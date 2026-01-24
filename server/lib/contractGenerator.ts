import puppeteer from 'puppeteer-core';

interface ContractGenerationOptions {
  contractType: 'ONE' | 'MANUFACTURING' | 'ONSITE';
  projectData: Record<string, any>;
  format?: 'pdf' | 'html';
}

interface Clause {
  id: number;
  clause_code: string;
  name: string;
  content: string;
  contract_type: string;
  hierarchy_level: number;
  category: string;
  conditions?: any;
  variables_used?: string[];
  sort_order: number;
}

export async function generateContract(options: ContractGenerationOptions): Promise<Buffer> {
  const { contractType, projectData, format = 'pdf' } = options;
  
  console.log(`\n=== Generating ${contractType} Contract (${format.toUpperCase()}) ===`);
  
  const clauses = await fetchClausesForContract(contractType, projectData);
  console.log(`✓ Fetched ${clauses.length} clauses`);
  
  const variableMap = buildVariableMap(projectData);
  console.log(`✓ Built variable map with ${Object.keys(variableMap).length} variables`);
  
  const processedClauses = clauses.map(clause => ({
    ...clause,
    content: replaceVariables(clause.content, variableMap)
  }));
  console.log(`✓ Processed ${processedClauses.length} clauses with variable replacement`);
  
  const html = generateHTMLFromClauses(processedClauses, contractType, projectData);
  
  if (format === 'html') {
    return Buffer.from(html, 'utf-8');
  }
  
  const pdfBuffer = await convertHTMLToPDF(html);
  console.log(`✓ Generated PDF: ${pdfBuffer.length} bytes\n`);
  
  return pdfBuffer;
}

