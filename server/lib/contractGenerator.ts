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

// Use special markers that won't be escaped by escapeHtml
const VAR_START = '\u0001VAR\u0002';
const VAR_END = '\u0001/VAR\u0002';
const PLACEHOLDER_START = '\u0001PH\u0002';
const PLACEHOLDER_END = '\u0001/PH\u0002';

function replaceVariables(content: string, variableMap: Record<string, string>): string {
  if (!content) return '';
  
  let result = content;
  
  // Replace variables with their values using special markers
  // These markers will be converted to HTML spans after formatting
  Object.entries(variableMap).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    const displayValue = value || '[NOT PROVIDED]';
    result = result.replace(regex, `${VAR_START}${displayValue}${VAR_END}`);
  });
  
  // Find any remaining unreplaced variables and log them
  const unreplaced = result.match(/\{\{([A-Z_0-9]+)\}\}/g);
  if (unreplaced && unreplaced.length > 0) {
    const uniqueUnreplaced = Array.from(new Set(unreplaced));
    console.warn('⚠️  Unreplaced variables found:', uniqueUnreplaced);
    // Replace with placeholder so we can see what's missing
    uniqueUnreplaced.forEach(variable => {
      const varName = variable.replace(/[{}]/g, '');
      result = result.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), `${PLACEHOLDER_START}[MISSING: ${varName}]${PLACEHOLDER_END}`);
    });
  }
  
  return result;
}

// Convert variable markers to HTML spans (call this after all formatting is done)
function convertVariableMarkersToHtml(html: string): string {
  return html
    .replace(new RegExp(VAR_START, 'g'), '<span class="variable-value">')
    .replace(new RegExp(VAR_END, 'g'), '</span>')
    .replace(new RegExp(PLACEHOLDER_START, 'g'), '<span class="variable-placeholder">')
    .replace(new RegExp(PLACEHOLDER_END, 'g'), '</span>');
}

