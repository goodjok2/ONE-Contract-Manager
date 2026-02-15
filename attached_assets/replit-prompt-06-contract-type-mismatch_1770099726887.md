# Prompt 6: Fix Contract Type Mismatch — Zero Clauses Returned

## The Problem

Contracts render with **only a title page and signature block — no contract body at all**. The entire 235-clause contract body is missing from the PDF.

## Root Cause

There is a **contract type value mismatch** between what's stored in the clauses and what the generator queries for.

**Clauses were ingested with:**
```
contract_types = '["ONE"]'
```
The import page sends `contractType: "ONE"` (from `{ value: "ONE", label: "ONE Agreement" }`), and the ingestion code stores `JSON.stringify([contractType])` → `'["ONE"]'`.

**The generator queries for:**
```
contract_types @> '["ONE Agreement"]'
```
Because `fetchClausesForContract()` in `server/lib/contractGenerator.ts` maps `'ONE'` → `'ONE Agreement'` via `contractTypeMap` before calling the API.

**The JSONB containment check:** `'["ONE"]' @> '["ONE Agreement"]'` → **FALSE**

Result: Zero clauses returned. Empty contract body.

## The Fix

**Remove the contractTypeMap translation in `fetchClausesForContract()`**. The function receives `'ONE'` from the caller, and the clauses store `'ONE'`. The mapping to human-readable names is wrong — it translates a matching value into a non-matching one.

In `server/lib/contractGenerator.ts`, in `fetchClausesForContract()`, change:

```typescript
// BEFORE (broken):
const contractTypeMap: Record<string, string> = {
  'ONE': 'ONE Agreement',
  'ONE_AGREEMENT': 'ONE Agreement',
  'one_agreement': 'ONE Agreement',
  'MANUFACTURING': 'Manufacturing Subcontract',
  'manufacturing_sub': 'Manufacturing Subcontract',
  'ONSITE': 'OnSite Subcontract',
  'onsite_sub': 'OnSite Subcontract',
};
const mappedType = contractTypeMap[contractType] || contractType;
const url = `http://localhost:5000/api/clauses?contractType=${encodeURIComponent(mappedType)}`;
```

```typescript
// AFTER (fixed):
// Normalize to the short-form codes that match what's stored in clauses.contract_types
// Clauses store: ["ONE"], ["MANUFACTURING"], ["ONSITE"]
// Callers may pass various formats, normalize them all to the stored format
const contractTypeNormalizer: Record<string, string> = {
  'ONE Agreement': 'ONE',
  'ONE_AGREEMENT': 'ONE',
  'one_agreement': 'ONE',
  'Manufacturing Subcontract': 'MANUFACTURING',
  'manufacturing_sub': 'MANUFACTURING',
  'OnSite Subcontract': 'ONSITE',
  'onsite_sub': 'ONSITE',
};
const normalizedType = contractTypeNormalizer[contractType] || contractType;
const url = `http://localhost:5000/api/clauses?contractType=${encodeURIComponent(normalizedType)}`;
```

This ensures that no matter what format the caller passes, it gets normalized to the short code that matches what's actually stored in the `contract_types` JSONB array.

## Also Check: fetchExhibitsForContract

The exhibit fetcher also filters by contract type. Verify it uses the same short codes:

```typescript
// In fetchExhibitsForContract:
exhibit.contractTypes?.includes(contractType.toUpperCase())
```

If exhibits store `["ONE"]` in their `contract_types`, this should work as-is since the caller passes `'ONE'`. But if exhibits were stored with `["ONE Agreement"]` or some other format, the same mismatch would occur. Verify the exhibit records use the same short codes.

## Verification

After applying this fix:

1. **Check server logs** when generating a contract. You should see:
   ```
   Fetching clauses from: http://localhost:5000/api/clauses?contractType=ONE
   Received 235 total clauses from API
   ```
   NOT `Received 0 total clauses from API`.

2. **Generate a contract PDF**. It should now be 40-60+ pages instead of 2 pages.

3. If it still shows 0 clauses, run this SQL to verify what's stored:
   ```sql
   SELECT DISTINCT contract_types FROM clauses LIMIT 5;
   ```
   The result tells you exactly what value to query for.

## Files to modify
- `server/lib/contractGenerator.ts` — fix `fetchClausesForContract()` type mapping

## Important
- Do NOT change the values stored in the clauses table
- Do NOT change the API endpoint query logic
- Only change the mapping in the generator so it queries with the value that matches what's stored
- This is a one-line conceptual fix: query for `"ONE"` instead of `"ONE Agreement"`
