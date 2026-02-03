# Prompt 7A: Fix BLOCK Component Resolution + Missing Variables

The contract body renders but has unresolved BLOCK components showing as `[MISSING: BLOCK_*]` and several variables not resolving. This prompt fixes the data pipeline issues.

## Issue 1: BLOCK Components Show as [MISSING]

**Symptom:** `[MISSING: BLOCK_ON_SITE_SCOPE_RECITAL]` and `[MISSING: BLOCK_ON_SITE_SCOPE_1_1_B]` appear in the generated PDF instead of the CRC/CMOS conditional content.

**Root cause:** `resolveBlockTags()` in `contractGenerator.ts` and `renderComponent()` in `component-library.ts` only handle two hardcoded tag names: `BLOCK_ON_SITE_SCOPE` and `BLOCK_WARRANTY_SECTION`. But the clause content uses **specific suffixed names** like `BLOCK_ON_SITE_SCOPE_RECITAL`, `BLOCK_ON_SITE_SCOPE_1_1_B`, `BLOCK_ON_SITE_SCOPE_3_12`, `BLOCK_PAYMENT_FLOW`, `BLOCK_RESPONSIBILITY_MATRIX`, `BLOCK_GC_REQUIREMENTS`. These don't match the hardcoded names, so they fall through to the `[MISSING]` placeholder.

The `component_library` DB table was seeded with 12 records using these exact tag names (6 tag names × CRC/CMOS variants). But `resolveBlockTags()` never queries the DB — it calls the synchronous `renderComponent()` which only checks the `HARDCODED_COMPONENTS` dictionary.

**Fix:** Replace the hardcoded block resolution with a **generic approach** that queries the `component_library` DB table for ANY `{{BLOCK_*}}` tag. Use a preload-and-cache pattern (same pattern already used for state disclosures):

**Step 1:** Add a block component cache and preload function in `contractGenerator.ts`:

```typescript
// Block component cache (populated before variable replacement)
let blockComponentCache: Map<string, string> = new Map();
```

**Step 2:** In `generateContract()`, after fetching clauses (Step 1), add a preload step:

```typescript
// Step 1.7: Preload BLOCK components from DB for this service model
blockComponentCache = new Map();
const allBlockTags = new Set<string>();
for (const clause of clauses) {
  const blockMatches = (clause.content || '').matchAll(/\{\{(BLOCK_[A-Z0-9_]+)\}\}/g);
  for (const match of blockMatches) {
    allBlockTags.add(match[1]);
  }
}
if (allBlockTags.size > 0) {
  console.log(`📦 Preloading ${allBlockTags.size} BLOCK components for ${currentServiceModel}...`);
  for (const tagName of allBlockTags) {
    const content = await fetchComponentFromDB(tagName, 1, currentServiceModel);
    if (content) {
      blockComponentCache.set(tagName, content);
      console.log(`  ✓ ${tagName}: ${content.length} chars`);
    } else {
      console.warn(`  ⚠️ ${tagName}: not found in component_library`);
    }
  }
  console.log(`✓ Preloaded ${blockComponentCache.size} of ${allBlockTags.size} BLOCK components`);
}
```

Note: `fetchComponentFromDB` is already exported from `component-library.ts` — import it if not already imported.

**Step 3:** Replace `resolveBlockTags()` to use the cache:

```typescript
function resolveBlockTags(content: string, serviceModel: string): string {
  let result = content;
  
  // Find ALL {{BLOCK_*}} tags in the content
  const blockPattern = /\{\{(BLOCK_[A-Z0-9_]+)\}\}/g;
  let match;
  while ((match = blockPattern.exec(content)) !== null) {
    const tagName = match[1];
    const cachedContent = blockComponentCache.get(tagName);
    if (cachedContent) {
      result = result.replace(new RegExp(`\\{\\{${tagName}\\}\\}`, 'g'), cachedContent);
    }
    // If not in cache, it will fall through to the unreplaced variable handler
    // which shows [MISSING: TAG_NAME] — that's the correct behavior for truly missing components
  }
  
  return result;
}
```

**Step 4:** Remove the two hardcoded `BLOCK_ON_SITE_SCOPE` / `BLOCK_WARRANTY_SECTION` checks from the old `resolveBlockTags()`. The generic approach handles all tags.

## Issue 2: Missing Variable Mappings

Add these to `server/lib/mapper.ts`:

### PROJECT_STATE_CODE
State civil/commercial code reference used in warranty and termination sections.

Add a helper function and map entry:
```typescript
function getStateCodeReference(state: string): string {
  const stateCodes: Record<string, string> = {
    'CA': 'Cal. Civ. Code § 1797',
    'California': 'Cal. Civ. Code § 1797',
    'TX': 'Tex. Prop. Code § 401',
    'Texas': 'Tex. Prop. Code § 401',
    'AZ': 'Ariz. Rev. Stat. § 32-1101',
    'Arizona': 'Ariz. Rev. Stat. § 32-1101',
    'MT': 'Mont. Code Ann. § 30-2-313',
    'Montana': 'Mont. Code Ann. § 30-2-313',
    'CO': 'Colo. Rev. Stat. § 5-1-101',
    'Colorado': 'Colo. Rev. Stat. § 5-1-101',
    'NV': 'Nev. Rev. Stat. § 113',
    'WA': 'Wash. Rev. Code § 64.50',
    'NM': 'N.M. Stat. § 47-8-1',
    'UT': 'Utah Code § 57-1-1',
    'ID': 'Idaho Code § 54-4501',
    'OR': 'Or. Rev. Stat. § 701.005',
  };
  return stateCodes[state] || '';
}
```

