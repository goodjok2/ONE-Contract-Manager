/**
 * Table Generators for Contract PDF Generation
 * Generates HTML tables with inline styles for PDF compatibility
 */

interface PricingBreakdown {
  totalDesignFee: number;
  totalOffsite: number;
  totalOnsite: number;
  totalCustomizations?: number;
}

interface PricingSummary {
  breakdown: PricingBreakdown;
  grandTotal: number;
  projectBudget: number;
  contractValue: number;
  serviceModel?: string;
}

interface PaymentMilestone {
  name: string;
  percentage: number;
  amount: number;
  phase?: string;
}

function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Generates an HTML table showing pricing breakdown
 * Includes Design Fee, Offsite Manufacturing, Onsite Services (if applicable), and Grand Total
 */
export function generatePricingTableHtml(pricingSummary: PricingSummary | null): string {
  if (!pricingSummary) {
    return 'No pricing data found.';
  }

  const { breakdown, contractValue, serviceModel } = pricingSummary;
  const isCMOS = serviceModel === 'CMOS';

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

  const headerCellRightStyle = `
    background-color: #2c3e50;
    color: white;
    padding: 12px 16px;
    text-align: right;
    font-weight: bold;
    border: 1px solid #2c3e50;
  `.trim().replace(/\s+/g, ' ');

  const cellStyle = `
    padding: 10px 16px;
    border: 1px solid #ddd;
    text-align: left;
  `.trim().replace(/\s+/g, ' ');

  const cellRightStyle = `
    padding: 10px 16px;
    border: 1px solid #ddd;
    text-align: right;
  `.trim().replace(/\s+/g, ' ');

  const totalRowStyle = `
    background-color: #f8f9fa;
    font-weight: bold;
  `.trim().replace(/\s+/g, ' ');

  const totalCellStyle = `
    padding: 12px 16px;
    border: 1px solid #2c3e50;
    text-align: left;
    font-weight: bold;
    font-size: 12pt;
  `.trim().replace(/\s+/g, ' ');

  const totalCellRightStyle = `
    padding: 12px 16px;
    border: 1px solid #2c3e50;
    text-align: right;
    font-weight: bold;
    font-size: 12pt;
  `.trim().replace(/\s+/g, ' ');

  let rows = `
    <tr>
      <td style="${cellStyle}">Design Fee</td>
      <td style="${cellRightStyle}">${formatCurrency(breakdown.totalDesignFee)}</td>
    </tr>
    <tr>
      <td style="${cellStyle}">Offsite (Manufacturing)</td>
      <td style="${cellRightStyle}">${formatCurrency(breakdown.totalOffsite)}</td>
    </tr>
  `;

  if (isCMOS && breakdown.totalOnsite > 0) {
    rows += `
    <tr>
      <td style="${cellStyle}">Onsite Services</td>
      <td style="${cellRightStyle}">${formatCurrency(breakdown.totalOnsite)}</td>
    </tr>
    `;
  }

  if (breakdown.totalCustomizations && breakdown.totalCustomizations > 0) {
    rows += `
    <tr>
      <td style="${cellStyle}">Customizations</td>
      <td style="${cellRightStyle}">${formatCurrency(breakdown.totalCustomizations)}</td>
    </tr>
    `;
  }

  return `
<table style="${tableStyle}">
  <thead>
    <tr>
      <th style="${headerCellStyle}">Item</th>
      <th style="${headerCellRightStyle}">Cost</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr style="${totalRowStyle}">
      <td style="${totalCellStyle}">Contract Total</td>
      <td style="${totalCellRightStyle}">${formatCurrency(contractValue)}</td>
    </tr>
  </tbody>
</table>
  `.trim();
}

/**
 * Generates an HTML table showing payment schedule milestones
 * Shows Phase, Percentage, and Amount for each milestone
 */
