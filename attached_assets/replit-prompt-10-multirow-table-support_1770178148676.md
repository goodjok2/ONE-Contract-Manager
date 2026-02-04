# Replit Agent Prompt 10: Component Library Multi-Row Table Support

## Context
We are working on the ONE Contract Manager. The `renderDynamicTable` function in `server/lib/tableBuilders.ts` currently only generates a **single data row** per table. Contract tables like signature blocks, multi-unit pricing, and milestone schedules need multiple rows.

## RULES
1. **Surgical changes only.** Modify only the `renderDynamicTable` function.
2. **Do not create new files, pages, routes, or wizards.**
3. **Backward compatible** — existing single-row table definitions must continue to work exactly as before.

---

## Problem
In `server/lib/tableBuilders.ts`, the `renderDynamicTable` function (around line 102) renders one header row and one data row:

```typescript
const dataRow = columns
  .map(col => { ... })
  .join("");

// Only ONE data row:
<tr>${dataRow}</tr>
```

This means `table_definitions` entries can only produce single-row tables.

## Change

Modify `renderDynamicTable` to support an optional `rows` JSONB field on `table_definitions`. When `rows` is present, each row entry provides its own column values. When `rows` is absent, fall back to the current single-row behavior.

### Step 1: Update the `TableDefinition` interface (around line 20)

Find:
```typescript
interface TableDefinition {
  id: number;
  variable_name: string;
  display_name: string;
  description: string | null;
  columns: TableColumn[];
  is_active: boolean;
}
```

Replace with:
```typescript
interface TableDefinition {
  id: number;
  variable_name: string;
  display_name: string;
  description: string | null;
  columns: TableColumn[];
  rows?: TableRow[];
  is_active: boolean;
}

interface TableRow {
  values: Record<string, string>;  // column header -> value
}
```

### Step 2: Update `renderDynamicTable` body generation (around line 141)

Find the single-row rendering block:
```typescript
  const dataRow = columns
    .map(col => {
      const width = col.width ? `width: ${escapeHtml(col.width)};` : (col.type === "signature" ? "width: 120px;" : "");
      const value = resolveColumnValue(col, projectData);
      return `<td style="${width}">${value}</td>`;
    })
    .join("");

  return `
    <table class="contract-table" style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <thead>
        <tr style="background-color: #f2f2f2;">${headerRow}</tr>
      </thead>
      <tbody>
        <tr>${dataRow}</tr>
      </tbody>
    </table>
```

Replace with:
```typescript
  // Support multi-row tables via optional rows array
  const tableRows: TableRow[] = Array.isArray(tableDef.rows)
    ? tableDef.rows
    : typeof tableDef.rows === 'string'
      ? JSON.parse(tableDef.rows)
      : [];

  let bodyRows: string;

  if (tableRows.length > 0) {
    // Multi-row mode: each row provides its own values
    bodyRows = tableRows.map((row, rowIdx) => {
      const bgColor = rowIdx % 2 === 0 ? '' : 'background-color: #f8f9fa;';
      const cells = columns.map(col => {
        const width = col.width ? `width: ${escapeHtml(col.width)};` : (col.type === "signature" ? "width: 120px;" : "");
        // Look up value by column header, fall back to resolveColumnValue
        const value = row.values?.[col.header] ?? resolveColumnValue(col, projectData);
        return `<td style="${width} ${bgColor}">${value}</td>`;
      }).join("");
      return `<tr>${cells}</tr>`;
    }).join("");
  } else {
    // Single-row fallback (existing behavior)
    const dataRow = columns
      .map(col => {
        const width = col.width ? `width: ${escapeHtml(col.width)};` : (col.type === "signature" ? "width: 120px;" : "");
        const value = resolveColumnValue(col, projectData);
        return `<td style="${width}">${value}</td>`;
      })
      .join("");
    bodyRows = `<tr>${dataRow}</tr>`;
  }

  return `
    <table class="contract-table" style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <thead>
        <tr style="background-color: #f2f2f2;">${headerRow}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
```

### Step 3: Add `rows` column to `table_definitions` if missing

Run this migration:
```sql
-- Add rows column if it doesn't exist
ALTER TABLE table_definitions 
ADD COLUMN IF NOT EXISTS rows JSONB DEFAULT NULL;
```

## Verification

1. Existing single-row tables should render exactly as before (no `rows` field = single-row fallback)
2. Create a test multi-row table definition:
```sql
INSERT INTO table_definitions (variable_name, display_name, columns, rows, is_active, organization_id)
VALUES (
  'TEST_MULTI_ROW',
  'Test Multi Row Table',
  '[{"header": "Item", "type": "text", "value": ""}, {"header": "Amount", "type": "text", "value": ""}]',
  '[{"values": {"Item": "Design Fee", "Amount": "$25,000"}}, {"values": {"Item": "Manufacturing", "Amount": "$175,000"}}, {"values": {"Item": "Installation", "Amount": "$50,000"}}]',
  true,
  1
);
```
3. The multi-row table should render with 3 data rows + alternating background colors.

## Summary

| File | Change | Impact |
|------|--------|--------|
| `server/lib/tableBuilders.ts` | Add `TableRow` interface, update `renderDynamicTable` | ~30 lines added |
| Database migration | Add `rows` JSONB column to `table_definitions` | 1 SQL statement |

Total: ~30 lines of new code, fully backward compatible.
