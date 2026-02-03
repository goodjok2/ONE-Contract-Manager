# Prompt 7B: Fix Contract Hierarchy, Numbering, and 8-Level Styling

The contract body renders with 235 clauses but the visual hierarchy is broken — most levels render with the same blue bold styling, numbering doesn't reflect the tree depth, and indentation is flat.

## THE AUTHORITATIVE 8-LEVEL FORMATTING GUIDE

This is the definitive numbering and hierarchy spec. Follow it exactly.

| Level | Name | Numbering Format | Example | Parent | Indentation |
|-------|------|-----------------|---------|--------|-------------|
| L1 | Article | `1.` (integer) | **1. GENERAL PROVISIONS** | None (top-level) | 0 (left flush) |
| L2 | Section | `1.1` (dot notation) | **1.1 Scope of Work** | Child of L1 | 0 |
| L3 | Clause | `1.1.1` (dot notation) | **1.1.1 Inclusions** | Child of L2 | 0 |
| L4 | Sub-Clause | `(a)` (lower alpha) | **(a) Materials** | Child of L3 | Indented |
| L5 | Paragraph | `(i)` (lower roman) | **(i) Raw Lumber** | Child of L4 | More indented |
| L6 | Sub-Paragraph | `1.` (integer, resets) | **1. Grade A** | Child of L5 | More indented |
| L7 | Item | `(A)` (upper alpha) | **(A) Pine** | See note* | More indented |
| L8 | Sub-Item | `-` (dash) | **- Treated** | See note* | Most indented |

*L7 and L8 are special-purpose levels that may appear contextually.

### Key Rules:
- **L1-L3 use cumulative dot notation**: L1 = `1.`, L2 = `1.1`, L3 = `1.1.1`
- **L4 switches to `(a)` lower alpha** — resets for each L3 parent
- **L5 switches to `(i)` lower roman** — resets for each L4 parent  
- **L6 switches to `1.` integer** — resets for each L5 parent
- **L7 switches to `(A)` upper alpha** — resets per parent
- **L8 uses `-` dash** — no numbering sequence, just a bullet dash

## Problem 1: Visual Styling — Everything Looks the Same

The CSS makes levels 3 and 4 both blue and bold. The contract reads as a wall of blue bold text.

**Fix the CSS** in `getContractStyles()`. Use these exact styles:

```css
/* Level 1 (Article): Bold, uppercase, blue, centered, border */
.level-1 {
  font-size: 14pt;
  font-weight: bold;
  color: #1a73e8;
  text-transform: uppercase;
  text-align: center;
  margin-top: 28pt;
  margin-bottom: 14pt;
  padding-bottom: 6pt;
  border-bottom: 2px solid #1a73e8;
  page-break-after: avoid;
}

/* Level 2 (Section): Bold, blue, left-aligned */
.level-2 {
  font-size: 12pt;
  font-weight: bold;
  color: #1a73e8;
  margin-top: 20pt;
  margin-bottom: 10pt;
  page-break-after: avoid;
}

/* Level 3 (Clause): Bold, blue, smaller */
.level-3 {
  font-size: 11pt;
  font-weight: bold;
  color: #1a73e8;
  margin-top: 14pt;
  margin-bottom: 8pt;
  page-break-after: avoid;
}

/* Level 4 (Sub-Clause): Bold, BLACK, indented with hanging indent */
.level-4 {
  font-size: 11pt;
  font-weight: bold;
  color: #000000;
  margin-bottom: 8pt;
  margin-left: 0.35in;
  padding-left: 0.35in;
  text-indent: -0.35in;
}

/* Level 5 (Paragraph): Normal weight, black, more indented */
.level-5 {
  font-size: 11pt;
  font-weight: normal;
  color: #000000;
  margin-bottom: 8pt;
  margin-left: 0.7in;
  padding-left: 0.3in;
  text-indent: -0.3in;
  line-height: 1.4;
}

/* Level 6 (Sub-Paragraph): Normal weight, black, more indented */
.level-6 {
  font-size: 11pt;
  font-weight: normal;
  color: #000000;
  margin-bottom: 8pt;
  margin-left: 1.0in;
  padding-left: 0.25in;
  text-indent: -0.25in;
  line-height: 1.4;
}

/* Level 7 (Item): Normal weight, black, deeply indented */
.level-7 {
  font-size: 11pt;
  font-weight: normal;
  color: #000000;
  margin-bottom: 6pt;
  margin-left: 1.25in;
  padding-left: 0.3in;
  text-indent: -0.3in;
  line-height: 1.4;
}

/* Level 8 (Sub-Item): Normal weight, black, most indented, dash marker */
.level-8 {
  font-size: 11pt;
  font-weight: normal;
  color: #000000;
  margin-bottom: 6pt;
  margin-left: 1.5in;
  padding-left: 0.2in;
  text-indent: -0.2in;
  line-height: 1.4;
}
```

