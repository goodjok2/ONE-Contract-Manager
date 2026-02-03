# Replit Agent Prompts — Exhibit Ingestion + Import Template Cleanup

## Context for All Prompts

The ONE Contract Manager has an exhibit ingest pipeline (`scripts/ingest_exhibits.ts`) that parses a DOCX file containing Exhibits A-G and loads them into the `exhibits` database table. The contract generator already has full exhibit rendering support — it fetches exhibits by contract type, renders them with page breaks, substitutes variables, resolves `[STATE_DISCLOSURE:]` tags, and processes `[IF CRC/CMOS]` conditionals. The exhibits table is currently empty, which is why generated contracts show `[MISSING: EXHIBIT_A]` through `[MISSING: EXHIBIT_G]`.

---

## Prompt 1: Fix Ingest Script — Add organizationId

**Goal:** The ingest script doesn't set `organizationId` when inserting exhibits, but `preloadExhibits()` in `contractGenerator.ts` filters by `organization_id = $1`. This means ingested exhibits won't be found by the preloader.

**What to change:**

In `scripts/ingest_exhibits.ts`, update the `db.insert(exhibits).values()` call (around line 462) to include `organizationId: 1`:

```typescript
// BEFORE (line 462-470):
await db.insert(exhibits).values({
  letter: exhibit.letter,
  title: exhibit.title,
  content: exhibit.content,
  isDynamic: exhibit.isDynamic,
  disclosureCode: exhibit.disclosureCode,
  contractTypes: exhibit.contractTypes,
  sortOrder: exhibit.sortOrder,
  isActive: true,
});

// AFTER:
await db.insert(exhibits).values({
  organizationId: 1,
  letter: exhibit.letter,
  title: exhibit.title,
  content: exhibit.content,
  isDynamic: exhibit.isDynamic,
  disclosureCode: exhibit.disclosureCode,
  contractTypes: exhibit.contractTypes,
  sortOrder: exhibit.sortOrder,
  isActive: true,
});
```

**Only this one change. Do not modify any other files.**

---

## Prompt 2: Fix Ingest Script — Default contractTypes to ONE Only

**Goal:** The ingest script defaults all exhibits to `['ONE', 'MANUFACTURING', 'ONSITE']`, but these exhibits from the ONE Agreement DOCX are specific to the ONE Agreement. MFG and ONSITE subcontracts will have their own exhibits later.

**What to change:**

In `scripts/ingest_exhibits.ts`, update the default `contractTypes` assignment (around line 369) from:

```typescript
contractTypes: ['ONE', 'MANUFACTURING', 'ONSITE'],
```

to:

```typescript
contractTypes: ['ONE'],
```

**Only this one change. Do not modify any other files.**

---

## Prompt 3: Upload Exhibits DOCX and Run Ingest

**Goal:** Place the ONE_Agreement_Exhibits.docx file in the `server/templates/` directory and run the ingest script.

**Steps:**

1. Upload the file `ONE_Agreement_Exhibits.docx` to `server/templates/` (it should sit alongside `ONE_Agreement_Master.docx`)

2. Run the ingest script:
```bash
npx tsx scripts/ingest_exhibits.ts server/templates/ONE_Agreement_Exhibits.docx
```

3. Verify the output shows 7 exhibits parsed (A through G) with content lengths > 0 for all except possibly Exhibit B (which is a stub).

4. Verify in the Exhibits admin page that all 7 exhibits now appear with Code, Name, and Contract Types = ONE.

**Do not modify any code. Just place the file and run the script.**

---

## Prompt 4: Fix Import Template Dropdown — Remove CMOS/CRC Options

**Goal:** The "Import Contract Template" page at `/admin/import-templates` has a Contract Type dropdown with 5 options: ONE Agreement, CMOS Contract, CRC Contract, Onsite Sub, Manufacturing Sub. The CMOS and CRC options should not exist because CRC vs CMOS is a service model selection on individual clauses, not a contract type. The contract generator's type definition is `contractType: 'ONE' | 'MANUFACTURING' | 'ONSITE'`. If someone uploads clauses as "CMOS" type, the generator will never find them.

**What to change:**

In `client/src/pages/admin/import-templates.tsx`, update the `CONTRACT_TYPES` array (around line 47-53) from:

```typescript
const CONTRACT_TYPES = [
  { value: "ONE", label: "ONE Agreement" },
  { value: "CMOS", label: "CMOS Contract" },
  { value: "CRC", label: "CRC Contract" },
  { value: "ONSITE", label: "Onsite Sub" },
  { value: "MFG", label: "Manufacturing Sub" },
];
```

to:

```typescript
const CONTRACT_TYPES = [
  { value: "ONE", label: "ONE Agreement" },
  { value: "ONSITE", label: "Onsite Sub" },
  { value: "MFG", label: "Manufacturing Sub" },
];
```

**Only this one change. Do not modify any other files.**

---

## Prompt 5: Verify Exhibit Rendering in Generated Contract

**Goal:** After exhibits are ingested, generate a test ONE Agreement PDF and verify that exhibits render instead of showing `[MISSING: EXHIBIT_X]` tags.

**Steps:**

1. Navigate to a test project (e.g., project 2026-496 or 2026-497)
2. Generate the ONE Agreement PDF
3. Scroll to the end of the document — after the signature block, each exhibit should now render on its own page with:
   - "EXHIBIT A" centered header
   - Exhibit title below
   - Full exhibit content with variables (some may still show as `{{VAR}}` if the project has empty fields — that's expected)
4. Specifically check:
   - Exhibit A should show `{{PRICING_BREAKDOWN_TABLE}}` placeholder text (confirms tables need wiring)
   - Exhibit E (Limited Warranty) should have the most content
   - Exhibit F should show `{{VAR_ON_SITE_SELECTION_NAME}}` or its resolved value
   - Exhibit G should show `[STATE_DISCLOSURE:EXHIBIT_G_CONTENT]` tag (state disclosure wiring)

**This is a verification step only. No code changes.**

---

## Notes

- Prompts 1 and 2 are tiny surgical fixes (1 line each) and should be done before Prompt 3
- Prompt 3 requires the actual DOCX file to be in the project — you'll need to upload it to Replit
- Prompt 4 is independent and can be done anytime
- Prompt 5 is verification only, do after Prompt 3
