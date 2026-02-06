# REPLIT AGENT PROMPT — FIX HIERARCHY & NUMBERING TO MATCH DOCX TEMPLATE

## CONTEXT

The contract generator produces PDFs with the wrong section numbering scheme. The generated output uses Roman numeral sections (I, II, III...) with decimal sub-numbering (1, 1.1, 2.1), but the DOCX template (the legal source of truth) uses a completely different hierarchy. We need to match the template exactly.

## THE PROBLEM

**Current (WRONG) output:**
```
I. MASTER PURCHASE AGREEMENT          ← should not exist
II. RECITALS                          ← should not be numbered
   1. Recital 1                       ← should not have "Recital N" labels
   2. Recital 2
III. AGREEMENT CONSTRUCTION           ← should be "1)"
   1. Exhibits Incorporated           ← should be "a."
      1.1 Exhibit A                   ← should be "i."
      1.2 Exhibit B                   ← should be "ii."
   2. Exhibit-First Structure         ← should be "b."
   3. Order of Precedence             ← should be "c."
IV. SERVICES; SCOPE; CHANGE CONTROL   ← should be "2)"
   1. Services                        ← should be "a."
   2. Completion Model                ← should be "b."
      2.1 Company Completion Model    ← should be "i."
      2.2 Client GC Completion Model  ← should be "ii."
```

**Required (CORRECT) output matching DOCX template:**
```
RECITALS                               ← no number, just a heading
   WHEREAS, Company designs...         ← no number, no "Recital 1" label
   WHEREAS, Client owns...             ← no number
   WHEREAS, Client desires...          ← no number

NOW, THEREFORE, for good and valuable consideration, the Parties agree as follows:

1) AGREEMENT CONSTRUCTION
   a. Exhibits Incorporated. The following exhibits...
      i.   Exhibit A — Project Scope and Commercial Terms...
      ii.  Exhibit B — Home Plans, Specifications & Finishes...
      iii. Exhibit C — General Contractor / On-Site Scope...
      iv.  Exhibit D — Milestones & Schedule...
      v.   Exhibit E — Limited Warranty...
      vi.  Exhibit F — State-Specific Provisions...
   b. Exhibit-First Structure. All project- and customer-specific...
   c. Order of Precedence. If there is any conflict:
      i.   Exhibit A controls solely for project scope...
      ii.  Exhibits B and C control for technical requirements...
      iii. Exhibit D controls for schedule mechanics...
      iv.  Exhibit E controls for warranty terms...
      v.   Exhibit F controls solely to the extent required...
      vi.  This Agreement controls in all other respects
   d. Multiple Projects / Multiple Exhibit As. The Parties may execute...

2) SERVICES; SCOPE; CHANGE CONTROL
   a. Company will provide the services described...
   b. Completion Model; Separation of Responsibility...
      i.  If Company Completion Model is selected...
      ii. If Client GC Completion Model is selected...
   c. Change Orders; Substitutions
      i.  Change Orders. Any Client-requested changes...
      ii. Like-for-Like Substitutions. Company may make reasonable...
   d. What is Not Included. Unless expressly included...

3) FEES; PAYMENT; FINANCEABILITY
   a. Pricing and Payment Schedule...
   b. Green Light Conditions...
   c. Milestone Certification; Deemed Acceptance...
   d. Irrevocable Payment Obligation After Green Light...
   e. No Setoff / No Counterclaim...
   f. Reimbursables...
   g. Late Payments; Suspension...
   h. Assignment; Financing; Payment Directions...
   i. Financing Party Cure Rights (Non-Operator)...

[...continues through 14)]

14) SIGNATURES; COUNTERPARTS; AUTHORITY...
```

## THE NUMBERING SCHEME (3 levels only for the main body)

| Level | Format | Example | Resets |
|-------|--------|---------|--------|
| Level 1 (Section) | `N)` — Arabic numeral + closing paren | `1)`, `2)`, `3)`...`14)` | Never (sequential through whole document) |
| Level 2 (Sub-section) | `a.` — lowercase letter + period | `a.`, `b.`, `c.`...`i.` | Resets for each Level 1 parent |
| Level 3 (Sub-sub-section) | `i.` — lowercase Roman numeral + period | `i.`, `ii.`, `iii.`...`vi.` | Resets for each Level 2 parent |

**Important:** There is no deeper nesting in the template. The document only uses 3 levels for numbered items.

## SPECIFIC CHANGES REQUIRED

### Change 1: Fix the title page

