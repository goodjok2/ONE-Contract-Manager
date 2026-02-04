# Replit Agent Prompt 11: Table Row Editor UI + Backend Routes for Multi-Row Tables

## Context
We are working on the ONE Contract Manager. In Prompt 10, we added multi-row support to `tableBuilders.ts` (the `renderDynamicTable` function now accepts an optional `rows` JSONB array). However, users currently have no way to create or edit multi-row tables through the UI — they would have to write raw SQL. This prompt adds the UI and backend support so admins can visually manage table rows.

## RULES
1. **Modify only the files listed.** Do not create new pages or routes.
2. **Do not modify `WizardContext.tsx` or `WizardShell.tsx`.**
3. **Preserve all existing column editor functionality** — the row editor is additive.
4. **Follow the existing code patterns** in `component-library.tsx` (shadcn/ui components, tanstack query mutations, dialog forms).

---

## PART A: Backend — Add `rows` to Table Definition Routes

### File: `server/routes/contracts.ts`

**Change 1 — POST route (line ~2536):** Add `rows` to the INSERT.

Find:
```typescript
router.post("/table-definitions", async (req, res) => {
  try {
    const { variable_name, display_name, description, columns } = req.body;
    
    if (!variable_name || !display_name || !columns) {
      return res.status(400).json({ error: "variable_name, display_name, and columns are required" });
    }
    
    const result = await pool.query(
      `INSERT INTO table_definitions (variable_name, display_name, description, columns)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [variable_name, display_name, description, JSON.stringify(columns)]
    );