**Key rule: Blue stops at Level 3.** Levels 4-8 are all black text. This creates a clear visual break between structural headers (L1-L3) and content (L4-L8).

**IMPORTANT: There is currently a separate `.conspicuous` CSS class used for bold legal disclaimers.** Some clauses have `block_type = 'conspicuous'` regardless of their hierarchy_level. Keep the `.conspicuous` class as-is (bold, black) and apply it in addition to the level class when `block_type === 'conspicuous'`. The hierarchy level determines indentation and numbering; the conspicuous flag determines bold styling.

## Problem 2: Numbering Logic

Fix `applyDynamicNumbering()` to follow the 8-Level spec. The function walks the block tree recursively and assigns `dynamicNumber` to each node.

```
Numbering rules:
- L1: Sequential integer among L1 siblings: "1", "2", "3"
- L2: Parent L1 number + "." + sequential: "1.1", "1.2", "2.1"
- L3: Parent L2 number + "." + sequential: "1.1.1", "1.1.2", "2.1.1"
- L4: Lower alpha, resets per L3 parent: "a", "b", "c"
- L5: Lower roman, resets per L4 parent: "i", "ii", "iii", "iv"
- L6: Integer, resets per L5 parent: "1", "2", "3"
- L7: Upper alpha, resets per parent: "A", "B", "C"
- L8: Dash (no sequence): "-"
```

Helper functions needed:
```typescript
function toRomanNumeral(num: number): string {
  const map: [number, string][] = [
    [1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],
    [100,'c'],[90,'xc'],[50,'l'],[40,'xl'],
    [10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']
  ];
  let result = '';
  for (const [value, numeral] of map) {
    while (num >= value) { result += numeral; num -= value; }
  }
  return result;
}

function toAlpha(num: number): string {
  // 1='a', 2='b', ..., 26='z'
  return String.fromCharCode(96 + num);
}

function toUpperAlpha(num: number): string {
  // 1='A', 2='B', ..., 26='Z'
  return String.fromCharCode(64 + num);
}
```

The recursive numbering assignment:
```typescript
function assignNumbers(nodes: BlockNode[], parentNumber: string = ''): void {
  let counter = 0;
  for (const node of nodes) {
    if (node.isHidden) continue;
    counter++;
    const level = node.clause.hierarchy_level ?? 1;
    
    switch (level) {
      case 1:
        node.dynamicNumber = `${counter}`;
        break;
      case 2:
        node.dynamicNumber = `${parentNumber}.${counter}`;
        break;
      case 3:
        node.dynamicNumber = `${parentNumber}.${counter}`;
        break;
      case 4:
        node.dynamicNumber = toAlpha(counter);     // a, b, c
        break;
      case 5:
        node.dynamicNumber = toRomanNumeral(counter); // i, ii, iii
        break;
      case 6:
        node.dynamicNumber = `${counter}`;          // 1, 2, 3 (resets)
        break;
      case 7:
        node.dynamicNumber = toUpperAlpha(counter);  // A, B, C
        break;
      case 8:
        node.dynamicNumber = '-';                    // dash
        break;
    }
    
    // Recurse into children with current node's number as parent prefix
    if (node.children && node.children.length > 0) {
      assignNumbers(node.children, node.dynamicNumber);
    }
  }
}
```

Note: `counter` resets for each group of siblings (each call to `assignNumbers`), which is correct — L4 `(a)` resets for each L3 parent, L5 `(i)` resets for each L4 parent, etc.

## Problem 3: Renderer Must Format Numbers Per Level

Fix `renderBlockNode()` so each level displays its number in the correct format:

