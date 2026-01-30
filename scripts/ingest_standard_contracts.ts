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

interface StyledParagraph {
  style: string;
  text: string;
  html: string;
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

function deriveContractTypeFromFilename(filename: string): string {
  const baseName = path.basename(filename, '.docx');
  
  const cleaned = baseName
    .replace(/^Template[_-]?/i, '')
    .replace(/[_-]/g, '_')
    .toUpperCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  return cleaned || baseName.toUpperCase();
}

function determineBlockTypeFromStyle(styleName: string, text: string): { blockType: 'section' | 'clause' | 'paragraph' | 'table', level: number } {
  const normalizedStyle = styleName.toLowerCase().trim();
  
  if (text.includes('_TABLE}}') || text.includes('{{PRICING_BREAKDOWN_TABLE}}') || text.includes('{{PAYMENT_SCHEDULE_TABLE}}')) {
    return { blockType: 'table', level: 3 };
  }
  
  if (normalizedStyle.includes('heading 1') || normalizedStyle === 'heading1' || normalizedStyle === 'title') {
    return { blockType: 'section', level: 0 };
  }
  
  if (normalizedStyle.includes('heading 2') || normalizedStyle === 'heading2') {
    return { blockType: 'clause', level: 1 };
  }
  
  if (normalizedStyle.includes('heading 3') || normalizedStyle === 'heading3') {
    return { blockType: 'paragraph', level: 2 };
  }
  
  if (normalizedStyle.includes('heading') || normalizedStyle.includes('title')) {
    const headingMatch = normalizedStyle.match(/heading\s*(\d+)/i);
    if (headingMatch) {
      const num = parseInt(headingMatch[1]);
      if (num === 1) return { blockType: 'section', level: 0 };
      if (num === 2) return { blockType: 'clause', level: 1 };
      return { blockType: 'paragraph', level: Math.min(num, 3) };
    }
    return { blockType: 'section', level: 0 };
  }
  
  return { blockType: 'paragraph', level: 3 };
}

function detectHeaderPatterns(text: string): { isHeader: boolean, blockType: 'section' | 'clause' | 'paragraph', level: number } {
  const SECTION_PATTERN = /^(?:Section|SECTION|Article|ARTICLE|Recital|RECITAL|Exhibit|EXHIBIT)\s*([A-Z0-9]+)[\.\s:]/i;
  const ROMAN_SECTION_PATTERN = /^(I{1,3}|IV|VI{0,3}|IX|X{0,3})\.\s+[A-Z]/i;
  const NUMBERED_SECTION_PATTERN = /^(\d+)\.\s+(?![\d])([A-Z])/;
  const CLAUSE_PATTERN = /^(\d+\.\d+(?:\.\d+)?)[.\s]/;
  const UPPERCASE_HEADER = /^[A-Z][A-Z\s&\-:]{5,50}$/;
  const SHORT_TITLE = /^[A-Z][a-zA-Z\s&\-:]{3,40}:?\s*$/;
  
  if (SECTION_PATTERN.test(text) || ROMAN_SECTION_PATTERN.test(text)) {
    return { isHeader: true, blockType: 'section', level: 0 };
  }
  
  if (NUMBERED_SECTION_PATTERN.test(text)) {
    return { isHeader: true, blockType: 'section', level: 0 };
  }
  
  if (CLAUSE_PATTERN.test(text)) {
    const match = text.match(CLAUSE_PATTERN);
    if (match) {
      const parts = match[1].split('.');
      if (parts.length >= 3) {
        return { isHeader: true, blockType: 'paragraph', level: 2 };
      }
      return { isHeader: true, blockType: 'clause', level: 1 };
    }
  }
  
  if (text.length < 60 && UPPERCASE_HEADER.test(text.trim())) {
    return { isHeader: true, blockType: 'section', level: 0 };
  }
  
  if (text.length < 50 && SHORT_TITLE.test(text.trim()) && !text.includes('.') || text.endsWith(':')) {
    return { isHeader: true, blockType: 'clause', level: 1 };
  }
  
  return { isHeader: false, blockType: 'paragraph', level: 3 };
}

async function parseDocxWithStyles(filePath: string, contractType: string): Promise<ParsedBlock[]> {
  console.log(`\n📄 Parsing ${path.basename(filePath)} as "${contractType}"...`);
  
  const buffer = fs.readFileSync(filePath);
  
  const styleMap = [
    "p[style-name='Heading 1'] => h1.heading1:fresh",
    "p[style-name='Heading 2'] => h2.heading2:fresh",
    "p[style-name='Heading 3'] => h3.heading3:fresh",
    "p[style-name='Title'] => h1.title:fresh",
    "p[style-name='Subtitle'] => h2.subtitle:fresh",
    "b => strong",
  ];
  
  const result = await mammoth.convertToHtml({ 
    buffer,
    styleMap: styleMap
  } as any);
  
  const html = result.value;
  const messages = result.messages;
  
  if (messages.length > 0) {
    console.log(`   ⚠️  ${messages.length} mammoth messages (styles/formatting)`);
  }
  
  const blocks: ParsedBlock[] = [];
  let sortOrder = 0;
  
  const segments = html.split(/(<\/h[1-6]>|<\/p>)/).filter(s => s.trim());
  
  const paragraphs: StyledParagraph[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.match(/^<\/h[1-6]>$/) || segment === '</p>') continue;
    
    let style = 'Normal';
    if (segment.includes('<h1')) {
      style = 'Heading 1';
    } else if (segment.includes('<h2')) {
      style = 'Heading 2';
    } else if (segment.includes('<h3')) {
      style = 'Heading 3';
    }
    
    const text = cleanText(segment);
    if (text && text.length >= 2) {
      paragraphs.push({ style, text, html: segment });
    }
  }
  
