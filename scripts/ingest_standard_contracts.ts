// @ts-ignore - mammoth doesn't have type declarations
import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/db';
import { clauses } from '../shared/schema';
import { sql, eq } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ParsedBlock {
  tempId: string;
  clauseCode: string;
  name: string;
  content: string;
  blockType: 'section' | 'clause' | 'paragraph' | 'table' | 'list_item' | 'dynamic_disclosure' | 'conspicuous';
  hierarchyLevel: number; // 1-7: Agreement Parts, Major Sections, Clauses, Sub-headers, Body, Conspicuous, Roman Lists
  sortOrder: number;
  parentTempId: string | null;
  variablesUsed: string[];
  contractType: string;
  category: string;
  conditions: Record<string, string> | null;
  disclosureCode: string | null; // For [STATE_DISCLOSURE:XXXX] patterns
  serviceModelCondition: string | null; // 'CRC' or 'CMOS' for service model branching
}

interface StyledParagraph {
  style: string;
  text: string;
  html: string;
}

const VARIABLE_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

// Pattern for [STATE_DISCLOSURE:XXXX] smart tags
const STATE_DISCLOSURE_PATTERN = /\[STATE_DISCLOSURE:([A-Z0-9_]+)\]/g;

// Pattern for prefix stripping (removes manual numbers like "1.1.", "a.", "i.", etc.)
const PREFIX_STRIP_PATTERN = /^(\d+(\.\d+)*|[a-z]\.|[ivx]+\.)\s+/i;

// Pattern to detect notes to ignore (paragraphs starting with !!!!)
const IGNORE_NOTES_PATTERN = /^!!!!.*/;

// State abbreviation mapping for state-specific provisions
const STATE_PATTERNS: { pattern: RegExp; code: string }[] = [
  { pattern: /\bCalifornia\b/i, code: 'CA' },
  { pattern: /\bTexas\b/i, code: 'TX' },
  { pattern: /\bArizona\b/i, code: 'AZ' },
  { pattern: /\bNevada\b/i, code: 'NV' },
  { pattern: /\bOregon\b/i, code: 'OR' },
  { pattern: /\bWashington\b/i, code: 'WA' },
  { pattern: /\bColorado\b/i, code: 'CO' },
  { pattern: /\bFlorida\b/i, code: 'FL' },
  { pattern: /\bNew York\b/i, code: 'NY' },
  { pattern: /\bIdaho\b/i, code: 'ID' },
  { pattern: /\bUtah\b/i, code: 'UT' },
  { pattern: /\bMontana\b/i, code: 'MT' },
];

/**
 * Detect if text indicates a state-specific provision
 * Returns the state code if detected, null otherwise
 */
function detectStateProvision(text: string): string | null {
  // Look for patterns like "California Provisions", "Texas Specific", etc.
  const stateProvisionPatterns = [
    /(\w+)\s+Provisions?/i,
    /(\w+)\s+Specific/i,
    /(\w+)\s+State\s+Law/i,
    /State\s+of\s+(\w+)/i,
  ];
  
  for (const pattern of stateProvisionPatterns) {
    const match = text.match(pattern);
    if (match) {
      const stateName = match[1];
      for (const stateInfo of STATE_PATTERNS) {
        if (stateInfo.pattern.test(stateName)) {
          return stateInfo.code;
        }
      }
    }
  }
  
  // Also check for direct state name in short headers
  if (text.length < 60) {
    for (const stateInfo of STATE_PATTERNS) {
      if (stateInfo.pattern.test(text)) {
        return stateInfo.code;
      }
    }
  }
  
  return null;
}

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

