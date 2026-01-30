// @ts-ignore - mammoth doesn't have type declarations
import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/db';
import { clauses } from '../shared/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { sql } from 'drizzle-orm';

interface ParsedBlock {
  clauseCode: string;
  name: string;
  content: string;
  blockType: 'section' | 'clause' | 'paragraph' | 'table';
  hierarchyLevel: number;
  sortOrder: number;
  parentClauseId: number | null;
  variablesUsed: string[];
  contractType: string;
  category: string;
}

const VARIABLE_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

function extractVariables(text: string): string[] {
  const variables: string[] = [];
  let match;
  while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  VARIABLE_PATTERN.lastIndex = 0;
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

function determineBlockType(line: string, hierarchyLevel: number): 'section' | 'clause' | 'paragraph' | 'table' {
  if (line.includes('<table') || line.includes('|---')) return 'table';
  if (hierarchyLevel === 0) return 'section';
  if (hierarchyLevel === 1) return 'clause';
  return 'paragraph';
}

async function parseDocx(filePath: string, contractType: string): Promise<ParsedBlock[]> {
  console.log(`\nParsing ${path.basename(filePath)} for ${contractType}...`);
  
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value;
  
  const blocks: ParsedBlock[] = [];
  let sortOrder = 0;
  let blockCounter = 0;
  
  const paragraphs = html.split(/<\/p>|<\/h[1-6]>/).filter(p => p.trim());
  
  let currentSection: { id: number | null; code: string; name: string } = { id: null, code: '', name: '' };
  let currentClause: { id: number | null; code: string } = { id: null, code: '' };
  let contentBuffer = '';
  let pendingBlock: Partial<ParsedBlock> | null = null;
  
  const SECTION_PATTERN = /^(?:<[^>]+>)*\s*(?:SECTION|ARTICLE|RECITAL|EXHIBIT)\s*([A-Z0-9]+)?(?:[:\.\s]|<)/i;
  const CLAUSE_PATTERN = /^(?:<[^>]+>)*\s*(\d+(?:\.\d+)?)[:\.\s]/;
  const SUBCLAUSE_PATTERN = /^(?:<[^>]+>)*\s*(\d+\.\d+\.\d+)[:\.\s]/;
  const BOLD_HEADER_PATTERN = /<strong>([^<]+)(?::|<\/strong>:)/;
  
  for (const para of paragraphs) {
    const cleanText = para.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) continue;
    
    sortOrder += 10;
    
    let sectionMatch = para.match(SECTION_PATTERN);
    let boldHeaderMatch = para.match(BOLD_HEADER_PATTERN);
    let clauseMatch = para.match(CLAUSE_PATTERN);
    let subclauseMatch = para.match(SUBCLAUSE_PATTERN);
    
    if (sectionMatch || (boldHeaderMatch && !clauseMatch)) {
      if (pendingBlock && contentBuffer) {
        pendingBlock.content = contentBuffer.trim();
        pendingBlock.variablesUsed = extractVariables(pendingBlock.content);
        blocks.push(pendingBlock as ParsedBlock);
      }
      
      const sectionName = sectionMatch 
        ? cleanText.split(':')[0].trim()
        : boldHeaderMatch![1].trim();
      
      const sectionCode = sectionMatch?.[1] || 
        (sectionName.toUpperCase().replace(/[^A-Z0-9]/g, '-').substring(0, 20));
      blockCounter++;
      
      pendingBlock = {
        clauseCode: `${contractType}-${sectionCode}-${blockCounter}`,
        name: sectionName,
        content: '',
        blockType: 'section',
        hierarchyLevel: 0,
        sortOrder,
        parentClauseId: null,
        variablesUsed: [],
        contractType,
        category: categorizeClause(sectionName, cleanText),
      };
      
      contentBuffer = cleanText.includes(':') 
        ? cleanText.substring(cleanText.indexOf(':') + 1).trim()
        : '';
      
      currentSection = { id: blocks.length, code: sectionCode, name: sectionName };
      currentClause = { id: null, code: '' };
      
    } else if (subclauseMatch) {
      if (pendingBlock && contentBuffer) {
        pendingBlock.content = contentBuffer.trim();
        pendingBlock.variablesUsed = extractVariables(pendingBlock.content);
        blocks.push(pendingBlock as ParsedBlock);
      }
      
      const subclauseCode = subclauseMatch[1];
      const subclauseName = cleanText.substring(subclauseMatch[0].length).split('.')[0].trim() || 
        `Subclause ${subclauseCode}`;
      blockCounter++;
      
      pendingBlock = {
        clauseCode: `${contractType}-${subclauseCode}-${blockCounter}`,
        name: subclauseName,
        content: '',
        blockType: 'paragraph',
        hierarchyLevel: 2,
        sortOrder,
        parentClauseId: currentClause.id,
        variablesUsed: [],
        contractType,
        category: categorizeClause(subclauseName, cleanText),
      };
      
      contentBuffer = cleanText;
      
    } else if (clauseMatch) {
      if (pendingBlock && contentBuffer) {
        pendingBlock.content = contentBuffer.trim();
        pendingBlock.variablesUsed = extractVariables(pendingBlock.content);
        blocks.push(pendingBlock as ParsedBlock);
      }
      
      const clauseCode = clauseMatch[1];
      const clauseName = cleanText.substring(clauseMatch[0].length).split('.')[0].trim() ||
        `Clause ${clauseCode}`;
      blockCounter++;
      
      pendingBlock = {
        clauseCode: `${contractType}-${clauseCode}-${blockCounter}`,
        name: clauseName,
        content: '',
        blockType: 'clause',
        hierarchyLevel: 1,
        sortOrder,
        parentClauseId: currentSection.id,
        variablesUsed: [],
        contractType,
        category: categorizeClause(clauseName, cleanText),
      };
      
      contentBuffer = cleanText;
      currentClause = { id: blocks.length, code: clauseCode };
      
    } else {
      if (contentBuffer) {
        contentBuffer += '\n\n' + cleanText;
      } else if (pendingBlock) {
        contentBuffer = cleanText;
      }
    }
  }
  
  if (pendingBlock && contentBuffer) {
    pendingBlock.content = contentBuffer.trim();
    pendingBlock.variablesUsed = extractVariables(pendingBlock.content);
    blocks.push(pendingBlock as ParsedBlock);
  }
  
  console.log(`  Found ${blocks.length} blocks`);
  return blocks;
}

async function insertBlocks(blocks: ParsedBlock[]): Promise<Map<string, number>> {
  const idMap = new Map<string, number>();
  
  for (const block of blocks) {
    const resolvedParentId = block.parentClauseId !== null 
      ? idMap.get(blocks[block.parentClauseId]?.clauseCode || '') || null
      : null;
    
    const [inserted] = await db.insert(clauses).values({
      clauseCode: block.clauseCode,
      name: block.name,
      content: block.content,
      blockType: block.blockType,
      hierarchyLevel: block.hierarchyLevel,
      sortOrder: block.sortOrder,
      parentClauseId: resolvedParentId,
      variablesUsed: block.variablesUsed.length > 0 ? block.variablesUsed : null,
      contractType: block.contractType,
      category: block.category,
      riskLevel: 'MEDIUM',
      negotiable: false,
    }).returning({ id: clauses.id });
    
    idMap.set(block.clauseCode, inserted.id);
  }
  
  return idMap;
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
  
  process.exit(0);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