```

Replace with:
```typescript
router.post("/table-definitions", async (req, res) => {
  try {
    const { variable_name, display_name, description, columns, rows } = req.body;
    
    if (!variable_name || !display_name || !columns) {
      return res.status(400).json({ error: "variable_name, display_name, and columns are required" });
    }
    
    const result = await pool.query(
      `INSERT INTO table_definitions (variable_name, display_name, description, columns, rows)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [variable_name, display_name, description, JSON.stringify(columns), rows ? JSON.stringify(rows) : null]
    );
```

**Change 2 — PATCH route (line ~2561):** Add `rows` to the update handler.

Find (inside the PATCH handler, after the `columns` block):
```typescript
    if (columns !== undefined) {
      updateFields.push(`columns = $${paramCount}`);
      values.push(JSON.stringify(columns));
      paramCount++;
    }
```

Add immediately after:
```typescript
    if (req.body.rows !== undefined) {
      updateFields.push(`rows = $${paramCount}`);
      values.push(req.body.rows ? JSON.stringify(req.body.rows) : null);
      paramCount++;
    }
```

---

## PART B: Frontend — Row Editor in Component Library

### File: `client/src/pages/component-library.tsx`

The Component Library page already has a column editor with add/remove/drag-reorder. We need to add a **Row Data Editor** section below the column editor — both in the Create dialog and the Edit panel. The row editor lets users add data rows where each row maps column headers to values.

### Step 1: Update the `TableDefinition` interface (around line 84)

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
interface TableRow {
  values: Record<string, string>;
}

interface TableDefinition {
  id: number;
  variable_name: string;
  display_name: string;
  description: string | null;
  columns: TableColumn[];
  rows?: TableRow[];
  is_active: boolean;
}
```

### Step 2: Add row state variables (near existing table state, around line 225-227)

Find:
```typescript
  const [newTableColumns, setNewTableColumns] = useState<TableColumn[]>([
```

Add **before** this line:
```typescript
  const [newTableRows, setNewTableRows] = useState<TableRow[]>([]);
```

### Step 3: Add row management functions (near the `addColumn`/`removeColumn` functions, around line 499-520)

Add these new functions right after the existing `removeColumn` function:

```typescript
  const addRow = () => {
    const cols = isEditMode && editingTable ? editingTable.columns : newTableColumns;
    const emptyRow: TableRow = { values: {} };
    cols.forEach(col => { emptyRow.values[col.header] = ""; });
    
    if (isEditMode && editingTable) {
      setEditingTable({ ...editingTable, rows: [...(editingTable.rows || []), emptyRow] });
    } else {
      setNewTableRows([...newTableRows, emptyRow]);
    }
  };

  const removeRow = (rowIndex: number) => {
    if (isEditMode && editingTable) {
      const rows = [...(editingTable.rows || [])];
      rows.splice(rowIndex, 1);
      setEditingTable({ ...editingTable, rows });
    } else {
      const rows = [...newTableRows];
      rows.splice(rowIndex, 1);
      setNewTableRows(rows);
    }
  };

  const updateRowValue = (rowIndex: number, columnHeader: string, value: string) => {
    if (isEditMode && editingTable) {
      const rows = [...(editingTable.rows || [])];
      if (rows[rowIndex]) {
        rows[rowIndex] = { ...rows[rowIndex], values: { ...rows[rowIndex].values, [columnHeader]: value } };
      }
      setEditingTable({ ...editingTable, rows });
    } else {
      const rows = [...newTableRows];
      if (rows[rowIndex]) {
        rows[rowIndex] = { ...rows[rowIndex], values: { ...rows[rowIndex].values, [columnHeader]: value } };
      }
      setNewTableRows(rows);
    }
  };
```

### Step 4: Include rows in the create handler (around line 475-483)

Find the `handleTableCreate` function where it builds the payload:
```typescript
      variable_name: slugifyToVariable(newTableName),
      display_name: newTableName,
      description: newTableDescription,
      columns: newTableColumns,
```

Replace with:
```typescript
      variable_name: slugifyToVariable(newTableName),
      display_name: newTableName,
      description: newTableDescription,
      columns: newTableColumns,
      rows: newTableRows.length > 0 ? newTableRows : undefined,
```

### Step 5: Include rows in the edit/save handler

Find where the `updateTableMutation` is called (it will be in a save handler). Add `rows` to the payload:

If the existing save handler passes `{ columns: editingTable.columns, display_name: ... }`, add:
```typescript
rows: editingTable.rows && editingTable.rows.length > 0 ? editingTable.rows : null,
```

### Step 6: Reset rows in the reset function

Find the `resetTableForm` or equivalent reset function that clears `newTableName`, `newTableDescription`, `newTableColumns`. Add:
```typescript
setNewTableRows([]);
```

### Step 7: Include rows in the `startTableEdit` function (line ~554)

Find:
```typescript
  const startTableEdit = (table: TableDefinition) => {
    setEditingTable({ ...table });
    setIsEditMode(true);
  };
```

No change needed — `editingTable` already includes `rows` from the API response since we updated the interface.

### Step 8: Add Row Editor UI in the Create Dialog (after the Columns section, around line 1244)

Find the closing `</div>` of the Columns section in the create dialog (the one right after the column `.map()` loop). Add this **Row Data** section immediately after:

```tsx
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Row Data <span className="text-xs text-muted-foreground font-normal">(optional — leave empty for single-row tables using column values)</span></Label>
                <Button variant="outline" size="sm" onClick={addRow}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Row
                </Button>
              </div>
              {newTableRows.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {newTableRows.map((row, rowIdx) => (
                    <div key={rowIdx} className="p-2 border rounded bg-background space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Row {rowIdx + 1}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(rowIdx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid gap-1">
                        {newTableColumns.map((col) => (
                          <div key={col.header} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-24 truncate" title={col.header}>{col.header}:</span>
                            <Input
                              value={row.values[col.header] || ""}
                              onChange={(e) => updateRowValue(rowIdx, col.header, e.target.value)}
                              placeholder={`Value for ${col.header}`}
                              className="h-7 text-xs flex-1"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
```

### Step 9: Add Row Editor UI in the Edit Panel (after the Columns section, around line 1010)

Find the closing `</div>` of the Columns section in the edit panel (the `isEditMode && editingTable` branch, after the column `.map()` loop). Add the same Row Data editor, but using `editingTable.rows` and `editingTable.columns`:

```tsx
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Label>Row Data <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                                <Button variant="outline" size="sm" onClick={addRow}>
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Row
                                </Button>
                              </div>
                              {(editingTable.rows || []).length > 0 && (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {(editingTable.rows || []).map((row, rowIdx) => (
                                    <div key={rowIdx} className="p-2 border rounded bg-background space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground">Row {rowIdx + 1}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRow(rowIdx)}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <div className="grid gap-1">
                                        {editingTable.columns.map((col) => (
                                          <div key={col.header} className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground w-24 truncate" title={col.header}>{col.header}:</span>
                                            <Input
                                              value={row.values[col.header] || ""}
                                              onChange={(e) => updateRowValue(rowIdx, col.header, e.target.value)}
                                              placeholder={`Value for ${col.header}`}
                                              className="h-7 text-xs flex-1"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
```

### Step 10: Add Row Data in the View Panel (non-edit mode, around line 1030)

Find the view-mode section for custom tables (the `else` branch that shows column badges). After the Columns display section, add a read-only row data display:

```tsx
                            {selectedItem.data.rows && selectedItem.data.rows.length > 0 && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Row Data ({selectedItem.data.rows.length} rows)</Label>
                                <div className="mt-2 space-y-1">
                                  {selectedItem.data.rows.map((row: TableRow, idx: number) => (
                                    <div key={idx} className="text-xs p-1.5 bg-muted rounded font-mono">
                                      {Object.entries(row.values).map(([k, v]) => `${k}: ${v}`).join(" | ")}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
```

---

## Verification

1. **Create a table with no rows** → should work exactly as before (single-row using column values)
2. **Create a table with rows** → click "Add Row" in the create dialog, fill in values per column, save → the preview should show multiple data rows with alternating backgrounds
3. **Edit an existing table** → add rows, save → preview updates to show multi-row table
4. **Delete a row** → click trash icon on a row → row disappears, save persists the change

## Summary of Changes

| File | Change | Lines |
|------|--------|-------|
| `server/routes/contracts.ts` | Add `rows` to POST and PATCH handlers | ~10 lines |
| `client/src/pages/component-library.tsx` | Add `TableRow` interface, state, functions, UI | ~100 lines |

Total: ~110 lines of new code. Fully backward compatible — no existing functionality changes.
