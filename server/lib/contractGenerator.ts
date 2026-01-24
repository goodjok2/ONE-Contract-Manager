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
      margin: 1in 1in 1in 1in;
    }
    
    @page :first {
      margin-top: 0.5in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 12pt;
      line-height: 1.5;
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
      padding-top: 2.5in;
      page-break-after: always;
      min-height: 9in;
    }
    
    .contract-title {
      font-size: 16pt;
      font-weight: bold;
      margin-bottom: 24pt;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .project-info {
      font-size: 14pt;
      margin-bottom: 8pt;
      line-height: 1.6;
    }
    
    .date-line {
      margin-top: 48pt;
      font-size: 12pt;
      font-style: italic;
    }
    
    .parties-section {
      margin-top: 60pt;
      text-align: left;
      padding: 0 40pt;
    }
    
    .parties-section .party {
      margin-bottom: 12pt;
    }
    
    /* Contract Body Styles */
    .contract-body {
      text-align: justify;
      hyphens: auto;
    }
    
    /* Article/Section Headers (Level 1) */
    .article-header {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      margin-top: 24pt;
      margin-bottom: 12pt;
      page-break-after: avoid;
      letter-spacing: 0.5px;
    }
    
    /* Subsection Headers (Level 2) */
    .section-header {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 18pt;
      margin-bottom: 10pt;
      page-break-after: avoid;
      text-indent: 0;
    }
    
    /* Paragraph Headers (Level 3+) */
    .subsection-header {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 12pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
      display: inline;
    }
    
    /* Regular paragraphs */
    p {
      margin-bottom: 12pt;
      text-align: justify;
      line-height: 1.5;
      text-indent: 0.5in;
    }
    
    p.no-indent {
      text-indent: 0;
    }
    
    p.first-paragraph {
      text-indent: 0;
    }
    
    /* Clause numbering */
    .clause-number {
      font-weight: bold;
    }
    
    .inline-clause {
      margin-bottom: 12pt;
      text-align: justify;
      line-height: 1.5;
    }
    
    .inline-clause .clause-number {
      margin-right: 6pt;
    }
    
    /* Lists */
    ol, ul {
      margin: 12pt 0;
      padding-left: 0.75in;
    }
    
    ol {
      list-style-type: lower-alpha;
    }
    
    ol ol {
      list-style-type: lower-roman;
    }
    
    li {
      margin-bottom: 8pt;
      text-align: justify;
      line-height: 1.5;
    }
    
    /* Definitions */
    .definition-term {
      font-weight: bold;
    }
    
    /* Signature Block */
    .signature-section {
      margin-top: 48pt;
      page-break-inside: avoid;
    }
    
    .signature-block {
      margin-top: 36pt;
      page-break-inside: avoid;
    }
    
    .signature-line {
      border-bottom: 1px solid #000;
      width: 3in;
      margin-top: 36pt;
      margin-bottom: 4pt;
    }
    
    .signature-name {
      font-size: 11pt;
    }
    
    .signature-title {
      font-size: 10pt;
      color: #333;
    }
    
    /* Exhibit/Schedule headers */
    .exhibit-header {
      font-size: 14pt;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      margin-top: 36pt;
      margin-bottom: 24pt;
      page-break-before: always;
    }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
      font-size: 11pt;
    }
    
    th, td {
      border: 1px solid #333;
      padding: 6pt 8pt;
      text-align: left;
      vertical-align: top;
    }
    
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    
    /* Page numbers - handled by Puppeteer */
    
    /* Recitals / Whereas clauses */
    .recitals {
      margin-top: 24pt;
      margin-bottom: 24pt;
    }
    
    .recital {
      margin-bottom: 12pt;
      text-indent: 0.5in;
    }
    
    .recital-label {
      font-weight: bold;
      text-transform: uppercase;
    }
    
    /* Agreement statement */
    .agreement-statement {
      margin-top: 24pt;
      margin-bottom: 24pt;
      text-align: center;
      font-weight: bold;
    }
    
    /* Indentation levels */
    .indent-1 { margin-left: 0.5in; }
    .indent-2 { margin-left: 1in; }
    .indent-3 { margin-left: 1.5in; }
    
    /* Keep headers with following content */
    h1, h2, h3, .article-header, .section-header, .subsection-header {
      page-break-after: avoid;
      orphans: 3;
      widows: 3;
    }
    
    /* Prevent orphaned lines */
    p {
      orphans: 2;
      widows: 2;
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
  const clientName = projectData.clientLegalName || projectData.clientFullName || '[CLIENT NAME]';
  const llcName = projectData.childLlcName || 'Dvele Partners LLC';
  
  return `
    <div class="title-page">
      <div class="contract-title">${title}</div>
      
      <div class="project-info">
        <div style="font-weight: bold; margin-bottom: 4pt;">
          Project ${escapeHtml(projectData.projectNumber || '[NUMBER]')}
        </div>
        <div>${escapeHtml(projectData.projectName || '[PROJECT NAME]')}</div>
      </div>
      
      <div class="parties-section">
        <div style="margin-bottom: 24pt; text-align: center;">
          <div style="font-weight: bold;">by and between</div>
        </div>
        
        <div style="text-align: center; margin-bottom: 18pt;">
          <div style="font-weight: bold; font-size: 13pt;">${escapeHtml(llcName)}</div>
          <div style="font-size: 11pt; margin-top: 4pt;">a Delaware limited liability company</div>
          <div style="font-size: 11pt; font-style: italic;">("Company")</div>
        </div>
        
        <div style="text-align: center; margin-bottom: 18pt;">
          <div style="font-weight: bold;">and</div>
        </div>
        
        <div style="text-align: center; margin-bottom: 18pt;">
          <div style="font-weight: bold; font-size: 13pt;">${escapeHtml(clientName)}</div>
          ${projectData.clientEntityType && projectData.clientState ? `
            <div style="font-size: 11pt; margin-top: 4pt;">
              a ${escapeHtml(projectData.clientState)} ${escapeHtml(getEntityTypeText(projectData.clientEntityType))}
            </div>
          ` : ''}
          <div style="font-size: 11pt; font-style: italic;">("Client")</div>
        </div>
      </div>
      
      ${projectData.agreementDate ? `
        <div class="date-line">
          Dated as of ${formatDate(projectData.agreementDate)}
        </div>
      ` : ''}
    </div>
  `;
}

