# REPLIT AGENT PROMPT — CONSOLIDATE TABLE SYSTEM INTO UNIFIED COMPONENT LIBRARY

## OVERVIEW

The contract generator currently has THREE separate systems for producing tables in contracts, each with different styling and different admin accessibility. We are consolidating them into ONE system: the Component Library. After this prompt, every table in the generated contract comes from the same pipeline, uses the same styling, and is editable from the admin UI.

### Current State (3 systems):

1. **`tableGenerators.ts`** — Hardcoded TypeScript functions producing nicely styled HTML tables (dark blue headers, striped rows, inline CSS). Creates `PRICING_BREAKDOWN_TABLE`, `PAYMENT_SCHEDULE_TABLE`, `UNIT_DETAILS_TABLE`. Called by mapper.ts. NOT admin-editable.

2. **`component_library` DB table** — Stores BLOCK components (CRC/CMOS conditional content) and some raw HTML table content. Resolves `{{BLOCK_*}}` tags. Has basic admin CRUD but ugly styling (gray `#f2f2f2` headers, no striping).

3. **`table_definitions` DB table + `tableBuilders.ts`** — Structured table definitions (columns/rows as JSON) with a renderer. Has a column editor UI but is partially disconnected from the contract generator. Uses `#f2f2f2` gray headers.

4. **Inline HTML in `contractGenerator.ts`** — Signature blocks, A.1 overview table, A.2 property matrix, etc. built directly in the renderer. NOT admin-editable at all.

### Target State (1 system):

All tables flow through the Component Library with:
- **Standardized styling** matching the nice `tableGenerators.ts` look (dark headers, striped rows)
- **Admin-editable** structure and content
- **One resolver** that handles both static tables and data-driven tables
- **One clean UI** to manage everything

---

## SECTION 1: STANDARDIZE TABLE STYLING

**Goal:** Create a single shared table style function that ALL table generators use. This is the fastest visual win.

### Step 1.1: Create shared table style constants

**File:** `server/lib/tableStyles.ts` (NEW FILE)

```typescript
/**
 * Shared table styling for all contract tables.
 * Every table in the generated contract should use these functions
 * to ensure visual consistency.
 */

export const TABLE_STYLES = {
  // Dark blue header — matches the "nice" tables from tableGenerators.ts
  headerBg: '#2c3e50',
  headerText: '#ffffff',
  headerFont: 'font-weight: bold; font-size: 10pt; font-family: Arial, sans-serif;',
  
  // Alternating row colors
  evenRowBg: '#ffffff',
  oddRowBg: '#f8f9fa',
  
  // Borders
  border: '1px solid #dee2e6',
  
  // Cell padding
  cellPadding: 'padding: 8px 12px;',
  
  // Table wrapper
  tableBase: 'width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; font-family: Arial, sans-serif;',
};

/**
 * Wraps content in a styled table with header and body rows.
 * This is the SINGLE function all table generators should call.
 */
export function buildStyledTable(options: {
  columns: { header: string; width?: string; align?: string }[];
  rows: { cells: string[]; isBold?: boolean }[];
  caption?: string;
}): string {
  const { columns, rows, caption } = options;

  const headerCells = columns.map(col => {
    const width = col.width ? `width: ${col.width};` : '';
    const align = col.align ? `text-align: ${col.align};` : 'text-align: left;';
    return `<th style="background-color: ${TABLE_STYLES.headerBg}; color: ${TABLE_STYLES.headerText}; ${TABLE_STYLES.headerFont} ${TABLE_STYLES.cellPadding} ${width} ${align} border-bottom: 2px solid ${TABLE_STYLES.headerBg};">${col.header}</th>`;
  }).join('');

  const bodyRows = rows.map((row, idx) => {
    const bgColor = idx % 2 === 0 ? TABLE_STYLES.evenRowBg : TABLE_STYLES.oddRowBg;
    const fontWeight = row.isBold ? 'font-weight: bold;' : '';
    const cells = row.cells.map((cell, colIdx) => {
      const align = columns[colIdx]?.align ? `text-align: ${columns[colIdx].align};` : 'text-align: left;';
      const width = columns[colIdx]?.width ? `width: ${columns[colIdx].width};` : '';
      return `<td style="background-color: ${bgColor}; ${TABLE_STYLES.cellPadding} ${fontWeight} ${align} ${width} border-bottom: ${TABLE_STYLES.border};">${cell}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  let html = '';
  if (caption) {
    html += `<p style="font-weight: bold; font-size: 11pt; margin-bottom: 4px;">${caption}</p>`;
  }
  html += `<table style="${TABLE_STYLES.tableBase}">`;
  html += `<thead><tr>${headerCells}</tr></thead>`;
  html += `<tbody>${bodyRows}</tbody>`;
  html += `</table>`;
  return html;
}

