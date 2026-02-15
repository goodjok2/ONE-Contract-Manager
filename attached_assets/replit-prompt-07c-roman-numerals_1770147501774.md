# Prompt 7C: Change L1 to Upper Roman Numerals + Restart Numbering

This is a targeted formatting update to the hierarchy rendering. Prompt 7B already implemented the 8-level hierarchy system. This prompt makes two specific changes:

## Change 1: L1 Uses Upper Roman Numerals

The top-level items (L1 / hierarchy_level = 1) are structural divisions of the entire document, not numbered articles. They should use upper-case Roman numerals:

```
I.   DOCUMENT SUMMARY
II.  RECITALS
III. ATTACHMENTS
IV.  AGREEMENT
```

**In `applyDynamicNumbering()`**, change the L1 numbering from Arabic integers to upper Roman numerals:

```typescript
// L1: Upper Roman numerals
case 1:
  node.dynamicNumber = toUpperRoman(counter);  // I, II, III, IV
  break;
```

Add this helper function (or reuse the existing `toRoman` if present, but ensure it outputs UPPERCASE):

```typescript
function toUpperRoman(num: number): string {
  const map: [number, string][] = [
    [1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],
    [100,'C'],[90,'XC'],[50,'L'],[40,'XL'],
    [10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']
  ];
  let result = '';
  for (const [value, numeral] of map) {
    while (num >= value) { result += numeral; num -= value; }
  }
  return result;
}
```

**In `renderBlockNode()`**, update the L1 rendering to display the Roman numeral with a period:

```typescript
case 1:
  html += `<div class="level-1">${dynamicNumber}. ${escapeHtml(clauseName.toUpperCase())}</div>`;
  // dynamicNumber is now "I", "II", "III", etc.
  break;
```

Output examples:
```
I. DOCUMENT SUMMARY
II. RECITALS
III. ATTACHMENTS
IV. AGREEMENT
```

## Change 2: L2 Numbering Restarts Under Each L1

Currently L2 numbering may continue sequentially across the entire document. Instead, it should **restart at 1** under each L1 (Roman) section. So:

```
I. DOCUMENT SUMMARY
  1. What the Client is Signing
  2. Peace of Mind Guarantee

II. RECITALS
  1. Company is engaged...          ← restarts at 1
  2. Company will engage...

III. ATTACHMENTS
  1. Exhibit A...                   ← restarts at 1

IV. AGREEMENT
  1. Scope of Services              ← restarts at 1
    1.1 Overview
      (a) Offsite Services
  2. Fees, Purchase Price...
  3. Client Responsibilities
```

This should already work correctly if `applyDynamicNumbering()` resets its counter for each group of siblings (each recursive call gets its own counter). Verify that the L2 counter resets when recursing into each L1's children. The key code pattern:

```typescript
function assignNumbers(nodes: BlockNode[], parentNumber: string = ''): void {
  let counter = 0;  // ← This resets for each group of siblings
  for (const node of nodes) {
    if (node.isHidden) continue;
    counter++;
    const level = node.clause.hierarchy_level ?? 1;
    
    switch (level) {
      case 1:
        node.dynamicNumber = toUpperRoman(counter);
        break;
      case 2:
        node.dynamicNumber = `${counter}`;  // Just "1", "2", "3" — no parent prefix needed
        break;
      case 3:
        node.dynamicNumber = `${parentNumber}.${counter}`;  // "1.1", "1.2"
        break;
      // ... L4-L8 unchanged from 7B
    }
    
    if (node.children && node.children.length > 0) {
      assignNumbers(node.children, node.dynamicNumber);
    }
  }
}
```

**Important**: Since L2 numbering restarts under each L1, L2's `dynamicNumber` is just `"1"`, `"2"`, `"3"` — NOT `"IV.1"`, `"IV.2"`. The Roman numeral parent is not prepended. This keeps clause references clean: "Section 1, Scope of Services" not "Section IV.1".

L3 then builds on L2: `"1.1"`, `"1.2"`, `"2.1"` — the dot notation starts at L2/L3, not L1.

## No CSS Changes Needed

The L1 CSS from Prompt 7B already styles it as bold, blue, centered, uppercase with a border. Roman numerals will look correct with the existing styling.

## Files to modify
- `server/lib/contractGenerator.ts`:
  - `applyDynamicNumbering()` — L1 uses `toUpperRoman()`, L2 number is just the counter (no parent prefix)
  - `renderBlockNode()` — L1 renders as `"I. NAME"` not `"1. NAME"`
  - Add `toUpperRoman()` helper if not already present

## Verification

Generate a contract and confirm:
```
I. DOCUMENT SUMMARY                    ← Upper Roman
  1. What the Client is Signing        ← Arabic, starts at 1
    1.1 Services:                      ← Dot notation from L2
      (a) Offsite Services             ← Alpha

II. RECITALS                           ← Roman continues
  1. Company is engaged...             ← Arabic RESTARTS at 1
  2. Company will engage...

III. ATTACHMENTS                       ← Roman continues
  1. Exhibit A                         ← Arabic RESTARTS at 1

IV. AGREEMENT                          ← Roman continues
  1. Scope of Services                 ← Arabic RESTARTS at 1
    1.1 Overview
  2. Fees, Purchase Price              ← Arabic continues within IV
    2.1 Design & Engineering Fee
```
