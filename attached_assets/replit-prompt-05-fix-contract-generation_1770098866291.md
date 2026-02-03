# Prompt 5: Fix Contract Generation — Clauses Not Rendering + Exhibit Issues

A smoke test of end-to-end contract generation revealed that the PDF contains **only the title page, signature block, and exhibits** — the entire contract body (Articles 1-11, ~235 clauses) is missing. Additionally, exhibits have unresolved conditional markers and variable mismatches.

## Issue 1: CRITICAL — Clauses Not Rendering (field name mismatch)

**Root cause:** The `fetchClausesForContract()` function in `server/lib/contractGenerator.ts` fetches clauses from `GET /api/clauses`, which returns fields named `body_html` and `header_text`. But the `Clause` interface expects `content` and `name`. Since there's no mapping step, every clause arrives with `content: undefined` and `name: undefined`, so the renderer produces empty output for all 235 clauses.

**The API endpoint** (`GET /api/clauses` in `server/routes/contracts.ts` around line 2037) maps database rows like this:
```typescript
{
  id: row.id,
  clause_code: row.slug,
  parent_clause_id: row.parent_id,
  hierarchy_level: row.level,
  sort_order: row.order,
  header_text: row.header_text || '',  // ← API sends "header_text"
  body_html: row.body_html || '',      // ← API sends "body_html"
  contract_types: row.contract_types || [],
  tags: row.tags || [],
}
```

**The Clause interface** in `contractGenerator.ts` expects:
```typescript
interface Clause {
  name: string;       // ← expects "name" (gets undefined)
  content: string;    // ← expects "content" (gets undefined)
  // ... other fields
}
```

**Fix:** Add a mapping step in `fetchClausesForContract()` immediately after `const data = await response.json()`. Transform API response fields to match the Clause interface:

```typescript
const data = await response.json();
const rawClauses = data.clauses || [];

// Map API field names to Clause interface field names
const allClauses: Clause[] = rawClauses.map((c: any) => ({
  id: c.id,
  clause_code: c.clause_code,
  name: c.header_text || '',           // API: header_text → Interface: name
  content: c.body_html || '',          // API: body_html → Interface: content
  contract_type: Array.isArray(c.contract_types) ? c.contract_types[0] : c.contract_types,
  hierarchy_level: c.hierarchy_level,
  sort_order: c.sort_order,
  parent_clause_id: c.parent_clause_id,
  conditions: c.conditions || null,
  block_type: c.block_type || null,
  disclosure_code: c.disclosure_code || null,
  category: c.category || '',
  variables_used: c.variables_used || [],
  service_model_condition: c.service_model_condition || null,
}));
```

This is the #1 fix. Without this, nothing else matters — the contract body will always be empty.

## Issue 2: Unresolved `{{SITE_ADDRESS}}`

The exhibit content contains `{{SITE_ADDRESS}}` but the mapper produces `DELIVERY_ADDRESS`, not `SITE_ADDRESS`.

**Fix:** Add an alias in `server/lib/mapper.ts`:
```typescript
SITE_ADDRESS: projectDetails?.deliveryAddress 
  ? `${projectDetails.deliveryAddress}, ${projectDetails.deliveryCity || ''}, ${projectDetails.deliveryState || ''} ${projectDetails.deliveryZip || ''}`.trim()
  : "",
```

This is the full site address string. The exhibits expect a single formatted address line, not just street address.

## Issue 3: Unresolved `{{MILESTONE_SCHEDULE_TABLE}}`

This variable appears in Exhibit E (Limited Warranty section) but is not handled by the variable mapper or the component resolver.

**Fix:** Add `MILESTONE_SCHEDULE_TABLE` handling in the `resolveDynamicTableVariables()` function in `contractGenerator.ts`, or add it as a computed table in the component resolver. For now, add a simple stub in the mapper to prevent raw placeholder display:

```typescript
MILESTONE_SCHEDULE_TABLE: "", // TODO: Generate milestone schedule HTML table from milestones data
```

Then, once the milestone data is populated, build a proper HTML table from the `milestones` table data for the project.

## Issue 4: `[IF CLIENT HAS ELECTED...]` markers not processed in exhibits

The exhibits contain verbose conditional markers like:
```
[IF CLIENT HAS ELECTED 'CLIENT-RETAINED CONTRACTOR (CRC)':]
...content...
[IF CLIENT HAS ELECTED 'COMPANY-MANAGED ON-SITE SERVICES (CMOS)':]
...content...
```

These are NOT being processed because:
1. `processConditionalTags()` is only called on clause content (line 807), not on exhibit content in `renderExhibitsHTML()`
2. The tag format doesn't match anyway — the function expects `[IF CRC]...[/IF]` pairs, but the exhibit data has verbose one-line headers with no `[/IF]` closing tag

