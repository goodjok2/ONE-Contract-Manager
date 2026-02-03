import { Pool } from "pg";
import {
  generatePricingTableHtml,
  generatePaymentScheduleHtml,
  generateUnitDetailsHtml,
  UnitDetail,
  ContractFilterType
} from "../lib/tableGenerators";
import { calculateProjectPricing, PricingSummary } from "./pricingEngine";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface Exhibit {
  id: number;
  name: string;
  title: string;
  description?: string;
}

export interface ProjectContext {
  projectId: number;
  organizationId: number;
  onSiteType?: string | null;
  contractValue?: number;
  pricingSummary?: PricingSummary;
}

export interface ComponentRenderContext {
  projectId: number;
  organizationId: number;
  contractType: ContractFilterType;
  pricingSummary?: PricingSummary;
  onSiteType?: string | null;
}

// =============================================================================
// FETCH COMPONENT FROM DB (no hardcoded fallbacks - DB is single source of truth)
// =============================================================================

export async function fetchComponentFromDB(
  tagName: string,
  organizationId: number,
  serviceModel: string
): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT content FROM component_library 
       WHERE organization_id = $1 
         AND tag_name = $2 
         AND (service_model = $3 OR service_model IS NULL)
       ORDER BY CASE WHEN service_model = $3 THEN 0 ELSE 1 END
       LIMIT 1`,
      [organizationId, tagName, serviceModel]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].content;
    }
    return null;
  } catch (error) {
    console.warn(`Error fetching component ${tagName} from DB:`, error);
    return null;
  }
}

// =============================================================================
// RENDER COMPONENT FUNCTION (DB-only, async)
// =============================================================================

export async function renderComponentAsync(tagName: string, projectContext: ProjectContext): Promise<string> {
  const onSiteType = projectContext.onSiteType || 'CRC';
  
  const dbContent = await fetchComponentFromDB(tagName, projectContext.organizationId, onSiteType);
  if (dbContent) {
    return dbContent;
  }
  
  console.warn(`No component found for tag: ${tagName} with service_model=${onSiteType}`);
  return `<!-- Component not found: ${tagName} -->`;
}

// =============================================================================
// TABLE RENDERING FUNCTIONS
// =============================================================================

export function renderPaymentSchedule(
  pricingSummary: PricingSummary | null,
  contractType: ContractFilterType = 'ONE'
): string {
  if (!pricingSummary || !pricingSummary.paymentSchedule) {
    return '<p>No payment schedule available.</p>';
  }

  let filteredContractTotal: number | undefined;
  if (contractType === 'MANUFACTURING') {
    filteredContractTotal = pricingSummary.breakdown.totalDesignFee + pricingSummary.breakdown.totalOffsite;
  } else if (contractType === 'ONSITE') {
    filteredContractTotal = pricingSummary.breakdown.totalOnsite;
  }

  return generatePaymentScheduleHtml(
    pricingSummary.paymentSchedule,
    contractType,
    filteredContractTotal
  );
}

export function renderPricingBreakdown(
  pricingSummary: PricingSummary | null,
  contractType: ContractFilterType = 'ONE'
): string {
  if (!pricingSummary) {
    return '<p>No pricing data available.</p>';
  }

  return generatePricingTableHtml(pricingSummary, contractType);
}

export async function renderUnitPricingTable(
  projectId: number,
  organizationId: number
): Promise<string> {
  const result = await pool.query(
    `SELECT 
      pu.id,
      pu.unit_label as "unitLabel",
      pu.base_price_snapshot as "basePriceSnapshot",
      hm.model_name as "modelName",
      hm.bedrooms,
      hm.bathrooms,
      hm.square_footage as "squareFootage"
     FROM project_units pu
     LEFT JOIN home_models hm ON pu.model_id = hm.id
     WHERE pu.project_id = $1 AND pu.organization_id = $2
     ORDER BY pu.unit_label`,
    [projectId, organizationId]
  );

  if (result.rows.length === 0) {
    return '<p>No units configured for this project.</p>';
  }

  const units: UnitDetail[] = result.rows.map(row => ({
    unitLabel: row.unitLabel || '',
    modelName: row.modelName || 'Unknown Model',
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    squareFootage: row.squareFootage,
    estimatedPrice: row.basePriceSnapshot || 0
  }));

  return generateUnitDetailsHtml(units);
}

export async function renderExhibitsList(
  contractType: string,
  organizationId: number
): Promise<string> {
  const result = await pool.query(
    `SELECT id, name, title, description
     FROM exhibits
     WHERE organization_id = $1 
       AND is_active = true
       AND (contract_types @> $2::jsonb OR contract_types = '[]'::jsonb)
     ORDER BY "order", name`,
    [organizationId, JSON.stringify([contractType])]
  );

  if (result.rows.length === 0) {
    return '<p>No exhibits available for this contract type.</p>';
  }

  const tableStyle = `
    width: 100%;
    border-collapse: collapse;
    font-family: Arial, sans-serif;
    font-size: 11pt;
    margin: 16px 0;
  `.trim().replace(/\s+/g, ' ');

  const headerCellStyle = `
    background-color: #2c3e50;
    color: white;
    padding: 12px 16px;
    text-align: left;
    font-weight: bold;
    border: 1px solid #2c3e50;
  `.trim().replace(/\s+/g, ' ');

  const rows = result.rows.map((exhibit: Exhibit, index: number) => {
    const isEven = index % 2 === 0;
    const rowBg = isEven ? 'background-color: #ffffff;' : 'background-color: #f8f9fa;';

    const cellStyle = `
      padding: 10px 16px;
      border: 1px solid #ddd;
      text-align: left;
      ${rowBg}
    `.trim().replace(/\s+/g, ' ');

    return `
    <tr>
      <td style="${cellStyle}">${exhibit.name}</td>
      <td style="${cellStyle}">${exhibit.title || exhibit.description || '-'}</td>
    </tr>
    `;
  }).join('');

  return `