function renderClausesHTML(clauses: Clause[], projectData: Record<string, any>): string {
  let html = '<div class="contract-body">';
  
  // Add preamble/recitals section
  html += renderPreamble(projectData);
  
  for (const clause of clauses) {
    const hierarchyLevel = typeof clause.hierarchy_level === 'number' ? clause.hierarchy_level : parseInt(String(clause.hierarchy_level)) || 1;
    const content = clause.content ? formatContent(clause.content) : '';
    
    if (hierarchyLevel === 1) {
      // Article/Major Section - centered, uppercase
      html += `
        <div class="article-header">
          ${clause.clause_code ? `ARTICLE ${escapeHtml(clause.clause_code)}` : ''}
          ${clause.name ? `<br>${escapeHtml(clause.name.toUpperCase())}` : ''}
        </div>
        ${content ? `<p class="first-paragraph">${content}</p>` : ''}
      `;
    } else if (hierarchyLevel === 2) {
      // Section - bold, left-aligned with number
      html += `
        <div class="section-header">
          ${clause.clause_code ? `<span class="clause-number">${escapeHtml(clause.clause_code)}</span> ` : ''}
          ${escapeHtml(clause.name || '')}
        </div>
        ${content ? `<p class="first-paragraph">${content}</p>` : ''}
      `;
    } else {
      // Subsection/Paragraph - inline bold number with content
      if (clause.clause_code && clause.clause_code.trim()) {
        html += `
          <div class="inline-clause">
            <span class="clause-number">(${escapeHtml(clause.clause_code)})</span>
            ${clause.name ? `<span style="font-weight: bold;">${escapeHtml(clause.name)}.</span> ` : ''}
            ${content}
          </div>
        `;
      } else {
        html += `<p>${content}</p>`;
      }
    }
  }
  
  // Add signature blocks
  html += renderSignatureBlocks(projectData);
  
  html += '</div>';
  return html;
}