/**
 * Builds a compact signature block table (used for Section 14 and Exhibit A).
 */
export function buildSignatureBlock(options: {
  leftTitle: string;
  rightTitle: string;
  companyName: string;
  compact?: boolean;
}): string {
  const { leftTitle, rightTitle, companyName, compact } = options;
  const lineStyle = 'border-bottom: 1px solid #000; padding-bottom: 14px; margin-bottom: 6px;';
  const labelStyle = 'font-size: 10pt; color: #555; margin-bottom: 2px;';
  const spacing = compact ? 'padding: 8pt;' : 'padding: 12pt;';

  function sigColumn(title: string): string {
    return `
      <td style="width: 47%; vertical-align: top; ${spacing}">
        <p style="font-weight: bold; font-size: 11pt; margin-bottom: 10pt;">${title}</p>
        <p style="margin-bottom: 4pt;">${companyName}</p>
        <p style="${labelStyle}">By:</p><div style="${lineStyle}"></div>
        <p style="${labelStyle}">Name:</p><div style="${lineStyle}"></div>
        <p style="${labelStyle}">Title:</p><div style="${lineStyle}"></div>
        <p style="${labelStyle}">Date:</p><div style="${lineStyle}"></div>
        <div style="margin-top: 16pt;">
          <p style="margin-bottom: 4pt;">Client</p>
          <p style="${labelStyle}">By:</p><div style="${lineStyle}"></div>
          <p style="${labelStyle}">Name:</p><div style="${lineStyle}"></div>
          <p style="${labelStyle}">Title (if applicable):</p><div style="${lineStyle}"></div>
          <p style="${labelStyle}">Date:</p><div style="${lineStyle}"></div>
        </div>
      </td>`;
  }

  return `
    <table style="width: 100%; margin-top: 20pt; border-collapse: collapse;">
      <tr>
        ${sigColumn(leftTitle)}
        <td style="width: 6%;"></td>
        ${sigColumn(rightTitle)}
      </tr>
    </table>`;
}
```

### Step 1.2: Update `tableGenerators.ts` to use shared styles

**File:** `server/lib/tableGenerators.ts`

Import and use the shared function:

```typescript
import { buildStyledTable } from './tableStyles';
```

Refactor each generator function to use `buildStyledTable()` instead of hand-building HTML. For example, `generatePricingTableHtml()` should become:

```typescript
export function generatePricingTableHtml(pricingSummary: any, contractType: string): string {
  if (!pricingSummary) return '<p><em>Pricing data not available</em></p>';

  const breakdown = pricingSummary.breakdown;
  const rows: { cells: string[]; isBold?: boolean }[] = [];

  rows.push({ cells: ['Design / Pre-Production Fee', formatCurrencyWhole(breakdown.totalDesignFee), 'Due at signing'] });
  rows.push({ cells: ['Offsite Services (Factory)', formatCurrencyWhole(breakdown.totalOffsite), 'Per Phase'] });

  if (contractType !== 'MANUFACTURING') {
    rows.push({ cells: ['Offsite Services (Delivery/Assembly)', formatCurrencyWhole(breakdown.totalLogistics || 0), 'Delivery/transport'] });
  }

  if (contractType === 'ONE' && pricingSummary.serviceModel === 'CMOS') {
    rows.push({ cells: ['On-site Services', formatCurrencyWhole(breakdown.totalOnsite), 'CMOS only'] });
  }

  rows.push({ cells: ['Reimbursables (if any)', '', `At cost plus admin fee of ${pricingSummary.adminFeePercent || 10}%`] });
  rows.push({ cells: ['Total Project Price', formatCurrencyWhole(pricingSummary.contractValue), 'Subject to Change Orders'], isBold: true });

  return buildStyledTable({
    columns: [
      { header: 'Stage / Component', width: '40%' },
      { header: 'Amount', width: '25%', align: 'right' },
      { header: 'Notes', width: '35%' },
    ],
    rows,
  });
}
```

Do the same for `generatePaymentScheduleHtml()` and `generateUnitDetailsHtml()`.

**Keep the existing function signatures and return types.** Only change the internal HTML generation to use `buildStyledTable()`.

### Step 1.3: Update `tableBuilders.ts` to use shared styles

**File:** `server/lib/tableBuilders.ts`

Replace the inline style in `renderDynamicTable()` so that custom tables from `table_definitions` also use the shared styling:

```typescript
import { TABLE_STYLES } from './tableStyles';
```

Change the header row style from:
```html
<tr style="background-color: #f2f2f2;">
```
to:
```html
<tr style="background-color: ${TABLE_STYLES.headerBg}; color: ${TABLE_STYLES.headerText};">
```

And add alternating row backgrounds to the body rows using `TABLE_STYLES.evenRowBg` / `TABLE_STYLES.oddRowBg`.

### Step 1.4: Update signature blocks in `contractGenerator.ts`

**File:** `server/lib/contractGenerator.ts`

Import `buildSignatureBlock` from the shared styles:

```typescript
import { buildSignatureBlock } from './tableStyles';
```

Find the Section 14 signature block rendering and replace the inline HTML with:

```typescript
const signatureHtml = buildSignatureBlock({
  leftTitle: 'COMPANY:',
  rightTitle: 'CLIENT:',
  companyName: companyLegalName,
});
```

Find the Exhibit A signature block rendering and replace with:

```typescript
const exhibitASignatureHtml = buildSignatureBlock({
  leftTitle: 'Accepted and agreed:',
  rightTitle: 'Post Design Approval (Greenlight):',
  companyName: 'DVELE, INC.',
  compact: true,
});
```

### Step 1.5: Update exhibit inline tables

In `contractGenerator.ts`, find where the A.1 overview table, A.2 property matrix, and other exhibit tables are built inline. Import and use `buildStyledTable()` for each one.

For the A.1 overview table (which is a two-column key/value table), use:

```typescript
const overviewHtml = buildStyledTable({
  columns: [
    { header: 'Item', width: '35%' },
    { header: 'Entry', width: '65%' },
  ],
  rows: [
    { cells: ['Client Type', buyerType] },
    { cells: ['Properties', projectType + ' (see A.2)'] },
    { cells: ['Project Name', projectName] },
    { cells: ['Project Number', projectNumber] },
    { cells: ['Completion Model', completionModel] },
    { cells: ['Jurisdiction(s)', projectState] },
    { cells: ['Site(s)', siteAddress] },
    { cells: ['Client Notice Address / Email', clientEmail] },
    { cells: ['Dvele Notice Address / Email', companyEmail] },
  ],
});
```

---

## SECTION 2: MOVE STATIC TABLES INTO COMPONENT LIBRARY

**Goal:** Tables that are currently hardcoded in `mapper.ts` or `contractGenerator.ts` become admin-editable component library entries.

### Step 2.1: Identify static tables to migrate

These tables have FIXED content (no data from the pricing engine). They should move to the `component_library` table:

| Current Location | Variable/Tag | Description |
|-----------------|-------------|-------------|
| `mapper.ts` | `WHAT_HAPPENS_NEXT_TABLE` | 4-row static table |
| `contractGenerator.ts` inline | `SIGNATURE_BLOCK_SECTION14` | Section 14 signature block |
| `contractGenerator.ts` inline | `SIGNATURE_BLOCK_EXHIBIT_A` | Exhibit A dual sig block |
| `component_library` (existing) | `BLOCK_CUSTOMER_ACKNOWLEDGE_TABLE` | Customer acknowledgement |

### Step 2.2: Create component library entries for static tables

Insert into `component_library` table:

```sql
-- What Happens Next table (move from mapper.ts hardcode)
INSERT INTO component_library (tag_name, service_model, description, content, is_system, is_active)
VALUES (
  'TABLE_WHAT_HAPPENS_NEXT',
  NULL,  -- applies to both CRC and CMOS
  'What Happens Next - 4 phase overview table shown in Document Summary',
  '', -- Content will be set in Step 2.3
  false,
  true
);

