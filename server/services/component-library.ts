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

// =============================================================================
// CRC vs CMOS TEXT BLOCKS
// =============================================================================

const BLOCK_ON_SITE_SCOPE_CRC = `
<p><strong>Option A – Client-Retained Contractor ("CRC")</strong></p>
<p>Client has elected to retain a separate licensed general contractor ("Site Contractor") to perform all on-site construction services, including but not limited to: site preparation, foundation work, utility connections, module setting and crane services, exterior finishing, and all other work required to complete the Home on the Site.</p>
<p>Company's scope of work under this Agreement is expressly limited to the design, engineering, manufacturing, and delivery of the modular components ("Modules") to the Site. Company shall have no responsibility for, and expressly disclaims any liability arising from, the on-site construction work performed by the Site Contractor or any other party retained by Client.</p>
<p>Client acknowledges and agrees that:</p>
<p>(i) Client is solely responsible for selecting, contracting with, and supervising the Site Contractor;</p>
<p>(ii) Client shall ensure the Site Contractor is properly licensed, insured, and qualified to perform the required work;</p>
<p>(iii) Company's Limited Warranty does not extend to any work performed by the Site Contractor;</p>
<p>(iv) Client shall coordinate with Company regarding delivery scheduling and Module placement requirements.</p>
`.trim();

const BLOCK_ON_SITE_SCOPE_CMOS = `
<p><strong>Option B – Company-Managed On-Site Services ("CMOS")</strong></p>
<p>Client has elected to have Company manage and coordinate all on-site construction services required to complete the Home on the Site. Company shall retain qualified subcontractors to perform site preparation, foundation work, utility connections, module setting and crane services, exterior finishing, and all other work required to complete the Home.</p>
<p>Company's scope of work under this Agreement includes the design, engineering, manufacturing, delivery, and installation of the modular components, as well as coordination of all on-site construction activities through substantial completion.</p>
<p>Client acknowledges and agrees that:</p>
<p>(i) Company shall select and manage all on-site subcontractors;</p>
<p>(ii) The Total Contract Price includes all on-site construction costs;</p>
<p>(iii) Company's Limited Warranty extends to the on-site work performed under Company's supervision;</p>
<p>(iv) Company shall provide a single point of contact for all construction-related matters.</p>
`.trim();

const BLOCK_WARRANTY_SECTION_CRC = `
<p><strong>Limited Warranty – Client-Retained Contractor Projects</strong></p>
<p>Company warrants the Modules manufactured by Company against defects in materials and workmanship for a period of one (1) year from the date of delivery to the Site ("Warranty Period"). This warranty covers only the modular components manufactured by Company and expressly excludes:</p>
<p>(i) Any defects or damage arising from transportation, handling, or storage after delivery;</p>
<p>(ii) Any work performed by the Site Contractor or other parties not employed by Company;</p>
<p>(iii) Normal wear and tear, cosmetic imperfections, or minor variations in materials;</p>
<p>(iv) Damage caused by misuse, neglect, or failure to maintain the Home;</p>
<p>(v) Any modifications or alterations made without Company's prior written approval.</p>
<p>Client's sole remedy under this warranty is repair or replacement, at Company's option, of the defective component. Company shall not be liable for any consequential, incidental, or indirect damages.</p>
`.trim();

const BLOCK_WARRANTY_SECTION_CMOS = `
<p><strong>Limited Warranty – Company-Managed On-Site Projects</strong></p>
<p>Company warrants the completed Home against defects in materials and workmanship for a period of one (1) year from the date of substantial completion ("Warranty Period"). This comprehensive warranty covers:</p>
<p>(i) The modular components manufactured by Company;</p>
<p>(ii) On-site construction work performed under Company's supervision;</p>
<p>(iii) Mechanical, electrical, and plumbing systems installed as part of the Home;</p>
<p>(iv) Foundation and structural elements.</p>
<p>This warranty expressly excludes:</p>
<p>(i) Normal wear and tear, cosmetic imperfections, or minor variations in materials;</p>
<p>(ii) Damage caused by misuse, neglect, or failure to maintain the Home;</p>
<p>(iii) Any modifications or alterations made without Company's prior written approval;</p>
<p>(iv) Landscaping, fencing, or other site improvements not included in the scope of work.</p>
<p>Client's sole remedy under this warranty is repair or replacement, at Company's option, of the defective component or workmanship. Company shall not be liable for any consequential, incidental, or indirect damages.</p>
`.trim();

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
// HARDCODED FALLBACKS (used when DB is empty)
// =============================================================================