/**
 * 8-Level Hierarchy Mapping:
 * Level 1 (Heading 1) - Agreement Parts (e.g., "II. AGREEMENT")
 * Level 2 (Heading 2) - Major Sections (e.g., "Section 1. Scope")
 * Level 3 (Heading 3) - Clauses (e.g., "2.1. Design Fee")
 * Level 4 (Heading 4) - Sub-headers/Lead-ins
 * Level 5 (Normal Text) - Body Paragraphs & simple a/b/c lists
 * Level 6 (Heading 6) - Conspicuous Bold / Legal Disclaimers
 * Level 7 (Heading 5) - Deep Sub-lists / Roman Numerals (i, ii, iii)
 */
function determineBlockTypeFromStyle(styleName: string, text: string): { blockType: 'section' | 'clause' | 'paragraph' | 'table' | 'list_item' | 'conspicuous', level: number } {
  const normalizedStyle = styleName.toLowerCase().trim();
  
  // Check for table placeholders
  if (text.includes('_TABLE}}') || text.includes('{{PRICING_BREAKDOWN_TABLE}}') || text.includes('{{PAYMENT_SCHEDULE_TABLE}}') || text.includes('{{WHAT_HAPPENS_NEXT_TABLE}}')) {
    return { blockType: 'table', level: 5 };
  }
  
  // Check for Roman numeral list items (i., ii., iii.) - Level 7
  const romanList = detectRomanListItem(text);
  if (romanList.isRomanList) {
    return { blockType: 'list_item', level: 7 };
  }
  
  // 8-Level Style Mapping (per spec)
  // Heading 1 -> Level 1 (Agreement Parts) - blockType: 'section'
  if (normalizedStyle.includes('heading 1') || normalizedStyle === 'heading1' || normalizedStyle === 'title') {
    return { blockType: 'section', level: 1 };
  }
  
  // Heading 2 -> Level 2 (Major Sections) - blockType: 'section'
  if (normalizedStyle.includes('heading 2') || normalizedStyle === 'heading2') {
    return { blockType: 'section', level: 2 };
  }
  
  // Heading 3 -> Level 3 (Clauses) - blockType: 'clause'
  if (normalizedStyle.includes('heading 3') || normalizedStyle === 'heading3') {
    return { blockType: 'clause', level: 3 };
  }
  
  // Heading 4 -> Level 4 (Sub-headers) - blockType: 'paragraph'
  if (normalizedStyle.includes('heading 4') || normalizedStyle === 'heading4') {
    return { blockType: 'paragraph', level: 4 };
  }
  
  // Heading 5 -> Level 7 (Deep Sub-lists / Roman Numerals) - blockType: 'list_item'
  if (normalizedStyle.includes('heading 5') || normalizedStyle === 'heading5') {
    return { blockType: 'list_item', level: 7 };
  }
  
  // Heading 6 -> Level 6 (Conspicuous Bold / Legal Disclaimers) - blockType: 'conspicuous'
  if (normalizedStyle.includes('heading 6') || normalizedStyle === 'heading6') {
    return { blockType: 'conspicuous', level: 6 };
  }
  
  // Generic heading detection
  if (normalizedStyle.includes('heading') || normalizedStyle.includes('title')) {
    const headingMatch = normalizedStyle.match(/heading\s*(\d+)/i);
    if (headingMatch) {
      const num = parseInt(headingMatch[1]);
      if (num === 1) return { blockType: 'section', level: 1 };
      if (num === 2) return { blockType: 'section', level: 2 };
      if (num === 3) return { blockType: 'clause', level: 3 };
      if (num === 4) return { blockType: 'paragraph', level: 4 };
      if (num === 5) return { blockType: 'list_item', level: 7 };
      if (num === 6) return { blockType: 'conspicuous', level: 6 };
      return { blockType: 'paragraph', level: Math.min(num, 5) };
    }
    return { blockType: 'section', level: 1 };
  }
  
  // Normal Text -> Level 5 (Body Paragraphs)
  return { blockType: 'paragraph', level: 5 };
}

/**
 * Detect lowercase Roman numeral list items (i., ii., iii., iv., etc.)
 * Returns the Roman numeral if detected, null otherwise
 */
