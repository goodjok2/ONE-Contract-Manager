import mammoth from 'mammoth';
import * as fs from 'fs';
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

function cleanHeaderText(html: string): string {
  return html
    .replace(/<a[^>]*id="[^"]*"[^>]*><\/a>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getHeadingLevel(tag: string): number | null {
  const match = tag.match(/<h([1-6])/i);
  if (match) return parseInt(match[1]);
  return null;
}

function isContentElement(element: string): boolean {
  return /^<(p|ul|ol|table|blockquote)/i.test(element.trim());
}

function parseDocxHtml(html: string, contractType: string): ParsedClause[] {
  const clauses: ParsedClause[] = [];
  let globalOrder = 100;
  
  const decoded = decodeHtmlEntities(html);
  
  const elements = decoded.split(/(?=<h[1-6]|<p(?:\s|>)|<ul|<ol|<table|<blockquote)/i).filter(el => el.trim());
  
  let currentL1: ParsedClause | null = null;
  let currentL2: ParsedClause | null = null;
  let currentL3: ParsedClause | null = null;
  let bodyBuffer: string[] = [];
  
  const hasTOC = decoded.includes('<a href="#');
  let skipTOC = hasTOC;
  
  function flushBody() {
    if (bodyBuffer.length > 0) {
      const body = bodyBuffer.join('\n');
      if (currentL3) {
        currentL3.bodyHtml += (currentL3.bodyHtml ? '\n' : '') + body;
        currentL3.variablesUsed = extractVariables(currentL3.bodyHtml);
      } else if (currentL2) {
        currentL2.bodyHtml += (currentL2.bodyHtml ? '\n' : '') + body;
        currentL2.variablesUsed = extractVariables(currentL2.bodyHtml);
      } else if (currentL1) {
        currentL1.bodyHtml += (currentL1.bodyHtml ? '\n' : '') + body;
        currentL1.variablesUsed = extractVariables(currentL1.bodyHtml);
      }
      bodyBuffer = [];
    }
  }
  
  for (const element of elements) {
    if (hasTOC && element.includes('<a href="#')) {
      continue;
    }
    
    if (hasTOC && element.includes('<a id="')) {
      skipTOC = false;
    }
    
    if (skipTOC) continue;
    
    const level = getHeadingLevel(element);
    
    if (level !== null) {
      const headerText = cleanHeaderText(element);
      
      if (!headerText || headerText.length < 2) continue;
      
      flushBody();
      
      if (level === 1) {
        const slug = slugify(headerText, contractType, globalOrder);
        currentL1 = {
          slug,
          headerText,
          bodyHtml: '',
          level: 1,
          parentSlug: null,
          order: globalOrder,
          contractTypes: [contractType],
          tags: [],
          variablesUsed: [],
          conditions: null,
        };
        clauses.push(currentL1);
        currentL2 = null;
        currentL3 = null;
        globalOrder += 100;
      } else if (level === 2) {
        const slug = slugify(headerText, contractType, globalOrder);
        currentL2 = {
          slug,
          headerText,
          bodyHtml: '',
          level: 2,
          parentSlug: currentL1?.slug || null,
          order: globalOrder,
          contractTypes: [contractType],
          tags: [],
          variablesUsed: [],
          conditions: null,
        };
        clauses.push(currentL2);
        currentL3 = null;
        globalOrder += 10;
      } else if (level >= 3) {
        const slug = slugify(headerText, contractType, globalOrder);
        currentL3 = {
          slug,
          headerText,
          bodyHtml: '',
          level: 3,
          parentSlug: currentL2?.slug || currentL1?.slug || null,
          order: globalOrder,
          contractTypes: [contractType],
          tags: [],
          variablesUsed: [],
          conditions: null,
        };
        clauses.push(currentL3);
        globalOrder += 5;
      }
    } else if (isContentElement(element)) {
      bodyBuffer.push(element.trim());
    }
  }
  
  flushBody();
  
  return clauses;
}

async function parseDocxFile(filePath: string, contractType: string): Promise<ParsedClause[]> {
  console.log(`📖 Parsing ${contractType}: ${filePath}`);
  
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  
  console.log(`  ⚠️ Mammoth warnings: ${result.messages.length}`);
  
  const clauses = parseDocxHtml(result.value, contractType);
  
  const withContent = clauses.filter(c => c.bodyHtml.length > 0);
  console.log(`  ✅ Parsed ${clauses.length} clauses (${withContent.length} with body content)`);
  
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
  
  if (clauseIds.length === 0) {
    console.log(`  ⚠️ No clauses found for ${contractType}, skipping template creation`);
    return;
  }
  
  const existing = await pool.query(
    `SELECT id FROM contract_templates WHERE contract_type = $1`,
    [contractType]
  );
  
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE contract_templates 
       SET base_clause_ids = $1::integer[], updated_at = NOW()
       WHERE contract_type = $2`,
      [clauseIds, contractType]
    );
    console.log(`  📝 Updated template for ${contractType} with ${clauseIds.length} clauses`);
  } else {
    await pool.query(
      `INSERT INTO contract_templates (name, display_name, contract_type, base_clause_ids, conditional_rules, is_active, organization_id, version, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4::integer[], $5, true, 1, '1.0', 'active', NOW(), NOW())`,
      [
        `Master ${contractType} Agreement`,
        `${contractType} Agreement`,
        contractType,
        clauseIds,
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
      `INSERT INTO template_clauses (template_id, clause_id, order_index, organization_id) VALUES ($1, $2, $3, 1)`,
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
      const oneClauses = await parseDocxFile(oneFile, 'ONE');
      allClauses.push(...oneClauses);
    } else {
      console.log(`  ⚠️ ONE Agreement file not found: ${oneFile}`);
    }
    
    if (fs.existsSync(mfgFile)) {
      const mfgClauses = await parseDocxFile(mfgFile, 'MANUFACTURING');
      allClauses.push(...mfgClauses);
    } else {
      console.log(`  ⚠️ Manufacturing file not found: ${mfgFile}`);
    }
    
    if (fs.existsSync(onsiteFile)) {
      const onsiteClauses = await parseDocxFile(onsiteFile, 'ONSITE');
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
        (SELECT COUNT(*) FROM clauses WHERE length(body_html) > 0) as clauses_with_content,
        (SELECT COUNT(*) FROM contract_templates) as template_count,
        (SELECT COUNT(*) FROM template_clauses) as junction_count
    `);
    console.log('📊 Final stats:', stats.rows[0]);
    
    const samples = await pool.query(`
      SELECT slug, header_text, length(body_html) as body_length, level
      FROM clauses 
      WHERE contract_types @> '["ONE"]'::jsonb AND length(body_html) > 0
      ORDER BY "order"
      LIMIT 5
    `);
    console.log('\n📋 Sample clauses with content:');
    samples.rows.forEach(r => {
      console.log(`  - [L${r.level}] ${r.header_text.substring(0, 50)}... (${r.body_length} chars)`);
    });
    
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    throw error;
  }
}

main().then(() => process.exit(0)).catch(() => process.exit(1));
