# PROMPT 1: Fix Broken Contract Generation Pipeline

## Problem Summary

Contracts are generating blank — only the title page and signature block render, with no clause content in between. The root cause is that the `contract_templates` table's `base_clause_ids` column is empty (the seed SQL that populates it was never run, or it ran before clauses were inserted so the subqueries returned empty arrays). Additionally, the new 3-step wizard at `/agreements/new` creates project records but never triggers contract hydration with clauses. When you try to edit/resume a draft, it falls back to the old 9-step wizard at `/generate-contracts` which fails to load the draft.

## What Needs to Happen (in this order)

### Step 1: Verify and Fix contract_templates Data

The `contract_templates` table should have 3 rows (ONE, MANUFACTURING, ONSITE), each with a populated `base_clause_ids` array and `conditional_rules` JSONB. The seed file exists at `attached_assets/seed_contract_templates_1769046557884.sql` but likely needs to be re-run AFTER clauses are already in the database.

**Action:** Create a diagnostic API endpoint and a repair mechanism:

```
GET /api/system/diagnose-templates
```

This endpoint should:
1. Count rows in `clauses` table grouped by `contract_type` — report the counts
2. Count rows in `contract_templates` — report the counts
3. For each template row, check if `base_clause_ids` is null or empty array
4. If templates exist but have empty `base_clause_ids`, re-populate them using the same logic from the seed file:
   - ONE template: all clauses WHERE `contract_type = 'ONE'` AND `clause_code NOT LIKE '%-CRC'` AND `clause_code NOT LIKE '%-CMOS'` AND `clause_code != 'ONE-2.4-SOLAR'` AND `clause_code != 'ONE-2.5-BATTERY'`, ordered by `sort_order`
   - MANUFACTURING template: all clauses WHERE `contract_type = 'MANUFACTURING'` AND `clause_code != 'MFG-2.4-SOLAR'` AND `clause_code != 'MFG-2.5-BATTERY'`, ordered by `sort_order`
   - ONSITE template: all clauses WHERE `contract_type = 'ONSITE'` AND `clause_code NOT LIKE '%-CRC'` AND `clause_code NOT LIKE '%-CMOS'` AND `clause_code != 'ONSITE-6.5-BOND'`, ordered by `sort_order`
5. Also populate `conditional_rules` JSONB for each template using the same logic from the seed (CRC/CMOS clause codes, SOLAR, BATTERY, BOND conditions)
6. If template rows don't exist at all, INSERT them
7. Return a full diagnostic report showing: clause counts per type, template status, base_clause_ids count per template, and whether repair was needed

Also add a button on the Settings page or Dashboard that calls this endpoint so I can trigger it from the UI.

### Step 2: Fix the Contract Preview / HTML Generation

The contract preview endpoint (likely `GET /api/contracts/:id/preview` or the HTML preview page) needs to actually hydrate clauses. The flow should be:

1. Look up the contract record → get its `contractType` and `projectId`
2. Look up the corresponding `contract_templates` row by `contractType`
3. Get clause IDs from `base_clause_ids` + apply `conditional_rules` based on project's `serviceModel` (CRC vs CMOS)
4. Fetch all matching clauses from the `clauses` table, ordered by `sort_order`
5. Build the variable map from the project data (using the existing `mapProjectToVariables` function in `server/lib/mapper.ts` or `buildVariableMap` in `server/lib/contractGenerator.ts`)
6. Substitute `{{VARIABLE_NAME}}` placeholders in each clause's content
7. Render the full HTML document with all clause content between the title page and signature block

The existing code in `POST /api/contracts/generate-package` (contracts.ts ~line 611) already does steps 2-6 correctly. The issue is that this endpoint is not being called by the preview page, OR the contract record doesn't have the right data to trigger hydration.

### Step 3: Fix the Wizard Flow — Use the 9-Step Wizard Correctly

There are currently TWO wizard implementations that conflict:

**A) `agreements-new.tsx`** — A simple 3-step form (Project & Client → Entity Setup → Budget) at route `/agreements/new`. This creates a project record via `POST /api/projects` but does NOT create contract records, does NOT hydrate clauses, and does NOT trigger any contract generation. It's basically just a project creation form.

