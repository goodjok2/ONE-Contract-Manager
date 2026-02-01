import { pool } from "../db";

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
  is_active: boolean;
}

interface ProjectData {
  [key: string]: any;
}

export async function fetchProjectData(projectId: number): Promise<ProjectData> {
  const result = await pool.query(
    `SELECT 
      p.id, p.project_number, p.name as project_name, p.status, p.state,
      pd.site_address, pd.site_city, pd.site_state, pd.site_zip,
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
  data.SITE_ADDRESS = row.site_address || "";
  data.SITE_CITY = row.site_city || "";
  data.SITE_STATE = row.site_state || "";
  data.SITE_ZIP = row.site_zip || "";
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
      return column.value || "";
    case "data_field":
      const varName = column.value.replace(/\{\{|\}\}/g, "").trim();
      return projectData[varName] || `[${varName}]`;
    case "signature":
      return `<div style="border-bottom: 1px solid #000; height: 30px; min-width: 150px;"></div>`;
    default:
      return column.value || "";
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
    return `<p class="text-red-500">[Table not found: ${tableIdOrVariable}]</p>`;
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
      const width = col.width ? `width: ${col.width};` : "";
      return `<th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: left; ${width}">${col.header}</th>`;
    })
    .join("");

  const dataRow = columns
    .map(col => {
      const width = col.width ? `width: ${col.width};` : "";
      const value = resolveColumnValue(col, projectData);
      return `<td style="border: 1px solid #ddd; padding: 8px; ${width}">${value}</td>`;
    })
    .join("");

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
      <thead>
        <tr>${headerRow}</tr>
      </thead>
      <tbody>
        <tr>${dataRow}</tr>
      </tbody>
    </table>
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