const HARDCODED_COMPONENTS: Record<string, Record<string, string>> = {
  'BLOCK_ON_SITE_SCOPE': {
    'CRC': BLOCK_ON_SITE_SCOPE_CRC,
    'CMOS': BLOCK_ON_SITE_SCOPE_CMOS,
  },
  'BLOCK_WARRANTY_SECTION': {
    'CRC': BLOCK_WARRANTY_SECTION_CRC,
    'CMOS': BLOCK_WARRANTY_SECTION_CMOS,
  },
};

// =============================================================================
// FETCH COMPONENT FROM DB (with fallback)
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
// RENDER COMPONENT FUNCTION (DB-first with fallback)
// =============================================================================

export async function renderComponentAsync(tagName: string, projectContext: ProjectContext): Promise<string> {
  const onSiteType = projectContext.onSiteType || 'CRC';
  
  const dbContent = await fetchComponentFromDB(tagName, projectContext.organizationId, onSiteType);
  if (dbContent) {
    return dbContent;
  }
  
  const fallback = HARDCODED_COMPONENTS[tagName];
  if (fallback) {
    return fallback[onSiteType] || fallback['CRC'] || '';
  }
  
  if (tagName === 'TABLE_PAYMENT_SCHEDULE') {
    if (projectContext.pricingSummary) {
      return renderPaymentSchedule(projectContext.pricingSummary, 'ONE');
    }
    return '<p>Payment schedule not available.</p>';
  }
  
  console.warn(`Unknown component tag: ${tagName}`);
  return `<!-- Unknown component: ${tagName} -->`;
}

export function renderComponent(tagName: string, projectContext: ProjectContext): string {
  const onSiteType = projectContext.onSiteType || 'CRC';
  
  const fallback = HARDCODED_COMPONENTS[tagName];
  if (fallback) {
    return fallback[onSiteType] || fallback['CRC'] || '';
  }
  
  if (tagName === 'TABLE_PAYMENT_SCHEDULE') {
    if (projectContext.pricingSummary) {
      return renderPaymentSchedule(projectContext.pricingSummary, 'ONE');
    }
    return '<p>Payment schedule not available.</p>';
  }
  
  console.warn(`Unknown component tag: ${tagName}`);
  return `<!-- Unknown component: ${tagName} -->`;
}

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

export async function resolveComponentTags(
  content: string,
  context: ComponentRenderContext
): Promise<string> {
  let result = content;
  const onSiteType = context.onSiteType || 'CRC';

  // Handle BLOCK_ tags (CRC vs CMOS dynamic content) - now fetches from DB first
  if (result.includes('{{BLOCK_ON_SITE_SCOPE}}')) {
    const blockContent = await renderComponentAsync('BLOCK_ON_SITE_SCOPE', {
      projectId: context.projectId,
      organizationId: context.organizationId,
      onSiteType,
      pricingSummary: context.pricingSummary
    });
    result = result.replace(/\{\{BLOCK_ON_SITE_SCOPE\}\}/g, blockContent);
  }

  if (result.includes('{{BLOCK_WARRANTY_SECTION}}')) {
    const blockContent = await renderComponentAsync('BLOCK_WARRANTY_SECTION', {
      projectId: context.projectId,
      organizationId: context.organizationId,
      onSiteType,
      pricingSummary: context.pricingSummary
    });
    result = result.replace(/\{\{BLOCK_WARRANTY_SECTION\}\}/g, blockContent);
  }

  // Handle TABLE_ tags
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
