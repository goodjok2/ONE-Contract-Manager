// @ts-ignore - mammoth doesn't have type declarations
import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/db';
import { clauses } from '../shared/schema';
import { sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ParsedBlock {
  tempId: string;
  clauseCode: string;
  name: string;
  content: string;
  blockType: 'section' | 'clause' | 'paragraph' | 'table';
  hierarchyLevel: number;
  sortOrder: number;
  parentTempId: string | null;
  variablesUsed: string[];
  contractType: string;
  category: string;
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

function categorizeClause(name: string, content: string): string {
  const lowerName = name.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  if (lowerName.includes('recital') || lowerName.includes('preamble')) return 'recital';
  if (lowerName.includes('payment') || lowerName.includes('price') || lowerName.includes('fee')) return 'payment';
  if (lowerName.includes('warranty') || lowerName.includes('guarantee')) return 'warranty';
  if (lowerName.includes('termination') || lowerName.includes('cancel')) return 'termination';
  if (lowerName.includes('exhibit')) return 'exhibit';
  if (lowerName.includes('scope') || lowerName.includes('work')) return 'scope';
  if (lowerName.includes('insurance')) return 'insurance';
  if (lowerName.includes('dispute') || lowerName.includes('arbitration')) return 'dispute';
  if (lowerName.includes('change') || lowerName.includes('modification')) return 'changes';
  if (lowerName.includes('schedule') || lowerName.includes('timeline')) return 'schedule';
  if (lowerName.includes('definition')) return 'definitions';
  if (lowerContent.includes('indemnif')) return 'indemnification';
  if (lowerContent.includes('liability') || lowerContent.includes('limitation')) return 'liability';
  
  return 'general';
}

function determineBlockType(content: string, hierarchyLevel: number): 'section' | 'clause' | 'paragraph' | 'table' {
  if (content.includes('<table') || content.includes('|---|') || /\|[^|]+\|[^|]+\|/.test(content)) {
    return 'table';
  }
  if (hierarchyLevel === 0) return 'section';
  if (hierarchyLevel === 1) return 'clause';
  return 'paragraph';
}

function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFullName(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match) return text.substring(0, 100);
  
  const afterMatch = text.substring(match.index! + match[0].length);
  const colonIndex = afterMatch.indexOf(':');
  const newlineIndex = afterMatch.indexOf('\n');
  
  let endIndex = Math.min(
    colonIndex > 0 ? colonIndex : Infinity,
    newlineIndex > 0 ? newlineIndex : Infinity,
    100
  );
  
  const name = afterMatch.substring(0, endIndex).trim();
  return name || match[0].trim();
}

async function parseDocx(filePath: string, contractType: string): Promise<ParsedBlock[]> {
  console.log(`\nParsing ${path.basename(filePath)} for ${contractType}...`);
  
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;
  
  const blocks: ParsedBlock[] = [];
  let sortOrder = 0;
  
  const paragraphs = html.split(/<\/p>|<\/h[1-6]>/).filter(p => p.trim());
  
  let currentSectionId: string | null = null;
  let currentClauseId: string | null = null;
  let sectionCounter = 0;
  let contentBuffer = '';
  let pendingBlock: Partial<ParsedBlock> | null = null;
  
  const SECTION_PATTERN = /^(?:<[^>]+>)*\s*(?:Section|SECTION|Article|ARTICLE|Recital|RECITAL|Exhibit|EXHIBIT)\s*([A-Z0-9]+)[\.\s:]/i;
  const ROMAN_SECTION_PATTERN = /^(?:<[^>]+>)*\s*(I{1,3}|IV|VI{0,3}|IX|X{0,3})\.\s+[A-Z]/i;
  const BOLD_SECTION_PATTERN = /<strong>([^<]+)<\/strong>(?:\s*:)?/;
  const CLAUSE_PATTERN = /^(?:<[^>]+>)*\s*(\d+\.\d+(?:\.\d+)?)[.\s]/;
  const SECTION_NUM_PATTERN = /^(?:<[^>]+>)*\s*(\d+)\.\s+(?![\d])/;
  
  function finalizePendingBlock() {
    if (pendingBlock) {
      pendingBlock.content = contentBuffer.trim() || pendingBlock.name || '';
      pendingBlock.variablesUsed = extractVariables(pendingBlock.content);
      pendingBlock.blockType = determineBlockType(pendingBlock.content, pendingBlock.hierarchyLevel || 0);
      blocks.push(pendingBlock as ParsedBlock);
      contentBuffer = '';
      pendingBlock = null;
    }
  }
  
  for (const para of paragraphs) {
    const text = cleanText(para);
    if (!text || text.length < 3) continue;
    
    sortOrder += 10;
    
    const sectionMatch = para.match(SECTION_PATTERN);
    const romanMatch = para.match(ROMAN_SECTION_PATTERN);
    const boldMatch = para.match(BOLD_SECTION_PATTERN);
    const clauseMatch = para.match(CLAUSE_PATTERN);
    const sectionNumMatch = para.match(SECTION_NUM_PATTERN);
    
    const isSectionHeader = sectionMatch || romanMatch ||
      (boldMatch && !clauseMatch && text.length < 150 && (text.includes(':') || text.toUpperCase() === text.substring(0, 20).toUpperCase()));
    
    if (isSectionHeader || sectionNumMatch) {
      finalizePendingBlock();
      sectionCounter++;
      
      let sectionCode: string;
      let sectionName: string;
      
      if (sectionMatch) {
        sectionCode = sectionMatch[1] || `S${sectionCounter}`;
        const periodIdx = text.indexOf('.');
        const numEnd = text.search(/\d+$/);
        sectionName = numEnd > periodIdx ? text.substring(0, numEnd).trim() : text.substring(0, 80).trim();
      } else if (romanMatch) {
        sectionCode = romanMatch[1];
        sectionName = text.replace(/\d+$/, '').trim();
      } else if (sectionNumMatch) {
        sectionCode = sectionNumMatch[1];
        sectionName = text.replace(/\d+$/, '').substring(0, 80).trim();
      } else if (boldMatch) {
        sectionCode = `H${sectionCounter}`;
        sectionName = boldMatch[1].trim();
      } else {
        sectionCode = `S${sectionCounter}`;
        sectionName = text.substring(0, 80).trim();
      }
      
      const tempId = `${contractType}-SEC-${sectionCode}-${sortOrder}`;
      currentSectionId = tempId;
      currentClauseId = null;
      
      pendingBlock = {
        tempId,
        clauseCode: `${contractType}-${sectionCode}-${sortOrder}`,
        name: sectionName,
        content: '',
        blockType: 'section',
        hierarchyLevel: 0,
        sortOrder,
        parentTempId: null,
        variablesUsed: [],
        contractType,
        category: categorizeClause(sectionName, text),
      };
      
      const colonIdx = text.indexOf(':');
      contentBuffer = colonIdx > 0 ? text.substring(colonIdx + 1).trim() : '';
      
    } else if (clauseMatch) {
      finalizePendingBlock();
      
      const clauseNum = clauseMatch[1];
      const isSubclause = clauseNum.split('.').length > 2;
      const tempId = `${contractType}-CLS-${clauseNum}-${sortOrder}`;
      
      const colonIdx = text.indexOf(':');
      const periodIdx = text.indexOf('.', clauseMatch[0].length);
      const nameEndIdx = Math.min(
        colonIdx > 0 ? colonIdx : Infinity,
        periodIdx > clauseMatch[0].length ? periodIdx : Infinity,
        clauseMatch[0].length + 80
      );
      
      let clauseName = text.substring(clauseMatch[0].length, nameEndIdx).trim();
      if (!clauseName) clauseName = `Clause ${clauseNum}`;
      
      if (isSubclause) {
        pendingBlock = {
          tempId,
          clauseCode: `${contractType}-${clauseNum}-${sortOrder}`,
          name: clauseName,
          content: '',
          blockType: 'paragraph',
          hierarchyLevel: 2,
          sortOrder,
          parentTempId: currentClauseId,
          variablesUsed: [],
          contractType,
          category: categorizeClause(clauseName, text),
        };
      } else {
        currentClauseId = tempId;
        pendingBlock = {
          tempId,
          clauseCode: `${contractType}-${clauseNum}-${sortOrder}`,
          name: clauseName,
          content: '',
          blockType: 'clause',
          hierarchyLevel: 1,
          sortOrder,
          parentTempId: currentSectionId,
          variablesUsed: [],
          contractType,
          category: categorizeClause(clauseName, text),
        };
      }
      
      contentBuffer = text;
      
    } else {
      if (pendingBlock) {
        contentBuffer += (contentBuffer ? '\n\n' : '') + text;
      }
    }
  }
  
  finalizePendingBlock();
  
  console.log(`  Found ${blocks.length} blocks`);
  return blocks;
}

async function insertBlocks(blocks: ParsedBlock[]): Promise<void> {
  const tempIdToDbId = new Map<string, number>();
  
  const sections = blocks.filter(b => b.hierarchyLevel === 0);
  const nonSections = blocks.filter(b => b.hierarchyLevel !== 0);
  
  for (const block of sections) {
    const [inserted] = await db.insert(clauses).values({
      clauseCode: block.clauseCode,
      name: block.name,
      content: block.content,
      blockType: block.blockType,
      hierarchyLevel: block.hierarchyLevel,
      sortOrder: block.sortOrder,
      parentClauseId: null,
      variablesUsed: block.variablesUsed.length > 0 ? block.variablesUsed : null,
      contractType: block.contractType,
      category: block.category,
      riskLevel: 'MEDIUM',
      negotiable: false,
    }).returning({ id: clauses.id });
    
    tempIdToDbId.set(block.tempId, inserted.id);
  }
  
  for (const block of nonSections) {
    let parentId: number | null = null;
    if (block.parentTempId) {
      parentId = tempIdToDbId.get(block.parentTempId) || null;
    }
    
    const [inserted] = await db.insert(clauses).values({
      clauseCode: block.clauseCode,
      name: block.name,
      content: block.content,
      blockType: block.blockType,
      hierarchyLevel: block.hierarchyLevel,
      sortOrder: block.sortOrder,
      parentClauseId: parentId,
      variablesUsed: block.variablesUsed.length > 0 ? block.variablesUsed : null,
      contractType: block.contractType,
      category: block.category,
      riskLevel: 'MEDIUM',
      negotiable: false,
    }).returning({ id: clauses.id });
    
    tempIdToDbId.set(block.tempId, inserted.id);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('INTELLIGENT CONTRACT INGESTOR');
  console.log('='.repeat(60));
  
  const templatesDir = path.join(__dirname, '..', 'server', 'templates');
  
  const templates = [
    { file: 'Template_ONE_Agreement.docx', type: 'ONE' },
    { file: 'Template_Offsite.docx', type: 'OFFSITE' },
    { file: 'Template_On-Site.docx', type: 'ONSITE' },
  ];
  
  for (const t of templates) {
    const filePath = path.join(templatesDir, t.file);
    if (!fs.existsSync(filePath)) {
      console.error(`Template not found: ${filePath}`);
      process.exit(1);
    }
  }
  
  console.log('\n1. Clearing existing clauses table...');
  await db.delete(clauses);
  console.log('   Clauses table cleared.');
  
  console.log('\n2. Parsing and ingesting templates...');
  
  let totalBlocks = 0;
  
  for (const template of templates) {
    const filePath = path.join(templatesDir, template.file);
    const blocks = await parseDocx(filePath, template.type);
    
    console.log(`\n   Inserting ${blocks.length} blocks for ${template.type}...`);
    await insertBlocks(blocks);
    totalBlocks += blocks.length;
    
    console.log(`   ✓ ${template.type}: ${blocks.length} blocks inserted`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`COMPLETE: Ingested ${totalBlocks} total blocks`);
  console.log('='.repeat(60));
  
  const stats = await db.execute(sql`
    SELECT 
      contract_type,
      block_type,
      COUNT(*) as count
    FROM clauses
    GROUP BY contract_type, block_type
    ORDER BY contract_type, block_type
  `);
  
  console.log('\nBlock Distribution:');
  console.table(stats.rows);
  
  const treeSample = await db.execute(sql`
    SELECT 
      c.clause_code,
      c.name,
      c.block_type,
      c.hierarchy_level,
      p.clause_code as parent_code
    FROM clauses c
    LEFT JOIN clauses p ON c.parent_clause_id = p.id
    WHERE c.contract_type = 'ONE'
    ORDER BY c.sort_order
    LIMIT 20
  `);
  
  console.log('\nTree Structure Sample (ONE):');
  console.table(treeSample.rows);
  
  process.exit(0);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
