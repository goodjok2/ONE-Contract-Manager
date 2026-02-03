import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../server/db';

interface ParsedClause {
  slug: string;
  headerText: string;
  bodyHtml: string;
  level: number;
  parentSlug: string | null;
  order: number;
  contractTypes: string[];
  tags: string[];
  variablesUsed: string[];
  conditions: Record<string, string> | null;
}

const VARIABLE_REGEX = /\{\{([A-Z_0-9]+)\}\}/g;

function extractVariables(html: string): string[] {
  const matches = html.matchAll(VARIABLE_REGEX);
  const variables = new Set<string>();
  for (const match of matches) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function slugify(text: string, contractType: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  return `${contractType.toLowerCase()}-${base}-${index}`;
}

interface SectionMatch {
  type: 'section' | 'subsection' | 'recital' | 'exhibit' | 'article';
  number: string;
  title: string;
  level: number;
}

function detectSectionType(text: string): SectionMatch | null {
  const cleanText = text.replace(/<[^>]+>/g, '').trim();
  
  if (/^SECTION\s+(\d+)\.\s*(.+)/i.test(cleanText)) {
    const match = cleanText.match(/^SECTION\s+(\d+)\.\s*(.+)/i);
    return { type: 'section', number: match![1], title: match![2], level: 1 };
  }
  
  if (/^(\d+)\.(\d+)\s+(.+)/i.test(cleanText)) {
    const match = cleanText.match(/^(\d+)\.(\d+)\s+(.+)/i);
    return { type: 'subsection', number: `${match![1]}.${match![2]}`, title: match![3], level: 2 };
  }
  
  if (/^ARTICLE\s+(\d+|[IVXLC]+)[.:\s]+(.+)/i.test(cleanText)) {
    const match = cleanText.match(/^ARTICLE\s+(\d+|[IVXLC]+)[.:\s]+(.+)/i);
    return { type: 'article', number: match![1], title: match![2], level: 1 };
  }
  
  if (/^RECITAL\s+([A-Z])[.:\s]*/i.test(cleanText)) {
    const match = cleanText.match(/^RECITAL\s+([A-Z])[.:\s]*/i);
    return { type: 'recital', number: match![1], title: '', level: 2 };
  }
  
  if (/^EXHIBIT\s+([A-Z])[.:\s]*(.+)?/i.test(cleanText)) {
    const match = cleanText.match(/^EXHIBIT\s+([A-Z])[.:\s]*(.+)?/i);
    return { type: 'exhibit', number: match![1], title: match![2] || '', level: 1 };
  }
  
  if (/^RECITALS$/i.test(cleanText)) {
    return { type: 'section', number: 'R', title: 'RECITALS', level: 1 };
  }
  
  if (/^DOCUMENT SUMMARY$/i.test(cleanText)) {
    return { type: 'section', number: 'DS', title: 'DOCUMENT SUMMARY', level: 1 };
  }
  
  if (/^ATTACHMENTS$/i.test(cleanText)) {
    return { type: 'section', number: 'A', title: 'ATTACHMENTS', level: 1 };
  }
  
  return null;
}

function isHeading(element: string): boolean {
  return /<h[1-6]/i.test(element) || 
         /<p[^>]*class="[^"]*heading[^"]*"/i.test(element) ||
         /<strong>SECTION/i.test(element) ||
         /<strong>ARTICLE/i.test(element) ||
         /<strong>EXHIBIT/i.test(element);
}

function parseDocxHtml(html: string, contractType: string): ParsedClause[] {
  const clauses: ParsedClause[] = [];
  let globalOrder = 100;
  
  const decoded = decodeHtmlEntities(html);
  
  const elements = decoded.split(/(?=<h[1-6]|<p)/i).filter(el => el.trim());
  
  let currentSection: ParsedClause | null = null;
  let currentSubsection: ParsedClause | null = null;
  let bodyAccumulator: string[] = [];
  
  function flushSubsection() {
    if (currentSubsection && bodyAccumulator.length > 0) {
      currentSubsection.bodyHtml = bodyAccumulator.join('\n');
      currentSubsection.variablesUsed = extractVariables(currentSubsection.bodyHtml);
    }
    bodyAccumulator = [];
  }
  
  function flushSection() {
    flushSubsection();
    if (currentSection && !currentSubsection && bodyAccumulator.length > 0) {
      currentSection.bodyHtml = bodyAccumulator.join('\n');
      currentSection.variablesUsed = extractVariables(currentSection.bodyHtml);
    }
  }
  
  for (const element of elements) {
    const cleanText = element.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) continue;
    
    const sectionMatch = detectSectionType(element);
    
    if (sectionMatch) {
      if (sectionMatch.level === 1) {
        flushSection();
        
        const slug = slugify(`${sectionMatch.type}-${sectionMatch.number}-${sectionMatch.title}`, contractType, globalOrder);
        currentSection = {
          slug,
          headerText: cleanText,
          bodyHtml: '',
          level: 1,
          parentSlug: null,
          order: globalOrder,
          contractTypes: [contractType],
          tags: [],
          variablesUsed: [],
          conditions: null,
        };
        clauses.push(currentSection);
        currentSubsection = null;
        globalOrder += 100;
      } else if (sectionMatch.level === 2) {
        flushSubsection();
        
        const slug = slugify(`${sectionMatch.type}-${sectionMatch.number}-${sectionMatch.title}`, contractType, globalOrder);
        currentSubsection = {
          slug,
          headerText: cleanText,
          bodyHtml: '',
          level: 2,
          parentSlug: currentSection?.slug || null,
          order: globalOrder,
          contractTypes: [contractType],
          tags: [],
          variablesUsed: [],
          conditions: null,
        };
        clauses.push(currentSubsection);
        globalOrder += 10;
      }
    } else {
      let htmlContent = element.trim();
      if (!htmlContent.startsWith('<')) {
        htmlContent = `<p>${htmlContent}</p>`;
      }
      bodyAccumulator.push(htmlContent);
    }
  }
  
  flushSection();
  
  return clauses;
}