The cover page / title should read:
```
Master Purchase Agreement - {{PROJECT_NUMBER}} - {{PROJECT_NAME}}
```
NOT "CONTRACT AGREEMENT". The title comes from the template's first line.

### Change 2: Remove the "I. MASTER PURCHASE AGREEMENT" wrapper

The generated PDF currently wraps everything in a `I. MASTER PURCHASE AGREEMENT` section header. This does not exist in the template. The document starts with the preamble paragraph ("This Master Factory Built Home Purchase Agreement...") directly after the title.

### Change 3: Fix RECITALS section

- Header should just say `RECITALS` — no Roman numeral, no numbering
- The three WHEREAS clauses should NOT have "Recital 1" / "Recital 2" / "Recital 3" labels
- Each WHEREAS clause stands alone as a paragraph beginning with "WHEREAS,"
- The "NOW, THEREFORE..." paragraph follows the WHEREAS clauses as a standalone line

### Change 4: Update `applyDynamicNumbering()` in `server/lib/contractGenerator.ts`

Replace the current numbering logic. The new scheme is:

```typescript
function applyDynamicNumbering(nodes: ClauseNode[]): void {
  function assignNumbers(siblings: ClauseNode[], parentLevel: number): void {
    let counter = 0;
    
    for (const node of siblings) {
      const level = node.hierarchyLevel || 1;
      counter++;
      
      switch (level) {
        case 1:
          // Level 1: "1)", "2)", "3)"...
          node.dynamicNumber = `${counter})`;
          break;
        case 2:
          // Level 2: "a.", "b.", "c."... (resets per L1 parent)
          node.dynamicNumber = `${toLowerAlpha(counter)}.`;
          break;
        case 3:
          // Level 3: "i.", "ii.", "iii."... (resets per L2 parent)
          node.dynamicNumber = `${toLowerRoman(counter)}.`;
          break;
        default:
          // Deeper levels: no numbering, just paragraph text
          node.dynamicNumber = '';
          break;
      }
      
      // Recurse into children — counter resets for each new group of siblings
      if (node.children && node.children.length > 0) {
        assignNumbers(node.children, level);
      }
    }
  }
  
  assignNumbers(nodes, 0);
}

function toLowerAlpha(n: number): string {
  // 1→a, 2→b, 3→c, ... 26→z
  return String.fromCharCode(96 + n);
}

function toLowerRoman(n: number): string {
  const romans = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
                   'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];
  return romans[n - 1] || n.toString();
}
```

### Change 5: Update `renderBlockNode()` to use the new numbering format

For each level, render as follows:

```typescript
case 1:
  // "1) AGREEMENT CONSTRUCTION" — number already includes ")"
  html += `<div class="level-1">${dynamicNumber} ${escapeHtml(clauseName.toUpperCase())}</div>`;
  if (content) html += `<div class="level-1-body">${content}</div>`;
  break;

case 2:
  // "a. Exhibits Incorporated. The following exhibits..."
  // Sub-section name is inline with the letter, followed by content on same line
  html += `<div class="level-2">`;
  html += `<span class="level-2-marker">${dynamicNumber}</span> `;
  if (clauseName) html += `${escapeHtml(clauseName)}`;
  if (clauseName && content) html += ` `; // space between name and content
  if (content) html += content;
  html += `</div>`;
  break;

case 3:
  // "i. Exhibit A — Project Scope and Commercial Terms..."
  html += `<div class="level-3">`;
  html += `<span class="level-3-marker">${dynamicNumber}</span> `;
  if (clauseName) html += `${escapeHtml(clauseName)}`;
  if (content) html += ` ${content}`;
  html += `</div>`;
  break;
```

### Change 6: Update CSS in `getContractStyles()`

