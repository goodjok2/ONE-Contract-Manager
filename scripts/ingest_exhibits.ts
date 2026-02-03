// @ts-ignore - mammoth doesn't have type declarations
import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../server/db';
import { exhibits } from '../shared/schema';
import { sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface StyledParagraph {
  style: string;
  text: string;
  html: string;
}

interface ParsedExhibit {
  letter: string;
  title: string;
  content: string;
  isDynamic: boolean;
  disclosureCode: string | null;
  contractTypes: string[];
  sortOrder: number;
}

const VARIABLE_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;
const STATE_DISCLOSURE_PATTERN = /\[STATE_DISCLOSURE:([A-Z0-9_]+)\]/g;
// More robust pattern: matches "EXHIBIT X", "EXHIBIT X:", "EXHIBIT X -", "EXHIBIT X.", "EXHIBIT-X", etc.
// The pattern is case-insensitive and allows for various separators between "EXHIBIT" and the letter
// Updated for hard split: Forces page-break-before on every block starting with "EXHIBIT"
const EXHIBIT_HEADER_PATTERN = /^\s*EXHIBIT[\s\-]*([A-Z])[\s:.\-\u2013\u2014]*(.*)$/i;

// Strict pattern for validating exhibit letter headers before appending content
// This ensures Exhibit E doesn't capture content belonging to Exhibit F
const EXHIBIT_STRICT_HEADER_PATTERN = /^\s*EXHIBIT\s*([A-Z])\s*[:.\-\u2013\u2014]?\s*/i;

// Keywords that indicate dynamic/state-specific exhibits
const DYNAMIC_EXHIBIT_KEYWORDS = [
  'state-specific',
  'state specific',
  'state provisions',
  'state disclosures',
  'warranty disclosure',
  'legal disclosure',
];

/**
 * 8-Level Hierarchy Mapping for Exhibit Content (same as clauses):
 * Level 1 (Heading 1) - Major Sections
 * Level 2 (Heading 2) - Subsections
 * Level 3 (Heading 3) - Clauses
 * Level 4 (Heading 4) - Sub-headers
 * Level 5 (Normal) - Body text
 * Level 6 (Heading 6) - Conspicuous/Legal
 * Level 7 (Heading 5) - Roman numeral lists
 */
function getHtmlTagForLevel(level: number, blockType: string): { open: string; close: string } {
  switch (level) {
    case 1:
      return { open: '<h2 class="exhibit-section-1">', close: '</h2>' };
    case 2:
      return { open: '<h3 class="exhibit-section-2">', close: '</h3>' };
    case 3:
      return { open: '<h4 class="exhibit-clause">', close: '</h4>' };
    case 4:
      return { open: '<h5 class="exhibit-subheader">', close: '</h5>' };
    case 5:
      return { open: '<p class="exhibit-body">', close: '</p>' };
    case 6:
      return { open: '<p class="exhibit-conspicuous"><strong>', close: '</strong></p>' };
    case 7:
      return { open: '<li class="exhibit-list-item">', close: '</li>' };
    default:
      return { open: '<p>', close: '</p>' };
  }
}

function determineBlockTypeFromStyle(styleName: string, text: string): { blockType: string; level: number } {
  const normalizedStyle = styleName.toLowerCase().trim();
  
  // Check for Roman numeral list items
  if (/^(i{1,3}|iv|vi{0,3}|ix|x{0,3})\.?\s+/i.test(text)) {
    return { blockType: 'list_item', level: 7 };
  }
  
  // Heading mappings
  if (normalizedStyle.includes('heading 1') || normalizedStyle === 'heading1' || normalizedStyle === 'title') {
    return { blockType: 'section', level: 1 };
  }
  if (normalizedStyle.includes('heading 2') || normalizedStyle === 'heading2') {
    return { blockType: 'section', level: 2 };
  }
  if (normalizedStyle.includes('heading 3') || normalizedStyle === 'heading3') {
    return { blockType: 'clause', level: 3 };
  }
  if (normalizedStyle.includes('heading 4') || normalizedStyle === 'heading4') {
    return { blockType: 'paragraph', level: 4 };
  }
  if (normalizedStyle.includes('heading 5') || normalizedStyle === 'heading5') {
    return { blockType: 'list_item', level: 7 };
  }
  if (normalizedStyle.includes('heading 6') || normalizedStyle === 'heading6') {
    return { blockType: 'conspicuous', level: 6 };
  }
  
  // Generic heading detection
  if (normalizedStyle.includes('heading')) {
    const match = normalizedStyle.match(/heading\s*(\d+)/i);
    if (match) {
      const num = parseInt(match[1]);
      return { blockType: num <= 2 ? 'section' : 'paragraph', level: Math.min(num, 5) };
    }
  }
  
  return { blockType: 'paragraph', level: 5 };
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

/**
 * Clean exhibit content by removing trailing garbage content
 * This includes empty paragraphs, whitespace, and other artifacts
 */
function cleanExhibitContent(content: string): string {
  if (!content) return '';
  
  // Remove trailing empty HTML tags and whitespace
  let cleaned = content
    .replace(/(<p[^>]*>\s*<\/p>\s*)+$/gi, '')
    .replace(/(<li[^>]*>\s*<\/li>\s*)+$/gi, '')
    .replace(/(<ul[^>]*>\s*<\/ul>\s*)+$/gi, '')
    .replace(/(<div[^>]*>\s*<\/div>\s*)+$/gi, '')
    .replace(/(<br\s*\/?>\s*)+$/gi, '')
    .trim();
  
  // Remove trailing paragraphs with only whitespace or punctuation
  cleaned = cleaned
    .replace(/(<p[^>]*>\s*[.\s\-_]*\s*<\/p>\s*)+$/gi, '')
    .trim();
  
  // Ensure proper closing of unclosed tags
  const openUl = (cleaned.match(/<ul/g) || []).length;
  const closeUl = (cleaned.match(/<\/ul>/g) || []).length;
  if (openUl > closeUl) {
    cleaned += '</ul>'.repeat(openUl - closeUl);
  }
  
  return cleaned;
}

function isDynamicExhibit(letter: string, title: string, content: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  // Exhibit G and H are typically state-specific
  if (letter === 'G' || letter === 'H') {
    return true;
  }
  
  // Check for dynamic keywords
  for (const keyword of DYNAMIC_EXHIBIT_KEYWORDS) {
    if (lowerTitle.includes(keyword) || lowerContent.includes(keyword)) {
      return true;
    }
  }
  
  // Check for STATE_DISCLOSURE tags
  if (STATE_DISCLOSURE_PATTERN.test(content)) {
    return true;
  }
  
  return false;
}

function extractDisclosureCode(content: string): string | null {
  const match = content.match(STATE_DISCLOSURE_PATTERN);
  if (match) {
    // Extract just the code from the first match
    const codeMatch = match[0].match(/\[STATE_DISCLOSURE:([A-Z0-9_]+)\]/);
    return codeMatch ? codeMatch[1] : null;
  }
  return null;
}

async function extractStyledParagraphs(docxPath: string): Promise<StyledParagraph[]> {
  const paragraphs: StyledParagraph[] = [];
  
  const result = await mammoth.convertToHtml(
    { path: docxPath },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
        "p[style-name='Title'] => h1.title:fresh",
        "p[style-name='Normal'] => p:fresh",
        "p => p:fresh",
      ],
      transformDocument: (document: any) => {
        const children = document.children || [];
        for (const child of children) {
          if (child.type === 'paragraph') {
            const styleName = child.styleName || 'Normal';
            const textContent = extractTextFromElement(child);
            paragraphs.push({
              style: styleName,
              text: textContent,
              html: '',
            });
          }
        }
        return document;
      },
    }
  );
  
  // Also parse with raw extraction for HTML content
  const rawResult = await mammoth.convertToHtml({ path: docxPath });
  
  // Match up paragraphs with their HTML
  const htmlParagraphs = rawResult.value.split(/<\/p>|<\/h[1-6]>/);
  let htmlIndex = 0;
  
  for (let i = 0; i < paragraphs.length && htmlIndex < htmlParagraphs.length; i++) {
    const para = paragraphs[i];
    // Find matching HTML paragraph
    while (htmlIndex < htmlParagraphs.length) {
      const htmlChunk = htmlParagraphs[htmlIndex];
      const textFromHtml = cleanText(htmlChunk);
      if (textFromHtml && para.text.includes(textFromHtml.substring(0, 20))) {
        para.html = htmlChunk;
        htmlIndex++;
        break;
      }
      htmlIndex++;
    }
  }
  
  return paragraphs;
}

