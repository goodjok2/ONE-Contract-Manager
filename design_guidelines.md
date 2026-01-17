# Dvele Contract Manager - Design Guidelines

## Design Approach

**Selected Approach:** Design System (Productivity-Focused)
**Reference Inspiration:** Linear + Notion + Asana
**Rationale:** Internal contract management requires clarity, efficiency, and information density. Drawing from modern productivity tools that excel at data organization and workflow management.

## Core Design Principles

1. **Clarity First:** Information hierarchy optimized for quick scanning and decision-making
2. **Efficiency:** Minimal clicks to complete common tasks (upload, review, approve contracts)
3. **Consistency:** Predictable patterns across all views and workflows
4. **Professional:** Clean, business-appropriate aesthetic without unnecessary ornamentation

## Typography

**Font Family:** Inter (Google Fonts)
- Primary: Inter (400, 500, 600)
- Monospace: 'Monaco' for contract IDs, dates

**Hierarchy:**
- Page Titles: text-2xl font-semibold (32px)
- Section Headers: text-lg font-semibold (20px)
- Card Titles: text-base font-medium (16px)
- Body Text: text-sm font-normal (14px)
- Metadata/Labels: text-xs font-medium uppercase tracking-wide (12px)
- Helper Text: text-xs (12px)

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12 (p-2, m-4, gap-6, py-8, mb-12)

**Container Structure:**
- Sidebar: Fixed width w-64, full height
- Main Content: flex-1 with max-w-7xl, px-8 py-6
- Cards/Panels: p-6 standard, p-4 for compact variants

**Grid Patterns:**
- Contract List: Single column with full-width rows
- Dashboard Stats: grid-cols-1 md:grid-cols-3 gap-6
- Document Details: Two-column split (2/3 main content, 1/3 metadata sidebar)

## Component Library

### Navigation
**Sidebar (Left-aligned, Fixed):**
- Logo/Brand at top (h-16 flex items-center px-6)
- Navigation items: py-2 px-4, rounded-md within the sidebar
- Active state: font-medium with subtle visual treatment
- Grouped sections with text-xs uppercase labels (mb-2)

**Top Bar:**
- h-16, border-b, flex items-center justify-between px-8
- Search bar (max-w-md), user menu (right-aligned)

### Core UI Elements

**Buttons:**
- Primary: px-4 py-2 rounded-md font-medium
- Secondary: px-4 py-2 rounded-md border
- Icon buttons: p-2 rounded-md
- Sizes: Small (text-sm py-1.5 px-3), Default (py-2 px-4), Large (py-3 px-6)

**Forms:**
- Input fields: px-3 py-2 rounded-md border, focus:ring-2
- Labels: text-sm font-medium mb-2 block
- Helper text: text-xs mt-1
- Field spacing: mb-6 between form groups
- Text areas: min-h-32

**Cards:**
- Standard: rounded-lg border p-6 (for dashboards, document previews)
- Compact: rounded-md border p-4 (for list items)
- Elevated: rounded-lg shadow-md p-6 (for modals, popovers)

### Data Displays

**Table (Contract List):**
- Header: text-xs font-medium uppercase tracking-wide py-3 px-4 border-b
- Rows: py-4 px-4 border-b hover state
- Columns: Contract Name, Client, Status, Date, Actions
- Alternating row treatment for better scanning
- Action buttons in last column (icon buttons, compact)

**Status Badges:**
- Pill-shaped: px-2.5 py-0.5 rounded-full text-xs font-medium
- States: Draft, Pending Review, Approved, Signed, Expired

**Document Preview Card:**
- Thumbnail preview (if applicable)
- Contract title (text-base font-medium)
- Metadata row (text-xs, flex gap-4)
- Quick actions (icon buttons)

### Overlays

**Modal (Document Upload/Edit):**
- Fixed overlay with backdrop blur
- Content: max-w-2xl mx-auto mt-20 rounded-lg shadow-xl p-8
- Header: text-xl font-semibold mb-6
- Footer: flex justify-end gap-3 mt-8 pt-6 border-t

**Dropdown Menus:**
- rounded-md shadow-lg border min-w-48
- Items: px-4 py-2 text-sm hover state
- Dividers: my-2 border-t

**Toast Notifications:**
- Fixed bottom-right, rounded-md shadow-lg p-4
- Icon + Message + Dismiss button
- Auto-dismiss after 4s

## Page Layouts

### Dashboard
- Stats cards grid (3 columns): Total Contracts, Pending Approvals, Expiring Soon
- Recent activity list
- Quick actions panel

### Contract List View
- Search + Filter bar (top, flex gap-4 mb-6)
- Full-width table
- Pagination footer

### Contract Detail View
- Breadcrumb navigation
- Two-column layout: Main content (document viewer/form) + Sidebar (metadata, status, actions, activity log)
- Action buttons in fixed bottom bar on mobile

### Upload/Create Contract
- Modal-based or dedicated page
- Step indicator if multi-step
- File upload dropzone: border-2 border-dashed rounded-lg p-12 text-center
- Form fields for metadata

## Icons
**Library:** Lucide React (already installed)
**Usage:**
- Navigation: 20px size
- Buttons: 16px inline with text
- Table actions: 18px
- Status indicators: 14px

## Animations
**Minimal, purposeful only:**
- Hover states: Simple opacity/transform changes
- Modal enter/exit: Subtle fade + scale
- Dropdown: Fade in
- NO complex animations or transitions

## Key Interactions
- Click contract row → Navigate to detail view
- Hover table row → Subtle highlight
- Upload → Drag-and-drop or click to browse
- Status change → Inline dropdown, updates immediately
- Document approval → Modal with signature/comment field