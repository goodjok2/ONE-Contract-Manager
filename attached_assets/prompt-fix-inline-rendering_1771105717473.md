# REPLIT AGENT PROMPT — FIX INLINE HEADER + CONTENT RENDERING

## PROBLEM

In the generated contract PDF, Level 2 and Level 3 items render the header (clause name) and body content on SEPARATE LINES with extra indentation on the body. They should be on the SAME LINE.

### Current (WRONG) rendering:

```
a. Exhibits Incorporated.
   The following exhibits are attached to and incorporated into this Agreement:
```

```
i. Exhibit A.
   Project Scope and Commercial Terms (Project/Phase Matrix; Milestones; Pricing;
   Payment Schedule; Completion Model election)
```

```
b. Exhibit-First Structure.
   All project- and customer-specific descriptions and commercial terms are set forth
   in Exhibit A and related technical/operational Exhibits.
```

### Required (CORRECT) rendering:

```
a. Exhibits Incorporated. The following exhibits are attached to and incorporated into this Agreement:
```

```
i. Exhibit A. Project Scope and Commercial Terms (Project/Phase Matrix; Milestones; Pricing;
   Payment Schedule; Completion Model election)
```

```
b. Exhibit-First Structure. All project- and customer-specific descriptions and commercial terms are
   set forth in Exhibit A and related technical/operational Exhibits.
```

### Also for items with NO header (just body content):

Current (WRONG):
```
i.
   Exhibit A controls solely for project scope, phasing, milestones, pricing, payment terms,
   delivery parameters, and site/completion model elections.
```

Required (CORRECT):
```
i. Exhibit A controls solely for project scope, phasing, milestones, pricing, payment terms,
   delivery parameters, and site/completion model elections.
```

## ROOT CAUSE

In `server/lib/contractGenerator.ts`, the `renderBlockNode()` function (or equivalent rendering function) is generating SEPARATE HTML elements for the header and body content. The header goes in one element (like a `<div>` or `<span>`) and the body goes in another, which causes a line break between them.

## THE FIX

Find the rendering function for Level 2 and Level 3 nodes. The fix is to put the header and content in a SINGLE block element, using inline spans for the header styling.

### For Level 2 (a. b. c.) — Find and replace the rendering logic:

**Look for code that produces something like this:**
```html
<div class="level-2">
  <span class="level-2-marker">a.</span>
  <span class="level-2-header">Exhibits Incorporated.</span>
</div>
<div class="level-2-body">The following exhibits...</div>
```

**Or this pattern:**
```html
<div class="level-2">
  <span>a.</span> <span>Exhibits Incorporated.</span>
</div>
<div class="level-2-content">The following exhibits...</div>
```

**Replace with this — everything in ONE div:**
```html
<div class="level-2"><span class="level-2-marker">a. </span><span class="level-2-header">Exhibits Incorporated.</span> The following exhibits are attached to and incorporated into this Agreement:</div>
```

### For Level 3 (i. ii. iii.) WITH a header:
```html
<div class="level-3"><span class="level-3-marker">i. </span><span class="level-3-header">Exhibit A.</span> Project Scope and Commercial Terms...</div>
```

### For Level 3 WITHOUT a header (content only):
```html
<div class="level-3"><span class="level-3-marker">i. </span>Exhibit A controls solely for project scope, phasing...</div>
```

## DETAILED CODE CHANGES

In `renderBlockNode()` (or whatever function renders individual clause nodes to HTML), find the Level 2 case. It likely looks something like this:

```typescript
case 2:
  html += `<div class="level-2">`;
  html += `<span class="level-2-marker">${dynamicNumber}</span> `;
  if (clauseName) {
    html += `<span class="level-2-header">${escapeHtml(clauseName)}</span>`;
  }
  html += `</div>`;  // <-- THIS CLOSES THE DIV
  if (content) {
    html += `<div class="level-2-body">${content}</div>`;  // <-- NEW DIV = NEW LINE
  }
  break;
```

**Change to:**
```typescript
case 2:
  html += `<div class="level-2">`;
  html += `<span class="level-2-marker">${dynamicNumber} </span>`;
  if (clauseName) {
    html += `<span class="level-2-header">${escapeHtml(clauseName)}</span>`;
    if (content) {
      html += ` ${content}`;  // Content follows header on SAME LINE, space between
    }
  } else if (content) {
    // No header — content starts right after the marker
    html += content;
  }
  html += `</div>`;  // Single div wraps everything
  break;
```