function generateHTMLFromClauses(
  clauses: Clause[],
  contractType: string,
  projectData: Record<string, any>
): string {
  const title = getContractTitle(contractType);
  
  const rawHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @page {
      size: letter;
      margin: 1in 1in 1in 1in;
      @bottom-center {
        content: counter(page);
        font-family: 'Times New Roman', Times, serif;
        font-size: 10pt;
      }
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
    
    /* Variable substitutions - display in blue for easy visibility */
    .variable-value {
      color: #1a73e8;
      font-weight: 500;
    }
    
    /* Unsubstituted variables - display in blue with background */
    .variable-placeholder {
      color: #1a73e8;
      background-color: #e8f0fe;
      padding: 0 2pt;
      border-radius: 2pt;
      font-family: monospace;
      font-size: 10pt;
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
  
  // Convert variable markers to styled HTML spans
  return convertVariableMarkersToHtml(rawHtml);
}

function renderTitlePage(title: string, projectData: Record<string, any>): string {
  // Support both uppercase (from mapper) and camelCase (legacy) variable names
  const projectNumber = projectData.PROJECT_NUMBER || projectData.projectNumber || '[NUMBER]';
  const projectName = projectData.PROJECT_NAME || projectData.projectName || '[PROJECT NAME]';
  
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
      
      ${(projectData.AGREEMENT_EXECUTION_DATE || projectData.agreementDate) ? `
        <div class="date-line">
          ${formatDate(projectData.AGREEMENT_EXECUTION_DATE || projectData.agreementDate)}
        </div>
      ` : ''}
    </div>
  `;
}

// Helper function to strip duplicate headers from clause content
function stripDuplicateHeader(content: string, clauseName: string, clauseCode: string): string {
  if (!content) return '';
  
  let cleanContent = content.trim();
  
  // Normalize for comparison (uppercase, remove extra spaces, punctuation)
  const normalizeForCompare = (str: string) => 
    str.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  
  const normalizedName = normalizeForCompare(clauseName);
  const normalizedCode = normalizeForCompare(clauseCode);
  
  // Split content into lines
  const lines = cleanContent.split('\n');
  
  // Check if first non-empty line matches or is similar to clause name/code
  let startIndex = 0;
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const normalizedLine = normalizeForCompare(line);
    
    // If line matches clause name or code (or is very similar), skip it
    if (normalizedLine === normalizedName || 
        normalizedLine === normalizedCode ||
        normalizedName.includes(normalizedLine) ||
        normalizedLine.includes(normalizedName)) {
      startIndex = i + 1;
      break;
    }
    
    // Also check for section number patterns like "SECTION 1. SCOPE OF SERVICES"
    // or subsection patterns like "1.1. OVERVIEW"
    if (/^SECTION\s*\d+/i.test(line) || /^\d+\.\d+\.?\s*[A-Z]/i.test(line)) {
      const lineWithoutPrefix = line.replace(/^(SECTION\s*\d+\.?\s*|\d+\.\d+\.?\s*)/i, '');
      const nameWithoutPrefix = clauseName.replace(/^(Section\s*\d+\.?\s*|\d+\.\d+\.?\s*)/i, '');
      if (normalizeForCompare(lineWithoutPrefix) === normalizeForCompare(nameWithoutPrefix)) {
        startIndex = i + 1;
        break;
      }
    }
    
    break; // Only check first non-empty line
  }
  
  // Remove the duplicate header line(s)
  if (startIndex > 0) {
    lines.splice(0, startIndex);
    cleanContent = lines.join('\n').trim();
  }
  
  return cleanContent;
}

function renderClausesHTML(clauses: Clause[], projectData: Record<string, any>): string {
  let html = '<div class="contract-body">';
  
  // NOTE: Document Summary and other content comes from the clause library (database)
  // Do NOT add hardcoded sections here - the clauses contain all the content
  // in the correct order with proper variable substitution
  
  let currentSection = '';
  let currentExhibit = '';
  
  for (const clause of clauses) {
    const hierarchyLevel = typeof clause.hierarchy_level === 'number' ? clause.hierarchy_level : parseInt(String(clause.hierarchy_level)) || 1;
    const rawContent = clause.content || '';
    const clauseCode = clause.clause_code || '';
    const clauseName = clause.name || '';
    
    // Strip duplicate headers from content before formatting
    const strippedContent = stripDuplicateHeader(rawContent, clauseName, clauseCode);
    const content = strippedContent ? formatContent(strippedContent) : '';
    
    // Check for Roman numeral sections (I., II., etc.)
    const isRomanSection = /^[IVX]+\.?\s/.test(clauseCode) || /^[IVX]+\.?\s/.test(clauseName);
    
    // Check if this is a new top-level Exhibit (e.g., ONE-EXHIBIT-A, ONE-EXHIBIT-B, etc.)
    // Only match exact exhibit codes like EXHIBIT-A, EXHIBIT-B, not sub-clauses like EXHIBIT-A-1
    const exhibitMatch = clauseCode.match(/EXHIBIT-([A-G])$/);
    const isNewExhibit = exhibitMatch && exhibitMatch[1] !== currentExhibit;
    
    // Add page break before each new Exhibit
    if (isNewExhibit) {
      currentExhibit = exhibitMatch[1];
      html += `<div style="page-break-before: always;"></div>`;
    }
    
    if (hierarchyLevel === 1) {
      if (isRomanSection) {
        // Roman numeral section header (I. ATTACHMENTS, II. AGREEMENT)
        // Only show the name, not the clause_code to avoid duplication
        html += `
          <div class="roman-section">
            ${escapeHtml(clauseName.toUpperCase())}
          </div>
          ${content ? `<p>${content}</p>` : ''}
        `;
      } else {
        // Section header - only show the name, not the clause_code
        html += `
          <div class="section-header">
            ${escapeHtml(clauseName)}
          </div>
          ${content ? `<p>${content}</p>` : ''}
        `;
      }
    } else if (hierarchyLevel === 2) {
      // Subsection - only show the name, not the clause_code
      html += `
        <div class="subsection-header">
          ${escapeHtml(clauseName)}
        </div>
        ${content ? `<p>${content}</p>` : ''}
      `;
    } else {
      // Paragraph level - only show name and content, not clause_code
      if (clauseName && clauseName.trim()) {
        html += `
          <div class="inline-clause">
            <span style="font-weight: bold;">${escapeHtml(clauseName)}.</span>
            ${content}
          </div>
        `;
      } else if (content) {
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
  // Support both uppercase (from mapper) and camelCase (legacy) variable names
  const clientName = projectData.CLIENT_LEGAL_NAME || projectData.clientLegalName || projectData.clientFullName || '[CLIENT NAME]';
  const designFee = formatCurrency(projectData.DESIGN_FEE || projectData.designFee || 0);
  const totalPrice = formatCurrency(projectData.TOTAL_PRELIMINARY_CONTRACT_PRICE || projectData.totalPreliminaryContractPrice || 0);
  
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
  // Support both uppercase (from mapper) and camelCase (legacy) variable names
  const clientName = projectData.CLIENT_LEGAL_NAME || projectData.clientLegalName || projectData.clientFullName || '[CLIENT NAME]';
  const llcName = projectData.CHILD_LLC_LEGAL_NAME || projectData.childLlcName || 'Dvele Partners LLC';
  const siteAddress = projectData.DELIVERY_ADDRESS || projectData.siteAddress || '[ADDRESS]';
  const siteCity = projectData.DELIVERY_CITY || projectData.siteCity || '[CITY]';
  const siteState = projectData.DELIVERY_STATE || projectData.siteState || '[STATE]';
  const totalUnits = projectData.TOTAL_UNITS || projectData.totalUnits || '1';
  const clientEntityType = projectData.CLIENT_ENTITY_TYPE || projectData.clientEntityType || '';
  const clientState = projectData.CLIENT_STATE || projectData.clientState || '';
  
  return `
    <div class="recitals">
      <div class="recitals-title">RECITALS</div>
      
      <p class="recital">
        This Master Purchase Agreement ("Agreement") is entered into as of the Effective Date by and between 
        <strong>${escapeHtml(llcName)}</strong>, a Delaware limited liability company ("Company"), and 
        <strong>${escapeHtml(clientName)}</strong>${clientEntityType ? `, a ${escapeHtml(clientState)} ${escapeHtml(getEntityTypeText(clientEntityType))}` : ''} ("Client").
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
  // Support both uppercase (from mapper) and camelCase (legacy) variable names
  const clientName = projectData.CLIENT_LEGAL_NAME || projectData.clientLegalName || projectData.clientFullName || '[CLIENT NAME]';
  const llcName = projectData.CHILD_LLC_LEGAL_NAME || projectData.childLlcName || 'Dvele Partners LLC';
  const clientSignerName = projectData.CLIENT_SIGNER_NAME || projectData.clientSignerName || '';
  const clientTitle = projectData.CLIENT_TITLE || projectData.clientTitle || '';
  
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
            <div style="font-size: 9pt; color: #666;">Name (Print): ${clientSignerName ? escapeHtml(clientSignerName) : ''}</div>
            <div style="margin-top: 16pt; border-bottom: 1px solid #000; margin-bottom: 4pt; height: 18pt;"></div>
            <div style="font-size: 9pt; color: #666;">Title: ${clientTitle ? escapeHtml(clientTitle) : ''}</div>
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
  
  let html = '';
  const lines = content.split('\n');
  let inRomanList = false;      // Level 1: i., ii., iii.
  let inLetterList = false;     // Level 2: a., b., c.
  let romanListHtml = '';
  let letterListHtml = '';
  
  // Indentation constants (matching Google Doc style)
  const ROMAN_INDENT = '36pt';      // First level indent
  const LETTER_INDENT = '72pt';     // Second level indent (nested under roman)
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Detect roman numeral lists (i., ii., iii., iv., v., vi., vii., viii., ix., x.)
    const romanMatch = line.match(/^[\s]*(i{1,3}|iv|vi{0,3}|ix|x)\.\s+(.+)$/i);
    // Detect letter lists (a., b., c., etc.) - second level
    const letterMatch = line.match(/^[\s]*([a-z])\.\s+(.+)$/);
    // Detect numbered section headers (1. Services:, 2. Initial Payment:, etc.) - headers that END with colon
    const numberedHeaderMatch = line.match(/^[\s]*(\d+)\.\s+([^:]+:)\s*$/);
    // Detect numbered list items (1. Content here - full content items, not just headers)
    const numberedListMatch = line.match(/^[\s]*(\d+)\.\s+(.+)$/);
    
    if (romanMatch) {
      // Close letter list if open (it's nested, so close it first)
      if (inLetterList) {
        romanListHtml += `<div style="margin-left: ${LETTER_INDENT};">${letterListHtml}</div>`;
        letterListHtml = '';
        inLetterList = false;
      }
      if (!inRomanList) {
        inRomanList = true;
      }
      const romanContent = formatInlineStyles(escapeHtml(romanMatch[2]));
      const romanNumeral = romanMatch[1].toLowerCase();
      romanListHtml += `<div style="margin-bottom: 6pt; margin-left: ${ROMAN_INDENT}; display: flex;"><span style="flex-shrink: 0; width: 28pt;">${romanNumeral}.</span><span style="flex: 1;">${romanContent}</span></div>`;
    } else if (letterMatch && inRomanList) {
      // Only treat as nested letter list if we're inside a roman list
      if (!inLetterList) {
        inLetterList = true;
      }
      const letterContent = formatInlineStyles(escapeHtml(letterMatch[2]));
      const letter = letterMatch[1];
      letterListHtml += `<p style="margin-bottom: 6pt; text-indent: -16pt; padding-left: 16pt;">${letter}. ${letterContent}</p>`;
    } else if (letterMatch && !inRomanList) {
      // Standalone letter list (not nested) - used in some clauses
      if (!inLetterList) {
        inLetterList = true;
      }
      const letterContent = formatInlineStyles(escapeHtml(letterMatch[2]));
      const letter = letterMatch[1];
      letterListHtml += `<p style="margin-bottom: 6pt; margin-left: ${ROMAN_INDENT}; text-indent: -16pt; padding-left: 16pt;">${letter}. ${letterContent}</p>`;
    } else if (numberedHeaderMatch) {
      // Close any open lists first
      if (inLetterList) {
        if (inRomanList) {
          romanListHtml += `<div style="margin-left: ${LETTER_INDENT};">${letterListHtml}</div>`;
        } else {
          html += `<div>${letterListHtml}</div>`;
        }
        letterListHtml = '';
        inLetterList = false;
      }
      if (inRomanList) {
        html += `<div>${romanListHtml}</div>`;
        romanListHtml = '';
        inRomanList = false;
      }
      // Render as a bold numbered header (e.g., "1. Services:", "2. Initial Payment:")
      const num = numberedHeaderMatch[1];
      const headerText = numberedHeaderMatch[2];
      html += `<p style="margin-top: 12pt; margin-bottom: 8pt;"><strong>${escapeHtml(num)}. ${escapeHtml(headerText)}</strong></p>`;
    } else if (numberedListMatch) {
      // Handle numbered list items with full content (e.g., "1. Design and Engineering: $10,000")
      // Close any open lists first
      if (inLetterList) {
        if (inRomanList) {
          romanListHtml += `<div style="margin-left: ${LETTER_INDENT};">${letterListHtml}</div>`;
        } else {
          html += `<div>${letterListHtml}</div>`;
        }
        letterListHtml = '';
        inLetterList = false;
      }
      if (inRomanList) {
        html += `<div>${romanListHtml}</div>`;
        romanListHtml = '';
        inRomanList = false;
      }
      // Render numbered list item with proper indentation
      const num = numberedListMatch[1];
      const itemContent = formatInlineStyles(escapeHtml(numberedListMatch[2]));
      html += `<p style="margin-bottom: 6pt; margin-left: ${ROMAN_INDENT}; text-indent: -24pt; padding-left: 24pt;"><span style="display: inline-block; width: 24pt;">${escapeHtml(num)}.</span>${itemContent}</p>`;
    } else {
      // Close any open lists
      if (inLetterList) {
        if (inRomanList) {
          romanListHtml += `<div style="margin-left: ${LETTER_INDENT};">${letterListHtml}</div>`;
        } else {
          html += `<div>${letterListHtml}</div>`;
        }
        letterListHtml = '';
        inLetterList = false;
      }
      if (inRomanList) {
        html += `<div>${romanListHtml}</div>`;
        romanListHtml = '';
        inRomanList = false;
      }
      
      // Handle bold section headers (lines that are mostly bold or end with colon)
      const trimmedLine = line.trim();
      if (trimmedLine) {
        const formattedLine = formatInlineStyles(escapeHtml(trimmedLine));
        
        // Check if this is a subheading (bold text ending with colon, like "What the Client is Signing:")
        if (/^\*\*[^*]+:\*\*$/.test(trimmedLine) || /^[A-Z][^:]+:$/.test(trimmedLine)) {
          html += `<p style="margin-top: 12pt; margin-bottom: 8pt;"><strong>${escapeHtml(trimmedLine.replace(/^\*\*|\*\*$/g, ''))}</strong></p>`;
        } else {
          html += `<p style="margin-bottom: 8pt;">${formattedLine}</p>`;
        }
      }
    }
  }
  
  // Close any remaining open lists
  if (inLetterList) {
    if (inRomanList) {
      romanListHtml += `<div style="margin-left: ${LETTER_INDENT};">${letterListHtml}</div>`;
    } else {
      html += `<div>${letterListHtml}</div>`;
    }
  }
  if (inRomanList) {
    html += `<div>${romanListHtml}</div>`;
  }
  
  return html;
}

function formatInlineStyles(text: string): string {
  // Handle bold text with ** markers
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Handle italic text with * markers (but not if already part of bold)
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  
  // Handle underline with __ markers
  text = text.replace(/__([^_]+)__/g, '<u>$1</u>');
  
  return text;
}

function formatTableContent(content: string): string {
  const lines = content.split('\n');
  let html = '';
  let tableHtml = '<table>';
  let isFirstRow = true;
  let inTable = false;
  let tableEnded = false;
  let remainingContent: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // If we've ended the table, collect remaining content
    if (tableEnded) {
      remainingContent.push(line);
      continue;
    }
    
    if (line.includes('|')) {
      inTable = true;
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      
      // Skip separator rows (----)
      if (cells.every(cell => /^[-:]+$/.test(cell))) {
        continue;
      }
      
      if (isFirstRow) {
        tableHtml += '<thead><tr>';
        for (const cell of cells) {
          tableHtml += `<th>${escapeHtml(cell)}</th>`;
        }
        tableHtml += '</tr></thead><tbody>';
        isFirstRow = false;
      } else {
        // Check if this is a total row
        const isTotalRow = cells.some(cell => /total|sum|subtotal/i.test(cell));
        tableHtml += `<tr${isTotalRow ? ' class="total-row"' : ''}>`;
        for (const cell of cells) {
          tableHtml += `<td>${escapeHtml(cell)}</td>`;
        }
        tableHtml += '</tr>';
      }
    } else {
      // Non-table line
      if (inTable && line.trim()) {
        // We were in a table but hit a non-table line - table has ended
        tableEnded = true;
        remainingContent.push(line);
      } else if (!inTable && line.trim()) {
        // Content before the table starts
        remainingContent.push(line);
      }
      // Empty lines are ignored
    }
  }
  
  tableHtml += '</tbody></table>';
  
  // Build final HTML: table + remaining content formatted normally
  html = tableHtml;
  
  // Format remaining content (after the table)
  if (remainingContent.length > 0) {
    const remainingText = remainingContent.join('\n');
    html += formatNonTableContent(remainingText);
  }
  
  return html;
}