  console.log(`   Found ${paragraphs.length} paragraphs`);
  
  let currentSectionId: string | null = null;
  let currentClauseId: string | null = null;
  let sectionCounter = 0;
  let clauseCounter = 0;
  let contentBuffer = '';
  let pendingBlock: Partial<ParsedBlock> | null = null;
  
  function finalizePendingBlock() {
    if (pendingBlock) {
      pendingBlock.content = contentBuffer.trim() || pendingBlock.name || '';
      pendingBlock.variablesUsed = extractVariables(pendingBlock.content);
      
      if (pendingBlock.content.includes('_TABLE}}')) {
        pendingBlock.blockType = 'table';
      }
      
      blocks.push(pendingBlock as ParsedBlock);
      contentBuffer = '';
      pendingBlock = null;
    }
  }
  
  for (const para of paragraphs) {
    sortOrder += 10;
    
    let styleInfo = determineBlockTypeFromStyle(para.style, para.text);
    
    const patternInfo = detectHeaderPatterns(para.text);
    if (patternInfo.isHeader && styleInfo.blockType === 'paragraph') {
      styleInfo = { blockType: patternInfo.blockType, level: patternInfo.level };
    }
    
    const { blockType, level } = styleInfo;
    
    if (blockType === 'section') {
      finalizePendingBlock();
      sectionCounter++;
      
      let sectionCode = `S${sectionCounter}`;
      let sectionName = para.text.substring(0, 100);
      
      const sectionMatch = para.text.match(/^(?:Section|SECTION|Article|ARTICLE|Recital|RECITAL|Exhibit|EXHIBIT)\s*([A-Z0-9]+)/i);
      const romanMatch = para.text.match(/^(I{1,3}|IV|VI{0,3}|IX|X{0,3})\./i);
      const numMatch = para.text.match(/^(\d+)\.\s/);
      
      if (sectionMatch) {
        sectionCode = sectionMatch[1];
      } else if (romanMatch) {
        sectionCode = romanMatch[1];
      } else if (numMatch) {
        sectionCode = numMatch[1];
      }
      
      const colonIdx = para.text.indexOf(':');
      const periodIdx = para.text.indexOf('.', 3);
      const endIdx = Math.min(
        colonIdx > 0 ? colonIdx : 100,
        periodIdx > 3 ? periodIdx : 100,
        100
      );
      sectionName = para.text.substring(0, endIdx).replace(/^\d+\.\s*/, '').replace(/^[IVXLCDM]+\.\s*/i, '').trim();
      if (!sectionName) sectionName = para.text.substring(0, 60);
      
      const tempId = `${contractType}-SEC-${sectionCode}-${sortOrder}`;
      currentSectionId = tempId;
      currentClauseId = null;
      clauseCounter = 0;
      
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
        category: categorizeClause(sectionName, para.text),
      };
      
      contentBuffer = para.text;
      
    } else if (blockType === 'clause' || (blockType === 'paragraph' && level <= 2 && patternInfo.isHeader)) {
      finalizePendingBlock();
      clauseCounter++;
      
      let clauseNum = `${clauseCounter}`;
      const clauseMatch = para.text.match(/^(\d+\.\d+(?:\.\d+)?)/);
      if (clauseMatch) {
        clauseNum = clauseMatch[1];
      }
      
      const isSubclause = clauseNum.split('.').length > 2;
      const tempId = `${contractType}-CLS-${clauseNum}-${sortOrder}`;
      
      let clauseName = para.text.substring(0, 80);
      const colonIdx = para.text.indexOf(':');
      const periodIdx = para.text.indexOf('.', clauseMatch ? clauseMatch[0].length : 0);
      if (colonIdx > 0 && colonIdx < 80) {
        clauseName = para.text.substring(0, colonIdx);
      } else if (periodIdx > 0 && periodIdx < 80) {
        clauseName = para.text.substring(0, periodIdx);
      }
      clauseName = clauseName.replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
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
          category: categorizeClause(clauseName, para.text),
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
          category: categorizeClause(clauseName, para.text),
        };
      }
      
      contentBuffer = para.text;
      
    } else {
      if (pendingBlock) {
        contentBuffer += '\n\n' + para.text;
      } else {
        finalizePendingBlock();
        
        const tempId = `${contractType}-PARA-${sortOrder}`;
        pendingBlock = {
          tempId,
          clauseCode: `${contractType}-P-${sortOrder}`,
          name: para.text.substring(0, 60),
          content: '',
          blockType: blockType === 'table' ? 'table' : 'paragraph',
          hierarchyLevel: 3,
          sortOrder,
          parentTempId: currentClauseId || currentSectionId,
          variablesUsed: [],
          contractType,
          category: 'general',
        };
        contentBuffer = para.text;
      }
    }
  }
  
  finalizePendingBlock();
  
  console.log(`   ✓ Created ${blocks.length} blocks`);
  return blocks;
}