-- Section 14 signature block
INSERT INTO component_library (tag_name, service_model, description, content, is_system, is_active)
VALUES (
  'TABLE_SIGNATURE_SECTION14',
  NULL,
  'Main agreement signature block - Section 14',
  '', -- Content will be set in Step 2.3
  false,
  true
);

-- Exhibit A signature blocks (dual column)
INSERT INTO component_library (tag_name, service_model, description, content, is_system, is_active)
VALUES (
  'TABLE_SIGNATURE_EXHIBIT_A',
  NULL,
  'Exhibit A dual signature blocks - Accepted/Agreed + Post Greenlight',
  '', -- Content will be set in Step 2.3
  false,
  true
);
```

### Step 2.3: Populate content using shared styles

Write a one-time migration script or seed that generates the HTML content for each static table using the `buildStyledTable()` and `buildSignatureBlock()` functions, then stores the resulting HTML in the `component_library.content` field.

Alternatively, you can store the content directly. The key requirement is that the HTML in `component_library.content` uses the SAME inline styles as `tableStyles.ts` produces. This way, even when admin-edited, the base styling is correct.

For the What Happens Next table:

```typescript
import { buildStyledTable } from './tableStyles';

const whatHappensNextHtml = buildStyledTable({
  columns: [
    { header: 'Phase', width: '20%' },
    { header: 'Description', width: '55%' },
    { header: 'Buyer Pays', width: '25%' },
  ],
  rows: [
    { cells: ['<strong>Design</strong>', 'Work starts after execution of this Agreement. Dvele prepares schematic designs, engineering, and specifications.', 'Paid at Signing'] },
    { cells: ['<strong>Mid-Design Review</strong>', 'Buyer receives a refined estimate based on selections and site conditions.', 'No payment due'] },
    { cells: ['<strong>Purchase Decision</strong>', 'The buyer decides whether to proceed to production.', 'Production Deposit (Milestone 1)'] },
    { cells: ['<strong>Site & Factory Milestones</strong>', 'Payments are made at key points during factory production and site work.', 'See Payment Schedule'] },
  ],
});
```

### Step 2.4: Update the resolver to handle TABLE_ tags

**File:** `server/services/component-library.ts`

The existing resolver handles `{{BLOCK_*}}` tags. Extend it to also handle `{{TABLE_*}}` tags using the same lookup:

```typescript
// In resolveComponentTags() or equivalent:
const allTagPattern = /\{\{(BLOCK_[A-Z_]+|TABLE_[A-Z_]+)\}\}/g;
```

This means both `{{BLOCK_*}}` and `{{TABLE_*}}` tags resolve from the `component_library` table by matching on `tag_name`.

### Step 2.5: Remove hardcoded static tables from mapper.ts

After the component library entries are created and the resolver handles `TABLE_*` tags:

1. Remove the `WHAT_HAPPENS_NEXT_TABLE` HTML string from `mapper.ts`
2. Instead, let the clause content use `{{TABLE_WHAT_HAPPENS_NEXT}}` which the resolver will pick up from the component library

3. In `contractGenerator.ts`, replace inline signature block HTML with `{{TABLE_SIGNATURE_SECTION14}}` and `{{TABLE_SIGNATURE_EXHIBIT_A}}` tags that resolve from the component library

---

## SECTION 3: DATA-DRIVEN TABLE TEMPLATES

**Goal:** The pricing, payment, and unit tables keep their generators (they need live data) but the column structure and styling come from a shared place.

### Step 3.1: Keep `tableGenerators.ts` functions

Do NOT remove `generatePricingTableHtml()`, `generatePaymentScheduleHtml()`, or `generateUnitDetailsHtml()`. These MUST run at generation time because they use live project data (pricing engine output, unit selections, milestone calculations).

### Step 3.2: Mark data-driven tables in the component library as read-only references

Add component library entries for documentation purposes:

```sql
INSERT INTO component_library (tag_name, service_model, description, content, is_system, is_active)
VALUES
  ('TABLE_PRICING_BREAKDOWN', NULL, 'Pricing summary table (A.4) — auto-generated from pricing engine. Column structure: Stage/Component, Amount, Notes.', '<p><em>This table is auto-generated from project pricing data. It cannot be edited here.</em></p>', true, true),
  ('TABLE_PAYMENT_SCHEDULE', NULL, 'Payment milestone table (A.5) — auto-generated from payment schedule. Columns: Property ID, Phase, Payment, Trigger, %, Amount, Due.', '<p><em>This table is auto-generated from project payment schedule. It cannot be edited here.</em></p>', true, true),
  ('TABLE_UNIT_DETAILS', NULL, 'Unit breakdown table — auto-generated from project units. Columns: Unit, Model, Specs, Price.', '<p><em>This table is auto-generated from project unit selections. It cannot be edited here.</em></p>', true, true);