function detectRomanListItem(text: string): { isRomanList: boolean, numeral: string | null } {
  // Pattern for lowercase Roman numerals at start of line: i., ii., iii., iv., v., vi., vii., viii., ix., x.
  const ROMAN_LIST_PATTERN = /^(i{1,3}|iv|vi{0,3}|ix|x{0,3})\.?\s+/i;
  const match = text.match(ROMAN_LIST_PATTERN);
  if (match) {
    return { isRomanList: true, numeral: match[1].toLowerCase() };
  }
  return { isRomanList: false, numeral: null };
}

function detectHeaderPatterns(text: string): { isHeader: boolean, blockType: 'section' | 'clause' | 'paragraph' | 'list_item', level: number } {
  // First check for Roman numeral list items (i., ii., iii.) - Level 7
  const romanList = detectRomanListItem(text);
  if (romanList.isRomanList) {
    return { isHeader: false, blockType: 'list_item', level: 7 };
  }
  
  const SECTION_PATTERN = /^(?:Section|SECTION|Article|ARTICLE|Recital|RECITAL|Exhibit|EXHIBIT)\s*([A-Z0-9]+)[\.\s:]/i;
  const ROMAN_SECTION_PATTERN = /^(I{1,3}|IV|VI{0,3}|IX|X{0,3})\.\s+[A-Z]/i;
  const NUMBERED_SECTION_PATTERN = /^(\d+)\.\s+(?![\d])([A-Z])/;
  const CLAUSE_PATTERN = /^(\d+\.\d+(?:\.\d+)?)[.\s]/;
  const UPPERCASE_HEADER = /^[A-Z][A-Z\s&\-:]{5,50}$/;
  const SHORT_TITLE = /^[A-Z][a-zA-Z\s&\-:]{3,40}:?\s*$/;
  
  // Level 1 or 2 - Agreement Parts / Major Sections
  if (SECTION_PATTERN.test(text) || ROMAN_SECTION_PATTERN.test(text)) {
    // "Section X" patterns are major sections (level 2)
    if (/^Section\s+\d+/i.test(text)) {
      return { isHeader: true, blockType: 'section', level: 2 };
    }
    // Roman numerals and other section patterns are agreement parts (level 1)
    return { isHeader: true, blockType: 'section', level: 1 };
  }
  
  if (NUMBERED_SECTION_PATTERN.test(text)) {
    return { isHeader: true, blockType: 'section', level: 2 };
  }
  
  // Level 3 - Clauses (numbered like 1.1, 2.3, etc.)
  if (CLAUSE_PATTERN.test(text)) {
    const match = text.match(CLAUSE_PATTERN);
    if (match) {
      const parts = match[1].split('.');
      if (parts.length >= 3) {
        // Sub-sub-clauses like 1.1.1 -> level 4
        return { isHeader: true, blockType: 'paragraph', level: 4 };
      }
      // Regular clauses like 1.1, 2.3 -> level 3
      return { isHeader: true, blockType: 'clause', level: 3 };
    }
  }
  
  if (text.length < 60 && UPPERCASE_HEADER.test(text.trim())) {
    return { isHeader: true, blockType: 'section', level: 1 };
  }
  
  if (text.length < 50 && SHORT_TITLE.test(text.trim()) && !text.includes('.') || text.endsWith(':')) {
    return { isHeader: true, blockType: 'clause', level: 3 };
  }
  
  // Default - Level 5 Body Paragraph
  return { isHeader: false, blockType: 'paragraph', level: 5 };
}

/**
 * Detect [STATE_DISCLOSURE:XXXX] patterns in text
 * Returns the disclosure code if found, null otherwise
 */
function detectStateDisclosure(text: string): string | null {
  const match = text.match(/\[STATE_DISCLOSURE:([A-Z0-9_]+)\]/);
  return match ? match[1] : null;
}