**Do the exact same for Level 3:**
```typescript
case 3:
  html += `<div class="level-3">`;
  html += `<span class="level-3-marker">${dynamicNumber} </span>`;
  if (clauseName) {
    html += `<span class="level-3-header">${escapeHtml(clauseName)}</span>`;
    if (content) {
      html += ` ${content}`;
    }
  } else if (content) {
    html += content;
  }
  html += `</div>`;
  break;
```

**And for Level 1 — keep the header and body separate** (section headers like "1) AGREEMENT CONSTRUCTION" should be standalone bold lines, with any body text below). Level 1 is the only level where a line break between header and body is correct.

## CSS CHANGES

Update the CSS in `getContractStyles()`:

```css
/* Level 2: single block with hanging indent so wrapped lines align with text start */
.level-2 {
  font-size: 11pt;
  font-weight: normal;
  color: #000000;
  margin-bottom: 8pt;
  margin-left: 0.5in;
  padding-left: 0.3in;
  text-indent: -0.3in;
  line-height: 1.5;
}

/* Level 2 marker (a. b. c.) */
.level-2-marker {
  font-weight: normal;
}

/* Level 2 header: underlined, non-bold, inline */
.level-2-header {
  text-decoration: underline;
  font-weight: normal;
}

/* REMOVE any .level-2-body or .level-2-content class that has its own margin/padding/indent */
/* These should NOT exist as separate styled elements anymore */

/* Level 3: same pattern, deeper indent */
.level-3 {
  font-size: 11pt;
  font-weight: normal;
  color: #000000;
  margin-bottom: 6pt;
  margin-left: 1.0in;
  padding-left: 0.4in;
  text-indent: -0.4in;
  line-height: 1.5;
}

.level-3-marker {
  font-weight: normal;
}

.level-3-header {
  text-decoration: underline;
  font-weight: normal;
}
```

**Key CSS principle:** The `text-indent: -0.3in` with `padding-left: 0.3in` creates a hanging indent. The FIRST line starts 0.3in to the left (where the marker "a." goes), and all subsequent wrapped lines align with the start of the text after the marker. This means:

```
a. Exhibits Incorporated. The following exhibits are attached to and
   incorporated into this Agreement:
   ↑ wrapped text aligns here, under "E" in "Exhibits"
```

## ALSO REMOVE SEPARATE BODY DIVS

Search the entire `renderBlockNode()` function for any code that renders body content in a separate `<div>`. Common patterns to look for and remove:

```typescript
// REMOVE patterns like these:
html += `<div class="level-2-body">${content}</div>`;
html += `<div class="level-2-content">${content}</div>`;
html += `<p class="clause-body">${content}</p>`;
```

ALL content for Levels 2 and 3 must be inside the same `<div>` as the marker and header. No separate body element.

## EDGE CASE: CONTENT WITH SUB-ITEMS

Some Level 2 items have both inline content AND child nodes (Level 3 sub-items). For example:

```
c. Order of Precedence. If there is any conflict:
   i. Exhibit A controls solely for...
   ii. Exhibits B and C control for...
```

In this case:
- "Order of Precedence." is the header (underlined)
- "If there is any conflict:" is the inline content (same line as header)
- The Level 3 items (i. ii. iii.) are CHILDREN rendered separately below

The children are NOT part of the inline content — they're separate nodes in the clause tree that render as their own `<div class="level-3">` elements. Only the direct body content of the Level 2 node goes inline.

## VERIFICATION

Generate a contract and check:

1. ✅ Section 1.a: "a. Exhibits Incorporated. The following exhibits..." — ALL ON ONE LINE
2. ✅ Section 1.b: "b. Exhibit-First Structure. All project-..." — ALL ON ONE LINE  
3. ✅ Section 1.c: "c. Order of Precedence. If there is any conflict:" — ALL ON ONE LINE
4. ✅ Section 1.c.i: "i. Exhibit A controls solely for..." — content starts right after "i."
5. ✅ Wrapped text aligns with start of text content, NOT with the marker
6. ✅ Level 1 headers (like "1) AGREEMENT CONSTRUCTION") are still on their own line
7. ✅ No empty lines between markers and their content anywhere in the document
8. ✅ Headers are underlined, non-bold
9. ✅ Body text is plain (not underlined, not bold) — unless it's legal imperative ALL CAPS text
