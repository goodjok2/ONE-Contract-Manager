// @ts-ignore - mammoth doesn't have type declarations
import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/db';
import { clauses, exhibits } from '../shared/schema';
import { sql, eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCX_PATH = path.join(__dirname, '../server/templates/Master_Agreement_EF.docx');
const CONTRACT_TYPE = 'MASTER_EF';

interface ParsedClause {
  tempId: string;
  clauseCode: string;
  headerText: string;
  bodyHtml: string;
  hierarchyLevel: number;
  sortOrder: number;
  parentTempId: string | null;
  variablesUsed: string[];
}

const VARIABLE_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

function extractVariables(text: string): string[] {
  const variables: string[] = [];
  let match;
  const pattern = new RegExp(VARIABLE_PATTERN);
  while ((match = pattern.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}

function generateClauseCode(headerText: string, index: number): string {
  const slug = headerText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  return `master-ef-${slug}-${index}`;
}

function fixMalformedTags(html: string): string {
  let fixed = html;
  
  fixed = fixed.replace(/\{\{DVELE_PARTNERS_XYZ_ENTITY_TYPE\}(?!\})/g, '{{DVELE_PARTNERS_XYZ_ENTITY_TYPE}}');
  fixed = fixed.replace(/\{\{CLIENT_LEGAL_NAME\}(?!\})/g, '{{CLIENT_LEGAL_NAME}}');
  fixed = fixed.replace(/\{\{\$_DAYS\}\}/g, '{{STORAGE_FREE_DAYS}}');
  fixed = fixed.replace(/\{\{DESIGN_FEE\}(?!\})/g, '{{DESIGN_FEE}}');
  fixed = fixed.replace(/\{\{FEES; PAYMENT; FINANCEABILITY\}\}/g, '{{XREF_FEES_PAYMENT_SECTION}}');
  fixed = fixed.replace(/\{\{FINANCEABILITY_H\}\}/g, '{{XREF_BANKABILITY_SUBSECTIONS}}');
  
  return fixed;
}

function parseNestedList(html: string): ParsedClause[] {
  const clauses: ParsedClause[] = [];
  let sortOrder = 100;
  
  const lines = html.split(/(<\/?[a-z0-9]+[^>]*>)/gi).filter(s => s.trim());
  
  const sectionStack: { tempId: string; level: number }[] = [];
  let currentLevel = 0;
  let buffer = '';
  let inListItem = false;
  let listDepth = 0;
  
  const titleMatch = html.match(/<p>Master Purchase Agreement[^<]+<\/p>/i);
  if (titleMatch) {
    const titleText = titleMatch[0].replace(/<[^>]+>/g, '').trim();
    clauses.push({
      tempId: 'title-1',
      clauseCode: 'master-ef-title-1',
      headerText: titleText,
      bodyHtml: '',
      hierarchyLevel: 1,
      sortOrder: 10,
      parentTempId: null,
      variablesUsed: extractVariables(titleText),
    });
    sectionStack.push({ tempId: 'title-1', level: 1 });
  }
  
  const preambleMatch = html.match(/<p>This Master Factory Built Home[^<]+<\/p>/i);
  if (preambleMatch) {
    const preambleText = preambleMatch[0].replace(/<[^>]+>/g, '').trim();
    clauses.push({
      tempId: 'preamble-1',
      clauseCode: 'master-ef-preamble-1',
      headerText: 'Preamble',
      bodyHtml: `<p>${preambleText}</p>`,
      hierarchyLevel: 2,
      sortOrder: 20,
      parentTempId: 'title-1',
      variablesUsed: extractVariables(preambleText),
    });
  }
  
  const recitalsSection = html.match(/<p>RECITALS<\/p>(.*?)<h1/is);
  if (recitalsSection) {
    clauses.push({
      tempId: 'recitals-1',
      clauseCode: 'master-ef-recitals-1',
      headerText: 'RECITALS',
      bodyHtml: '',
      hierarchyLevel: 2,
      sortOrder: 30,
      parentTempId: 'title-1',
      variablesUsed: [],
    });
    
    const whereasMatches = recitalsSection[1].match(/<h2[^>]*>WHEREAS[^<]+<\/h2>/gi) || [];
    whereasMatches.forEach((match, idx) => {
      const text = match.replace(/<[^>]+>/g, '').trim();
      clauses.push({
        tempId: `whereas-${idx + 1}`,
        clauseCode: `master-ef-whereas-${idx + 1}`,
        headerText: `Recital ${idx + 1}`,
        bodyHtml: `<p>${text}</p>`,
        hierarchyLevel: 3,
        sortOrder: 35 + idx,
        parentTempId: 'recitals-1',
        variablesUsed: extractVariables(text),
      });
    });
  }
  
  const agreementBody = html.match(/<h1[^>]*>NOW, THEREFORE[^<]*<\/h1>\s*<ol>(.*)<\/ol>/is);
  if (agreementBody) {
    parseListContent(agreementBody[1], clauses, sortOrder);
  }
  
  return clauses;
}

function parseListContent(html: string, clauses: ParsedClause[], startOrder: number): void {
  let sortOrder = startOrder;
  const parentStack: { tempId: string; level: number }[] = [];
  
  const level1Sections = html.split(/<li>/i).slice(1);
  
  level1Sections.forEach((section, sectionIdx) => {
    const firstNewline = section.indexOf('<ol>');
    const headerEnd = firstNewline > -1 ? firstNewline : section.indexOf('</li>');
    let headerText = section.substring(0, headerEnd).replace(/<[^>]+>/g, '').trim();
    
    if (!headerText || headerText.length < 3) return;
    
    const tempId = `section-${sectionIdx + 1}`;
    clauses.push({
      tempId,
      clauseCode: generateClauseCode(headerText, sortOrder),
      headerText: headerText.split('.')[0] || headerText,
      bodyHtml: '',
      hierarchyLevel: 2,
      sortOrder: sortOrder,
      parentTempId: 'title-1',
      variablesUsed: extractVariables(headerText),
    });
    sortOrder += 100;
    
    const sublistMatch = section.match(/<ol>(.*?)<\/ol>/is);
    if (sublistMatch) {
      parseSublist(sublistMatch[1], clauses, tempId, 3, sortOrder);
    }
  });
}

function parseSublist(html: string, clauses: ParsedClause[], parentTempId: string, level: number, startOrder: number): number {
  let sortOrder = startOrder;
  const items = html.split(/<li>/i).slice(1);
  
  items.forEach((item, idx) => {
    const sublistPos = item.indexOf('<ol>');
    const closePos = item.indexOf('</li>');
    const textEnd = sublistPos > -1 && sublistPos < closePos ? sublistPos : closePos;
    
    let text = item.substring(0, textEnd > -1 ? textEnd : undefined).replace(/<[^>]+>/g, '').trim();
    
    if (!text || text.length < 3) return;
    
    const headerEnd = text.indexOf('.') > -1 && text.indexOf('.') < 60 ? text.indexOf('.') + 1 : Math.min(60, text.length);
    const headerText = text.substring(0, headerEnd).trim();
    const bodyText = text.substring(headerEnd).trim();
    
    const tempId = `${parentTempId}-${idx + 1}`;
    clauses.push({
      tempId,
      clauseCode: generateClauseCode(headerText, sortOrder),
      headerText,
      bodyHtml: bodyText ? `<p>${bodyText}</p>` : '',
      hierarchyLevel: Math.min(level, 8),
      sortOrder: sortOrder,
      parentTempId,
      variablesUsed: extractVariables(text),
    });
    sortOrder += 10;
    
    const sublistMatch = item.match(/<ol>(.*?)<\/ol>/is);
    if (sublistMatch && level < 7) {
      sortOrder = parseSublist(sublistMatch[1], clauses, tempId, level + 1, sortOrder);
    }
  });
  
  return sortOrder;
}

const EXHIBITS_CONFIG = [
  { code: 'A', name: 'Project Scope and Commercial Terms', order: 1, content: `
<h2>EXHIBIT A — PROJECT SCOPE AND COMMERCIAL TERMS</h2>
<h3>A.1 Project Overview</h3>
<table class="exhibit-table">
  <tr><td>Buyer Type</td><td>{{BUYER_TYPE}}</td></tr>
  <tr><td>Project Name</td><td>{{PROJECT_NAME}}</td></tr>
  <tr><td>Project Number</td><td>{{PROJECT_NUMBER}}</td></tr>
  <tr><td>Properties</td><td>{{PROJECT_TYPE}}</td></tr>
  <tr><td>Completion Model</td><td>{{ON_SITE_SERVICES_SELECTION}}</td></tr>
  <tr><td>Jurisdiction(s)</td><td>{{PROJECT_STATE}}</td></tr>
  <tr><td>Site(s)</td><td>{{SITE_ADDRESS}}</td></tr>
  <tr><td>Client Notice Email</td><td>{{CLIENT_EMAIL}}</td></tr>
  <tr><td>Company Notice Email</td><td>{{COMPANY_EMAIL}}</td></tr>
</table>
<h3>A.2 Pricing Summary</h3>
<table class="exhibit-table pricing">
  <tr><th>Stage / Component</th><th>Amount</th><th>Notes</th></tr>
  <tr><td>Design / Pre-Production Fee</td><td>{{DESIGN_FEE}}</td><td>Due at signing</td></tr>
  <tr><td>Production Price (Factory)</td><td>{{PRODUCTION_PRICE}}</td><td>Per Phase</td></tr>
  <tr><td>Logistics</td><td>{{LOGISTICS_PRICE}}</td><td>Delivery/transport</td></tr>
  <tr><td>On-Site (if Company Managed)</td><td>{{ONSITE_PRICE}}</td><td>Only if CMOS</td></tr>
  <tr><td>Admin Fee</td><td>{{AD_FEE}}</td><td>On reimbursables</td></tr>
  <tr><th>Total Project Price</th><th>{{TOTAL_PROJECT_PRICE}}</th><th>Subject to Change Orders</th></tr>
</table>
<h3>A.3 Payment Schedule</h3>
{{PAYMENT_SCHEDULE_TABLE}}
<h3>A.4 Special Commercial Terms</h3>
<p>Storage fees if site not ready: {{STORAGE_FEE_PER_DAY}}/day after {{STORAGE_FREE_DAYS}} days free</p>
` },
  { code: 'B', name: 'Home Plans, Specifications & Finishes', order: 2, content: `
<h2>EXHIBIT B — HOME PLANS, SPECIFICATIONS & FINISHES</h2>
<h3>B.1 Plan Set Index</h3>
{{UNIT_DETAILS_TABLE}}
<h3>B.2 Specifications</h3>
<p>See attached specification schedules.</p>
<h3>B.3 Change Control</h3>
<p>Changes that materially affect cost, schedule, or milestone timing require an Exhibit A amendment or Change Order signed by both Parties.</p>
` },
  { code: 'C', name: 'GC / On-Site Scope & Responsibility Matrix', order: 3, content: `
<h2>EXHIBIT C — GC / ON-SITE SCOPE & RESPONSIBILITY MATRIX</h2>
{{BLOCK_GC_INFO_SECTION}}
<h3>C.2 Site Readiness Requirements</h3>
<p>Client/GC must provide written confirmation that foundation meets tolerances, utility stubs are placed, access routes are ready, permits are scheduled, and site is safe and secured.</p>
` },
  { code: 'D', name: 'Milestones & Schedule', order: 4, content: `
<h2>EXHIBIT D — MILESTONES & SCHEDULE</h2>
<h3>D.1 Design / Pre-Production Milestones</h3>
<p>Design Duration: {{DESIGN_DURATION}} days</p>
<p>Permitting Duration: {{PERMITTING_DURATION}} days</p>
<h3>D.2 Production Milestones</h3>
<p>Production Duration: {{PRODUCTION_DURATION}} days</p>
<p>Delivery Duration: {{DELIVERY_DURATION}} days</p>
<h3>D.3 Schedule Dependencies</h3>
<p>Schedule adjustments occur for: permitting timelines, production slot changes, supply constraints, Client approvals, GC readiness, site readiness, and force majeure.</p>
` },
  { code: 'E', name: 'Limited Warranty', order: 5, content: `
<h2>EXHIBIT E — LIMITED WARRANTY</h2>
<p class="conspicuous">THIS SECTION CHANGES YOUR EXISTING WARRANTY RIGHTS. PLEASE READ CAREFULLY.</p>
<h3>Warranty Scope</h3>
<table class="exhibit-table">
  <tr><th>Warranty Type</th><th>Duration</th><th>Covered Components</th></tr>
  <tr><td>Fit and Finish</td><td>2 Years</td><td>Interior/exterior finishes</td></tr>
  <tr><td>Building Envelope</td><td>5 Years</td><td>Roof, exterior walls, foundation system</td></tr>
  <tr><td>Structural</td><td>10 Years</td><td>Structural frame, floor structure, load-bearing walls</td></tr>
  <tr><td>Systems</td><td>2 Years</td><td>Plumbing, Electrical, HVAC</td></tr>
</table>
<h3>Exclusions</h3>
<p>This warranty does not cover: cosmetic issues not affecting functionality, damage caused by others, normal wear and tear, modifications without approval, acts of God, or commercial/rental use unless approved.</p>
` },
  { code: 'F', name: 'State-Specific Provisions', order: 6, content: `
<h2>EXHIBIT F — STATE-SPECIFIC PROVISIONS</h2>
<h3>F.1 Applicability</h3>
<p>This Exhibit applies only if and to the extent required by applicable law for the Property jurisdiction identified in Exhibit A.</p>
<h3>F.2 Consumer / Statutory Notices</h3>
[STATE_DISCLOSURE:MASTER_EF_NOTICES]
<h3>F.3 Priority</h3>
<p>If a state-required provision conflicts with the Agreement, the state-required provision controls only to the minimum extent required by law.</p>
` },
];

async function ingestMasterEFAgreement() {
  console.log('=== Starting Master Exhibit-First Agreement Ingestion ===');
  console.log(`Source: ${DOCX_PATH}`);
  console.log(`Contract Type: ${CONTRACT_TYPE}`);
  
  if (!fs.existsSync(DOCX_PATH)) {
    throw new Error(`Source DOCX not found: ${DOCX_PATH}`);
  }
  
  const buffer = fs.readFileSync(DOCX_PATH);
  const styleMap = [
    "p[style-name='Heading 1'] => h1.heading1:fresh",
    "p[style-name='Heading 2'] => h2.heading2:fresh",
    "p[style-name='Heading 3'] => h3.heading3:fresh",
    "p[style-name='Title'] => h1.title:fresh",
  ];
  
  const result = await mammoth.convertToHtml({ buffer }, { styleMap });
  let html = result.value;
  
  console.log(`Parsed DOCX: ${html.length} characters`);
  
  html = fixMalformedTags(html);
  console.log('Fixed malformed tags');
  
  const parsedClauses = parseNestedList(html);
  console.log(`Parsed ${parsedClauses.length} clauses from document`);
  
  const existingCheck = await db.select().from(clauses).where(
    sql`${clauses.contractTypes} @> '["MASTER_EF"]'::jsonb`
  ).limit(1);
  
  if (existingCheck.length > 0) {
    console.log('Deleting existing MASTER_EF clauses...');
    await db.delete(clauses).where(
      sql`${clauses.contractTypes} @> '["MASTER_EF"]'::jsonb`
    );
  }
  
  console.log('\nInserting body clauses...');
  const tempIdToDbId = new Map<string, number>();
  
  for (const clause of parsedClauses) {
    const parentDbId = clause.parentTempId ? tempIdToDbId.get(clause.parentTempId) : null;
    
    const [inserted] = await db.insert(clauses).values({
      organizationId: 1,
      slug: clause.clauseCode,
      headerText: clause.headerText,
      bodyHtml: clause.bodyHtml,
      level: clause.hierarchyLevel,
      parentId: parentDbId || null,
      order: clause.sortOrder,
      contractTypes: [CONTRACT_TYPE],
      tags: [],
    }).returning();
    
    tempIdToDbId.set(clause.tempId, inserted.id);
    console.log(`  ✓ [L${clause.hierarchyLevel}] ${clause.headerText.substring(0, 50)}`);
  }
  
  console.log('\nDeleting existing MASTER_EF exhibits...');
  await db.execute(sql`DELETE FROM exhibits WHERE contract_types @> ARRAY['MASTER_EF']::text[]`);
  
  console.log('\nInserting exhibits...');
  for (const exhibit of EXHIBITS_CONFIG) {
    await db.execute(sql`
      INSERT INTO exhibits (letter, title, content, contract_types, sort_order, organization_id)
      VALUES (${exhibit.code}, ${exhibit.name}, ${exhibit.content}, ARRAY['MASTER_EF']::text[], ${exhibit.order}, 1)
    `);
    console.log(`  ✓ Exhibit ${exhibit.code}: ${exhibit.name}`);
  }
  
  console.log('\n=== MASTER_EF Ingestion Complete ===');
  console.log(`Total clauses inserted: ${parsedClauses.length}`);
  console.log(`Total exhibits inserted: ${EXHIBITS_CONFIG.length}`);
}

ingestMasterEFAgreement()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
  });