async function insertBlocks(blocks: ParsedBlock[]): Promise<void> {
  const tempIdToDbId = new Map<string, number>();
  
  const sortedBlocks = [...blocks].sort((a, b) => {
    if (a.hierarchyLevel !== b.hierarchyLevel) {
      return a.hierarchyLevel - b.hierarchyLevel;
    }
    return a.sortOrder - b.sortOrder;
  });
  
  for (const block of sortedBlocks) {
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

function discoverTemplates(templatesDir: string): { file: string, type: string }[] {
  const templates: { file: string, type: string }[] = [];
  
  if (!fs.existsSync(templatesDir)) {
    console.error(`Templates directory not found: ${templatesDir}`);
    return templates;
  }
  
  const files = fs.readdirSync(templatesDir);
  
  for (const file of files) {
    if (file.endsWith('.docx') && !file.startsWith('~$')) {
      const contractType = deriveContractTypeFromFilename(file);
      templates.push({ file, type: contractType });
      console.log(`   📁 Discovered: ${file} → type: "${contractType}"`);
    }
  }
  
  return templates;
}

async function main() {
  console.log('═'.repeat(60));
  console.log('   INTELLIGENT DISCOVERY-BASED CONTRACT INGESTOR');
  console.log('═'.repeat(60));
  
  const templatesDir = path.join(__dirname, '..', 'server', 'templates');
  
  console.log('\n📂 Step 1: Discovering .docx templates...');
  const templates = discoverTemplates(templatesDir);
  
  if (templates.length === 0) {
    console.error('No .docx templates found in', templatesDir);
    process.exit(1);
  }
  
  console.log(`\n   Found ${templates.length} template(s)`);
  
  console.log('\n🗑️  Step 2: Clean slate - clearing clauses table...');
  await db.delete(clauses);
  console.log('   ✓ Clauses table cleared');
  
  console.log('\n📝 Step 3: Parsing and ingesting templates...');
  
  let totalBlocks = 0;
  
  for (const template of templates) {
    const filePath = path.join(templatesDir, template.file);
    
    if (!fs.existsSync(filePath)) {
      console.error(`   ❌ Template not found: ${filePath}`);
      continue;
    }
    
    const blocks = await parseDocxWithStyles(filePath, template.type);
    
    console.log(`   Inserting ${blocks.length} blocks for ${template.type}...`);
    await insertBlocks(blocks);
    totalBlocks += blocks.length;
    
    console.log(`   ✓ ${template.type}: ${blocks.length} blocks inserted`);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log(`   ✅ COMPLETE: Ingested ${totalBlocks} total blocks`);
  console.log('═'.repeat(60));
  
  const stats = await db.execute(sql`
    SELECT 
      contract_type,
      block_type,
      COUNT(*) as count
    FROM clauses
    GROUP BY contract_type, block_type
    ORDER BY contract_type, block_type
  `);
  
  console.log('\n📊 Block Distribution:');
  console.table(stats.rows);
  
  const parentStats = await db.execute(sql`
    SELECT 
      contract_type,
      COUNT(*) FILTER (WHERE parent_clause_id IS NULL) as root_nodes,
      COUNT(*) FILTER (WHERE parent_clause_id IS NOT NULL) as child_nodes,
      COUNT(*) as total
    FROM clauses
    GROUP BY contract_type
    ORDER BY contract_type
  `);
  
  console.log('\n🌳 Tree Structure Summary:');
  console.table(parentStats.rows);
  
  for (const template of templates) {
    const treeSample = await db.execute(sql`
      SELECT 
        c.clause_code,
        LEFT(c.name, 50) as name,
        c.block_type,
        c.hierarchy_level as level,
        p.clause_code as parent_code
      FROM clauses c
      LEFT JOIN clauses p ON c.parent_clause_id = p.id
      WHERE c.contract_type = ${template.type}
      ORDER BY c.sort_order
      LIMIT 15
    `);
    
    console.log(`\n📋 Tree Structure Sample (${template.type} - first 15):`);
    console.table(treeSample.rows);
  }
  
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Ingestion failed:', err);
  process.exit(1);
});