async function parseOneAgreement(filePath: string): Promise<ParsedClause[]> {
  console.log(`📖 Parsing ONE Agreement: ${filePath}`);
  
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  
  console.log(`  ⚠️ Mammoth warnings: ${result.messages.length}`);
  result.messages.forEach(msg => console.log(`    - ${msg.message}`));
  
  const clauses = parseDocxHtml(result.value, 'ONE');
  
  console.log(`  ✅ Parsed ${clauses.length} clauses from ONE Agreement`);
  return clauses;
}

async function parseManufacturingSubcontract(filePath: string): Promise<ParsedClause[]> {
  console.log(`📖 Parsing Manufacturing Subcontract: ${filePath}`);
  
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  
  const clauses = parseDocxHtml(result.value, 'MANUFACTURING');
  
  console.log(`  ✅ Parsed ${clauses.length} clauses from Manufacturing Subcontract`);
  return clauses;
}

async function parseOnsiteSubcontract(filePath: string): Promise<ParsedClause[]> {
  console.log(`📖 Parsing OnSite Subcontract: ${filePath}`);
  
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  
  const clauses = parseDocxHtml(result.value, 'ONSITE');
  
  console.log(`  ✅ Parsed ${clauses.length} clauses from OnSite Subcontract`);
  return clauses;
}

