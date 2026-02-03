# Prompt 4: Fix Schema Drift + Variable Mapping Gaps

## Part A: Schema Drift — Align Drizzle Schema with Actual Database

The Drizzle schema in `shared/schema.ts` has fallen out of sync with the actual Postgres database. Replit Agent has been adding tables and columns via raw SQL without updating the Drizzle schema. This causes two problems: (1) `drizzle-kit generate` will produce migrations that try to recreate things that already exist, and (2) any new Drizzle-based code won't have TypeScript types for the missing columns/tables.

### Missing Table: `template_clauses` — CRITICAL, BLOCKING CONTRACT GENERATION

This junction table links templates to clauses and is referenced in **18+ locations** across `contracts.ts`, `system.ts`, and `admin-import.ts`. It is NOT in the Drizzle schema **and likely does not exist in the database at all** — there is no migration that creates it, and no `CREATE TABLE` statement anywhere in the codebase. This is why the contract preview renders blank: the generation pipeline queries `template_clauses` for the template's clause playlist, gets zero rows (or an error), and produces an empty contract.

**Step 1: Add to `shared/schema.ts`:**
```typescript
export const templateClauses = pgTable("template_clauses", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .references(() => contractTemplates.id)
    .notNull(),
  clauseId: integer("clause_id")
    .references(() => clauses.id)
    .notNull(),
  orderIndex: integer("order_index").notNull(),
  organizationId: integer("organization_id")
    .references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Step 2: Push schema to DB to create the table:**
```bash
npm run db:push
```
This runs `drizzle-kit push` which will create the `template_clauses` table (and any other missing columns). **This is essential** — without this step the table won't exist and contracts will continue to render blank.

**Step 3: Populate `template_clauses` with existing data:**

The 235 clauses have already been ingested into the `clauses` table, and a template exists in `contract_templates`. But the junction table linking them is empty (or didn't exist). After creating the table, populate it:

```sql
-- Find the template and its base_clause_ids (which were populated during ingestion)
SELECT id, name, contract_type, base_clause_ids 
FROM contract_templates 
WHERE contract_type = 'one_agreement' AND is_active = true;

-- If base_clause_ids is populated, use it to backfill template_clauses:
INSERT INTO template_clauses (template_id, clause_id, order_index, organization_id)
SELECT 
  ct.id as template_id,
  unnest(ct.base_clause_ids::integer[]) as clause_id,
  row_number() OVER () - 1 as order_index,
  ct.organization_id
FROM contract_templates ct
WHERE ct.contract_type = 'one_agreement' AND ct.is_active = true
ON CONFLICT DO NOTHING;

-- If base_clause_ids is empty, fall back to linking all clauses in order:
INSERT INTO template_clauses (template_id, clause_id, order_index, organization_id)
SELECT 
  (SELECT id FROM contract_templates WHERE contract_type = 'one_agreement' AND is_active = true LIMIT 1),
  c.id,
  c."order",
  c.organization_id
FROM clauses c
WHERE c.contract_types::jsonb ? 'one_agreement'
ORDER BY c."order"
ON CONFLICT DO NOTHING;
```

Run `db:push` first, then run whichever SQL is appropriate based on the state of `base_clause_ids`. The agent should check the template's `base_clause_ids` to decide which path to take.

**Step 4: Verify the fix:**
```sql
-- Should return 235 rows
SELECT COUNT(*) FROM template_clauses;

-- Should show the first few clauses linked to the template
SELECT tc.order_index, c.header_text, left(c.body_html, 50) as preview
FROM template_clauses tc
JOIN clauses c ON c.id = tc.clause_id
ORDER BY tc.order_index
LIMIT 10;
```

After this, creating a new contract via the wizard should produce a populated HTML preview instead of blank.

### Missing Columns on `contract_templates`

The schema defines: `id, organizationId, name, contractType, version, content, isActive, createdAt, updatedAt`

But the running code uses these additional columns:
- `base_clause_ids` (integer array) — used in `system.ts` as a denormalized copy of template_clauses
- `conditional_rules` (jsonb) — used in `system.ts` for CRC/CMOS/SOLAR/BATTERY conditional logic
- `display_name` (text) — used in `contracts.ts`, `contract-templates.ts`, and `system.ts`
- `status` (text) — used in `system.ts` INSERT

**Update `contractTemplates` in `shared/schema.ts`:**
```typescript
export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .references(() => organizations.id)
    .notNull(),
  name: text("name").notNull(),
  displayName: text("display_name"),
  contractType: text("contract_type").notNull(),
  version: text("version").default("1.0"),
  status: text("status").default("active"),
  content: text("content"),
  baseClauseIds: jsonb("base_clause_ids"), // integer[] stored as jsonb
  conditionalRules: jsonb("conditional_rules"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});
```

### Missing Column on `clauses`

The `clauses` table in the schema has no `organizationId`, but `admin-import.ts` inserts with `organization_id`:

**Add to `clauses` in `shared/schema.ts`:**
```typescript
organizationId: integer("organization_id")
  .references(() => organizations.id),
```

### Verification

After updating `shared/schema.ts`, run:
```bash
npm run db:push
```

This runs `drizzle-kit push` which compares the Drizzle schema to the actual database and applies the necessary CREATE TABLE / ALTER TABLE statements. This is how this project syncs schema changes to the DB. It is safe — it will only add what's missing, never drop existing columns or tables.

Verify with:
```bash
# Check that template_clauses table now exists and has data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM template_clauses;"
# Should be ~235 after the backfill step above