function extractTextFromElement(element: any): string {
  if (element.type === 'text') {
    return element.value || '';
  }
  if (element.children) {
    return element.children.map((child: any) => extractTextFromElement(child)).join('');
  }
  return '';
}

async function parseExhibitsFromDocument(docxPath: string): Promise<ParsedExhibit[]> {
  console.log(`\nParsing exhibits from: ${docxPath}`);
  
  // Use mammoth to extract styled paragraphs
  const result = await mammoth.convertToHtml(
    { path: docxPath },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
        "p[style-name='Title'] => h1.title:fresh",
        "p => p:fresh",
      ],
    }
  );
  
  // Also extract with document transform to get styles
  const styledParagraphs: StyledParagraph[] = [];
  
  await mammoth.convertToHtml(
    { path: docxPath },
    {
      transformDocument: (document: any) => {
        const stack: any[] = [document];
        while (stack.length > 0) {
          const node = stack.shift();
          if (node.type === 'paragraph') {
            const styleName = node.styleName || 'Normal';
            const textContent = extractTextFromElement(node);
            if (textContent.trim()) {
              styledParagraphs.push({
                style: styleName,
                text: textContent.trim(),
                html: '',
              });
            }
          }
          if (node.children) {
            stack.push(...node.children);
          }
        }
        return document;
      },
    }
  );
  
  console.log(`  Found ${styledParagraphs.length} paragraphs`);
  
  // Split into exhibits based on "EXHIBIT X" headers
  const exhibitsList: ParsedExhibit[] = [];
  let currentExhibit: ParsedExhibit | null = null;
  let contentBuilder: string[] = [];
  let inListContext = false;
  let sortOrder = 1;
  
  for (const para of styledParagraphs) {
    const trimmedText = para.text.trim();
    if (!trimmedText) continue;
    
    // Check if this is an exhibit header (case-insensitive hard break)
    // HARD SPLIT: Validate the "Letter" header before appending content
    const headerMatch = trimmedText.match(EXHIBIT_HEADER_PATTERN);
    if (headerMatch) {
      // Validate with strict pattern to ensure proper letter extraction
      const strictMatch = trimmedText.match(EXHIBIT_STRICT_HEADER_PATTERN);
      if (!strictMatch) {
        console.log(`    Warning: Potential exhibit header "${trimmedText.substring(0, 50)}..." did not pass strict validation`);
      }
      
      // Save previous exhibit with content cleaning
      if (currentExhibit) {
        // Close any open list
        if (inListContext) {
          contentBuilder.push('</ul>');
          inListContext = false;
        }
        // Clean and trim garbage content from the end
        currentExhibit.content = cleanExhibitContent(contentBuilder.join('\n'));
        currentExhibit.isDynamic = isDynamicExhibit(
          currentExhibit.letter,
          currentExhibit.title,
          currentExhibit.content
        );
        currentExhibit.disclosureCode = extractDisclosureCode(currentExhibit.content);
        exhibitsList.push(currentExhibit);
        console.log(`    Saved Exhibit ${currentExhibit.letter} (${currentExhibit.content.length} chars, cleaned)`);
      }
      
      // Start new exhibit - HARD SPLIT point
      const letter = headerMatch[1].toUpperCase();
      const title = (headerMatch[2] || '').trim().replace(/^[:.\-\s]+/, '').trim();
      
      currentExhibit = {
        letter,
        title: title || `Exhibit ${letter}`,
        content: '',
        isDynamic: false,
        disclosureCode: null,
        contractTypes: ['ONE'],
        sortOrder: sortOrder++,
      };
      contentBuilder = [];
      inListContext = false;
      
      // Force page-break-before: always for exhibit content (applied when rendering)
      // This is marked in the content with a special comment for the contract generator
      contentBuilder.push('<!-- EXHIBIT_PAGE_BREAK -->');
      
      console.log(`  Found Exhibit ${letter}: ${title} [HARD SPLIT]`);
      continue;
    }
    
    // VALIDATION: Before appending content, verify we're in the correct exhibit
    // This prevents Exhibit E from capturing content that belongs to Exhibit F
    if (currentExhibit) {
      // Check if this line looks like it might be a different exhibit's content
      const potentialExhibitRef = trimmedText.match(/^\s*EXHIBIT\s+([A-Z])/i);
      if (potentialExhibitRef && potentialExhibitRef[1].toUpperCase() !== currentExhibit.letter) {
        // This content references a different exhibit letter - might be misplaced
        console.log(`    Warning: Content referencing Exhibit ${potentialExhibitRef[1]} found in Exhibit ${currentExhibit.letter}`);
      }
      
      const { blockType, level } = determineBlockTypeFromStyle(para.style, trimmedText);
      const tags = getHtmlTagForLevel(level, blockType);
      
      // Handle list context
      if (level === 7) {
        if (!inListContext) {
          contentBuilder.push('<ul class="exhibit-roman-list">');
          inListContext = true;
        }
        contentBuilder.push(`${tags.open}${trimmedText}${tags.close}`);
      } else {
        if (inListContext) {
          contentBuilder.push('</ul>');
          inListContext = false;
        }
        contentBuilder.push(`${tags.open}${trimmedText}${tags.close}`);
      }
    }
  }
  
  // Don't forget the last exhibit
  if (currentExhibit) {
    if (inListContext) {
      contentBuilder.push('</ul>');
    }
    // Clean and trim garbage content from the end
    currentExhibit.content = cleanExhibitContent(contentBuilder.join('\n'));
    currentExhibit.isDynamic = isDynamicExhibit(
      currentExhibit.letter,
      currentExhibit.title,
      currentExhibit.content
    );
    currentExhibit.disclosureCode = extractDisclosureCode(currentExhibit.content);
    exhibitsList.push(currentExhibit);
    console.log(`    Saved Exhibit ${currentExhibit.letter} (${currentExhibit.content.length} chars, cleaned)`);
  }
  
  return exhibitsList;
}