```

These are `is_system: true` so they can't be deleted, and their content is just a description. The ACTUAL content comes from `tableGenerators.ts` via the mapper — the component library entries just make them visible in the admin UI so admins know they exist and what they do.

### Step 3.3: Ensure the mapper still injects data-driven tables

In `mapper.ts`, these variable assignments should remain:

```typescript
map['PRICING_BREAKDOWN_TABLE'] = generatePricingTableHtml(pricingSummary, contractType);
map['PAYMENT_SCHEDULE_TABLE'] = generatePaymentScheduleHtml(paymentSchedule, contractType);
map['UNIT_DETAILS_TABLE'] = generateUnitDetailsHtml(units);
```

The mapper values take priority over component library content for these variables. When the contract generator encounters `{{PRICING_BREAKDOWN_TABLE}}`, it resolves from the mapper first (which has the live data), not from the component library (which has the placeholder description).

**Resolution order should be:**
1. Mapper variables (data-driven) — highest priority
2. Component library `TABLE_*` tags — for static tables
3. Component library `BLOCK_*` tags — for conditional content

---

## SECTION 4: REBUILD THE COMPONENT LIBRARY UI

**Goal:** One clean admin page that shows ALL components (blocks, static tables, data-driven table references) with consistent UX and full CRUD.

### Step 4.1: Create unified page at `/component-library`

**File:** `client/src/pages/component-library.tsx` (rebuild)

The page layout should be:

```
┌──────────────────────────────────────────────────────────────┐
│  Component Library                              [+ New Component] │
├───────────────┬──────────────────────────────────────────────┤
│  SIDEBAR      │  DETAIL PANEL                                │
│               │                                              │
│  ▼ Block      │  [Selected component details]                │
│    Components │                                              │
│  ○ BLOCK_ON.. │  Tag: BLOCK_ON_SITE_SCOPE_EXHIBIT_A          │
│  ○ BLOCK_ON.. │  Type: Block Component    Model: CRC         │
│  ● BLOCK_CU.. │  Description: [editable]                     │
│               │                                              │
│  ▼ Static     │  Content:                                    │
│    Tables     │  ┌──────────────────────────────────┐        │
│  ○ TABLE_WH.. │  │ [HTML editor / textarea]          │        │
│  ○ TABLE_SI.. │  │                                   │        │
│  ○ TABLE_SI.. │  └──────────────────────────────────┘        │
│               │                                              │
│  ▼ Data-      │  Preview:                                    │
│    Driven     │  ┌──────────────────────────────────┐        │
│    Tables     │  │ [rendered HTML preview]            │        │
│  ○ TABLE_PR.. │  │                                   │        │
│  ○ TABLE_PA.. │  └──────────────────────────────────┘        │
│  ○ TABLE_UN.. │                                              │
│               │  [Save]  [Duplicate]  [Delete]               │
└───────────────┴──────────────────────────────────────────────┘
```

### Step 4.2: Sidebar groups

The sidebar should group components into three collapsible sections:

**Block Components** — queried from `component_library` where `tag_name LIKE 'BLOCK_%'`
- Show tag name (truncated) with CRC/CMOS badge
- Group by base tag name (e.g., show `BLOCK_ON_SITE_SCOPE_EXHIBIT_A` with "CRC" and "CMOS" variants nested)

**Static Tables** — queried from `component_library` where `tag_name LIKE 'TABLE_%' AND is_system = false`
- These are fully editable (What Happens Next, Signature Blocks, etc.)

**Data-Driven Tables** — queried from `component_library` where `tag_name LIKE 'TABLE_%' AND is_system = true`
- These are read-only in the UI (Pricing, Payment, Unit Details)
- Show an info banner: "This table is auto-generated from project data and cannot be edited here."

### Step 4.3: Detail panel

When a component is selected from the sidebar:

**For editable components (Block Components + Static Tables):**
- Tag Name (read-only — cannot be changed because clauses reference it)
- Service Model (dropdown: CRC / CMOS / Both — only for Block Components)
- Description (text input, editable)
- Content (HTML textarea with syntax highlighting if possible, otherwise plain textarea)
- Live Preview (renders the HTML content below the editor — use `dangerouslySetInnerHTML` in an iframe or sandboxed div)
- Action buttons: Save, Duplicate, Delete (with confirmation)

**For data-driven tables (read-only):**
- Tag Name
- Description
- Info banner: "Auto-generated from project data at contract generation time"
- Column structure (display only — show the column headers the generator produces)
- "Preview with Project" dropdown — select a project, and the preview calls `GET /api/contracts/preview-table/:tagName?projectId=X` to show the table rendered with real data

### Step 4.4: Create New Component dialog

Button: `[+ New Component]` at top right

Fields:
- Component Type (radio: Block Component / Static Table)
- Tag Name (text input — auto-prefixes with `BLOCK_` or `TABLE_` based on type)
- Service Model (dropdown — only shown for Block Components)
- Description (text input)
- Content (HTML textarea)

Validation:
- Tag name required, must be uppercase with underscores only
- Tag name must be unique (for the same service_model, if applicable)
- Content required

### Step 4.5: API endpoints

Verify these exist (they should from earlier work). If any are missing, create them:

```
GET    /api/components              — list all from component_library
GET    /api/components/:id          — get one
POST   /api/components              — create new
PATCH  /api/components/:id          — update
DELETE /api/components/:id          — delete (blocked if is_system=true)
```

Add a preview endpoint for data-driven tables:

```
GET    /api/contracts/preview-table/:tagName?projectId=X
```

This endpoint calls the appropriate table generator function for the given tag name using the specified project's data, and returns the HTML.

### Step 4.6: Remove the old admin components page

- Delete `client/src/pages/admin/components.tsx` (or the equivalent)
- Remove its route from the router
- Update the Admin index page to remove the "Components" link
- Add "Component Library" to the main sidebar navigation pointing to `/component-library`

### Step 4.7: Styling

Use the existing shadcn/ui component patterns in the codebase:
- `Card` for the detail panel
- `Button` for actions
- `Input` / `Textarea` for form fields
- `Select` for dropdowns
- `Badge` for CRC/CMOS labels
- `Collapsible` or accordion for sidebar groups
- `AlertDialog` for delete confirmation

The sidebar should have a search/filter input at the top so users can quickly find a component by name.

---

## SECTION 5: CLEAN UP DEAD CODE

After all sections are implemented and verified:

### Step 5.1: Remove hardcoded WHAT_HAPPENS_NEXT_TABLE from mapper.ts

Find the multi-line HTML string for this table in `mapper.ts` and remove it. The variable should now resolve from the component library via the `{{TABLE_WHAT_HAPPENS_NEXT}}` tag.

### Step 5.2: Remove inline signature HTML from contractGenerator.ts

Replace any inline signature block HTML with the `{{TABLE_SIGNATURE_SECTION14}}` and `{{TABLE_SIGNATURE_EXHIBIT_A}}` tags.

### Step 5.3: Remove the old `/admin/components` route and page

If not already done in Step 4.6.

---

## VERIFICATION

After implementing all sections, verify:

### Visual consistency:
1. ✅ Generate a contract — ALL tables should have dark blue headers (`#2c3e50`), white header text, alternating row stripes
2. ✅ No tables should have the old gray `#f2f2f2` header styling
3. ✅ Signature blocks use clean line-based layout (not raw underscores)