function renderPreamble(projectData: Record<string, any>): string {
  const clientName = projectData.clientLegalName || projectData.clientFullName || '[CLIENT NAME]';
  const llcName = projectData.childLlcName || 'Dvele Partners LLC';
  const agreementDate = formatDate(projectData.agreementDate) || '[DATE]';
  
  return `
    <p class="no-indent" style="margin-bottom: 18pt;">
      <strong>THIS AGREEMENT</strong> (this "Agreement") is made and entered into as of 
      ${agreementDate} (the "Effective Date"), by and between 
      <strong>${escapeHtml(llcName)}</strong>, a Delaware limited liability company ("Company"), 
      and <strong>${escapeHtml(clientName)}</strong>${projectData.clientEntityType ? `, a ${escapeHtml(projectData.clientState || '')} ${escapeHtml(getEntityTypeText(projectData.clientEntityType))}` : ''} ("Client").
    </p>
    
    <div class="recitals">
      <p class="no-indent" style="font-weight: bold; text-align: center; margin-bottom: 12pt;">RECITALS</p>
      
      <p class="recital">
        <span class="recital-label">WHEREAS,</span> Company is engaged in the business of designing, 
        manufacturing, and delivering prefabricated modular homes; and
      </p>
      
      <p class="recital">
        <span class="recital-label">WHEREAS,</span> Client desires to engage Company to design, manufacture, 
        and deliver ${projectData.totalUnits || '1'} modular home unit(s) to the property located at 
        ${escapeHtml(projectData.siteAddress || '[ADDRESS]')}, ${escapeHtml(projectData.siteCity || '[CITY]')}, 
        ${escapeHtml(projectData.siteState || '[STATE]')} ${escapeHtml(projectData.siteZip || '[ZIP]')}
        (the "Project Site"); and
      </p>
      
      <p class="recital">
        <span class="recital-label">WHEREAS,</span> Company agrees to perform such services upon the terms 
        and conditions set forth herein.
      </p>
    </div>
    
    <p class="agreement-statement" style="margin-top: 18pt; margin-bottom: 24pt;">
      NOW, THEREFORE, in consideration of the mutual covenants and agreements hereinafter set forth and for 
      other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, 
      the parties agree as follows:
    </p>
  `;
}

function renderSignatureBlocks(projectData: Record<string, any>): string {
  const clientName = projectData.clientLegalName || projectData.clientFullName || '[CLIENT NAME]';
  const llcName = projectData.childLlcName || 'Dvele Partners LLC';
  
  return `
    <div class="signature-section">
      <p class="no-indent" style="margin-top: 36pt; margin-bottom: 24pt;">
        <strong>IN WITNESS WHEREOF,</strong> the parties hereto have executed this Agreement as of the date first written above.
      </p>
      
      <div style="display: flex; justify-content: space-between; margin-top: 36pt;">
        <div class="signature-block" style="width: 45%;">
          <div style="font-weight: bold; margin-bottom: 36pt;">COMPANY:</div>
          <div style="font-weight: bold;">${escapeHtml(llcName)}</div>
          <div class="signature-line"></div>
          <div class="signature-name">By: _______________________________</div>
          <div class="signature-title">Name: _____________________________</div>
          <div class="signature-title">Title: ______________________________</div>
          <div class="signature-title">Date: _____________________________</div>
        </div>
        
        <div class="signature-block" style="width: 45%;">
          <div style="font-weight: bold; margin-bottom: 36pt;">CLIENT:</div>
          <div style="font-weight: bold;">${escapeHtml(clientName)}</div>
          <div class="signature-line"></div>
          <div class="signature-name">By: _______________________________</div>
          <div class="signature-title">Name: ${escapeHtml(projectData.clientSignerName || '_____________________________')}</div>
          <div class="signature-title">Title: ${escapeHtml(projectData.clientTitle || '______________________________')}</div>
          <div class="signature-title">Date: _____________________________</div>
        </div>
      </div>
    </div>
  `;
}

function formatContent(content: string): string {
  if (!content) return '';
  let escaped = escapeHtml(content);
  escaped = escaped.replace(/\n\n/g, '</p><p>');
  escaped = escaped.replace(/\n/g, '<br>');
  return escaped;
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