async function fetchClausesForContract(
  contractType: string, 
  projectData: Record<string, any>
): Promise<Clause[]> {
  try {
    const contractTypeMap: Record<string, string> = {
      'ONE': 'ONE Agreement',
      'MANUFACTURING': 'MANUFACTURING',
      'ONSITE': 'ONSITE',
    };
    const mappedType = contractTypeMap[contractType] || contractType;
    
    const url = `http://localhost:5000/api/clauses?contractType=${encodeURIComponent(mappedType)}`;
    console.log(`Fetching clauses from: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch clauses: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const allClauses: Clause[] = data.clauses || [];
    
    console.log(`Received ${allClauses.length} total clauses from API`);
    
    const serviceModel = projectData.serviceModel || 'CRC';
    console.log(`Filtering clauses for service model: ${serviceModel}`);
    
    const filteredClauses = allClauses.filter(clause => {
      if (!clause.conditions) return true;
      
      let conditions = clause.conditions;
      if (typeof conditions === 'string') {
        try {
          conditions = JSON.parse(conditions);
        } catch (e) {
          console.warn(`Failed to parse conditions for clause ${clause.clause_code}:`, conditions);
          return true;
        }
      }
      
      if (conditions.serviceModel && conditions.serviceModel !== serviceModel) {
        console.log(`Excluding clause ${clause.clause_code} (requires ${conditions.serviceModel}, have ${serviceModel})`);
        return false;
      }
      
      return true;
    });
    
    console.log(`After filtering: ${filteredClauses.length} clauses will be included`);
    
    return filteredClauses.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
  } catch (error) {
    console.error('Error fetching clauses:', error);
    throw error;
  }
}

function replaceVariables(content: string, variableMap: Record<string, string>): string {
  if (!content) return '';
  
  let result = content;
  
  Object.entries(variableMap).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value || '[NOT PROVIDED]');
  });
  
  return result;
}

function generateHTMLFromClauses(
  clauses: Clause[],
  contractType: string,
  projectData: Record<string, any>
): string {
  const title = getContractTitle(contractType);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @page {
      size: letter;
      margin: 1in 1in 0.75in 1in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.15;
      color: #000;
      background: #fff;
    }
    
    .contract-container {
      max-width: 6.5in;
      margin: 0 auto;
    }
    
    /* Title Page Styles */
    .title-page {
      text-align: center;
      padding-top: 1.5in;
      page-break-after: always;
      min-height: 8in;
    }
    
    .contract-title {
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 36pt;
      color: #1a73e8;
    }
    
    .project-info {
      font-size: 16pt;
      margin-bottom: 8pt;
      line-height: 1.4;
      color: #333;
    }
    
    .date-line {
      margin-top: 36pt;
      font-size: 12pt;
      color: #666;
    }
    
    .parties-section {
      margin-top: 48pt;
      text-align: left;
      padding: 0 20pt;
    }
    
    .parties-section .party {
      margin-bottom: 12pt;
    }
    
    /* Contract Body Styles */
    .contract-body {
      text-align: left;
    }
    
    /* Document Summary Box */
    .document-summary {
      background-color: #e8f0fe;
      border: 1px solid #1a73e8;
      border-radius: 4px;
      padding: 16pt;
      margin-bottom: 24pt;
      page-break-inside: avoid;
    }
    
    .document-summary h2 {
      color: #1a73e8;
      font-size: 14pt;
      margin-bottom: 12pt;
      border-bottom: none;
    }
    
    .document-summary p {
      text-indent: 0;
      margin-bottom: 8pt;
      font-size: 10pt;
    }
    
    /* Roman numeral sections (I. ATTACHMENTS, II. AGREEMENT) */
    .roman-section {
      font-size: 14pt;
      font-weight: bold;
      color: #1a73e8;
      margin-top: 24pt;
      margin-bottom: 12pt;
      padding-bottom: 4pt;
      border-bottom: 2px solid #1a73e8;
      page-break-after: avoid;
    }
    
    /* Section Headers (Section 1. Scope of Services) */
    .section-header {
      font-size: 13pt;
      font-weight: bold;
      color: #1a73e8;
      margin-top: 20pt;
      margin-bottom: 10pt;
      page-break-after: avoid;
    }
    
    /* Subsection Headers (1.1. Overview) */
    .subsection-header {
      font-size: 11pt;
      font-weight: bold;
      margin-top: 14pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    
    /* Paragraph level (1.1.1) */
    .paragraph-header {
      font-size: 11pt;
      font-weight: bold;
      display: inline;
    }
    
    /* Regular paragraphs */
    p {
      margin-bottom: 10pt;
      text-align: left;
      line-height: 1.15;
      text-indent: 0;
    }
    
    p.indented {
      margin-left: 0.25in;
    }
    
    /* Clause numbering */
    .clause-number {
      font-weight: bold;
    }
    
    .inline-clause {
      margin-bottom: 10pt;
      line-height: 1.15;
      margin-left: 0.25in;
    }
    
    .inline-clause .clause-number {
      margin-right: 4pt;
    }
    
    /* Lists */
    ol, ul {
      margin: 8pt 0 8pt 0.5in;
      padding-left: 0;
    }
    
    ol {
      list-style-type: lower-alpha;
    }
    
    ol ol {
      list-style-type: lower-roman;
    }
    
    li {
      margin-bottom: 6pt;
      line-height: 1.15;
    }
    
    /* Tables - Professional styling matching Google Docs */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0 16pt 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    
    table thead {
      background-color: #1a73e8;
    }
    
    table th {
      background-color: #1a73e8;
      color: #fff;
      font-weight: bold;
      padding: 8pt 10pt;
      text-align: left;
      vertical-align: middle;
      border: 1px solid #1a73e8;
    }
    
    table td {
      border: 1px solid #dadce0;
      padding: 8pt 10pt;
      text-align: left;
      vertical-align: top;
    }
    
    table tr:nth-child(even) {
      background-color: #f8f9fa;
    }
    
    table tr:hover {
      background-color: #e8f0fe;
    }
    
    /* Financial tables */
    table.financial td:last-child,
    table.financial th:last-child {
      text-align: right;
    }
    
    table.financial td:first-child {
      font-weight: 500;
    }
    
    /* Compact tables for schedules */
    table.compact {
      font-size: 9pt;
    }
    
    table.compact td,
    table.compact th {
      padding: 4pt 6pt;
    }
    
    /* Totals row styling */
    table tr.total-row {
      background-color: #e8f0fe !important;
      font-weight: bold;
    }
    
    table tr.total-row td {
      border-top: 2px solid #1a73e8;
    }
    
    /* Signature Block */
    .signature-section {
      margin-top: 36pt;
      page-break-inside: avoid;
    }
    
    .signature-block {
      margin-top: 24pt;
      page-break-inside: avoid;
    }
    
    .signature-line {
      border-bottom: 1px solid #000;
      width: 3in;
      margin-top: 24pt;
      margin-bottom: 4pt;
    }
    
    .signature-name {
      font-size: 10pt;
      margin-top: 4pt;
    }
    
    .signature-title {
      font-size: 9pt;
      color: #666;
    }
    
    /* Exhibit/Schedule headers */
    .exhibit-header {
      font-size: 16pt;
      font-weight: bold;
      text-align: center;
      color: #1a73e8;
      margin-top: 24pt;
      margin-bottom: 16pt;
      page-break-before: always;
    }
    
    /* Recitals / Whereas clauses */
    .recitals {
      margin-top: 16pt;
      margin-bottom: 16pt;
      background-color: #f8f9fa;
      padding: 12pt;
      border-left: 3px solid #1a73e8;
    }
    
    .recitals-title {
      font-weight: bold;
      font-size: 12pt;
      margin-bottom: 10pt;
      color: #1a73e8;
    }
    
    .recital {
      margin-bottom: 8pt;
      font-size: 10pt;
    }
    
    .recital-label {
      font-weight: bold;
    }
    
    /* Agreement statement */
    .agreement-statement {
      margin-top: 16pt;
      margin-bottom: 20pt;
      font-size: 10pt;
      font-style: italic;
      text-align: center;
    }
    
    /* Important notices */
    .notice-box {
      background-color: #fef7e0;
      border: 1px solid #f9ab00;
      border-radius: 4px;
      padding: 12pt;
      margin: 12pt 0;
      font-size: 10pt;
    }
    
    .notice-box strong {
      color: #e37400;
    }
    
    /* Indentation levels */
    .indent-1 { margin-left: 0.25in; }
    .indent-2 { margin-left: 0.5in; }
    .indent-3 { margin-left: 0.75in; }
    
    /* Keep headers with following content */
    h1, h2, h3, .roman-section, .section-header, .subsection-header {
      page-break-after: avoid;
      orphans: 3;
      widows: 3;
    }
    
    /* Prevent orphaned lines */
    p {
      orphans: 2;
      widows: 2;
    }
    
    /* Page footer */
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9pt;
      color: #666;
      padding: 8pt;
    }
    
    @media print {
      .contract-container {
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <div class="contract-container">
    ${renderTitlePage(title, projectData)}
    ${renderClausesHTML(clauses, projectData)}
  </div>
</body>
</html>
  `.trim();
}

function renderTitlePage(title: string, projectData: Record<string, any>): string {
  const projectNumber = projectData.projectNumber || '[NUMBER]';
  const projectName = projectData.projectName || '[PROJECT NAME]';
  
  return `
    <div class="title-page">
      <div class="contract-title">
        ${title}
      </div>
      
      <div class="project-info">
        <div style="font-size: 18pt; color: #1a73e8; margin-bottom: 8pt;">
          ${escapeHtml(projectNumber)} - ${escapeHtml(projectName)}
        </div>
      </div>
      
      ${projectData.agreementDate ? `
        <div class="date-line">
          ${formatDate(projectData.agreementDate)}
        </div>
      ` : ''}
    </div>
  `;
}

function renderClausesHTML(clauses: Clause[], projectData: Record<string, any>): string {
  let html = '<div class="contract-body">';
  
  // Add document summary section (like the Google Doc)
  html += renderDocumentSummary(projectData);
  
  // Add recitals section
  html += renderRecitals(projectData);
  
  let currentSection = '';
  
  for (const clause of clauses) {
    const hierarchyLevel = typeof clause.hierarchy_level === 'number' ? clause.hierarchy_level : parseInt(String(clause.hierarchy_level)) || 1;
    const content = clause.content ? formatContent(clause.content) : '';
    const clauseCode = clause.clause_code || '';
    const clauseName = clause.name || '';
    
    // Check for Roman numeral sections (I., II., etc.)
    const isRomanSection = /^[IVX]+\.?\s/.test(clauseCode) || /^[IVX]+\.?\s/.test(clauseName);
    
    if (hierarchyLevel === 1) {
      if (isRomanSection) {
        // Roman numeral section header (I. ATTACHMENTS, II. AGREEMENT)
        html += `
          <div class="roman-section">
            ${escapeHtml(clauseCode)} ${escapeHtml(clauseName.toUpperCase())}
          </div>
          ${content ? `<p>${content}</p>` : ''}
        `;
      } else {
        // Section header (Section 1. Scope of Services)
        html += `
          <div class="section-header">
            ${clauseCode ? `Section ${escapeHtml(clauseCode)} ` : ''}${escapeHtml(clauseName)}
          </div>
          ${content ? `<p>${content}</p>` : ''}
        `;
      }
    } else if (hierarchyLevel === 2) {
      // Subsection (1.1. Overview)
      html += `
        <div class="subsection-header">
          ${clauseCode ? `${escapeHtml(clauseCode)} ` : ''}${escapeHtml(clauseName)}
        </div>
        ${content ? `<p>${content}</p>` : ''}
      `;
    } else {
      // Paragraph level (1.1.1 or deeper)
      if (clauseCode && clauseCode.trim()) {
        html += `
          <div class="inline-clause">
            <span class="paragraph-header">${escapeHtml(clauseCode)}</span>
            ${clauseName ? ` <span style="font-weight: bold;">${escapeHtml(clauseName)}.</span>` : ''}
            ${content}
          </div>
        `;
      } else {
        html += `<p class="indented">${content}</p>`;
      }
    }
  }
  
  // Add signature blocks
  html += renderSignatureBlocks(projectData);
  
  html += '</div>';
  return html;
}

function renderDocumentSummary(projectData: Record<string, any>): string {
  const clientName = projectData.clientLegalName || projectData.clientFullName || '[CLIENT NAME]';
  const designFee = formatCurrency(projectData.designFee || 0);
  const totalPrice = formatCurrency(projectData.totalPreliminaryContractPrice || 0);
  
  return `
    <div class="document-summary">
      <h2>Document Summary</h2>
      <p><strong>What the Client is Signing:</strong></p>
      <p><strong>1. Services:</strong> Company will provide design, engineering, manufacturing, and delivery services for modular home(s) as specified in this Agreement.</p>
      <p><strong>2. Initial Payment:</strong> Design & Engineering Fee of ${designFee} is due upon signing.</p>
      <p><strong>3. What Happens Next:</strong> After design approval, production begins per the milestone payment schedule.</p>
      <p><strong>4. Important Notes:</strong> This is a preliminary pricing agreement. Final costs will be confirmed during the design phase.</p>
      <p><strong>5. Client's Responsibilities:</strong> Provide site access, project information, and timely approvals as outlined.</p>
      <p><strong>6. When Does This End?</strong> Either party may exit at designated milestones per Section 10.</p>
      <p><strong>7. Peace of Mind Guarantee:</strong> Limited warranty coverage as described in Section 6.</p>
    </div>
  `;
}

function renderRecitals(projectData: Record<string, any>): string {
  const clientName = projectData.clientLegalName || projectData.clientFullName || '[CLIENT NAME]';
  const llcName = projectData.childLlcName || 'Dvele Partners LLC';
  const siteAddress = projectData.siteAddress || '[ADDRESS]';
  const siteCity = projectData.siteCity || '[CITY]';
  const siteState = projectData.siteState || '[STATE]';
  const totalUnits = projectData.totalUnits || '1';
  
  return `
    <div class="recitals">
      <div class="recitals-title">RECITALS</div>
      
      <p class="recital">
        This Master Purchase Agreement ("Agreement") is entered into as of the Effective Date by and between 
        <strong>${escapeHtml(llcName)}</strong>, a Delaware limited liability company ("Company"), and 
        <strong>${escapeHtml(clientName)}</strong>${projectData.clientEntityType ? `, a ${escapeHtml(projectData.clientState || '')} ${escapeHtml(getEntityTypeText(projectData.clientEntityType))}` : ''} ("Client").
      </p>
      
      <p class="recital">
        <span class="recital-label">WHEREAS,</span> Company is engaged in the business of designing, 
        manufacturing, and delivering prefabricated modular homes; and
      </p>
      
      <p class="recital">
        <span class="recital-label">WHEREAS,</span> Client desires to engage Company to design, manufacture, 
        and deliver ${escapeHtml(totalUnits)} modular home unit(s) to the property located at 
        ${escapeHtml(siteAddress)}, ${escapeHtml(siteCity)}, ${escapeHtml(siteState)} (the "Project Site"); and
      </p>
      
      <p class="recital">
        <span class="recital-label">WHEREAS,</span> Company is willing to perform such services upon the terms 
        and conditions set forth herein.
      </p>
      
      <p class="recital" style="font-weight: bold; text-align: center; margin-top: 12pt;">
        NOW, THEREFORE, in consideration of the mutual covenants herein, the parties agree as follows:
      </p>
    </div>
  `;
}

function renderSignatureBlocks(projectData: Record<string, any>): string {
  const clientName = projectData.clientLegalName || projectData.clientFullName || '[CLIENT NAME]';
  const llcName = projectData.childLlcName || 'Dvele Partners LLC';
  
  return `
    <div class="signature-section" style="margin-top: 48pt; page-break-inside: avoid;">
      <p style="font-weight: bold; margin-bottom: 24pt;">
        IN WITNESS WHEREOF, the parties hereto have executed this Agreement as of the date first written above.
      </p>
      
      <table style="width: 100%; border: none; margin-top: 24pt;">
        <tr>
          <td style="width: 48%; border: none; vertical-align: top; padding-right: 20pt;">
            <div style="font-weight: bold; color: #1a73e8; margin-bottom: 8pt;">COMPANY:</div>
            <div style="font-weight: bold; margin-bottom: 24pt;">${escapeHtml(llcName)}</div>
            <div style="border-bottom: 1px solid #000; margin-bottom: 4pt; height: 24pt;"></div>
            <div style="font-size: 9pt; color: #666;">Signature</div>
            <div style="margin-top: 16pt; border-bottom: 1px solid #000; margin-bottom: 4pt; height: 18pt;"></div>
            <div style="font-size: 9pt; color: #666;">Name (Print)</div>
            <div style="margin-top: 16pt; border-bottom: 1px solid #000; margin-bottom: 4pt; height: 18pt;"></div>
            <div style="font-size: 9pt; color: #666;">Title</div>
            <div style="margin-top: 16pt; border-bottom: 1px solid #000; margin-bottom: 4pt; height: 18pt;"></div>
            <div style="font-size: 9pt; color: #666;">Date</div>
          </td>
          <td style="width: 4%; border: none;"></td>
          <td style="width: 48%; border: none; vertical-align: top;">
            <div style="font-weight: bold; color: #1a73e8; margin-bottom: 8pt;">CLIENT:</div>
            <div style="font-weight: bold; margin-bottom: 24pt;">${escapeHtml(clientName)}</div>
            <div style="border-bottom: 1px solid #000; margin-bottom: 4pt; height: 24pt;"></div>
            <div style="font-size: 9pt; color: #666;">Signature</div>
            <div style="margin-top: 16pt; border-bottom: 1px solid #000; margin-bottom: 4pt; height: 18pt;"></div>
            <div style="font-size: 9pt; color: #666;">Name (Print): ${projectData.clientSignerName ? escapeHtml(projectData.clientSignerName) : ''}</div>
            <div style="margin-top: 16pt; border-bottom: 1px solid #000; margin-bottom: 4pt; height: 18pt;"></div>
            <div style="font-size: 9pt; color: #666;">Title: ${projectData.clientTitle ? escapeHtml(projectData.clientTitle) : ''}</div>
            <div style="margin-top: 16pt; border-bottom: 1px solid #000; margin-bottom: 4pt; height: 18pt;"></div>
            <div style="font-size: 9pt; color: #666;">Date</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function formatContent(content: string): string {
  if (!content) return '';
  
  // Check if content contains table markers or tab-separated data
  if (content.includes('|') && content.split('\n').some(line => line.includes('|'))) {
    return formatTableContent(content);
  }
  
  let escaped = escapeHtml(content);
  
  // Handle bullet points
  escaped = escaped.replace(/^[\s]*[-•]\s+(.+)$/gm, '<li>$1</li>');
  if (escaped.includes('<li>')) {
    escaped = escaped.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul style="margin: 8pt 0 8pt 24pt;">$1</ul>');
  }
  
  // Handle numbered lists (1., 2., etc.)
  escaped = escaped.replace(/^[\s]*(\d+)\.\s+(.+)$/gm, '<li value="$1">$2</li>');
  
  // Handle lettered lists (a., b., etc.)
  escaped = escaped.replace(/^[\s]*([a-z])\.\s+(.+)$/gm, '<li>$2</li>');
  
  // Convert double newlines to paragraph breaks
  escaped = escaped.replace(/\n\n/g, '</p><p>');
  
  // Convert single newlines to line breaks
  escaped = escaped.replace(/\n/g, '<br>');
  
  return escaped;
}

function formatTableContent(content: string): string {
  const lines = content.split('\n').filter(line => line.trim());
  let html = '<table>';
  let isFirstRow = true;
  
  for (const line of lines) {
    if (line.includes('|')) {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      
      // Skip separator rows (----)
      if (cells.every(cell => /^[-:]+$/.test(cell))) {
        continue;
      }
      
      if (isFirstRow) {
        html += '<thead><tr>';
        for (const cell of cells) {
          html += `<th>${escapeHtml(cell)}</th>`;
        }
        html += '</tr></thead><tbody>';
        isFirstRow = false;
      } else {
        // Check if this is a total row
        const isTotalRow = cells.some(cell => /total|sum|subtotal/i.test(cell));
        html += `<tr${isTotalRow ? ' class="total-row"' : ''}>`;
        for (const cell of cells) {
          html += `<td>${escapeHtml(cell)}</td>`;
        }
        html += '</tr>';
      }
    } else {
      // Non-table line, add as a spanning cell or skip
      if (line.trim()) {
        html += `<tr><td colspan="100">${escapeHtml(line)}</td></tr>`;
      }
    }
  }
  
  html += '</tbody></table>';
  return html;
}

async function convertHTMLToPDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in'
      },
      printBackground: true,
      displayHeaderFooter: false
    });
    
    return Buffer.from(pdfBuffer);
    
  } finally {
    await browser.close();
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function getContractTitle(contractType: string): string {
  const titles: Record<string, string> = {
    'ONE': 'MASTER PURCHASE AGREEMENT',
    'MANUFACTURING': 'MANUFACTURING SUBCONTRACTOR AGREEMENT',
    'ONSITE': 'ON-SITE INSTALLATION SUBCONTRACTOR AGREEMENT'
  };
  return titles[contractType] || 'CONTRACT AGREEMENT';
}

function buildVariableMap(projectData: Record<string, any>): Record<string, string> {
  const map: Record<string, string> = {};
  
  map['PROJECT_NUMBER'] = projectData.projectNumber || '';
  map['PROJECT_NAME'] = projectData.projectName || '';
  map['TOTAL_UNITS'] = projectData.totalUnits?.toString() || '1';
  map['AGREEMENT_EXECUTION_DATE'] = formatDate(projectData.agreementDate);
  
  map['CLIENT_LEGAL_NAME'] = projectData.clientLegalName || '';
  map['CLIENT_STATE'] = projectData.clientState || '';
  map['CLIENT_ENTITY_TYPE'] = getEntityTypeText(projectData.clientEntityType);
  map['CLIENT_EMAIL'] = projectData.clientEmail || '';
  map['CLIENT_PHONE'] = projectData.clientPhone || '';
  map['CLIENT_SIGNER_NAME'] = projectData.clientSignerName || '';
  map['CLIENT_FULL_NAME'] = projectData.clientFullName || projectData.clientLegalName || '';
  map['CLIENT_TITLE'] = projectData.clientTitle || '';
  
  const llcBaseName = projectData.childLlcName?.replace(' LLC', '').replace(', LLC', '') || 'Dvele Partners';
  map['DVELE_PARTNERS_XYZ'] = llcBaseName;
  map['DVELE_PARTNERS_XYZ_LEGAL_NAME'] = projectData.childLlcName || '';
  map['DVELE_PARTNERS_XYZ_STATE'] = projectData.childLlcState || 'Delaware';
  map['DVELE_PARTNERS_XYZ_ENTITY_TYPE'] = 'limited liability company';
  map['DP_X'] = projectData.childLlcName || '';
  map['DP_X_STATE'] = projectData.childLlcState || 'Delaware';
  
  map['DELIVERY_ADDRESS'] = formatAddress(projectData);
  map['SITE_ADDRESS'] = projectData.siteAddress || '';
  map['SITE_CITY'] = projectData.siteCity || '';
  map['SITE_STATE'] = projectData.siteState || '';
  map['SITE_ZIP'] = projectData.siteZip || '';
  map['SITE_COUNTY'] = projectData.siteCounty || '';
  
  const totalUnits = parseInt(projectData.totalUnits) || 1;
  for (let i = 1; i <= totalUnits; i++) {
    map[`UNIT_${i}_MODEL`] = projectData[`unit${i}Model`] || '';
    map[`UNIT_${i}_SQFT`] = projectData[`unit${i}Sqft`] || '';
    map[`UNIT_${i}_BEDROOMS`] = projectData[`unit${i}Bedrooms`]?.toString() || '';
    map[`UNIT_${i}_BATHROOMS`] = projectData[`unit${i}Bathrooms`]?.toString() || '';
    map[`UNIT_${i}_PRICE`] = formatCurrency(projectData[`unit${i}Price`]);
  }
  
  map['HOME_MODEL'] = projectData.unit1Model || '';
  map['HOME_MODEL_1'] = projectData.unit1Model || '';
  
  map['DESIGN_FEE'] = formatCurrency(projectData.designFee);
  map['DESIGN_REVISION_ROUNDS'] = projectData.designRevisionRounds?.toString() || '3';
  map['PRELIMINARY_OFFSITE_PRICE'] = formatCurrency(projectData.preliminaryOffsitePrice);
  map['DELIVERY_INSTALLATION_PRICE'] = formatCurrency(projectData.deliveryInstallationPrice);
  map['TOTAL_PRELIMINARY_CONTRACT_PRICE'] = formatCurrency(projectData.totalPreliminaryContractPrice);
  
  map['MILESTONE_1_PERCENT'] = projectData.milestone1Percent?.toString() || '20';
  map['MILESTONE_2_PERCENT'] = projectData.milestone2Percent?.toString() || '20';
  map['MILESTONE_3_PERCENT'] = projectData.milestone3Percent?.toString() || '20';
  map['MILESTONE_4_PERCENT'] = projectData.milestone4Percent?.toString() || '20';
  map['MILESTONE_5_PERCENT'] = projectData.milestone5Percent?.toString() || '15';
  map['RETAINAGE_PERCENT'] = projectData.retainagePercent?.toString() || '5';
  map['RETAINAGE_DAYS'] = projectData.retainageDays?.toString() || '60';
  
  const totalPrice = parseFloat(projectData.totalPreliminaryContractPrice || '0');
  map['MILESTONE_1_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['MILESTONE_1_PERCENT']) / 100));
  map['MILESTONE_2_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['MILESTONE_2_PERCENT']) / 100));
  map['MILESTONE_3_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['MILESTONE_3_PERCENT']) / 100));
  map['MILESTONE_4_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['MILESTONE_4_PERCENT']) / 100));
  map['MILESTONE_5_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['MILESTONE_5_PERCENT']) / 100));
  map['RETAINAGE_AMOUNT'] = formatCurrency(totalPrice * (parseFloat(map['RETAINAGE_PERCENT']) / 100));
  
  map['MANUFACTURING_DESIGN_PAYMENT'] = formatCurrency(projectData.manufacturingDesignPayment);
  map['MANUFACTURING_PRODUCTION_START'] = formatCurrency(projectData.manufacturingProductionStart);
  map['MANUFACTURING_PRODUCTION_COMPLETE'] = formatCurrency(projectData.manufacturingProductionComplete);
  map['MANUFACTURING_DELIVERY_READY'] = formatCurrency(projectData.manufacturingDeliveryReady);
  
  map['AGREEMENT_DATE'] = formatDate(projectData.agreementDate);
  map['EFFECTIVE_DATE'] = formatDate(projectData.effectiveDate);
  map['ESTIMATED_COMPLETION_DATE'] = calculateEstimatedCompletion(projectData);
  map['DESIGN_PHASE_DAYS'] = projectData.designPhaseDays?.toString() || '90';
  map['MANUFACTURING_DURATION_DAYS'] = projectData.manufacturingDurationDays?.toString() || '120';
  map['ONSITE_DURATION_DAYS'] = projectData.onsiteDurationDays?.toString() || '90';
  
  map['WARRANTY_FIT_FINISH_MONTHS'] = projectData.warrantyFitFinishMonths?.toString() || '24';
  map['WARRANTY_BUILDING_ENVELOPE_MONTHS'] = projectData.warrantyBuildingEnvelopeMonths?.toString() || '60';
  map['WARRANTY_STRUCTURAL_MONTHS'] = projectData.warrantyStructuralMonths?.toString() || '120';
  
  map['PROJECT_STATE'] = projectData.siteState || '';
  map['PROJECT_COUNTY'] = projectData.projectCounty || projectData.siteCounty || '';
  map['PROJECT_FEDERAL_DISTRICT'] = projectData.projectFederalDistrict || '';
  map['ARBITRATION_PROVIDER'] = projectData.arbitrationProvider || 'JAMS';
  
  map['ON_SITE_SERVICES_SELECTION'] = projectData.serviceModel === 'CRC' 
    ? 'CLIENT-RETAINED CONTRACTOR' 
    : 'COMPANY-MANAGED ON-SITE SERVICES';
  
  if (projectData.serviceModel === 'CRC') {
    map['ONSITE_PROVIDER_NAME'] = projectData.contractorName || '';
    map['CONTRACTOR_LICENSE'] = projectData.contractorLicense || '';
    map['CONTRACTOR_NAME'] = projectData.contractorName || '';
  }
  
  if (projectData.serviceModel === 'CMOS') {
    map['SITE_PREP_PRICE'] = formatCurrency(projectData.sitePrepPrice);
    map['UTILITIES_PRICE'] = formatCurrency(projectData.utilitiesPrice);
    map['COMPLETION_PRICE'] = formatCurrency(projectData.completionPrice);
  }
  
  return map;
}

function formatCurrency(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '$0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatAddress(projectData: Record<string, any>): string {
  const parts = [
    projectData.siteAddress,
    projectData.siteCity,
    projectData.siteState,
    projectData.siteZip
  ].filter(Boolean);
  return parts.join(', ');
}

function getEntityTypeText(entityType: string | undefined): string {
  const types: Record<string, string> = {
    'Individual': 'individual',
    'LLC': 'limited liability company',
    'Corporation': 'corporation',
    'Partnership': 'partnership',
    'Trust': 'trust'
  };
  return types[entityType || 'Individual'] || 'individual';
}

function calculateEstimatedCompletion(projectData: Record<string, any>): string {
  if (!projectData.effectiveDate) return '';
  
  const startDate = new Date(projectData.effectiveDate);
  const totalDays = (parseInt(projectData.designPhaseDays) || 0) +
                   (parseInt(projectData.manufacturingDurationDays) || 0) +
                   (parseInt(projectData.onsiteDurationDays) || 0);
  
  const completionDate = new Date(startDate);
  completionDate.setDate(completionDate.getDate() + totalDays);
  
  return formatDate(completionDate.toISOString());
}

export function getContractFilename(contractType: string, projectData: Record<string, any>, format: 'pdf' | 'docx' = 'pdf'): string {
  const projectName = (projectData.projectName || 'Contract').replace(/[^a-z0-9]/gi, '_');
  const projectNumber = (projectData.projectNumber || 'DRAFT').replace(/[^a-z0-9-]/gi, '_');
  
  const typeMap: Record<string, string> = {
    'ONE': 'one_agreement',
    'MANUFACTURING': 'manufacturing_sub',
    'ONSITE': 'onsite_sub'
  };
  
  const typeName = typeMap[contractType] || contractType.toLowerCase();
  return `${projectName}_${typeName}_${projectNumber}.${format}`;
}