```
L1: "1. GENERAL PROVISIONS"          → number + ". " + name (uppercase)
L2: "1.1 Scope of Work"              → number + " " + name
L3: "1.1.1 Inclusions"               → number + " " + name
L4: "(a) Materials"                   → "(" + number + ") " + name
L5: "(i) Raw Lumber"                  → "(" + number + ") " + name
L6: "1. Grade A"                      → number + ". " + name
L7: "(A) Pine"                        → "(" + number + ") " + name
L8: "- Treated"                       → "- " + name
```

For each level, the renderer should produce HTML like:

```typescript
switch (hierarchyLevel) {
  case 1:
    html += `<div class="level-1">${dynamicNumber}. ${escapeHtml(clauseName.toUpperCase())}</div>`;
    if (content) html += `<div class="level-1-body">${content}</div>`;
    break;
  case 2:
    // Strip existing "Section N." prefix to avoid doubling
    const l2Name = clauseName.replace(/^Section\s*\d+\.?\s*/i, '').trim();
    html += `<div class="level-2">${dynamicNumber} ${escapeHtml(l2Name)}</div>`;
    if (content) html += `<div class="level-2-body">${content}</div>`;
    break;
  case 3:
    html += `<div class="level-3">${dynamicNumber} ${escapeHtml(clauseName)}</div>`;
    if (content) html += `<div class="level-3-body">${content}</div>`;
    break;
  case 4:
    html += `<div class="level-4">(${dynamicNumber}) ${clauseName ? escapeHtml(clauseName) : ''}${content ? ' ' + content : ''}</div>`;
    break;
  case 5:
    html += `<div class="level-5">(${dynamicNumber}) ${clauseName ? escapeHtml(clauseName) : ''}${content ? ' ' + content : ''}</div>`;
    break;
  case 6:
    html += `<div class="level-6">${dynamicNumber}. ${clauseName ? escapeHtml(clauseName) : ''}${content ? ' ' + content : ''}</div>`;
    break;
  case 7:
    html += `<div class="level-7">(${dynamicNumber}) ${clauseName ? escapeHtml(clauseName) : ''}${content ? ' ' + content : ''}</div>`;
    break;
  case 8:
    html += `<div class="level-8">- ${clauseName ? escapeHtml(clauseName) : ''}${content ? ' ' + content : ''}</div>`;
    break;
}
```

For levels 4-8, header and body content flow inline (on the same line). For levels 1-3, header is a standalone block element with body below it.

## Problem 4: "Section X." Prefix Doubling

Some L2 clauses have `header_text` that already includes "Section 1." from ingestion. The renderer must strip this before adding the dynamic number:

```typescript
// For L2:
const displayName = clauseName.replace(/^Section\s*\d+\.?\s*/i, '').trim();
```

## Problem 5: Conspicuous Block Handling

Clauses with `block_type === 'conspicuous'` (typically legal disclaimers in ALL CAPS) should:
- Still use their hierarchy level for indentation and numbering
- Additionally apply bold styling via the `conspicuous` CSS class
- Render as: `<div class="level-${hierarchyLevel} conspicuous">...</div>`

## Summary of Changes

In `server/lib/contractGenerator.ts`:

1. **CSS** (`getContractStyles()`): Replace all level styles with the spec above. Blue for L1-L3, black for L4-L8. Progressive indentation.

2. **Numbering** (`applyDynamicNumbering()`): Implement the exact numbering scheme: L1=`1.`, L2=`1.1`, L3=`1.1.1`, L4=`(a)`, L5=`(i)`, L6=`1.`, L7=`(A)`, L8=`-`

3. **Renderer** (`renderBlockNode()`): Each of the 8 levels gets its own rendering case with proper number formatting. L1-L3 headers are block elements; L4-L8 are inline header+body.

## Verification

Generate a contract and check this exact pattern:
```
1. DOCUMENT SUMMARY                         ← L1: blue, bold, centered, uppercase
  1.1 What the Client is Signing            ← L2: blue, bold, left
    1.1.1 Services:                         ← L3: blue, bold
      (a) Offsite Services: Design...       ← L4: BLACK, bold, indented, alpha
      (b) On-Site Services: Shipping...     ← L4: BLACK, bold, indented, alpha
    1.1.2 Initial Payment:                  ← L3: blue, bold (counter continues)
```

And for deeper nesting:
```
      (a) Materials                         ← L4
        (i) Raw Lumber                      ← L5: roman, more indented
          1. Grade A                        ← L6: integer resets
            (A) Pine                        ← L7: upper alpha
              - Treated                     ← L8: dash, most indented
```