export function generatePaymentScheduleHtml(paymentSchedule: PaymentMilestone[] | null): string {
  if (!paymentSchedule || paymentSchedule.length === 0) {
    return 'No payment schedule data found.';
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

  const headerCellCenterStyle = `
    background-color: #2c3e50;
    color: white;
    padding: 12px 16px;
    text-align: center;
    font-weight: bold;
    border: 1px solid #2c3e50;
  `.trim().replace(/\s+/g, ' ');

  const headerCellRightStyle = `
    background-color: #2c3e50;
    color: white;
    padding: 12px 16px;
    text-align: right;
    font-weight: bold;
    border: 1px solid #2c3e50;
  `.trim().replace(/\s+/g, ' ');

  const rows = paymentSchedule.map((milestone, index) => {
    const isEven = index % 2 === 0;
    const rowBg = isEven ? 'background-color: #ffffff;' : 'background-color: #f8f9fa;';
    
    const cellStyle = `
      padding: 10px 16px;
      border: 1px solid #ddd;
      text-align: left;
      ${rowBg}
    `.trim().replace(/\s+/g, ' ');

    const cellCenterStyle = `
      padding: 10px 16px;
      border: 1px solid #ddd;
      text-align: center;
      ${rowBg}
    `.trim().replace(/\s+/g, ' ');

    const cellRightStyle = `
      padding: 10px 16px;
      border: 1px solid #ddd;
      text-align: right;
      ${rowBg}
    `.trim().replace(/\s+/g, ' ');

    return `
    <tr>
      <td style="${cellStyle}">${milestone.name}</td>
      <td style="${cellCenterStyle}">${milestone.percentage}%</td>
      <td style="${cellRightStyle}">${formatCurrency(milestone.amount)}</td>
    </tr>
    `;
  }).join('');

  const total = paymentSchedule.reduce((sum, m) => sum + m.amount, 0);
  const totalPercent = paymentSchedule.reduce((sum, m) => sum + m.percentage, 0);

  const totalRowStyle = `
    background-color: #f0f0f0;
    font-weight: bold;
  `.trim().replace(/\s+/g, ' ');

  const totalCellStyle = `
    padding: 12px 16px;
    border: 1px solid #2c3e50;
    text-align: left;
    font-weight: bold;
  `.trim().replace(/\s+/g, ' ');

  const totalCellCenterStyle = `
    padding: 12px 16px;
    border: 1px solid #2c3e50;
    text-align: center;
    font-weight: bold;
  `.trim().replace(/\s+/g, ' ');

  const totalCellRightStyle = `
    padding: 12px 16px;
    border: 1px solid #2c3e50;
    text-align: right;
    font-weight: bold;
  `.trim().replace(/\s+/g, ' ');

  return `
<table style="${tableStyle}">
  <thead>
    <tr>
      <th style="${headerCellStyle}">Payment Milestone</th>
      <th style="${headerCellCenterStyle}">%</th>
      <th style="${headerCellRightStyle}">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr style="${totalRowStyle}">
      <td style="${totalCellStyle}">Total</td>
      <td style="${totalCellCenterStyle}">${totalPercent}%</td>
      <td style="${totalCellRightStyle}">${formatCurrency(total)}</td>
    </tr>
  </tbody>
</table>
  `.trim();
}

/**
 * Unit Details interface for the unit breakdown table
 */
export interface UnitDetail {
  unitLabel: string;
  modelName: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  estimatedPrice: number; // in cents
}

/**
 * Generates an HTML table showing unit details breakdown
 * Columns: Unit #, Model Name, Specs (Bed/Bath/Sqft), Estimated Price
 */
export function generateUnitDetailsHtml(units: UnitDetail[] | null): string {
  if (!units || units.length === 0) {
    return 'No units configured.';
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

  const headerCellCenterStyle = `
    background-color: #2c3e50;
    color: white;
    padding: 12px 16px;
    text-align: center;
    font-weight: bold;
    border: 1px solid #2c3e50;
  `.trim().replace(/\s+/g, ' ');

  const headerCellRightStyle = `
    background-color: #2c3e50;
    color: white;
    padding: 12px 16px;
    text-align: right;
    font-weight: bold;
    border: 1px solid #2c3e50;
  `.trim().replace(/\s+/g, ' ');

  const rows = units.map((unit, index) => {
    const isEven = index % 2 === 0;
    const rowBg = isEven ? 'background-color: #ffffff;' : 'background-color: #f8f9fa;';
    
    const cellStyle = `
      padding: 10px 16px;
      border: 1px solid #ddd;
      text-align: left;
      ${rowBg}
    `.trim().replace(/\s+/g, ' ');

    const cellCenterStyle = `
      padding: 10px 16px;
      border: 1px solid #ddd;
      text-align: center;
      ${rowBg}
    `.trim().replace(/\s+/g, ' ');

    const cellRightStyle = `
      padding: 10px 16px;
      border: 1px solid #ddd;
      text-align: right;
      ${rowBg}
    `.trim().replace(/\s+/g, ' ');

    // Format specs: "3 Bed / 2 Bath / 1,500 sqft"
    const specs: string[] = [];
    if (unit.bedrooms !== undefined && unit.bedrooms !== null) {
      specs.push(`${unit.bedrooms} Bed`);
    }
    if (unit.bathrooms !== undefined && unit.bathrooms !== null) {
      specs.push(`${unit.bathrooms} Bath`);
    }
    if (unit.squareFootage !== undefined && unit.squareFootage !== null) {
      specs.push(`${unit.squareFootage.toLocaleString()} sqft`);
    }
    const specsStr = specs.length > 0 ? specs.join(' / ') : '-';

    return `
    <tr>
      <td style="${cellStyle}">${unit.unitLabel || `Unit ${index + 1}`}</td>
      <td style="${cellStyle}">${unit.modelName || '-'}</td>
      <td style="${cellCenterStyle}">${specsStr}</td>
      <td style="${cellRightStyle}">${formatCurrency(unit.estimatedPrice)}</td>
    </tr>
    `;
  }).join('');

  const totalPrice = units.reduce((sum, u) => sum + (u.estimatedPrice || 0), 0);

  const totalRowStyle = `
    background-color: #f0f0f0;
    font-weight: bold;
  `.trim().replace(/\s+/g, ' ');

  const totalCellStyle = `
    padding: 12px 16px;
    border: 1px solid #2c3e50;
    text-align: left;
    font-weight: bold;
  `.trim().replace(/\s+/g, ' ');

  const totalCellRightStyle = `
    padding: 12px 16px;
    border: 1px solid #2c3e50;
    text-align: right;
    font-weight: bold;
  `.trim().replace(/\s+/g, ' ');

  return `
<table style="${tableStyle}">
  <thead>
    <tr>
      <th style="${headerCellStyle}">Unit #</th>
      <th style="${headerCellStyle}">Model Name</th>
      <th style="${headerCellCenterStyle}">Specs</th>
      <th style="${headerCellRightStyle}">Estimated Price</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr style="${totalRowStyle}">
      <td style="${totalCellStyle}" colspan="3">Total (${units.length} Unit${units.length !== 1 ? 's' : ''})</td>
      <td style="${totalCellRightStyle}">${formatCurrency(totalPrice)}</td>
    </tr>
  </tbody>
</table>
  `.trim();
}