**Fix (two parts):**

**Part A:** Call `processConditionalTags()` on exhibit content in `renderExhibitsHTML()`, after variable substitution:
```typescript
// In renderExhibitsHTML(), after variable replacement loop:
if (currentServiceModel && (content.includes('[IF ') || content.includes('[IF]'))) {
  content = processConditionalTags(content, currentServiceModel);
}
```

**Part B:** Extend `processConditionalTags()` to also handle the verbose exhibit format. The exhibit content uses this pattern — the conditional marker acts as a section header followed by content until the next conditional marker or end of section:

```
[IF CLIENT HAS ELECTED 'CLIENT-RETAINED CONTRACTOR (CRC)':]
...CRC content...
[IF CLIENT HAS ELECTED 'COMPANY-MANAGED ON-SITE SERVICES (CMOS)':]
...CMOS content...
```

Add these patterns to `processConditionalTags()`:
```typescript
// Handle verbose conditional format from exhibits
// [IF CLIENT HAS ELECTED 'CLIENT-RETAINED CONTRACTOR (CRC)':] ... content until next [IF or end
if (model === 'CRC') {
  // Remove CMOS verbose blocks (from CMOS header to next [IF or end of content)
  result = result.replace(
    /\[IF CLIENT HAS ELECTED ['']COMPANY-MANAGED ON-SITE SERVICES \(CMOS\)['']:?\]([\s\S]*?)(?=\[IF CLIENT HAS ELECTED|$)/gi,
    ''
  );
  // Unwrap CRC verbose blocks (keep content, remove header)
  result = result.replace(
    /\[IF CLIENT HAS ELECTED ['']CLIENT-RETAINED CONTRACTOR \(CRC\)['']:?\]\s*/gi,
    ''
  );
}
if (model === 'CMOS') {
  // Remove CRC verbose blocks
  result = result.replace(
    /\[IF CLIENT HAS ELECTED ['']CLIENT-RETAINED CONTRACTOR \(CRC\)['']:?\]([\s\S]*?)(?=\[IF CLIENT HAS ELECTED|$)/gi,
    ''
  );
  // Unwrap CMOS verbose blocks (keep content, remove header)
  result = result.replace(
    /\[IF CLIENT HAS ELECTED ['']COMPANY-MANAGED ON-SITE SERVICES \(CMOS\)['']:?\]\s*/gi,
    ''
  );
}
```

**Important:** These verbose patterns should be processed BEFORE the short-form `[IF CRC]...[/IF]` patterns, so add them at the top of the function.

## Issue 5: Debug text in exhibits

The exhibits contain debug/placeholder text that should be removed:
- `"___________________________________________delete later"` (Exhibit B, page 7)
- `"_______________________________________delete below if table shows"` (Exhibit D, page 11)

These are in the exhibit content stored in the `exhibits` table. Either:
- Clean them from the database directly:
```sql
UPDATE exhibits 
SET content = REPLACE(content, '___________________________________________delete later', '')
WHERE content LIKE '%delete later%';

UPDATE exhibits 
SET content = REPLACE(content, '_______________________________________delete below if table shows', '')
WHERE content LIKE '%delete below if table shows%';
```
- Or add a cleanup step in `renderExhibitsHTML()` that strips debug markers:
```typescript
content = content.replace(/_+delete\s*(later|below[^)]*)/gi, '');
```

## Files to modify
- `server/lib/contractGenerator.ts` — field mapping in `fetchClausesForContract()` (Issue 1), call `processConditionalTags()` in `renderExhibitsHTML()` (Issue 4A), extend `processConditionalTags()` for verbose format (Issue 4B)
- `server/lib/mapper.ts` — add `SITE_ADDRESS` alias (Issue 2), add `MILESTONE_SCHEDULE_TABLE` stub (Issue 3)
- Database: clean debug text from exhibits (Issue 5)

## Verification

After fixing Issue 1, create a new contract via the wizard. The HTML preview should now contain:
1. Title page with project name and number
2. Full contract body — Articles 1 through 11 with section numbers, headers, and body text
3. Signature block
4. Exhibits A through G with content

Check that the PDF is more than 2 pages — a complete ONE Agreement should be 40-60+ pages. The smoke test PDF was 24 pages (exhibits only, no contract body).

## Priority order
1. **Issue 1** (field name mismatch) — fixes the blank contract body, must be done first
2. **Issue 4** (conditional tags in exhibits) — fixes the CRC/CMOS content duplication
3. **Issue 2** (SITE_ADDRESS) — fixes unresolved variable
4. **Issue 3** (MILESTONE_SCHEDULE_TABLE) — stubs the unresolved table variable
5. **Issue 5** (debug text) — cosmetic cleanup