// Helper to format content that is NOT a table (used after table extraction)
function formatNonTableContent(content: string): string {
  if (!content || !content.trim()) return '';
  
  let html = '';
  const lines = content.split('\n');
  let inBulletList = false;
  let inNumberedList = false;
  let inRomanList = false;
  let listHtml = '';
  let romanListHtml = '';
  
  // Indentation constants (matching Google Doc style)
  const ROMAN_INDENT = '36pt';
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Detect bullet points (•, -, ○, ◦)
    const bulletMatch = line.match(/^[\s]*([-•○◦])\s+(.+)$/);
    // Detect numbered lists (1., 2., etc. at start of line - main numbered items)
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    // Detect roman numeral lists (i., ii., iii., iv., v., vi., vii., viii., ix., x.)
    const romanMatch = line.match(/^[\s]*(i{1,3}|iv|vi{0,3}|ix|x)\.\s+(.+)$/i);
    
    if (romanMatch) {
      // Close other lists if open
      if (inBulletList) {
        html += `<ul style="margin: 8pt 0 8pt 24pt; list-style-type: disc; padding-left: 16pt;">${listHtml}</ul>`;
        listHtml = '';
        inBulletList = false;
      }
      if (inNumberedList) {
        html += `<ol style="margin: 8pt 0 8pt 24pt; padding-left: 16pt;">${listHtml}</ol>`;
        listHtml = '';
        inNumberedList = false;
      }
      if (!inRomanList) {
        inRomanList = true;
      }
      const romanContent = formatInlineStyles(escapeHtml(romanMatch[2]));
      const romanNumeral = romanMatch[1].toLowerCase();
      romanListHtml += `<div style="margin-bottom: 6pt; margin-left: ${ROMAN_INDENT}; display: flex;"><span style="flex-shrink: 0; width: 28pt;">${romanNumeral}.</span><span style="flex: 1;">${romanContent}</span></div>`;
    } else if (bulletMatch) {
      // Close roman list if open
      if (inRomanList) {
        html += `<div>${romanListHtml}</div>`;
        romanListHtml = '';
        inRomanList = false;
      }
      if (!inBulletList) {
        // Close numbered list if open
        if (inNumberedList) {
          html += `<div style="margin: 8pt 0 8pt 24pt;">${listHtml}</div>`;
          listHtml = '';
          inNumberedList = false;
        }
        inBulletList = true;
      }
      const bulletContent = formatInlineStyles(escapeHtml(bulletMatch[2]));
      listHtml += `<li style="margin-bottom: 6pt;">${bulletContent}</li>`;
    } else if (numberedMatch) {
      // Close roman list if open
      if (inRomanList) {
        html += `<div>${romanListHtml}</div>`;
        romanListHtml = '';
        inRomanList = false;
      }
      // Close bullet list if open
      if (inBulletList) {
        html += `<ul style="margin: 8pt 0 8pt 24pt; list-style-type: disc; padding-left: 16pt;">${listHtml}</ul>`;
        listHtml = '';
        inBulletList = false;
      }
      // Close numbered list if open (we render each numbered item individually now)
      if (inNumberedList) {
        html += `<ol style="margin: 8pt 0 8pt 24pt; padding-left: 16pt;">${listHtml}</ol>`;
        listHtml = '';
        inNumberedList = false;
      }
      
      const numContent = formatInlineStyles(escapeHtml(numberedMatch[2]));
      // Check if this numbered item has a bold heading (like "4. Important Notes:")
      const headingMatch = numberedMatch[2].match(/^([^:]+):\s*$/);
      if (headingMatch) {
        // This is a section heading like "4. Important Notes:"
        html += `<p style="margin-top: 16pt; margin-bottom: 8pt; font-weight: bold;">${numberedMatch[1]}. ${escapeHtml(headingMatch[1])}</p>`;
      } else {
        // Regular numbered list item - render with proper indentation like roman numerals
        html += `<p style="margin-bottom: 6pt; margin-left: ${ROMAN_INDENT}; text-indent: -24pt; padding-left: 24pt;"><span style="display: inline-block; width: 24pt;">${numberedMatch[1]}.</span>${numContent}</p>`;
      }
    } else {
      // Close any open lists
      if (inRomanList) {
        html += `<div>${romanListHtml}</div>`;
        romanListHtml = '';
        inRomanList = false;
      }
      if (inBulletList) {
        html += `<ul style="margin: 8pt 0 8pt 24pt; list-style-type: disc; padding-left: 16pt;">${listHtml}</ul>`;
        listHtml = '';
        inBulletList = false;
      }
      if (inNumberedList) {
        html += `<ol style="margin: 8pt 0 8pt 24pt; padding-left: 16pt;">${listHtml}</ol>`;
        listHtml = '';
        inNumberedList = false;
      }
      
      const trimmedLine = line.trim();
      if (trimmedLine) {
        const formattedLine = formatInlineStyles(escapeHtml(trimmedLine));
        html += `<p style="margin-bottom: 8pt;">${formattedLine}</p>`;
      }
    }
  }
  
  // Close any remaining open lists
  if (inRomanList) {
    html += `<div>${romanListHtml}</div>`;
  }
  if (inBulletList) {
    html += `<ul style="margin: 8pt 0 8pt 24pt; list-style-type: disc; padding-left: 16pt;">${listHtml}</ul>`;
  }
  if (inNumberedList) {
    html += `<ol style="margin: 8pt 0 8pt 24pt; padding-left: 16pt;">${listHtml}</ol>`;
  }
  
  return html;
}