/**
 * Detect CRC or CMOS service model keywords in text
 * Returns 'CRC', 'CMOS', or null
 */
function detectServiceModel(text: string): 'CRC' | 'CMOS' | null {
  const upperText = text.toUpperCase();
  if (upperText.includes('CRC') && !upperText.includes('CMOS')) {
    return 'CRC';
  }
  if (upperText.includes('CMOS') && !upperText.includes('CRC')) {
    return 'CMOS';
  }
  return null;
}

/**
 * Strip manual numbering prefixes from text (e.g., "1.1.", "a.", "i.")
 * The generator will re-add these dynamically
 */
function stripPrefix(text: string): string {
  return text.replace(PREFIX_STRIP_PATTERN, '').trim();
}

/**
 * Check if a paragraph should be ignored (notes starting with !!!!)
 */
function shouldIgnoreParagraph(text: string): boolean {
  return IGNORE_NOTES_PATTERN.test(text.trim());
}

async function parseDocxWithStyles(filePath: string, contractType: string): Promise<ParsedBlock[]> {
  console.log(`\n📄 Parsing ${path.basename(filePath)} as "${contractType}"...`);
  
  const buffer = fs.readFileSync(filePath);
  
  const styleMap = [
    "p[style-name='Heading 1'] => h1.heading1:fresh",
    "p[style-name='Heading 2'] => h2.heading2:fresh",
    "p[style-name='Heading 3'] => h3.heading3:fresh",
    "p[style-name='Heading 4'] => h4.heading4:fresh",
    "p[style-name='Heading 5'] => h5.heading5:fresh",
    "p[style-name='Heading 6'] => h6.heading6:fresh",
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
    } else if (segment.includes('<h4')) {
      style = 'Heading 4';
    } else if (segment.includes('<h5')) {
      style = 'Heading 5';
    } else if (segment.includes('<h6')) {
      style = 'Heading 6';
    }
    
    const text = cleanText(segment);
    
    // Skip paragraphs starting with !!!! (notes to ignore)
    if (shouldIgnoreParagraph(text)) {
      console.log(`   🗑️  Skipping note: "${text.substring(0, 40)}..."`);
      continue;
    }
    
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
  
  // State-specific provision tracking
  let inExhibitG = false;  // Track if we're in Exhibit G (State-Specific Provisions)
  let currentStateCondition: string | null = null;  // Current state code (CA, TX, etc.)
  
  // Service model condition tracking (CRC or CMOS)
  let currentServiceModel: 'CRC' | 'CMOS' | null = null;
  
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
      
      // Strip manual numbering prefix from section name
      sectionName = stripPrefix(sectionName);
      
      // Detect Exhibit G (State-Specific Provisions)
      const isExhibitG = /Exhibit\s*G/i.test(para.text) || 
                         /State[- ]Specific\s+Provisions?/i.test(para.text);
      if (isExhibitG) {
        inExhibitG = true;
        currentStateCondition = null; // Reset state when entering Exhibit G
        console.log(`   📍 Detected Exhibit G - State-Specific Provisions section`);
      } else if (/Exhibit\s*[A-FH-Z]/i.test(para.text)) {
        // Leaving Exhibit G when we enter a different exhibit
        inExhibitG = false;
        currentStateCondition = null;
      }
      
      // Check for state-specific sub-section within Exhibit G
      const detectedState = detectStateProvision(para.text);
      if (inExhibitG && detectedState) {
        currentStateCondition = detectedState;
        console.log(`   🏛️  State-specific section detected: ${detectedState} from "${sectionName}"`);
      }
      
      // Detect CRC/CMOS service model from Heading 2/3 (sections)
      const serviceModelDetected = detectServiceModel(para.text);
      if (serviceModelDetected) {
        currentServiceModel = serviceModelDetected;
        console.log(`   ⚙️  Service model detected: ${serviceModelDetected} from "${sectionName}"`);
      } else if (level === 1) {
        // Reset service model at top-level sections
        currentServiceModel = null;
      }
      
      // Detect state disclosure pattern [STATE_DISCLOSURE:XXXX]
      const disclosureCode = detectStateDisclosure(para.text);
      if (disclosureCode) {
        console.log(`   📋 State disclosure detected: ${disclosureCode}`);
      }
      
      const tempId = `${contractType}-SEC-${sectionCode}-${sortOrder}`;
      currentSectionId = tempId;
      currentClauseId = null;
      clauseCounter = 0;
      
      // Determine conditions for this block
      let conditions: Record<string, string> | null = null;
      if (currentStateCondition) {
        conditions = { PROJECT_STATE: currentStateCondition };
      }
      
      pendingBlock = {
        tempId,
        clauseCode: `${contractType}-${sectionCode}-${sortOrder}`,
        name: sectionName,
        content: '',
        blockType: disclosureCode ? 'dynamic_disclosure' : 'section',
        hierarchyLevel: level, // Use the detected level (1 for sections)
        sortOrder,
        parentTempId: null,
        variablesUsed: [],
        contractType,
        category: categorizeClause(sectionName, para.text),
        conditions,
        disclosureCode,
        serviceModelCondition: currentServiceModel,
      };
      
      contentBuffer = para.text;
      
    } else if (blockType === 'clause' || (blockType === 'paragraph' && level <= 4 && patternInfo.isHeader)) {
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
      
      // Strip manual numbering prefix from clause name
      clauseName = stripPrefix(clauseName);
      
      // Check if this clause header introduces a new state section
      const detectedState = detectStateProvision(para.text);
      if (inExhibitG && detectedState) {
        currentStateCondition = detectedState;
        console.log(`   🏛️  State-specific clause detected: ${detectedState} from "${clauseName}"`);
      }
      
      // Detect CRC/CMOS service model from Heading 2/3 (clauses)
      const serviceModelDetected = detectServiceModel(para.text);
      if (serviceModelDetected) {
        currentServiceModel = serviceModelDetected;
        console.log(`   ⚙️  Service model detected: ${serviceModelDetected} from "${clauseName}"`);
      }
      
      // Detect state disclosure pattern [STATE_DISCLOSURE:XXXX]
      const disclosureCode = detectStateDisclosure(para.text);
      if (disclosureCode) {
        console.log(`   📋 State disclosure detected: ${disclosureCode}`);
      }
      
      // Inherit state condition from parent context
      let conditions: Record<string, string> | null = null;
      if (currentStateCondition) {
        conditions = { PROJECT_STATE: currentStateCondition };
      }
      
      if (isSubclause) {
        pendingBlock = {
          tempId,
          clauseCode: `${contractType}-${clauseNum}-${sortOrder}`,
          name: clauseName,
          content: '',
          blockType: disclosureCode ? 'dynamic_disclosure' : 'paragraph',
          hierarchyLevel: level, // Use detected level (3 for sub-clauses)
          sortOrder,
          parentTempId: currentClauseId,
          variablesUsed: [],
          contractType,
          category: categorizeClause(clauseName, para.text),
          conditions,
          disclosureCode,
          serviceModelCondition: currentServiceModel,
        };
      } else {
        currentClauseId = tempId;
        pendingBlock = {
          tempId,
          clauseCode: `${contractType}-${clauseNum}-${sortOrder}`,
          name: clauseName,
          content: '',
          blockType: disclosureCode ? 'dynamic_disclosure' : 'clause',
          hierarchyLevel: level, // Use detected level (2 for major clauses)
          sortOrder,
          parentTempId: currentSectionId,
          variablesUsed: [],
          contractType,
          category: categorizeClause(clauseName, para.text),
          conditions,
          disclosureCode,
          serviceModelCondition: currentServiceModel,
        };
      }
      
      contentBuffer = para.text;
      
    } else {
      if (pendingBlock) {
        contentBuffer += '\n\n' + para.text;
      } else {
        finalizePendingBlock();
        
        // Inherit state condition from parent context
        let conditions: Record<string, string> | null = null;
        if (currentStateCondition) {
          conditions = { PROJECT_STATE: currentStateCondition };
        }
        
        // Detect state disclosure pattern [STATE_DISCLOSURE:XXXX]
        const disclosureCode = detectStateDisclosure(para.text);
        if (disclosureCode) {
          console.log(`   📋 State disclosure detected in paragraph: ${disclosureCode}`);
        }
        
        // Strip manual numbering prefix from paragraph text for name
        const paraName = stripPrefix(para.text.substring(0, 60));
        
        // Determine block type based on detection
        let finalBlockType: ParsedBlock['blockType'] = blockType;
        if (disclosureCode) {
          finalBlockType = 'dynamic_disclosure';
        } else if (blockType === 'table') {
          finalBlockType = 'table';
        } else if (blockType === 'list_item') {
          finalBlockType = 'list_item';
        } else if (blockType === 'conspicuous') {
          finalBlockType = 'conspicuous';
        } else {
          finalBlockType = 'paragraph';
        }
        
        const tempId = `${contractType}-PARA-${sortOrder}`;
        pendingBlock = {
          tempId,
          clauseCode: `${contractType}-P-${sortOrder}`,
          name: paraName,
          content: '',
          blockType: finalBlockType,
          hierarchyLevel: level, // Use detected level (5 for body, 6 for conspicuous, 7 for lists)
          sortOrder,
          parentTempId: currentClauseId || currentSectionId,
          variablesUsed: [],
          contractType,
          category: 'general',
          conditions,
          disclosureCode,
          serviceModelCondition: currentServiceModel,
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
      conditions: block.conditions ? JSON.stringify(block.conditions) : null,
      disclosureCode: block.disclosureCode,
      serviceModelCondition: block.serviceModelCondition,
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

/**
 * Ingest a single template file (append-friendly mode).
 * Deletes only clauses for this contract_type, then inserts new ones.
 */
export async function ingestSingleTemplate(filePath: string): Promise<{ contractType: string; blocksCreated: number }> {
  const contractType = deriveContractTypeFromFilename(path.basename(filePath));
  
  console.log(`\n📄 Single-file ingestion mode: ${path.basename(filePath)} → "${contractType}"`);
  
  // Delete only clauses for this specific contract type (append-friendly)
  console.log(`🗑️  Deleting existing clauses for contract_type="${contractType}"...`);
  await db.delete(clauses).where(eq(clauses.contractType, contractType));
  console.log(`   ✓ Cleared clauses for ${contractType}`);
  
  // Parse and insert
  const blocks = await parseDocxWithStyles(filePath, contractType);
  console.log(`   Inserting ${blocks.length} blocks for ${contractType}...`);
  await insertBlocks(blocks);
  
  console.log(`   ✓ ${contractType}: ${blocks.length} blocks inserted`);
  
  return { contractType, blocksCreated: blocks.length };
}

async function main() {
  // Check for single-file mode via command line argument
  const singleFileArg = process.argv[2];
  
  if (singleFileArg) {
    // Single-file mode: ingest only the specified file
    const filePath = path.resolve(singleFileArg);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    
    console.log('═'.repeat(60));
    console.log('   CONTRACT INGESTOR - SINGLE FILE MODE');
    console.log('═'.repeat(60));
    
    const result = await ingestSingleTemplate(filePath);
    
    console.log('\n' + '═'.repeat(60));
    console.log(`   ✅ COMPLETE: Ingested ${result.blocksCreated} blocks for ${result.contractType}`);
    console.log('═'.repeat(60));
    
    process.exit(0);
  }
  
  // Full ingestion mode (original behavior)
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