# Check that contract_templates has the new columns
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'contract_templates' ORDER BY ordinal_position;"
```

**Do NOT drop or recreate any existing tables.** The goal is additive only.

---

## Part B: Variable Mapping Gaps — 13 Missing Variables

The variable mapper in `server/lib/mapper.ts` does not produce 13 variables that appear in the ingested ONE Agreement clauses. These will render as raw `{{PLACEHOLDER}}` text in contract preview/PDF.

### Gap 1: `VAR_ON_SITE_SELECTION_NAME` (naming mismatch)

The DOCX uses `{{VAR_ON_SITE_SELECTION_NAME}}` but the mapper produces `ON_SITE_SERVICES_SELECTION`.

**Fix:** Add an alias in the mapper output:
```typescript
VAR_ON_SITE_SELECTION_NAME: project.onSiteSelection === "CRC" 
  ? "Client-Retained Contractor" 
  : project.onSiteSelection === "CMOS" 
    ? "Company-Managed On-Site Services" 
    : "Not Selected",
```

This is the exact same logic as `ON_SITE_SERVICES_SELECTION` — just add it as a second key pointing to the same value.

### Gap 2: `EXHIBIT_A` through `EXHIBIT_G` (7 variables)

These appear after the signature block in the DOCX as standalone paragraphs: `{{EXHIBIT_A}}`, `{{EXHIBIT_B}}`, etc. They are meant to be resolved to the exhibit's full content (title + HTML body) from the `exhibits` table.

**These are NOT simple scalar variables** — they are content blocks like BLOCK_ components. They should be resolved by the `resolveComponentTags()` function, not the variable mapper.

**Add to `resolveComponentTags()` in `server/services/component-library.ts`:**
```typescript
// Resolve {{EXHIBIT_X}} tags from exhibits table
const exhibitTagRegex = /\{\{(EXHIBIT_[A-G])\}\}/g;
const exhibitMatches = [...new Set(content.matchAll(exhibitTagRegex))].map(m => m[1]);

for (const exhibitCode of exhibitMatches) {
  const exhibitResult = await pool.query(
    `SELECT name, content FROM exhibits 
     WHERE organization_id = $1 AND exhibit_code = $2 AND is_active = true`,
    [context.organizationId, exhibitCode]
  );
  
  if (exhibitResult.rows.length > 0) {
    const exhibit = exhibitResult.rows[0];
    const exhibitHtml = `<h2>${exhibit.name}</h2>\n${exhibit.content || ''}`;
    result = result.replace(
      new RegExp(`\\{\\{${exhibitCode}\\}\\}`, 'g'), 
      exhibitHtml
    );
  } else {
    // Leave placeholder — exhibits may not be populated yet
    console.warn(`⚠️ No exhibit found for {{${exhibitCode}}}`);
  }
}
```

### Gap 3: On-Site Preliminary Pricing (5 variables)

These appear in the CMOS/CRC replacement document's Exhibit A Phase 2 section:
- `{{SHIPPING_PRELIMINARY_PRICE}}`
- `{{INSTALLATION_PRELIMINARY_PRICE}}`
- `{{SITE_PREP_PRELIMINARY_PRICE}}`
- `{{UTILITIES_PRELIMINARY_PRICE}}`
- `{{COMPLETION_PRELIMINARY_PRICE}}`

These are line-item breakdowns of the on-site preliminary estimate. The `financials` table currently has `prelim_onsite` as a single lump sum but no line-item breakdown.

**For now, add these as stub mappings in the mapper** that return empty strings, with a TODO comment. These variables only appear in CMOS contracts (the Exhibit A Phase 2 on-site pricing section), and the detailed breakdown fields don't exist in the database yet.

```typescript
// TODO: Add on-site line-item breakdown fields to financials table
SHIPPING_PRELIMINARY_PRICE: "",
INSTALLATION_PRELIMINARY_PRICE: "",
SITE_PREP_PRELIMINARY_PRICE: "",
UTILITIES_PRELIMINARY_PRICE: "",
COMPLETION_PRELIMINARY_PRICE: "",
```

### Summary of changes

| Variable | Fix | File |
|---|---|---|
| `VAR_ON_SITE_SELECTION_NAME` | Add alias mapping | `server/lib/mapper.ts` |
| `EXHIBIT_A` through `EXHIBIT_G` | Resolve from exhibits table | `server/services/component-library.ts` |
| `SHIPPING_PRELIMINARY_PRICE` | Stub mapping (empty) | `server/lib/mapper.ts` |
| `INSTALLATION_PRELIMINARY_PRICE` | Stub mapping (empty) | `server/lib/mapper.ts` |
| `SITE_PREP_PRELIMINARY_PRICE` | Stub mapping (empty) | `server/lib/mapper.ts` |
| `UTILITIES_PRELIMINARY_PRICE` | Stub mapping (empty) | `server/lib/mapper.ts` |
| `COMPLETION_PRELIMINARY_PRICE` | Stub mapping (empty) | `server/lib/mapper.ts` |

## Files to modify
- `shared/schema.ts` — add `templateClauses` table, add missing columns to `contractTemplates` and `clauses`
- `server/lib/mapper.ts` — add `VAR_ON_SITE_SELECTION_NAME` alias and 5 stub on-site pricing variables
- `server/services/component-library.ts` — add `EXHIBIT_` tag resolution in `resolveComponentTags()`

## Important constraints
- After updating `shared/schema.ts`, run `npm run db:push` (`drizzle-kit push`) to sync schema to the database. This is the standard workflow for this project.
- After `db:push` creates the `template_clauses` table, immediately backfill it with the existing clause-to-template linkage data (see Step 3 above). Without this, contracts will still render blank.
- Do NOT change any raw SQL queries — they already work against the DB as-is
- Stub variables should be clearly marked with TODO comments for future implementation
- Test by creating a new contract via the wizard after all changes — the HTML preview should now show the full contract content instead of blank