async function insertClauses(clauses: ParsedClause[]): Promise<Map<string, number>> {
  const slugToId = new Map<string, number>();
  
  for (const clause of clauses) {
    const result = await pool.query(
      `INSERT INTO clauses (slug, header_text, body_html, level, parent_id, "order", contract_types, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        clause.slug,
        clause.headerText,
        clause.bodyHtml,
        clause.level,
        clause.parentSlug ? slugToId.get(clause.parentSlug) || null : null,
        clause.order,
        JSON.stringify(clause.contractTypes),
        JSON.stringify(clause.tags),
      ]
    );
    slugToId.set(clause.slug, result.rows[0].id);
  }
  
  return slugToId;
}

async function rebuildTemplates(slugToId: Map<string, number>, contractType: string) {
  const clauseResult = await pool.query(
    `SELECT id FROM clauses WHERE contract_types @> $1::jsonb ORDER BY "order"`,
    [JSON.stringify([contractType])]
  );
  
  const clauseIds = clauseResult.rows.map(r => r.id);
  
  const existing = await pool.query(
    `SELECT id FROM contract_templates WHERE contract_type = $1`,
    [contractType]
  );
  
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE contract_templates 
       SET base_clause_ids = $1, updated_at = NOW()
       WHERE contract_type = $2`,
      [JSON.stringify(clauseIds), contractType]
    );
    console.log(`  📝 Updated template for ${contractType} with ${clauseIds.length} clauses`);
  } else {
    await pool.query(
      `INSERT INTO contract_templates (name, contract_type, base_clause_ids, conditional_rules, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
      [
        `Master ${contractType} Agreement`,
        contractType,
        JSON.stringify(clauseIds),
        JSON.stringify({}),
      ]
    );
    console.log(`  ✨ Created template for ${contractType} with ${clauseIds.length} clauses`);
  }
  
  await pool.query(`DELETE FROM template_clauses WHERE template_id IN (SELECT id FROM contract_templates WHERE contract_type = $1)`, [contractType]);
  
  const templateResult = await pool.query(`SELECT id FROM contract_templates WHERE contract_type = $1`, [contractType]);
  const templateId = templateResult.rows[0].id;
  
  for (let i = 0; i < clauseIds.length; i++) {
    await pool.query(
      `INSERT INTO template_clauses (template_id, clause_id, sort_order) VALUES ($1, $2, $3)`,
      [templateId, clauseIds[i], i * 10]
    );
  }
  console.log(`  🔗 Linked ${clauseIds.length} clauses to template via template_clauses junction`);
}

async function main() {
  console.log('\n🚀 DOCX CLAUSE INGESTION STARTING...\n');
  
  const oneFile = 'attached_assets/7._26-00X_Project_Name_-_Dvele_ONE_Agreement_1769049836636.docx';
  const mfgFile = 'attached_assets/8._Manufacturing_Subcontractor_Agreement_-_Company_to_Dvele_M_1769052367912.docx';
  const onsiteFile = 'attached_assets/9._On-Site_Installation_Subcontractor_Agreement_-_Company_to__1769052367913.docx';
  
  try {
    console.log('📋 Step 1: Parsing DOCX files...\n');
    
    const allClauses: ParsedClause[] = [];
    
    if (fs.existsSync(oneFile)) {
      const oneClauses = await parseOneAgreement(oneFile);
      allClauses.push(...oneClauses);
    } else {
      console.log(`  ⚠️ ONE Agreement file not found: ${oneFile}`);
    }
    
    if (fs.existsSync(mfgFile)) {
      const mfgClauses = await parseManufacturingSubcontract(mfgFile);
      allClauses.push(...mfgClauses);
    } else {
      console.log(`  ⚠️ Manufacturing file not found: ${mfgFile}`);
    }
    
    if (fs.existsSync(onsiteFile)) {
      const onsiteClauses = await parseOnsiteSubcontract(onsiteFile);
      allClauses.push(...onsiteClauses);
    } else {
      console.log(`  ⚠️ OnSite file not found: ${onsiteFile}`);
    }
    
    console.log(`\n📊 Total clauses parsed: ${allClauses.length}\n`);
    
    console.log('📋 Step 2: Inserting clauses into database...\n');
    const slugToId = await insertClauses(allClauses);
    console.log(`  ✅ Inserted ${slugToId.size} clauses\n`);
    
    console.log('📋 Step 3: Rebuilding contract templates...\n');
    await rebuildTemplates(slugToId, 'ONE');
    await rebuildTemplates(slugToId, 'MANUFACTURING');
    await rebuildTemplates(slugToId, 'ONSITE');
    
    console.log('\n✅ INGESTION COMPLETE!\n');
    
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM clauses) as clause_count,
        (SELECT COUNT(*) FROM contract_templates) as template_count,
        (SELECT COUNT(*) FROM template_clauses) as junction_count
    `);
    console.log('📊 Final stats:', stats.rows[0]);
    
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    throw error;
  }
}

main().then(() => process.exit(0)).catch(() => process.exit(1));