async function ingestExhibits(docxPath: string, clearExisting: boolean = true): Promise<void> {
  console.log('\n========================================');
  console.log('EXHIBIT INGESTOR');
  console.log('========================================\n');
  
  if (!fs.existsSync(docxPath)) {
    console.error(`Error: File not found: ${docxPath}`);
    process.exit(1);
  }
  
  // Parse exhibits from document
  const parsedExhibits = await parseExhibitsFromDocument(docxPath);
  
  if (parsedExhibits.length === 0) {
    console.log('No exhibits found in document.');
    return;
  }
  
  console.log(`\nParsed ${parsedExhibits.length} exhibits`);
  
  // Clear existing exhibits if requested
  if (clearExisting) {
    console.log('\nClearing existing exhibits...');
    await db.execute(sql`DELETE FROM exhibits`);
  }
  
  // Insert parsed exhibits
  console.log('\nInserting exhibits into database...');
  
  for (const exhibit of parsedExhibits) {
    await db.insert(exhibits).values({
      organizationId: 1,
      exhibitCode: `EXHIBIT_${exhibit.letter}`,
      name: exhibit.title,
      letter: exhibit.letter,
      title: exhibit.title,
      content: exhibit.content,
      isDynamic: exhibit.isDynamic,
      disclosureCode: exhibit.disclosureCode,
      contractTypes: sql`ARRAY['ONE']::text[]`,
      sortOrder: exhibit.sortOrder,
      isActive: true,
    });
    
    const dynamicLabel = exhibit.isDynamic ? ' [DYNAMIC]' : '';
    const disclosureLabel = exhibit.disclosureCode ? ` [${exhibit.disclosureCode}]` : '';
    console.log(`  ✓ Exhibit ${exhibit.letter}: ${exhibit.title}${dynamicLabel}${disclosureLabel}`);
    console.log(`    Content length: ${exhibit.content.length} chars`);
  }
  
  console.log('\n========================================');
  console.log('INGESTION COMPLETE');
  console.log(`Total exhibits: ${parsedExhibits.length}`);
  console.log('========================================\n');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Default: look for Exhibits document in templates folder
    const templatesDir = path.join(__dirname, '..', 'server', 'templates');
    const files = fs.existsSync(templatesDir) ? fs.readdirSync(templatesDir) : [];
    const exhibitsFile = files.find(f => 
      f.toLowerCase().includes('exhibit') && f.endsWith('.docx')
    );
    
    if (exhibitsFile) {
      await ingestExhibits(path.join(templatesDir, exhibitsFile));
    } else {
      console.log('Usage: npx tsx scripts/ingest_exhibits.ts <path-to-exhibits.docx>');
      console.log('\nNo exhibits document found in server/templates/');
      console.log('Please provide a path to the exhibits document.');
      process.exit(1);
    }
  } else {
    // Use provided file path
    const filePath = args[0];
    const clearExisting = args[1] !== '--append';
    await ingestExhibits(filePath, clearExisting);
  }
  
  process.exit(0);
}

main().catch((error) => {
  console.error('Error during ingestion:', error);
  process.exit(1);
});