Map entry:
```typescript
PROJECT_STATE_CODE: getStateCodeReference(project.state || ''),
```

### PROJECT_COUNTY
```typescript
PROJECT_COUNTY: projectDetails?.county || "",
```
If the `county` field doesn't exist on projectDetails, add it as an empty string stub. It can be populated from project data entry later.

### PROJECT_FEDERAL_DISTRICT
```typescript
PROJECT_FEDERAL_DISTRICT: getFederalDistrict(project.state || ''),
```

Add helper:
```typescript
function getFederalDistrict(state: string): string {
  const districts: Record<string, string> = {
    'CA': 'Southern District of California',
    'California': 'Southern District of California',
    'TX': 'Western District of Texas',
    'AZ': 'District of Arizona',
    'MT': 'District of Montana',
    'CO': 'District of Colorado',
    'NV': 'District of Nevada',
    'WA': 'Western District of Washington',
    'NM': 'District of New Mexico',
    'UT': 'District of Utah',
    'ID': 'District of Idaho',
    'OR': 'District of Oregon',
  };
  return districts[state] || '';
}
```

### Pricing Variable Stubs
Ensure these exist in the mapper output even when pricing engine has no data, so they render as `[NOT PROVIDED]` instead of raw `{{PLACEHOLDER}}`:
```typescript
PRELIMINARY_CONTRACT_PRICE: "",
PRELIMINARY_OFFSITE_PRICE: "",
PRELIMINARY_ONSITE_PRICE: "",
```
These will be overwritten by the pricing engine in the generate-package route when unit data exists.

### SIGNATURE_BLOCK_TABLE
This is a structural HTML component. Add it as a computed value in the mapper:

```typescript
SIGNATURE_BLOCK_TABLE: buildSignatureBlock(
  /* companyName */ companyEntity?.name || project.name || '',
  /* clientName */ client 
    ? `${client.firstName || ''} ${client.lastName || ''}`.trim() 
    : '',
  /* clientTitle */ client?.entityType || ''
),
```

Add the helper function:
```typescript
function buildSignatureBlock(companyName: string, clientName: string, clientTitle: string): string {
  return `
<div style="margin-top: 40px;">
  <p><strong>COMPANY:</strong></p>
  <p>${companyName}</p>
  <p style="margin-top: 20px;">Signature: ___________________________</p>
  <p>Name (Print): ________________________</p>
  <p>Title: _______________________________</p>
  <p>Date: ________________________________</p>
  <br/>
  <p><strong>CLIENT:</strong></p>
  <p>${clientName}</p>
  <p style="margin-top: 20px;">Signature: ___________________________</p>
  <p>Name (Print): ________________________</p>
  <p>Title: ${clientTitle || ''}_______________</p>
  <p>Date: ________________________________</p>
</div>
  `.trim();
}
```

### Add all new variables to the validation list
Add `PROJECT_STATE_CODE`, `PROJECT_COUNTY`, `PROJECT_FEDERAL_DISTRICT`, `PRELIMINARY_CONTRACT_PRICE`, `PRELIMINARY_OFFSITE_PRICE`, `PRELIMINARY_ONSITE_PRICE`, and `SIGNATURE_BLOCK_TABLE` to the appropriate validation category arrays at the top of `mapper.ts`.

## Issue 3: Database Cleanup

Run these SQL fixes:

**Fix malformed tag name** (space in variable name from ingestion):
```sql
UPDATE clauses 
SET body_html = REPLACE(body_html, '{{Client Signature_TABLE}}', '{{SIGNATURE_BLOCK_TABLE}}')
WHERE body_html LIKE '%Client Signature_TABLE%';
```

**Remove debug comment in clause content:**
```sql
UPDATE clauses 
SET body_html = REGEXP_REPLACE(
  body_html, 
  '!{2,}[^!]*?!{2,}\s*', 
  '', 
  'g'
)
WHERE body_html LIKE '%!!!!%';
```

**Fix Exhibit H reference** (should be Exhibit G):
```sql
UPDATE clauses 
SET body_html = REPLACE(body_html, 'Exhibit H', 'Exhibit G')
WHERE body_html LIKE '%receipt of Exhibit H%';
```

## Files to modify
- `server/lib/contractGenerator.ts` — block component cache, preload step, generic resolveBlockTags
- `server/lib/mapper.ts` — add PROJECT_STATE_CODE, PROJECT_COUNTY, PROJECT_FEDERAL_DISTRICT, pricing stubs, SIGNATURE_BLOCK_TABLE, helper functions
- `server/services/component-library.ts` — no changes needed (fetchComponentFromDB already works)
- Database — three SQL cleanup statements

## Verification
1. Generate a contract. BLOCK sections should show CRC content (the test project uses CRC), not `[MISSING: BLOCK_*]`
2. Server logs should show: `📦 Preloading N BLOCK components...` with `✓` for each found tag
3. Variables like PROJECT_STATE_CODE should resolve if the project has a state set (e.g., "CA" → "Cal. Civ. Code § 1797")
4. Signature block should render as formatted HTML with company and client names
5. The `{{Client Signature_TABLE}}` malformed tag should no longer appear