async function findChromiumPath(): Promise<string> {
  const { execSync } = await import('child_process');
  const fs = await import('fs');
  
  // Check environment variable first
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  // Try to find chromium using which command
  try {
    const chromiumPath = execSync('which chromium', { encoding: 'utf-8' }).trim();
    if (chromiumPath && fs.existsSync(chromiumPath)) {
      return chromiumPath;
    }
  } catch (e) {
    // which command failed, continue to fallback
  }
  
  // Fallback paths for Replit environments
  const fallbackPaths = [
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  
  for (const path of fallbackPaths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }
  
  throw new Error('Could not find Chromium executable. Please set PUPPETEER_EXECUTABLE_PATH environment variable.');
}

async function convertHTMLToPDF(html: string): Promise<Buffer> {
  const chromiumPath = await findChromiumPath();
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
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

function escapeHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, m => map[m]);
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
  
  // =========================================================================
  // STEP 1: CORE VALUES (Define once, use everywhere)
  // =========================================================================
  
  // Company information
  const companyName = projectData.childLlcName || 'Dvele, Inc.';
  const companyEntityType = 'limited liability company';
  const companyState = projectData.childLlcState || 'Delaware';
  const companySignatoryName = 'Kirk Miller';
  const companySignatoryTitle = 'VP of Operations';
  
  // Client information
  const clientName = projectData.clientLegalName || '';
  const clientState = projectData.clientState || '';
  const clientEntityType = getEntityTypeText(projectData.clientEntityType);
  
  // Project information
  const projectNumber = projectData.projectNumber || '';
  const projectName = projectData.projectName || '';
  const projectAddress = formatAddress(projectData);
  const totalUnits = projectData.totalUnits?.toString() || '1';
  
  // Dates
  const agreementDate = formatDate(projectData.agreementDate);
  const effectiveDate = formatDate(projectData.effectiveDate || projectData.agreementDate);
  
  // Location/Jurisdiction
  const county = projectData.projectCounty || projectData.siteCounty || '';
  const state = projectData.siteState || '';
  const city = projectData.siteCity || '';
  const arbitrationLocation = `${city}, ${state}`.trim().replace(/^,\s*/, '') || 'Los Angeles, CA';
  
  // Building codes
  const stateCode = `${state || 'State'} Building Code`;
  const energyCode = `${state || 'State'} Energy Code`;
  const localCode = `${city || 'Local'} Building Code`;
  
  // =========================================================================
  // STEP 2: COMMON VARIABLES (Used across all contracts)
  // =========================================================================
  
  // Project basics
  map['PROJECT_NAME'] = projectName;
  map['PROJECT_NUMBER'] = projectNumber;
  map['TOTAL_UNITS'] = totalUnits;
  
  // Company (map to ALL variations)
  map['COMPANY_NAME'] = companyName;
  map['ENTITY_TYPE'] = companyEntityType;
  map['COMPANY_ENTITY_TYPE'] = companyEntityType;
  map['COMPANY_SIGNATORY_NAME'] = companySignatoryName;
  map['COMPANY_SIGNATORY_TITLE'] = companySignatoryTitle;
  
  // Client (map to ALL variations)
  map['CLIENT_NAME'] = clientName;
  map['CLIENT_LEGAL_NAME'] = clientName;
  map['CLIENT_FULL_NAME'] = projectData.clientFullName || clientName;
  map['CLIENT_STATE'] = clientState;
  map['CLIENT_ENTITY_TYPE'] = clientEntityType;
  map['CLIENT_TITLE'] = projectData.clientTitle || '';
  
  // Address (map to ALL variations)
  map['PROJECT_ADDRESS'] = projectAddress;
  map['DELIVERY_ADDRESS'] = projectAddress;
  
  // Dates (map to ALL variations)
  map['AGREEMENT_DATE'] = agreementDate;
  map['AGREEMENT_EXECUTION_DATE'] = agreementDate;
  map['MASTER_AGREEMENT_DATE'] = agreementDate;
  map['EFFECTIVE_DATE'] = effectiveDate;
  map['PLAN_DATE'] = agreementDate;
  map['SURVEY_DATE'] = agreementDate;
  
  // Jurisdiction (map to ALL variations)
  map['STATE_OF_FORMATION'] = companyState;
  map['COUNTY'] = county;
  map['PROJECT_STATE'] = state;
  map['PROJECT_COUNTY'] = county;
  map['ARBITRATION_LOCATION'] = arbitrationLocation;
  map['ARBITRATION_PROVIDER'] = 'JAMS';
  
  // Building codes (map to ALL variations)
  map['STATE_BUILDING_CODE'] = stateCode;
  map['ENERGY_CODE'] = energyCode;
  map['LOCAL_BUILDING_CODE'] = localCode;
  
  // =========================================================================
  // STEP 3: ONE AGREEMENT SPECIFIC
  // =========================================================================
  
  // LLC/SPV (only in ONE Agreement)
  const llcBaseName = companyName.replace(' LLC', '').replace(', LLC', '');
  map['DVELE_PARTNERS_XYZ'] = llcBaseName;
  map['DVELE_PARTNERS_XYZ_LEGAL_NAME'] = companyName;
  map['DVELE_PARTNERS_XYZ_STATE'] = companyState;
  map['DVELE_PARTNERS_XYZ_ENTITY_TYPE'] = companyEntityType;
  
  // Design & Financial
  map['DESIGN_FEE'] = formatCurrency(projectData.designFee);
  map['DESIGN_REVISION_ROUNDS'] = projectData.designRevisionRounds?.toString() || '3';
  map['PRELIMINARY_OFFSITE_PRICE'] = formatCurrency(projectData.preliminaryOffsitePrice);
  
  const onsiteTotal = projectData.serviceModel === 'CMOS'
    ? (parseFloat(projectData.sitePrepPrice || '0') +
       parseFloat(projectData.utilitiesPrice || '0') +
       parseFloat(projectData.completionPrice || '0'))
    : 0;
  
  map['PRELIMINARY_ONSITE_PRICE'] = projectData.serviceModel === 'CMOS'
    ? formatCurrency(onsiteTotal)
    : 'Not Applicable (Client-Retained Contractor)';
  
  const totalPrice = parseFloat(projectData.totalPreliminaryContractPrice || '0');
  map['PRELIMINARY_CONTRACT_PRICE'] = formatCurrency(totalPrice);
  map['FINAL_CONTRACT_PRICE'] = formatCurrency(totalPrice);
  map['TOTAL_PRELIMINARY_CONTRACT_PRICE'] = formatCurrency(totalPrice);
  
  // Client payment milestones (5 + retainage)
  map['MILESTONE_1_PERCENT'] = '20';
  map['MILESTONE_2_PERCENT'] = '20';
  map['MILESTONE_3_PERCENT'] = '20';
  map['MILESTONE_4_PERCENT'] = '20';
  map['MILESTONE_5_PERCENT'] = '15';
  map['RETAINAGE_PERCENT'] = '5';
  map['RETAINAGE_DAYS'] = '60';
  
  map['MILESTONE_1_AMOUNT'] = formatCurrency(totalPrice * 0.20);
  map['MILESTONE_2_AMOUNT'] = formatCurrency(totalPrice * 0.20);
  map['MILESTONE_3_AMOUNT'] = formatCurrency(totalPrice * 0.20);
  map['MILESTONE_4_AMOUNT'] = formatCurrency(totalPrice * 0.20);
  map['MILESTONE_5_AMOUNT'] = formatCurrency(totalPrice * 0.15);
  map['RETAINAGE_AMOUNT'] = formatCurrency(totalPrice * 0.05);
  
  // Warranty
  map['DVELE_FIT_FINISH_WARRANTY'] = projectData.warrantyFitFinishMonths?.toString() || '24';
  map['DVELE_ENVELOPE_WARRANTY'] = projectData.warrantyBuildingEnvelopeMonths?.toString() || '60';
  map['DVELE_STRUCTURAL_WARRANTY'] = projectData.warrantyStructuralMonths?.toString() || '120';
  
  // Insurance
  map['GL_INSURANCE_LIMIT'] = '$2,000,000';
  map['GL_AGGREGATE_LIMIT'] = '$4,000,000';
  
  // Service model
  map['ON_SITE_SERVICES_SELECTION'] = projectData.serviceModel === 'CRC'
    ? 'CLIENT-RETAINED CONTRACTOR'
    : 'COMPANY-MANAGED ON-SITE SERVICES';
  
  // Timeline estimates
  map['DESIGN_DURATION'] = Math.ceil((parseInt(projectData.designPhaseDays || '90')) / 7).toString();
  map['PERMITTING_DURATION'] = '4-8';
  map['PRODUCTION_DURATION'] = Math.ceil((parseInt(projectData.manufacturingDurationDays || '120')) / 7).toString();
  map['DELIVERY_DURATION'] = '1';
  map['COMPLETION_DURATION'] = Math.ceil((parseInt(projectData.onsiteDurationDays || '90')) / 7).toString();
  
  // Key dates
  map['GREEN_LIGHT_DATE'] = 'To Be Determined';
  map['DELIVERY_DATE'] = 'To Be Determined';
  map['COMPLETION_DATE'] = calculateEstimatedCompletion(projectData);
  
  // Fees
  map['CANCELLATION_FEE_PERCENT'] = '15';
  map['MATERIAL_INCREASE_THRESHOLD'] = '10';
  map['INFLATION_ADJUSTMENT_PERCENT'] = '5';
  
  // Units
  const numUnits = parseInt(totalUnits) || 1;
  map['TOTAL_MODULES'] = (numUnits * 3).toString();
  for (let i = 1; i <= Math.min(numUnits, 10); i++) {
    map[`UNIT_${i}_DESCRIPTION`] = projectData[`unit${i}Model`] || `Unit ${i}`;
    map[`UNIT_${i}_MODULES`] = '2-4';
    map[`UNIT_${i}_PRICE`] = formatCurrency(projectData[`unit${i}Price`]);
  }
  
  // =========================================================================
  // STEP 4: MANUFACTURING SUBCONTRACT SPECIFIC
  // =========================================================================
  
  // Manufacturer party
  map['MANUFACTURER_NAME'] = 'Dvele Manufacturing, LLC';
  map['MANUFACTURER_ENTITY_TYPE'] = 'limited liability company';
  map['MANUFACTURER_STATE'] = 'California';
  map['MANUFACTURER_SIGNATORY_NAME'] = 'Manufacturing Manager';
  map['MANUFACTURER_SIGNATORY_TITLE'] = 'Operations Manager';
  
  // Manufacturing pricing
  const offsitePrice = parseFloat(projectData.preliminaryOffsitePrice || '0');
  const mfgUpgrades = parseFloat(projectData.designFee || '0');
  const mfgTotal = offsitePrice + mfgUpgrades;
  
  map['MFG_BASE_PRICE'] = formatCurrency(offsitePrice);
  map['MFG_UPGRADES'] = formatCurrency(mfgUpgrades);
  map['MFG_TOTAL_PRICE'] = formatCurrency(mfgTotal);
  
  // Manufacturing payment schedule
  map['MFG_DEPOSIT_PERCENT'] = '10';
  map['MFG_START_PERCENT'] = '30';
  map['MFG_MID_PERCENT'] = '30';
  map['MFG_COMPLETE_PERCENT'] = '25';
  map['MFG_RETAINAGE_PERCENT'] = '5';
  
  map['MFG_DEPOSIT_AMOUNT'] = formatCurrency(mfgTotal * 0.10);
  map['MFG_START_AMOUNT'] = formatCurrency(mfgTotal * 0.30);
  map['MFG_MID_AMOUNT'] = formatCurrency(mfgTotal * 0.30);
  map['MFG_COMPLETE_AMOUNT'] = formatCurrency(mfgTotal * 0.25);
  map['MFG_DELIVERY_AMOUNT'] = formatCurrency(mfgTotal * 0.05);
  
  // Manufacturing schedule
  const startDate = new Date(projectData.effectiveDate || projectData.agreementDate || Date.now());
  const designDays = parseInt(projectData.designPhaseDays || '90');
  const mfgDays = parseInt(projectData.manufacturingDurationDays || '120');
  
  const productionStart = new Date(startDate);
  productionStart.setDate(productionStart.getDate() + designDays);
  
  const productionMid = new Date(productionStart);
  productionMid.setDate(productionMid.getDate() + Math.floor(mfgDays / 2));
  
  const productionComplete = new Date(productionStart);
  productionComplete.setDate(productionComplete.getDate() + mfgDays);
  
  const deliveryReady = new Date(productionComplete);
  deliveryReady.setDate(deliveryReady.getDate() + 7);
  
  map['PRODUCTION_START_DATE'] = formatDate(productionStart.toISOString());
  map['PRODUCTION_MIDPOINT_DATE'] = formatDate(productionMid.toISOString());
  map['PRODUCTION_COMPLETE_DATE'] = formatDate(productionComplete.toISOString());
  map['DELIVERY_READY_DATE'] = formatDate(deliveryReady.toISOString());
  
  // Manufacturing insurance
  map['MFG_GL_LIMIT'] = '$2,000,000';
  map['MFG_GL_AGGREGATE'] = '$4,000,000';
  map['MFG_EL_LIMIT'] = '$1,000,000';
  map['MFG_AUTO_LIMIT'] = '$1,000,000';
  map['MFG_PRODUCTS_LIMIT'] = '$2,000,000';
  map['MFG_UMBRELLA_LIMIT'] = '$5,000,000';
  
  // Manufacturing terms
  map['MFG_MARKUP_PERCENT'] = '15';
  map['DELAY_PENALTY'] = '$500';
  
  // =========================================================================
  // STEP 5: ONSITE SUBCONTRACT SPECIFIC
  // =========================================================================
  
  // On-site contractor party
  if (projectData.serviceModel === 'CMOS') {
    map['ONSITE_CONTRACTOR_NAME'] = 'Company-Managed Services';
    map['ONSITE_CONTRACTOR_ENTITY_TYPE'] = 'managed by Company';
    map['ONSITE_CONTRACTOR_STATE'] = state;
    map['ONSITE_CONTRACTOR_SIGNATORY_NAME'] = 'Site Manager';
    map['ONSITE_CONTRACTOR_SIGNATORY_TITLE'] = 'Construction Manager';
  } else {
    map['ONSITE_CONTRACTOR_NAME'] = projectData.contractorName || 'To Be Determined';
    map['ONSITE_CONTRACTOR_ENTITY_TYPE'] = 'To Be Determined';
    map['ONSITE_CONTRACTOR_STATE'] = state;
    map['ONSITE_CONTRACTOR_SIGNATORY_NAME'] = 'To Be Determined';
    map['ONSITE_CONTRACTOR_SIGNATORY_TITLE'] = 'To Be Determined';
  }
  
  // On-site pricing breakdown
  map['ONSITE_PREP_PRICE'] = formatCurrency(projectData.sitePrepPrice || '0');
  map['ONSITE_FOUNDATION_PRICE'] = formatCurrency(parseFloat(projectData.sitePrepPrice || '0') * 0.5);
  map['ONSITE_UTILITIES_PRICE'] = formatCurrency(projectData.utilitiesPrice || '0');
  map['ONSITE_SET_PRICE'] = formatCurrency(parseFloat(projectData.deliveryInstallationPrice || '0') * 0.3);
  map['ONSITE_COMPLETION_PRICE'] = formatCurrency(projectData.completionPrice || '0');
  map['ONSITE_TOTAL_PRICE'] = formatCurrency(onsiteTotal);
  
  // On-site payment schedule
  map['ONSITE_MOBILIZATION_PERCENT'] = '10';
  map['ONSITE_FOUNDATION_PERCENT'] = '30';
  map['ONSITE_UTILITIES_PERCENT'] = '20';
  map['ONSITE_SET_PERCENT'] = '15';
  map['ONSITE_COMPLETION_PERCENT'] = '20';
  map['ONSITE_RETAINAGE_PERCENT'] = '5';
  
  map['ONSITE_MOBILIZATION_AMOUNT'] = formatCurrency(onsiteTotal * 0.10);
  map['ONSITE_FOUNDATION_AMOUNT'] = formatCurrency(onsiteTotal * 0.30);
  map['ONSITE_UTILITIES_AMOUNT'] = formatCurrency(onsiteTotal * 0.20);
  map['ONSITE_SET_AMOUNT'] = formatCurrency(onsiteTotal * 0.15);
  map['ONSITE_COMPLETION_AMOUNT'] = formatCurrency(onsiteTotal * 0.20);
  map['ONSITE_RETAINAGE_AMOUNT'] = formatCurrency(onsiteTotal * 0.05);
  
  // On-site schedule
  const onsiteDays = parseInt(projectData.onsiteDurationDays || '90');
  const onsiteStart = new Date(deliveryReady);
  const foundationComplete = new Date(onsiteStart);
  foundationComplete.setDate(foundationComplete.getDate() + Math.floor(onsiteDays * 0.3));
  
  const siteReady = new Date(foundationComplete);
  siteReady.setDate(siteReady.getDate() + 7);
  
  const onsiteComplete = new Date(onsiteStart);
  onsiteComplete.setDate(onsiteComplete.getDate() + onsiteDays);
  
  const cooDate = new Date(onsiteComplete);
  cooDate.setDate(cooDate.getDate() + 14);
  
  map['ONSITE_MOBILIZATION_DATE'] = 'Upon Subcontract Execution';
  map['ONSITE_FOUNDATION_DATE'] = formatDate(foundationComplete.toISOString());
  map['ONSITE_READY_DATE'] = formatDate(siteReady.toISOString());
  map['COO_DATE'] = formatDate(cooDate.toISOString());
  
  // On-site insurance
  map['ONSITE_GL_LIMIT'] = '$2,000,000';
  map['ONSITE_GL_AGGREGATE'] = '$4,000,000';
  map['ONSITE_EL_LIMIT'] = '$1,000,000';
  map['ONSITE_AUTO_LIMIT'] = '$1,000,000';
  map['ONSITE_UMBRELLA_LIMIT'] = '$5,000,000';
  
  // On-site terms
  map['ONSITE_MARKUP_PERCENT'] = '15';
  map['ONSITE_DELAY_PENALTY'] = '$500';
  
  // =========================================================================
  // LOGGING
  // =========================================================================
  
  console.log('\n=== VARIABLE MAP SUMMARY ===');
  console.log(`Total variables mapped: ${Object.keys(map).length}`);
  console.log(`Common variables: ~40 (mapped to all variations)`);
  console.log(`Contract-specific: ~${Object.keys(map).length - 40}`);
  console.log('=========================\n');
  
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
  if (!projectData.effectiveDate && !projectData.agreementDate) return 'To Be Determined';
  
  const startDate = new Date(projectData.effectiveDate || projectData.agreementDate);
  const totalDays = (parseInt(projectData.designPhaseDays) || 90) +
                   (parseInt(projectData.manufacturingDurationDays) || 120) +
                   (parseInt(projectData.onsiteDurationDays) || 90);
  
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