**B) `WizardShell.tsx` + `WizardContext.tsx`** — The full 9-step wizard at route `/generate-contracts`. This is the complete implementation with autosave, variable mapping, pricing calculations, multi-unit support, and contract generation. But it has a broken draft loading flow.

**Decision: Use the 9-step wizard as the primary contract creation flow.** It has all the plumbing. The 3-step form can remain as a quick-create shortcut but it MUST also trigger contract record creation and clause hydration after the project is saved.

**Fix the 9-step wizard draft loading:**
- When navigating to `/generate-contracts?projectId=X`, the wizard should load the existing project data into its state
- The `loadProjectId` prop is already passed from `generate-contracts.tsx` to `WizardProvider`
- Debug why `isLoadingDraft` gets stuck or why the error "could not load the saved draft" appears — likely the API call to load project data is failing or returning data in an unexpected format
- Check that `getProjectWithRelations` in `server/routes/helpers.ts` returns all required fields

**Fix the navigation from contracts list:**
- When clicking "Edit" on a contract in the contracts list, it should navigate to `/generate-contracts?projectId=X` (the 9-step wizard), NOT to `/agreements/new`
- Check the contracts page for the edit button's `href` or `navigate` call and fix the target route

### Step 4: Fix Signature Block Company Names

The signature block shows wrong company names. This is a variable mapping issue. Check:

1. The `COMPANY_NAME` variable — it should resolve to the Child LLC name (e.g., "Dvele Partners Smith LLC"), not "Dvele, Inc."
2. The `DVELE_LEGAL_NAME` variable — this should be "Dvele, Inc." (the parent company)
3. In `contractGenerator.ts` around line 1560, there's this mapping:
   ```
   map['COMPANY_NAME'] = llcName || 'Dvele, Inc.';
   ```
   If the LLC name isn't being passed from the wizard, it falls back to "Dvele, Inc." — which is the parent, not the project-specific entity
4. Make sure the wizard is saving the LLC name to the `llcs` table AND that the contract generation reads it back correctly via `getProjectWithRelations`

### Step 5: Wire Up the Full Flow End-to-End

After the above fixes, the complete flow should be:

1. User creates a new contract via the wizard (either quick-create 3-step or full 9-step)
2. Project record is created with all related data (client, LLC, financials, details, units)
3. Contract records are created for each contract type (ONE, MANUFACTURING, ONSITE)
4. Each contract is hydrated: template's `base_clause_ids` + `conditional_rules` → fetch clauses → substitute variables
5. Preview shows full contract with all clauses rendered
6. PDF download generates the complete document
7. Editing a contract loads the 9-step wizard with all saved data pre-populated

## Critical Context

- The `clauses` table should have ~276 rows across THREE contract types (ONE, MANUFACTURING, ONSITE)
- The `contract_templates` table should have 3 rows, one per contract type
- Each template's `base_clause_ids` should contain an array of clause IDs (integers) — this is probably EMPTY right now, which is why contracts are blank
- The `conditional_rules` column is JSONB that maps conditions like `SERVICE_MODEL` → `CRC`/`CMOS` to additional clause IDs
- Variable substitution uses `{{VARIABLE_NAME}}` syntax in clause content
- The `contractGenerator.ts` file has the full HTML generation pipeline including Puppeteer PDF conversion — this code works, the issue is upstream (no clauses being fed to it)

## Verification

After implementing, I should be able to:
1. Hit `/api/system/diagnose-templates` and see all 3 templates with populated `base_clause_ids`
2. Create a new contract through the wizard
3. Preview the contract and see all clause content rendered (not just title page + signature)
4. The signature block should show the correct LLC name as Company and client name as Client
5. Click Edit on any contract and land in the 9-step wizard with data pre-populated
6. Download a PDF with full contract content

## Do NOT

- Do not restructure the database schema — the existing `contract_templates` + `clauses` tables are the right design
- Do not remove the 9-step wizard — it's the fully plumbed implementation
- Do not create a new `templateClauses` junction table — the `base_clause_ids` array approach already works, it just needs to be populated
- Do not rewrite the contract generator — `contractGenerator.ts` works correctly when given clauses, the problem is that it's getting zero clauses because templates have empty `base_clause_ids`