### Admin functionality:
4. ✅ `/component-library` page loads with three sidebar groups
5. ✅ Block Components show CRC/CMOS badges and are grouped by base tag name
6. ✅ Static Tables are fully editable (edit content, see preview, save)
7. ✅ Data-Driven Tables show as read-only with info banner
8. ✅ Creating a new Block Component works (appears in sidebar, saves to DB)
9. ✅ Creating a new Static Table works
10. ✅ Duplicating a component works (copies content, prompts for new tag name)
11. ✅ Deleting a non-system component works (with confirmation)
12. ✅ Deleting a system component is blocked with explanation

### Contract generation:
13. ✅ `{{TABLE_WHAT_HAPPENS_NEXT}}` resolves from component library (not mapper.ts)
14. ✅ `{{TABLE_SIGNATURE_SECTION14}}` resolves from component library
15. ✅ `{{TABLE_SIGNATURE_EXHIBIT_A}}` resolves from component library
16. ✅ `{{PRICING_BREAKDOWN_TABLE}}` still resolves from mapper/tableGenerators (data-driven)
17. ✅ `{{PAYMENT_SCHEDULE_TABLE}}` still resolves from mapper/tableGenerators (data-driven)
18. ✅ `{{BLOCK_*}}` tags still resolve correctly for CRC/CMOS content
19. ✅ No old admin components page exists at `/admin/components`

### Resolution priority:
20. ✅ If a variable exists in BOTH the mapper AND the component library, the mapper value wins (this ensures data-driven tables get live data, not the placeholder description)