```css
/* Level 1 (Section): Bold, left-aligned, normal case with number */
.level-1 {
  font-size: 12pt;
  font-weight: bold;
  color: #000000;
  margin-top: 18pt;
  margin-bottom: 8pt;
  page-break-after: avoid;
}

.level-1-body {
  font-size: 11pt;
  font-weight: normal;
  color: #000000;
  margin-bottom: 8pt;
  margin-left: 0.5in;
  line-height: 1.4;
}

/* Level 2 (Sub-section): Normal weight, indented with hanging indent */
.level-2 {
  font-size: 11pt;
  font-weight: normal;
  color: #000000;
  margin-bottom: 8pt;
  margin-left: 0.5in;
  padding-left: 0.3in;
  text-indent: -0.3in;
  line-height: 1.4;
}

.level-2-marker {
  font-weight: normal;
}

/* Level 3 (Sub-sub-section): Normal weight, more indented */
.level-3 {
  font-size: 11pt;
  font-weight: normal;
  color: #000000;
  margin-bottom: 6pt;
  margin-left: 1.0in;
  padding-left: 0.4in;
  text-indent: -0.4in;
  line-height: 1.4;
}

.level-3-marker {
  font-weight: normal;
}

/* Recitals section */
.recitals-header {
  font-size: 12pt;
  font-weight: bold;
  color: #000000;
  margin-top: 18pt;
  margin-bottom: 8pt;
}

.whereas-clause {
  font-size: 11pt;
  font-weight: normal;
  color: #000000;
  margin-bottom: 8pt;
  margin-left: 0.5in;
  line-height: 1.4;
}

.now-therefore {
  font-size: 11pt;
  font-weight: bold;
  color: #000000;
  margin-top: 12pt;
  margin-bottom: 12pt;
  line-height: 1.4;
}
```

### Change 7: Fix the RECITALS rendering

In the main HTML assembly function (likely `generateContractHTML()` or `assembleHTML()`), find where RECITALS are rendered and change the logic:

**Remove:**
- Any code that adds "II. RECITALS" with a Roman numeral
- Any code that labels WHEREAS clauses as "Recital 1", "Recital 2", etc.

**Replace with:**
```html
<div class="recitals-header">RECITALS</div>
<div class="whereas-clause">WHEREAS, Company designs and manufactures factory-built housing components...</div>
<div class="whereas-clause">WHEREAS, Client owns or controls...</div>
<div class="whereas-clause">WHEREAS, Client desires to engage Company...</div>
<div class="now-therefore">NOW, THEREFORE, for good and valuable consideration, the Parties agree as follows:</div>
```

### Change 8: Fix the section count

The template has exactly 14 numbered sections:
1. Agreement Construction
2. Services; Scope; Change Control
3. Fees; Payment; Financeability
4. Client Responsibilities
5. Company Responsibilities; Insurance
6. Schedule; Delays; Force Majeure; Pricing Adjustments
7. Limited Warranty; Disclaimer; Remedies
8. Intellectual Property; License; Publicity
9. Limitation of Liability
10. Milestone Review; No Obligation; Clarification
11. Default; Termination; Effects
12. Dispute Resolution; Governing Law
13. Miscellaneous
14. Signatures; Counterparts; Authority

There should be NO "I. MASTER PURCHASE AGREEMENT" as a section. The RECITALS are not numbered. Numbering starts at 1) for AGREEMENT CONSTRUCTION.

## CROSS-REFERENCE VARIABLE FIX

The template uses two cross-reference variables:
- `{{XREF_FEES_PAYMENT_SECTION}}` — should resolve to "3" (since Fees; Payment; Financeability is section 3)
- `{{XREF_BANKABILITY_SUBSECTIONS}}` — should resolve to "3.h" (since Assignment; Financing; Payment Directions is sub-section h of section 3)

In the variable mapper (`server/lib/mapper.ts`), add these mappings:
```typescript
map['XREF_FEES_PAYMENT_SECTION'] = '3';
map['XREF_BANKABILITY_SUBSECTIONS'] = '3.h';
```

Note: These use the NEW numbering scheme (3 = Fees section, 3.h = the 8th sub-item). The old PDF had "Sections 3.4–3.9" which was from the Roman numeral scheme.

## VERIFICATION

After implementing, generate a contract and verify:
1. ✅ Title page says "Master Purchase Agreement - [number] - [name]" (NOT "CONTRACT AGREEMENT")
2. ✅ No "I. MASTER PURCHASE AGREEMENT" wrapper section
3. ✅ RECITALS header has no number
4. ✅ WHEREAS clauses have no "Recital N" labels
5. ✅ First numbered section is `1) AGREEMENT CONSTRUCTION`
6. ✅ Sub-sections use `a. b. c.` lettering
7. ✅ Sub-sub-sections use `i. ii. iii.` Roman numerals
8. ✅ Last numbered section is `14) SIGNATURES; COUNTERPARTS; AUTHORITY`
9. ✅ No Roman numerals (I, II, III...) anywhere in section headers
10. ✅ No decimal numbering (1.1, 2.1, 3.1...) anywhere
11. ✅ Cross-references say "Section 3" and "Section 3.h" (not "3.4–3.9")
