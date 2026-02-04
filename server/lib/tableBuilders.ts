import { pool } from "../db";

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface TableColumn {
  header: string;
  type: "text" | "data_field" | "signature";
  width?: string;
  value: string;
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

interface TableRow {
  values: Record<string, string>;  // column header -> value
}

interface ProjectData {
  [key: string]: any;
}

export async function fetchProjectData(projectId: number): Promise<ProjectData> {
  const result = await pool.query(
    `SELECT 
      p.id, p.project_number, p.name as project_name, p.status, p.state,
      pd.delivery_address, pd.delivery_city, pd.delivery_state, pd.delivery_zip,
      c.legal_name as client_name, c.email as client_email, c.phone as client_phone,
      c.address as client_address, c.city as client_city, c.state as client_state, c.zip as client_zip,
      f.final_contract_price, f.design_fee
    FROM projects p
    LEFT JOIN project_details pd ON pd.project_id = p.id
    LEFT JOIN clients c ON c.project_id = p.id
    LEFT JOIN financials f ON f.project_id = p.id
    WHERE p.id = $1`,
    [projectId]
  );

  if (result.rows.length === 0) {
    return {};
  }

  const row = result.rows[0];
  const data: ProjectData = {};

  Object.entries(row).forEach(([key, value]) => {
    const varName = key.toUpperCase().replace(/_/g, "_");
    data[varName] = value;
  });

  data.CLIENT_LEGAL_NAME = row.client_name || "";
  data.CLIENT_EMAIL = row.client_email || "";
  data.CLIENT_PHONE = row.client_phone || "";
  data.CLIENT_ADDRESS = row.client_address || "";
  data.CLIENT_CITY = row.client_city || "";
  data.CLIENT_STATE = row.client_state || "";
  data.CLIENT_ZIP = row.client_zip || "";
  data.PROJECT_NAME = row.project_name || "";
  data.PROJECT_NUMBER = row.project_number || "";
  data.PROJECT_STATE = row.state || "";
  data.SITE_ADDRESS = row.delivery_address || "";
  data.SITE_CITY = row.delivery_city || "";
  data.SITE_STATE = row.delivery_state || "";
  data.SITE_ZIP = row.delivery_zip || "";
  data.FINAL_CONTRACT_PRICE = row.final_contract_price 
    ? `$${(row.final_contract_price / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}` 
    : "$0.00";
  data.DESIGN_FEE = row.design_fee
    ? `$${(row.design_fee / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : "$0.00";
  data.TODAY_DATE = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return data;
}

function resolveColumnValue(column: TableColumn, projectData: ProjectData): string {
  switch (column.type) {
    case "text":
      return escapeHtml(column.value || "");
    case "data_field":
      const varName = column.value.replace(/\{\{|\}\}/g, "").trim();
      const value = projectData[varName];
      return value !== undefined ? escapeHtml(String(value)) : `[${escapeHtml(varName)}]`;
    case "signature":
      const sigContent = column.value?.trim() || "";
      return `<div class="signature-box" style="min-width: 120px; width: 120px;">${escapeHtml(sigContent)}</div>`;
    default:
      return escapeHtml(column.value || "");
  }
}

export async function renderDynamicTable(
  tableIdOrVariable: number | string,
  projectId: number | null
): Promise<string> {
  let tableResult;
  
  if (typeof tableIdOrVariable === "number") {
    tableResult = await pool.query(
      "SELECT * FROM table_definitions WHERE id = $1 AND is_active = true",
      [tableIdOrVariable]
    );
  } else {
    tableResult = await pool.query(
      "SELECT * FROM table_definitions WHERE variable_name = $1 AND is_active = true",
      [tableIdOrVariable]
    );
  }

  if (tableResult.rows.length === 0) {
    return `<p class="text-red-500">[Table not found: ${escapeHtml(String(tableIdOrVariable))}]</p>`;
  }

  const tableDef: TableDefinition = tableResult.rows[0];
  const columns: TableColumn[] = Array.isArray(tableDef.columns) 
    ? tableDef.columns 
    : JSON.parse(tableDef.columns as any);

  let projectData: ProjectData = {};
  if (projectId) {
    projectData = await fetchProjectData(projectId);
  }

  const headerRow = columns
    .map(col => {
      const width = col.width ? `width: ${escapeHtml(col.width)};` : (col.type === "signature" ? "width: 120px;" : "");
      return `<th style="${width}">${escapeHtml(col.header)}</th>`;
    })
    .join("");

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
    <style>
      .contract-table th, .contract-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      .contract-table .signature-box { font-family: monospace; white-space: nowrap; }
    </style>
  `;
}

export async function getAllTableDefinitions(): Promise<TableDefinition[]> {
  const result = await pool.query(
    "SELECT * FROM table_definitions WHERE is_active = true ORDER BY display_name"
  );
  return result.rows;
}

export async function getTableDefinition(id: number): Promise<TableDefinition | null> {
  const result = await pool.query(
    "SELECT * FROM table_definitions WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

export async function renderTableFromColumns(
  columns: TableColumn[],
  projectId: number | null
): Promise<string> {
  let projectData: ProjectData = {};
  if (projectId) {
    projectData = await fetchProjectData(projectId);
  }

  const headerRow = columns
    .map(col => {
      const width = col.width ? `width: ${escapeHtml(col.width)};` : (col.type === "signature" ? "width: 120px;" : "");
      return `<th style="${width}">${escapeHtml(col.header)}</th>`;
    })
    .join("");

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
    <style>
      .contract-table th, .contract-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      .contract-table .signature-box { font-family: monospace; white-space: nowrap; }
    </style>
  `;
}