<table style="${tableStyle}">
  <thead>
    <tr>
      <th style="${headerCellStyle}">Exhibit</th>
      <th style="${headerCellStyle}">Description</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
  `.trim();
}

// =============================================================================
// RESOLVE ALL COMPONENT TAGS (generic regex approach)
// =============================================================================

export async function resolveComponentTags(
  content: string,
  context: ComponentRenderContext
): Promise<string> {
  let result = content;
  const onSiteType = context.onSiteType || 'CRC';

  // Step 1: Handle ALL {{BLOCK_*}} tags using generic regex (DB lookup)
  const blockTagRegex = /\{\{(BLOCK_[A-Z0-9_.]+)\}\}/g;
  const allMatches = Array.from(result.matchAll(blockTagRegex));
  const blockMatches = Array.from(new Set(allMatches.map(m => m[1])));

  for (const tagName of blockMatches) {
    const blockContent = await fetchComponentFromDB(tagName, context.organizationId, onSiteType);
    if (blockContent) {
      // Escape dots in tag name for regex
      const escapedTagName = tagName.replace(/\./g, '\\.');
      result = result.replace(new RegExp(`\\{\\{${escapedTagName}\\}\\}`, 'g'), blockContent);
    } else {
      console.warn(`No component found for {{${tagName}}} with service_model=${onSiteType}`);
      // Leave the placeholder in place so it shows up as unresolved in preview
    }
  }

  // Step 2: Handle TABLE_ tags (computed components, not DB lookups)
  // These come AFTER BLOCK_ resolution so blocks can contain table variables
  
  if (result.includes('{{PRICING_BREAKDOWN_TABLE}}')) {
    const pricingSummary = context.pricingSummary || await calculateProjectPricing(context.projectId);
    const table = renderPricingBreakdown(pricingSummary, context.contractType);
    result = result.replace(/\{\{PRICING_BREAKDOWN_TABLE\}\}/g, table);
  }

  if (result.includes('{{PAYMENT_SCHEDULE_TABLE}}') || result.includes('{{TABLE_PAYMENT_SCHEDULE}}')) {
    const pricingSummary = context.pricingSummary || await calculateProjectPricing(context.projectId);
    const table = renderPaymentSchedule(pricingSummary, context.contractType);
    result = result.replace(/\{\{PAYMENT_SCHEDULE_TABLE\}\}/g, table);
    result = result.replace(/\{\{TABLE_PAYMENT_SCHEDULE\}\}/g, table);
  }

  if (result.includes('{{UNIT_PRICING_TABLE}}') || result.includes('{{UNIT_SPEC_TABLE}}')) {
    const table = await renderUnitPricingTable(context.projectId, context.organizationId);
    result = result.replace(/\{\{UNIT_PRICING_TABLE\}\}/g, table);
    result = result.replace(/\{\{UNIT_SPEC_TABLE\}\}/g, table);
  }

  if (result.includes('{{EXHIBIT_LIST_TABLE}}')) {
    const table = await renderExhibitsList(context.contractType, context.organizationId);
    result = result.replace(/\{\{EXHIBIT_LIST_TABLE\}\}/g, table);
  }

  return result;
}
