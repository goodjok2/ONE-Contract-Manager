# Replit Agent Prompt 09: Fix Exhibit G Reverse Order + Headerless Clause Rendering

## Context
We are working on the ONE Contract Manager — a contract generation system. Two rendering bugs need surgical fixes.

## RULES
1. **Surgical changes only.** Fix exactly what is described below. Do not refactor adjacent code.
2. **Do not create new files, pages, routes, or wizards.**
3. **Do not modify `WizardContext.tsx` or `WizardShell.tsx`.**
4. **Test after each change** — do not batch fixes.

---

## FIX 1: LIFO Bug in `server/routes/contracts.ts` (2 occurrences)

### Problem
Two functions in `server/routes/contracts.ts` use `stack.pop()` for document tree traversal. `pop()` is LIFO (last-in, first-out), which reverses document order. The fix is `stack.shift()` (FIFO — first-in, first-out).

This is the exact same bug that was already fixed in `scripts/ingest_exhibits.ts` (line 296 — already changed to `shift()`). The same pattern needs to be applied here.

### Changes

**File:** `server/routes/contracts.ts`

**Change 1 — Line ~259** (inside `ingestExhibitsFromDocument`):
```
// FIND THIS:
const node = stack.pop();

// REPLACE WITH:
const node = stack.shift();
```

**Change 2 — Line ~398** (inside `ingestStateDisclosuresFromDocument`):
```
// FIND THIS:
const node = stack.pop();

// REPLACE WITH:
const node = stack.shift();
```

### How to verify
Both changes are inside `transformDocument` callbacks inside `mammoth.convertToHtml()` calls. After the fix:
```bash
grep -n "stack.pop()" server/routes/contracts.ts
```
Should return **zero** results.

```bash
grep -n "stack.shift()" server/routes/contracts.ts
```
Should return **two** results (one per function).

---

## FIX 2: Re-ingest Exhibit G State Disclosures

### Problem
The `EXHIBIT_G_CONTENT` state disclosure record in the `state_disclosures` table was likely ingested with reversed content (due to the LIFO bug above). After fixing the LIFO bug, the disclosure data needs to be re-ingested so the content is in correct document order.

### Steps
1. Check if state disclosure ingestion is still disabled in `server/routes/contracts.ts` around line 483. If yes, temporarily enable it by:
   - Commenting out the `console.log("⚠️ State disclosure ingestion temporarily disabled")` line
   - Commenting out the `return 0;` line right after it
   - Adding the actual insert logic (upsert into `state_disclosures` table)

2. If you cannot easily re-enable the full ingestion, use this direct SQL approach instead:

```sql
-- First, check current state of the disclosure
SELECT id, state, code, length(content) as content_length 
FROM state_disclosures 
WHERE code = 'EXHIBIT_G_CONTENT';

-- If a record exists for CA, note the id for updating later
```

3. Then re-run the exhibit ingest to verify exhibits come through in A-G order:
```bash
npx tsx scripts/ingest_exhibits.ts server/templates/ONE_Agreement_Exhibits.docx
```

4. Generate a test contract and verify Exhibit G content sections appear in correct order (e.g., CA-1 before CA-2 before CA-3, etc.).

### Verification
Generate a ONE Agreement PDF and check that Exhibit G's state-specific provisions appear in the correct order — first sections should come first in the document.

---

## FIX 3: Headerless Clause Rendering

### Problem
In `server/lib/contractGenerator.ts`, the `renderBlockNode` function always outputs a numbered header for every clause, including clauses that should render as headerless body text (e.g., recital-like preamble paragraphs, introductory prose). When a clause has no meaningful `name` (empty string or null), it still renders as `"I. "` (a number with no text after it).

### Location
`server/lib/contractGenerator.ts`, function `renderBlockNode`, inside the `switch (hierarchyLevel)` block (around lines 1178–1230).

### Change
Add a headerless check **before** the switch statement. If a clause has no `name` and has `body_html` content, render it as body-only without numbering.

Find this block (around line 1170):
```typescript
  else {
    // Determine if this is a conspicuous block (adds bold styling)
    const isConspicuous = blockType === 'conspicuous';
    const conspicuousClass = isConspicuous ? ' conspicuous' : '';
    
    // Strip existing "Section X." prefix to avoid doubling
    const l2DisplayName = clauseName.replace(/^Section\s*\d+\.?\s*/i, '').trim();
    
    switch (hierarchyLevel) {
```

Replace with:
```typescript
  else {
    // Determine if this is a conspicuous block (adds bold styling)
    const isConspicuous = blockType === 'conspicuous';
    const conspicuousClass = isConspicuous ? ' conspicuous' : '';
    
    // Headerless clause: if no name, render body content only without numbering
    if (!clauseName.trim() && content) {
      html += `<div class="level-${hierarchyLevel}-body${conspicuousClass}">${content}</div>`;
    }
    else {
    // Strip existing "Section X." prefix to avoid doubling
    const l2DisplayName = clauseName.replace(/^Section\s*\d+\.?\s*/i, '').trim();
    
    switch (hierarchyLevel) {
```

And add a closing brace after the switch statement's closing brace. Find the line after the `default:` case that closes the switch (around line 1229 — the `}` that closes the switch block), and add one more `}` after it to close the new `else` block:

```typescript
      default:
        // Fallback for any other levels
        if (clauseName && content) {
          html += `<div class="level-${hierarchyLevel}${conspicuousClass}">${dynamicNumber ? dynamicNumber + '. ' : ''}${escapeHtml(clauseName)} ${content}</div>`;
        } else if (content) {
          html += `<div class="level-${hierarchyLevel}${conspicuousClass}">${content}</div>`;
        }
    }
    } // Close the else block for headerless check
  }
```

### Verification
After the fix:
1. Any clause in the database with an empty `name` field but populated `body_html` / `content` should render as body text without a numbered header
2. Clauses with both a `name` and `content` should continue to render exactly as before (numbered header + body)
3. Generate a contract and visually confirm that introductory/recital-like clauses render as prose without stray numbers

---

## Summary of all changes

| File | Change | Lines |
|------|--------|-------|
| `server/routes/contracts.ts` | `stack.pop()` → `stack.shift()` | ~259 |
| `server/routes/contracts.ts` | `stack.pop()` → `stack.shift()` | ~398 |
| `server/lib/contractGenerator.ts` | Add headerless clause check before switch | ~1170 |

Total: ~8 lines of new/changed code across 2 files.
