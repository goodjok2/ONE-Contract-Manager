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
  parent_clause_id?: number | null;
  block_type?: 'section' | 'clause' | 'paragraph' | 'table' | 'list_item' | 'dynamic_disclosure' | 'conspicuous';
  disclosure_code?: string;
  service_model_condition?: string;
}

// State disclosure cache for performance
let stateDisclosureCache: Map<string, string> = new Map();

// Current project state for disclosure lookups (set during generation)
let currentProjectState: string = '';

// Current service model for conditional [IF] tag processing
let currentServiceModel: string = '';

/**
 * Process [IF CMOS]/[IF CRC] conditional tags in content
 * Removes content wrapped in opposite service model tags
 * Strips the literal [IF ...] and [/IF] tags from output
 */
function processConditionalTags(content: string, serviceModel: string): string {
  if (!content) return '';
  
  let result = content;
  const model = serviceModel.toUpperCase();
  
  // If CRC project, remove all [IF CMOS]...[/IF] content
  if (model === 'CRC') {
    // Remove [IF CMOS]...[/IF] blocks (including nested content)
    result = result.replace(/\[IF\s+CMOS\][\s\S]*?\[\/IF\]/gi, '');
    // Also remove [IF COMPANY-MANAGED]...[/IF] blocks
    result = result.replace(/\[IF\s+COMPANY-MANAGED\][\s\S]*?\[\/IF\]/gi, '');
  }
  
  // If CMOS project, remove all [IF CRC]...[/IF] content
  if (model === 'CMOS') {
    // Remove [IF CRC]...[/IF] blocks (including nested content)
    result = result.replace(/\[IF\s+CRC\][\s\S]*?\[\/IF\]/gi, '');
    // Also remove [IF CLIENT-RETAINED]...[/IF] blocks
    result = result.replace(/\[IF\s+CLIENT-RETAINED\][\s\S]*?\[\/IF\]/gi, '');
  }
  
  // Keep and unwrap the matching service model content (remove tags but keep content)
  if (model === 'CRC') {
    result = result.replace(/\[IF\s+CRC\]([\s\S]*?)\[\/IF\]/gi, '$1');
    result = result.replace(/\[IF\s+CLIENT-RETAINED\]([\s\S]*?)\[\/IF\]/gi, '$1');
  }
  if (model === 'CMOS') {
    result = result.replace(/\[IF\s+CMOS\]([\s\S]*?)\[\/IF\]/gi, '$1');
    result = result.replace(/\[IF\s+COMPANY-MANAGED\]([\s\S]*?)\[\/IF\]/gi, '$1');
  }
  
  // Remove any remaining [IF ...] and [/IF] tags that might have been left over
  result = result.replace(/\[IF\s+[A-Z_-]+\]/gi, '');
  result = result.replace(/\[\/IF\]/gi, '');
  
  return result.trim();
}

/**
 * Resolve dynamic table variables from table_definitions table
 * Looks for custom table variables (e.g., WHAT_HAPPENS_NEXT_TABLE) and renders them
 */
async function resolveDynamicTableVariables(
  variableMap: Record<string, string>,
  projectId: number | null
): Promise<void> {
  try {
    const { renderDynamicTable } = await import('./tableBuilders');
    
    // List of custom table variable names to resolve from table_definitions
    const customTableVars = ['WHAT_HAPPENS_NEXT_TABLE'];
    
    for (const varName of customTableVars) {
      // Only resolve if not already set in the variable map
      if (!variableMap[varName] || variableMap[varName].includes('NOT PROVIDED') || variableMap[varName].includes('MISSING')) {
        try {
          const tableHtml = await renderDynamicTable(varName, projectId);
          // Only set if we got valid HTML (not an error message)
          if (tableHtml && !tableHtml.includes('[Table not found')) {
            variableMap[varName] = tableHtml;
            console.log(`✓ Resolved dynamic table: ${varName}`);
          }
        } catch (tableError) {
          console.log(`   ℹ️ Custom table ${varName} not defined in table_definitions (this is OK)`);
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not resolve dynamic table variables:', error);
  }
}

/**
 * Look up state disclosure from the database
 * Returns content if found, or a missing disclosure warning
 */
async function lookupStateDisclosure(disclosureCode: string, state: string): Promise<string> {
  const cacheKey = `${disclosureCode}:${state}`;
  
  // Check cache first
  if (stateDisclosureCache.has(cacheKey)) {
    return stateDisclosureCache.get(cacheKey)!;
  }
  
  try {
    const { db } = await import('../db');
    const { stateDisclosures } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const result = await db.select()
      .from(stateDisclosures)
      .where(and(
        eq(stateDisclosures.code, disclosureCode),
        eq(stateDisclosures.state, state)
      ))
      .limit(1);
    
    if (result.length > 0 && result[0].content) {
      stateDisclosureCache.set(cacheKey, result[0].content);
      return result[0].content;
    } else {
      // Return missing disclosure warning
      const missing = `<div class="missing-disclosure">[MISSING LEGAL DISCLOSURE: ${disclosureCode} for ${state}]</div>`;
      stateDisclosureCache.set(cacheKey, missing);
      return missing;
    }
  } catch (error) {
    console.error(`Error looking up state disclosure ${disclosureCode} for ${state}:`, error);
    return `<div class="missing-disclosure">[ERROR LOADING DISCLOSURE: ${disclosureCode} for ${state}]</div>`;
  }
}

/**
 * Synchronous version for use in rendering (uses pre-loaded cache)
 */
function getStateDisclosureSync(disclosureCode: string, state: string): string {
  const cacheKey = `${disclosureCode}:${state}`;
  if (stateDisclosureCache.has(cacheKey)) {
    return stateDisclosureCache.get(cacheKey)!;
  }
  return `<div class="missing-disclosure">[MISSING LEGAL DISCLOSURE: ${disclosureCode} for ${state}]</div>`;
}

/**
 * Resolve inline [STATE_DISCLOSURE:XXXX] tags in content by looking up from state_disclosures table
 * These tags are found in exhibit content and clauses
 * Returns the content with tags replaced by actual disclosure content
 */
async function resolveInlineStateDisclosureTags(content: string, projectState: string): Promise<string> {
  if (!content || !projectState) return content;
  
  // Pattern: [STATE_DISCLOSURE:XXXX] where XXXX is the disclosure code
  const tagPattern = /\[STATE_DISCLOSURE:([A-Z0-9_]+)\]/g;
  
  // Find all unique disclosure codes using exec loop (for ES5 compatibility)
  const disclosureCodes: string[] = [];
  let match;
  while ((match = tagPattern.exec(content)) !== null) {
    if (!disclosureCodes.includes(match[1])) {
      disclosureCodes.push(match[1]);
    }
  }
  
  if (disclosureCodes.length === 0) return content;
  
  // Preload all required disclosures
  console.log(`📜 Resolving ${disclosureCodes.length} inline state disclosure tags for ${projectState}...`);
  for (let i = 0; i < disclosureCodes.length; i++) {
    await lookupStateDisclosure(disclosureCodes[i], projectState);
  }
  
  // Replace all tags with actual content
  let result = content;
  for (let i = 0; i < disclosureCodes.length; i++) {
    const code = disclosureCodes[i];
    const disclosure = getStateDisclosureSync(code, projectState);
    const pattern = new RegExp(`\\[STATE_DISCLOSURE:${code}\\]`, 'g');
    result = result.replace(pattern, disclosure);
  }
  
  return result;
}

/**
 * Fetch exhibits from database for a given contract type
 * Returns array of exhibit records ordered by sortOrder and letter
 */
async function fetchExhibitsForContract(contractType: string): Promise<any[]> {
  try {
    const { db } = await import('../db');
    const { exhibits } = await import('@shared/schema');
    const { asc } = await import('drizzle-orm');
    
    const allExhibits = await db.select()
      .from(exhibits)
      .orderBy(asc(exhibits.letter)); // Primary sort by exhibit_letter (A, B, C, D, E, F, G)
    
    // Filter by contract type and active status
    const filteredExhibits = allExhibits.filter(exhibit => 
      exhibit.isActive && 
      exhibit.contractTypes?.includes(contractType.toUpperCase())
    );
    
    // Ensure exhibits are sorted by letter ascending (A-G)
    filteredExhibits.sort((a, b) => {
      const letterA = (a.letter || '').toUpperCase();
      const letterB = (b.letter || '').toUpperCase();
      return letterA.localeCompare(letterB);
    });
    
    console.log(`📎 Found ${filteredExhibits.length} exhibits for ${contractType}, sorted A-G: ${filteredExhibits.map(e => e.letter).join(', ')}`);
    return filteredExhibits;
  } catch (error) {
    console.error('Error fetching exhibits:', error);
    return [];
  }
}

/**
 * Render exhibits to HTML with page breaks and variable substitution
 * For dynamic exhibits, looks up state-specific disclosures
 */
async function renderExhibitsHTML(
  exhibits: any[], 
  variableMap: Record<string, string>,
  projectState: string
): Promise<string> {
  if (exhibits.length === 0) return '';
  
  let html = '';
  
  for (const exhibit of exhibits) {
    // Page break before each exhibit
    html += '<div style="page-break-before: always;"></div>';
    
    // Exhibit header
    html += `
      <div class="exhibit-header">
        <div class="level-1 roman-section" style="text-align: center; font-size: 14pt; font-weight: bold; color: #1a73e8;">
          EXHIBIT ${exhibit.letter}
        </div>
        <div class="exhibit-title" style="text-align: center; font-size: 12pt; font-weight: bold; margin-bottom: 20px;">
          ${exhibit.title}
        </div>
      </div>
    `;
    
    // Exhibit content
    let content = exhibit.content || '';
    
    // Resolve inline [STATE_DISCLOSURE:XXXX] tags in exhibit content
    // These are tags embedded in the content that need to be replaced with actual disclosure text
    if (projectState && content.includes('[STATE_DISCLOSURE:')) {
      content = await resolveInlineStateDisclosureTags(content, projectState);
    }
    
    // For dynamic exhibits with a disclosureCode property, also look up that content
    if (exhibit.isDynamic && exhibit.disclosureCode && projectState) {
      const disclosureContent = await lookupStateDisclosure(exhibit.disclosureCode, projectState);
      // If disclosure found, append it to content
      if (!disclosureContent.includes('MISSING LEGAL DISCLOSURE')) {
        content += disclosureContent;
      } else {
        content += disclosureContent; // Shows the warning
      }
    }
    
    // Replace variables in exhibit content
    for (const [key, value] of Object.entries(variableMap)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(pattern, String(value || ''));
    }
    
    html += `<div class="exhibit-content">${content}</div>`;
  }
  
  return html;
}

// Tree node for recursive block structure
interface BlockNode {
  clause: Clause;
  children: BlockNode[];
  isHidden?: boolean;
  dynamicNumber?: string; // Computed number (e.g., "1", "1.1", "1.1.1")
  isInsideConditional?: boolean; // Track if inside [IF] block for Level 2 rendering
}

export async function generateContract(options: ContractGenerationOptions): Promise<Buffer> {
  const { contractType, projectData, format = 'pdf' } = options;
  
  console.log(`\n=== Generating ${contractType} Contract (${format.toUpperCase()}) ===`);
  
  // Step 1: Fetch and filter clauses
  const clauses = await fetchClausesForContract(contractType, projectData);
  console.log(`✓ Fetched ${clauses.length} clauses`);
  
  // Extract project state for state-specific filtering
  const projectState = projectData.PROJECT_STATE || projectData.state || projectData.siteState || '';
  console.log(`📍 Project state for filtering: ${projectState || '(none)'}`);
  
  // Set current project state for disclosure lookups
  currentProjectState = projectState;
  
  // Set current service model for [IF] tag processing
  currentServiceModel = (projectData.serviceModel || projectData.ON_SITE_SELECTION || 'CRC').toUpperCase();
  console.log(`📍 Service model for [IF] tag processing: ${currentServiceModel}`);
  
  // Step 1.5: Preload state disclosures for dynamic_disclosure blocks AND inline tags
  const disclosureCodes = clauses
    .filter(c => c.block_type === 'dynamic_disclosure' && c.disclosure_code)
    .map(c => c.disclosure_code as string);
  
  // Also find inline [STATE_DISCLOSURE:XXXX] tags in clause content
  const inlineTagPattern = /\[STATE_DISCLOSURE:([A-Z0-9_]+)\]/g;
  for (const clause of clauses) {
    if (clause.content) {
      let match;
      while ((match = inlineTagPattern.exec(clause.content)) !== null) {
        if (!disclosureCodes.includes(match[1])) {
          disclosureCodes.push(match[1]);
        }
      }
      inlineTagPattern.lastIndex = 0; // Reset for next clause
    }
  }
  
  if (disclosureCodes.length > 0 && projectState) {
    console.log(`📋 Preloading ${disclosureCodes.length} state disclosures for ${projectState}...`);
    for (const code of disclosureCodes) {
      await lookupStateDisclosure(code, projectState);
    }
    console.log(`✓ Preloaded state disclosures`);
  }
  
  // Step 2: Build recursive block tree with state filtering
  const blockTree = buildBlockTree(clauses, projectState);
  console.log(`✓ Built block tree with ${blockTree.length} top-level nodes`);
  
  // Step 3: Apply dynamic numbering
  applyDynamicNumbering(blockTree);
  console.log(`✓ Applied dynamic numbering`);
  
  // Step 4: Build variable map and process
  const variableMap = buildVariableMap(projectData);
  console.log(`✓ Built variable map with ${Object.keys(variableMap).length} variables`);
  
  // Step 4.5: Resolve dynamic table variables (e.g., WHAT_HAPPENS_NEXT_TABLE)
  const projectId = projectData.projectId || projectData.PROJECT_ID || null;
  await resolveDynamicTableVariables(variableMap, projectId);
  
  // Step 5: Process all clauses with variable replacement (recursive)
  processBlockTreeVariables(blockTree, variableMap);
  console.log(`✓ Processed block tree with variable replacement`);
  
  // Step 5.5: Fetch and render exhibits for this contract type
  const exhibitRecords = await fetchExhibitsForContract(contractType);
  let exhibitsHtml = '';
  if (exhibitRecords.length > 0) {
    exhibitsHtml = await renderExhibitsHTML(exhibitRecords, variableMap, projectState);
    console.log(`✓ Rendered ${exhibitRecords.length} exhibits`);
  }
  
  // Step 6: Generate HTML from tree (including exhibits)
  const html = generateHTMLFromBlockTree(blockTree, contractType, projectData, exhibitsHtml);
  
  if (format === 'html') {
    return Buffer.from(html, 'utf-8');
  }
  
  const pdfBuffer = await convertHTMLToPDF(html);
  console.log(`✓ Generated PDF: ${pdfBuffer.length} bytes\n`);
  
  return pdfBuffer;
}

/**
 * Build a recursive tree structure from flat clause array
 * Organizes blocks by parent_clause_id into Parent → Children hierarchy
 * Filters out blocks based on PROJECT_STATE condition
 * De-duplicates clauses by clause_id to prevent double-rendering
 */
function buildBlockTree(clauses: Clause[], projectState?: string): BlockNode[] {
  // Create a map for quick lookup
  const clauseMap = new Map<number, BlockNode>();
  const rootNodes: BlockNode[] = [];
  
  // De-duplication: Track seen clause IDs to prevent double-rendering
  const seenClauseIds = new Set<number>();
  
  // First pass: create BlockNode for each clause, checking state conditions
  for (const clause of clauses) {
    // De-duplication check
    if (seenClauseIds.has(clause.id)) {
      console.log(`   ⚠️ SKIPPED DUPLICATE: [${clause.id}] ${clause.clause_code}`);
      continue;
    }
    seenClauseIds.add(clause.id);
    // Check PROJECT_STATE condition
    let shouldInclude = true;
    if (clause.conditions) {
      let conditions = clause.conditions;
      if (typeof conditions === 'string') {
        try {
          conditions = JSON.parse(conditions);
        } catch (e) {
          // If parsing fails, include the clause
        }
      }
      
      // Check for PROJECT_STATE condition
      const requiredState = conditions?.PROJECT_STATE;
      if (requiredState && projectState) {
        // Only include if state matches
        shouldInclude = requiredState === projectState;
        if (!shouldInclude) {
          console.log(`   ✗ FILTERED: [${clause.id}] ${clause.clause_code} - state ${requiredState} != project ${projectState}`);
        }
      } else if (requiredState && !projectState) {
        // No project state provided but clause requires one - include it
        console.log(`   ⚠️  No project state, including state-specific clause: ${clause.clause_code}`);
      }
    }
    
    if (shouldInclude) {
      clauseMap.set(clause.id, {
        clause,
        children: [],
        isHidden: false
      });
    }
  }
  
  // Second pass: build tree structure
  for (const clause of clauses) {
    const node = clauseMap.get(clause.id);
    if (!node) continue; // Skip filtered-out clauses
    
    if (clause.parent_clause_id && clauseMap.has(clause.parent_clause_id)) {
      // This clause has a parent in the tree
      const parentNode = clauseMap.get(clause.parent_clause_id)!;
      parentNode.children.push(node);
    } else {
      // This is a root-level node (no parent or parent not in filtered set)
      rootNodes.push(node);
    }
  }
  
  // Sort children by sort_order
  function sortChildren(nodes: BlockNode[]) {
    nodes.sort((a, b) => (a.clause.sort_order || 0) - (b.clause.sort_order || 0));
    for (const node of nodes) {
      sortChildren(node.children);
    }
  }
  
  sortChildren(rootNodes);
  rootNodes.sort((a, b) => (a.clause.sort_order || 0) - (b.clause.sort_order || 0));
  
  return rootNodes;
}

// Track section counter for Level 2 sections (resets when Level 1 is encountered)
let globalSectionCounter = 0;

/**
 * Apply dynamic numbering to the block tree with absolute hierarchy rules
 * Uses hierarchy_level from the clause data (not recursion depth) to determine format:
 * - hierarchy_level 1: Upper Roman (I, II, III) for Agreement Parts - RESETS ALL sub-counters
 * - hierarchy_level 2: "Section X" for Major Sections (independent counter), OR dot-notation if inside [IF] tag
 * - hierarchy_level 3: X.X (e.g., 1.1, 2.3) for Clauses - dot-notation
 * - hierarchy_level 4: X.X.X (e.g., 1.1.1) for Sub-headers - dot-notation
 * - hierarchy_level 5-6: No numbering (body text and conspicuous)
 * - hierarchy_level 7: i., ii., iii. (lowercase Roman numerals for list items)
 * Auto-renumbers when blocks are hidden
 */
function applyDynamicNumbering(
  nodes: BlockNode[], 
  parentNumber: string = '', 
  level: number = 0,
  isInsideConditional: boolean = false
): void {
  let visibleIndex = 0;
  
  // Reset global section counter at root level
  if (level === 0) {
    globalSectionCounter = 0;
  }
  
  for (const node of nodes) {
    if (node.isHidden) continue;
    
    visibleIndex++;
    
    // Use hierarchy_level from clause data if available, otherwise fall back to tree depth
    const hierarchyLevel = node.clause.hierarchy_level ?? (level + 1);
    const blockType = node.clause.block_type || 'clause';
    const clauseName = node.clause.name || '';
    
    // Check if this is a conditional [IF] block
    const isConditionalBlock = clauseName.startsWith('[IF') || clauseName.includes('[IF ');
    
    // Determine the number format based on hierarchy_level (not tree depth)
    let number: string;
    
    if (hierarchyLevel === 1) {
      // Level 1: Upper Roman for Agreement Parts (I, II, III)
      // ABSOLUTE RULE: Reset all sub-counters when Level 1 is encountered
      globalSectionCounter = 0; // Reset section counter
      
      const clauseCode = node.clause.clause_code || '';
      const isRomanSection = /^[IVX]+\.?\s/.test(clauseCode) || /^[IVX]+\.?\s/.test(clauseName);
      
      if (isRomanSection) {
        number = toRoman(visibleIndex);
      } else {
        number = String(visibleIndex);
      }
    } else if (hierarchyLevel === 2) {
      // Level 2: "Section X" for Major Sections, OR dot-notation if inside conditional [IF] tag
      // ABSOLUTE RULE: If inside an [IF] tag, render as nested dot-notation (e.g., 5.1)
      if (isInsideConditional || isConditionalBlock) {
        // Inside conditional block - use dot-notation (parent.child format)
        number = parentNumber ? `${parentNumber}.${visibleIndex}` : String(visibleIndex);
      } else {
        // Regular Level 2 outside [IF] - use independent section numbering (Section 1, 2, 3...)
        globalSectionCounter++;
        number = String(globalSectionCounter);
      }
    } else if (hierarchyLevel === 5 || hierarchyLevel === 6) {
      // Levels 5-6: No numbering (body text and conspicuous)
      number = '';
    } else if (hierarchyLevel === 7 || blockType === 'list_item') {
      // Level 7 ONLY: Lowercase Roman numerals for Roman Lists (i., ii., iii.)
      number = toLowerRoman(visibleIndex);
    } else {
      // Levels 3-4: Parent.Child format (e.g., 1.1, 1.1.1)
      number = parentNumber ? `${parentNumber}.${visibleIndex}` : String(visibleIndex);
    }
    
    node.dynamicNumber = number || undefined;
    
    // Mark if this node is inside a conditional block for rendering decisions
    node.isInsideConditional = isInsideConditional || isConditionalBlock;
    
    // Recursively number children
    // Pass down conditional context so children know they're inside an [IF] block
    if (node.children.length > 0) {
      const childConditionalContext = isInsideConditional || isConditionalBlock;
      applyDynamicNumbering(node.children, number, level + 1, childConditionalContext);
    }
  }
}

/**
 * Convert integer to uppercase Roman numeral (I, II, III, IV, V...)
 */
function toRoman(num: number): string {
  const romanNumerals: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  
  let result = '';
  for (const [value, numeral] of romanNumerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

/**
 * Convert integer to lowercase Roman numeral (i, ii, iii, iv, v...)
 * Used for Level 4 list items
 */
function toLowerRoman(num: number): string {
  return toRoman(num).toLowerCase();
}

/**
 * Process variable replacement recursively through the block tree
 */
function processBlockTreeVariables(nodes: BlockNode[], variableMap: Record<string, string>): void {
  for (const node of nodes) {
    node.clause.content = replaceVariables(node.clause.content, variableMap);
    processBlockTreeVariables(node.children, variableMap);
  }
}

async function fetchClausesForContract(
  contractType: string, 
  projectData: Record<string, any>
): Promise<Clause[]> {
  try {
    // Contract types map from user-facing/internal names to database values
    // Database stores human-readable names: 'ONE Agreement', 'Manufacturing Subcontract', 'OnSite Subcontract'
    const contractTypeMap: Record<string, string> = {
      'ONE': 'ONE Agreement',
      'ONE_AGREEMENT': 'ONE Agreement',
      'one_agreement': 'ONE Agreement',
      'MANUFACTURING': 'Manufacturing Subcontract',
      'manufacturing_sub': 'Manufacturing Subcontract',
      'ONSITE': 'OnSite Subcontract',
      'onsite_sub': 'OnSite Subcontract',
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
    
    const serviceModel = (projectData.serviceModel || 'CRC').toUpperCase();
    console.log('📝 Generating for Service Model:', serviceModel);
    
    console.log(`\n🔍 STEP 1: Condition-Based Filtering (Project Service Model: ${serviceModel}):`);
    console.log(`   Total clauses before filtering: ${allClauses.length}`);
    
    // STEP 1: Condition-based filtering using ON_SITE_SERVICES_SELECTION
    const filteredClauses = allClauses.filter(clause => {
      if (!clause.conditions) {
        // No conditions = shared clause, keep it
        return true;
      }
      
      let conditions = clause.conditions;
      if (typeof conditions === 'string') {
        try {
          conditions = JSON.parse(conditions);
        } catch (e) {
          console.warn(`   ⚠️ [${clause.id}] ${clause.clause_code}: Failed to parse conditions -> KEEP (fallback)`);
          return true;
        }
      }
      
      // Check for ON_SITE_SERVICES_SELECTION condition (the actual field in database)
      const onSiteSelection = conditions.ON_SITE_SERVICES_SELECTION;
      if (onSiteSelection) {
        // Map condition value to service model
        const isCrcCondition = onSiteSelection.includes('CLIENT-RETAINED') || onSiteSelection === 'CRC';
        const isCmosCondition = onSiteSelection.includes('COMPANY-MANAGED') || onSiteSelection === 'CMOS';
        
        // If this is a CRC project, only keep CRC clauses (drop CMOS)
        if (serviceModel === 'CRC' && isCmosCondition && !isCrcCondition) {
          console.log(`   ✗ DROPPED: [${clause.id}] ${clause.clause_code} - CMOS condition in CRC project`);
          return false;
        }
        
        // If this is a CMOS project, only keep CMOS clauses (drop CRC)
        if (serviceModel === 'CMOS' && isCrcCondition && !isCmosCondition) {
          console.log(`   ✗ DROPPED: [${clause.id}] ${clause.clause_code} - CRC condition in CMOS project`);
          return false;
        }
        
        console.log(`   ✓ KEPT: [${clause.id}] ${clause.clause_code} - condition matches project`);
      }
      
      // Also check legacy service_model/serviceModel fields
      const legacyServiceModel = conditions.service_model || conditions.serviceModel;
      if (legacyServiceModel) {
        const normalizedLegacy = legacyServiceModel.toUpperCase();
        if (normalizedLegacy !== serviceModel && normalizedLegacy !== 'BOTH') {
          console.log(`   ✗ DROPPED: [${clause.id}] ${clause.clause_code} - legacy condition=${normalizedLegacy} vs project=${serviceModel}`);
          return false;
        }
      }
      
      return true;
    });
    
    console.log(`   Clauses after condition filtering: ${filteredClauses.length} (dropped ${allClauses.length - filteredClauses.length})`);
    
    // STEP 2: Symmetric name/key-based Service Model filtering
    // This catches clauses with CRC/CMOS in their name or key even without explicit conditions
    console.log(`\n🔍 STEP 2: Name/Key-Based Filtering (Project: ${serviceModel}):`);
    
    const serviceModelFilteredClauses = filteredClauses.filter(clause => {
      const title = (clause.name || "").toUpperCase();
      const key = (clause.clause_code || "").toUpperCase();
      const combined = title + " " + key;

      // Identify what type of clause this is based on name/key
      const isCrcClause = combined.includes("CRC") || combined.includes("CLIENT-RETAINED");
      const isCmosClause = combined.includes("CMOS") || combined.includes("COMPANY-MANAGED");

      // Edge case: If clause has BOTH keywords, treat as shared/dual-option clause - KEEP
      if (isCrcClause && isCmosClause) {
        console.log(`   ✓ KEPT (SHARED): [${clause.id}] ${clause.clause_code} - contains both keywords`);
        return true;
      }

      // If this is a CRC project, HIDE CMOS-only clauses
      if (serviceModel === "CRC" && isCmosClause) {
        console.log(`   ✗ DROPPED: [${clause.id}] ${clause.clause_code} - CMOS in name/key, CRC project`);
        return false;
      }

      // If this is a CMOS project, HIDE CRC-only clauses
      if (serviceModel === "CMOS" && isCrcClause) {
        console.log(`   ✗ DROPPED: [${clause.id}] ${clause.clause_code} - CRC in name/key, CMOS project`);
        return false;
      }

      // Otherwise, keep it (shared clauses or correctly matched clauses)
      return true;
    });
    
    const removedCount = filteredClauses.length - serviceModelFilteredClauses.length;
    console.log(`   Service model filtering removed ${removedCount} clauses`);
    console.log(`   Total clauses after all filtering: ${serviceModelFilteredClauses.length}\n`);
    
    console.log(`After filtering: ${serviceModelFilteredClauses.length} clauses will be included`);
    
    return serviceModelFilteredClauses.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
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
  
  // Process [IF CMOS]/[IF CRC] conditional tags based on current service model
  if (currentServiceModel && (result.includes('[IF ') || result.includes('[IF]'))) {
    result = processConditionalTags(result, currentServiceModel);
  }
  
  // Replace [STATE_DISCLOSURE:XXXX] inline tags with cached disclosure content
  // These should have been preloaded in the generateContract function
  if (result.includes('[STATE_DISCLOSURE:') && currentProjectState) {
    // Find all unique disclosure codes first
    const codePattern = /\[STATE_DISCLOSURE:([A-Z0-9_]+)\]/g;
    const uniqueCodes: string[] = [];
    let codeMatch;
    while ((codeMatch = codePattern.exec(result)) !== null) {
      if (!uniqueCodes.includes(codeMatch[1])) {
        uniqueCodes.push(codeMatch[1]);
      }
    }
    // Then replace ALL occurrences of each code with a global replace
    for (let i = 0; i < uniqueCodes.length; i++) {
      const code = uniqueCodes[i];
      const disclosureContent = getStateDisclosureSync(code, currentProjectState);
      const replacePattern = new RegExp(`\\[STATE_DISCLOSURE:${code}\\]`, 'g');
      result = result.replace(replacePattern, disclosureContent);
    }
  }
  
  // Replace variables with their values using special markers
  // These markers will be converted to HTML spans after formatting
  // EXCEPTION: HTML content (tables, etc.) is inserted raw without markers
  Object.entries(variableMap).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    const displayValue = value || '[NOT PROVIDED]';
    
    // Check if the value is raw HTML (starts with < and contains HTML tags)
    const isRawHtml = typeof displayValue === 'string' && 
      displayValue.trim().startsWith('<') && 
      (displayValue.includes('<table') || displayValue.includes('<div') || displayValue.includes('<p>'));
    
    if (isRawHtml) {
      // Insert HTML content directly without wrapping in markers
      result = result.replace(regex, displayValue);
    } else {
      // Wrap regular values in markers for highlighting
      result = result.replace(regex, `${VAR_START}${displayValue}${VAR_END}`);
    }
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

/**
 * Generate HTML document from recursive block tree
 * Uses block_type for styling: section, clause, paragraph
 * Appends exhibits after signature blocks
 */
function generateHTMLFromBlockTree(
  blockTree: BlockNode[],
  contractType: string,
  projectData: Record<string, any>,
  exhibitsHtml?: string
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
    ${getContractStyles()}
  </style>
</head>
<body>
  <div class="contract-container">
    ${renderTitlePage(title, projectData)}
    ${renderBlockTreeHTML(blockTree, projectData, exhibitsHtml)}
  </div>
</body>
</html>
  `.trim();
  
  // Convert variable markers to styled HTML spans
  return convertVariableMarkersToHtml(rawHtml);
}

/**
 * Render block tree to HTML recursively
 * Uses block_type and dynamic numbering for consistent formatting
 */
function renderBlockTreeHTML(nodes: BlockNode[], projectData: Record<string, any>, exhibitsHtml?: string): string {
  let html = '<div class="contract-body">';
  
  for (const node of nodes) {
    if (node.isHidden) continue;
    html += renderBlockNode(node);
  }
  
  // Add signature blocks at the end
  html += renderSignatureBlocks(projectData);
  
  // Add exhibits after signature blocks
  if (exhibitsHtml) {
    html += exhibitsHtml;
  }
  
  html += '</div>';
  
  return html;
}

/**
 * Render a single block node and its children recursively
 * Uses both block_type and hierarchy_level to determine rendering format
 * Supports 8-level hierarchy: Agreement Parts, Major Sections, Clauses, Sub-headers, Body, Conspicuous, Roman Lists
 */
function renderBlockNode(node: BlockNode): string {
  const { clause, children, dynamicNumber, isInsideConditional } = node;
  const blockType = clause.block_type || 'clause';
  const hierarchyLevel = clause.hierarchy_level ?? 1;
  const rawContent = clause.content || '';
  const clauseName = clause.name || '';
  const clauseCode = clause.clause_code || '';
  const disclosureCode = clause.disclosure_code || '';
  
  // Strip duplicate headers and format content
  const strippedContent = stripDuplicateHeader(rawContent, clauseName, clauseCode);
  const content = strippedContent ? formatContent(strippedContent) : '';
  
  let html = '';
  
  // Check for Roman numeral sections
  const isRomanSection = /^[IVX]+\.?\s/.test(clauseCode) || /^[IVX]+\.?\s/.test(clauseName);
  
  // Check for Exhibit sections (add page break)
  const exhibitMatch = clauseCode.match(/EXHIBIT-([A-G])$/);
  if (exhibitMatch) {
    html += `<div style="page-break-before: always;"></div>`;
  }
  
  // Handle dynamic_disclosure blocks - look up content from state_disclosures table
  if (blockType === 'dynamic_disclosure') {
    if (disclosureCode && currentProjectState) {
      const disclosureContent = getStateDisclosureSync(disclosureCode, currentProjectState);
      html += `<div class="level-${hierarchyLevel}">${disclosureContent}</div>`;
    } else if (disclosureCode) {
      html += `<div class="missing-disclosure">[MISSING STATE: Cannot look up disclosure ${disclosureCode} without PROJECT_STATE]</div>`;
    }
    // Fall through to render children
  }
  // Handle conspicuous blocks - entirely bold legal disclaimers
  else if (blockType === 'conspicuous') {
    html += `<div class="level-6 conspicuous">${content}</div>`;
  }
  // Render based on block_type and hierarchy_level
  else if (blockType === 'section') {
    if (hierarchyLevel === 1 || isRomanSection) {
      // Level 1: Agreement Parts - Center-aligned, Upper Roman (I, II, III)
      html += `
        <div class="level-1 roman-section">
          ${dynamicNumber ? `${dynamicNumber}. ` : ''}${escapeHtml(clauseName.replace(/^[IVX]+\.?\s*/, '').toUpperCase())}
        </div>
        ${content ? `<p>${content}</p>` : ''}
      `;
    } else {
      // Level 2: Major Sections
      // ABSOLUTE RULE: If inside [IF] tag, use dot-notation (e.g., 5.1) instead of "Section X"
      const displayName = clauseName.replace(/^Section\s*\d+\.?\s*/i, '');
      const isConditionalClause = clauseName.startsWith('[IF') || clauseName.includes('[IF ');
      
      if (isInsideConditional || isConditionalClause) {
        // Inside conditional block - use dot-notation, skip "Section" prefix
        html += `
          <div class="level-2 subsection-header">
            ${dynamicNumber ? `${dynamicNumber}. ` : ''}${escapeHtml(displayName)}
          </div>
          ${content ? `<p>${content}</p>` : ''}
        `;
      } else {
        // Regular Level 2 - use "Section X" format
        html += `
          <div class="level-2 subsection-header">
            ${dynamicNumber ? `Section ${dynamicNumber}. ` : ''}${escapeHtml(displayName)}
          </div>
          ${content ? `<p>${content}</p>` : ''}
        `;
      }
    }
  } else if (blockType === 'clause') {
    // Level 3: Clauses - Black, Bold, Dot-notation (1.1, 2.3)
    const displayName = clauseName.replace(/^\d+\.\d+\.?\s*/i, '');
    html += `
      <div class="level-3 clause-header">
        ${dynamicNumber ? `${dynamicNumber}. ` : ''}${escapeHtml(displayName)}
      </div>
      ${content ? `<p>${content}</p>` : ''}
    `;
  } else if (blockType === 'paragraph') {
    // Level 4 or 5 depending on hierarchy
    if (hierarchyLevel <= 4 && dynamicNumber) {
      // Level 4: Sub-headers with dot-notation (1.1.1)
      html += `
        <div class="level-4 paragraph-numbered">
          <span class="clause-number">${dynamicNumber}.</span> ${content}
        </div>
      `;
    } else {
      // Level 5: Body text with hanging indent
      html += `<div class="level-5">${content}</div>`;
    }
  } else if (blockType === 'list_item') {
    // Level 7: Roman numeral list items - Margin-Left: 60pt
    html += `
      <div class="level-7 list-item-roman">
        <span class="list-marker">${dynamicNumber}.</span>${content}
      </div>
    `;
  } else if (blockType === 'table') {
    // Table - content should already be HTML
    html += content;
  } else {
    // Default: Use hierarchy_level as fallback for rendering decision
    if (hierarchyLevel === 1) {
      html += `<div class="level-1">${dynamicNumber ? `${dynamicNumber}. ` : ''}${escapeHtml(clauseName.toUpperCase())}</div>`;
      if (content) html += `<p>${content}</p>`;
    } else if (hierarchyLevel === 2) {
      // ABSOLUTE RULE: If inside [IF] tag, use dot-notation instead of "Section X"
      const isConditionalClause = clauseName.startsWith('[IF') || clauseName.includes('[IF ');
      if (isInsideConditional || isConditionalClause) {
        html += `<div class="level-2">${dynamicNumber ? `${dynamicNumber}. ` : ''}${escapeHtml(clauseName)}</div>`;
      } else {
        html += `<div class="level-2">${dynamicNumber ? `Section ${dynamicNumber}. ` : ''}${escapeHtml(clauseName)}</div>`;
      }
      if (content) html += `<p>${content}</p>`;
    } else if (hierarchyLevel === 3) {
      html += `<div class="level-3">${dynamicNumber ? `${dynamicNumber}. ` : ''}${escapeHtml(clauseName)}</div>`;
      if (content) html += `<p>${content}</p>`;
    } else if (hierarchyLevel === 4) {
      html += `<div class="level-4 paragraph-numbered"><span class="clause-number">${dynamicNumber}.</span> ${content}</div>`;
    } else if (hierarchyLevel === 5) {
      html += `<div class="level-5">${content}</div>`;
    } else if (hierarchyLevel === 6) {
      html += `<div class="level-6 conspicuous">${content}</div>`;
    } else if (hierarchyLevel === 7) {
      html += `<div class="level-7 list-item-roman"><span class="list-marker">${dynamicNumber}.</span>${content}</div>`;
    } else if (clauseName && clauseName.trim() && content) {
      html += `
        <div class="inline-clause">
          <span style="font-weight: bold;">${dynamicNumber ? `${dynamicNumber}. ` : ''}${escapeHtml(clauseName)}.</span>
          ${content}
        </div>
      `;
    } else if (content) {
      html += `<p class="indented">${content}</p>`;
    }
  }
  
  // Render children recursively
  for (const child of children) {
    if (!child.isHidden) {
      html += renderBlockNode(child);
    }
  }
  
  return html;
}

/**
 * Extract CSS styles for contracts (shared between old and new generators)
 */
function getContractStyles(): string {
  return `
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
    
    /* === 8-LEVEL HIERARCHICAL STYLING === */
    
    /* Level 1 (H1): Agreement Parts - Blue, Bold, Center-align, Upper Roman (I, II, III) */
    .level-1,
    .roman-section,
    .section-header {
      font-size: 14pt;
      font-weight: bold;
      color: #1a73e8;
      text-transform: uppercase;
      text-align: center;
      margin-top: 28pt;
      margin-bottom: 14pt;
      padding-bottom: 6pt;
      border-bottom: 2px solid #1a73e8;
      page-break-after: avoid;
      text-indent: 0;
      margin-left: 0;
    }
    
    /* Level 2 (H2): Major Sections - Blue, Bold, Prefix "Section X. " */
    .level-2,
    .subsection-header {
      font-size: 12pt;
      font-weight: bold;
      color: #1a73e8;
      margin-top: 20pt;
      margin-bottom: 10pt;
      page-break-after: avoid;
      text-indent: 0;
      margin-left: 0;
    }
    
    /* Level 3: Clauses - Blue, Bold, Dot-notation (1.1, 2.3) */
    .level-3,
    .clause-header {
      font-size: 11pt;
      font-weight: bold;
      color: #1a73e8;
      margin-top: 14pt;
      margin-bottom: 8pt;
      page-break-after: avoid;
      text-indent: 0;
      margin-left: 0;
    }
    
    /* Level 4: Sub-headers - Black, Bold, Dot-notation (1.1.1) */
    .level-4,
    .paragraph-numbered {
      font-size: 11pt;
      font-weight: bold;
      color: #1a73e8;
      margin-bottom: 10pt;
      line-height: 1.15;
      margin-left: 0;
      padding-left: 0.35in;
      text-indent: -0.35in;
    }
    
    .paragraph-header {
      font-size: 11pt;
      font-weight: bold;
      display: inline;
    }
    
    /* Level 5: Body Text - Left-flush, justified with proper line-height */
    .level-5 {
      font-size: 11pt;
      font-weight: normal;
      margin-bottom: 10pt;
      text-align: justify;
      line-height: 1.5;
      text-indent: 0;
      margin-left: 0;
      padding-left: 0.35in;
      word-wrap: break-word;
    }
    
    /* Regular paragraphs - Left-justified, no indent */
    p {
      margin-bottom: 10pt;
      text-align: left;
      line-height: 1.15;
      text-indent: 0;
      margin-left: 0;
    }
    
    p.indented {
      margin-left: 0.25in;
    }
    
    /* Level 6: Conspicuous/Legal Disclaimers - Left-flush, justified, ENTIRELY BOLD */
    .level-6,
    .conspicuous {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 10pt;
      text-align: justify;
      line-height: 1.5;
      text-indent: 0;
      margin-left: 0;
      padding-left: 0.35in;
      text-transform: none;
      word-wrap: break-word;
    }
    
    /* Level 7 (H5): Roman Lists - Margin-Left: 60pt, text-indent: -20pt, Lower Roman (i., ii., iii.) */
    .level-7,
    .list-item-roman {
      font-size: 11pt;
      font-weight: normal;
      margin-bottom: 8pt;
      line-height: 1.5;
      margin-left: 60pt;
      text-indent: -20pt;
      list-style-type: lower-roman;
      word-wrap: break-word;
    }
    
    .list-item-roman .list-marker {
      display: inline-block;
      width: 0.35in;
      text-align: left;
    }
    
    /* Dynamic Disclosure - Missing disclosure warning */
    .missing-disclosure {
      color: #cc0000;
      font-weight: bold;
      background-color: #fff0f0;
      padding: 8pt;
      border: 1px dashed #cc0000;
      margin: 10pt 0;
    }
    
    /* Clause numbering */
    .clause-number {
      font-weight: bold;
    }
    
    .inline-clause {
      margin-bottom: 10pt;
      line-height: 1.15;
      margin-left: 0;
      padding-left: 0.35in;
      text-indent: -0.35in;
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
  `;
}

// Keep the old function for backward compatibility
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
    
    /* === 8-LEVEL HIERARCHICAL STYLING === */
    
    /* Level 1 (H1): Agreement Parts - Blue, Bold, Center-align, Upper Roman (I, II, III) */
    .level-1,
    .roman-section,
    .section-header {
      font-size: 14pt;
      font-weight: bold;
      color: #1a73e8;
      text-transform: uppercase;
      text-align: center;
      margin-top: 28pt;
      margin-bottom: 14pt;
      padding-bottom: 6pt;
      border-bottom: 2px solid #1a73e8;
      page-break-after: avoid;
      text-indent: 0;
      margin-left: 0;
    }
    
    /* Level 2 (H2): Major Sections - Blue, Bold, Prefix "Section X. " */
    .level-2,
    .subsection-header {
      font-size: 12pt;
      font-weight: bold;
      color: #1a73e8;
      margin-top: 20pt;
      margin-bottom: 10pt;
      page-break-after: avoid;
      text-indent: 0;
      margin-left: 0;
    }
    
    /* Level 3: Clauses - Blue, Bold, Dot-notation (1.1, 2.3) */
    .level-3,
    .clause-header {
      font-size: 11pt;
      font-weight: bold;
      color: #1a73e8;
      margin-top: 14pt;
      margin-bottom: 8pt;
      page-break-after: avoid;
      text-indent: 0;
      margin-left: 0;
    }
    
    /* Level 4: Sub-headers - Black, Bold, Dot-notation (1.1.1) */
    .level-4,
    .paragraph-numbered {
      font-size: 11pt;
      font-weight: bold;
      color: #1a73e8;
      margin-bottom: 10pt;
      line-height: 1.15;
      margin-left: 0;
      padding-left: 0.35in;
      text-indent: -0.35in;
    }
    
    .paragraph-header {
      font-size: 11pt;
      font-weight: bold;
      display: inline;
    }
    
    /* Level 5: Body Text - Left-flush, justified with proper line-height */
    .level-5 {
      font-size: 11pt;
      font-weight: normal;
      margin-bottom: 10pt;
      text-align: justify;
      line-height: 1.5;
      text-indent: 0;
      margin-left: 0;
      padding-left: 0.35in;
      word-wrap: break-word;
    }
    
    /* Regular paragraphs - Left-justified, no indent */
    p {
      margin-bottom: 10pt;
      text-align: left;
      line-height: 1.15;
      text-indent: 0;
      margin-left: 0;
    }
    
    p.indented {
      margin-left: 0.25in;
    }
    
    /* Level 6: Conspicuous/Legal Disclaimers - Left-flush, justified, ENTIRELY BOLD */
    .level-6,
    .conspicuous {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 10pt;
      text-align: justify;
      line-height: 1.5;
      text-indent: 0;
      margin-left: 0;
      padding-left: 0.35in;
      text-transform: none;
      word-wrap: break-word;
    }
    
    /* Level 7 (H5): Roman Lists - Margin-Left: 60pt, text-indent: -20pt, Lower Roman (i., ii., iii.) */
    .level-7,
    .list-item-roman {
      font-size: 11pt;
      font-weight: normal;
      margin-bottom: 8pt;
      line-height: 1.5;
      margin-left: 60pt;
      text-indent: -20pt;
      list-style-type: lower-roman;
      word-wrap: break-word;
    }
    
    .list-item-roman .list-marker {
      display: inline-block;
      width: 0.35in;
      text-align: left;
    }
    
    /* Dynamic Disclosure - Missing disclosure warning */
    .missing-disclosure {
      color: #cc0000;
      font-weight: bold;
      background-color: #fff0f0;
      padding: 8pt;
      border: 1px dashed #cc0000;
      margin: 10pt 0;
    }
    
    /* Clause numbering */
    .clause-number {
      font-weight: bold;
    }
    
    .inline-clause {
      margin-bottom: 10pt;
      line-height: 1.15;
      margin-left: 0;
      padding-left: 0.35in;
      text-indent: -0.35in;
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
  
  // Check if this content IS raw HTML (starts with < and looks like HTML)
  // This handles cases where variable substitution inserted raw HTML
  const trimmedContent = content.trim();
  
  // Detect raw HTML: content starting with HTML tag (not just text that happens to contain <)
  // Matches: <table, <div, <tr, <th, <thead, <tbody, <p, <span, <br, etc.
  const startsWithHtmlTag = /^<[a-zA-Z][^>]*>/.test(trimmedContent);
  const containsHtmlStructure = /<(table|div|tr|th|thead|tbody|p|span|br|ul|ol|li)[^>]*>/i.test(trimmedContent);
  
  if (startsWithHtmlTag && containsHtmlStructure) {
    // This is raw HTML from variable substitution - return as-is
    return content;
  }
  
  // Check if content CONTAINS raw HTML blocks - we need to extract and preserve them
  // Extract table blocks (for pricing/schedule tables) - these are the primary concern
  const htmlBlocks: string[] = [];
  let contentWithPlaceholders = content;
  let blockIndex = 0;
  
  // Extract <table>...</table> blocks
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const placeholder = `__HTML_BLOCK_${blockIndex}__`;
    htmlBlocks.push(match[0]);
    contentWithPlaceholders = contentWithPlaceholders.replace(match[0], placeholder);
    blockIndex++;
  }
  
  // If we found HTML blocks, process the non-HTML parts and restore the HTML
  if (htmlBlocks.length > 0) {
    let result = formatNonTableContent(contentWithPlaceholders);
    // Restore HTML blocks
    for (let i = 0; i < htmlBlocks.length; i++) {
      result = result.replace(`__HTML_BLOCK_${i}__`, htmlBlocks[i]);
    }
    return result;
  }
  
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

/**
 * Build variable map for contract clause replacement.
 * 
 * SINGLE SOURCE OF TRUTH: All contract generation endpoints should use
 * mapProjectToVariables() from server/lib/mapper.ts BEFORE calling this function.
 * This ensures consistent variable mapping and formatting.
 * 
 * Standard flow in routes:
 * 1. getProjectWithRelations(projectId) - Fetch project data
 * 2. calculateProjectPricing(projectId) - Calculate pricing
 * 3. mapProjectToVariables(fullProject, pricingSummary) - Map to contract variables
 * 4. generateContract({ projectData, ... }) - Generate PDF with pre-mapped data
 * 
 * The legacy fallback code below is retained for backward compatibility with
 * any direct API calls that don't use the standard flow.
 */
function buildVariableMap(projectData: Record<string, any>): Record<string, string> {
  const map: Record<string, string> = {};
  
  // Check if data is already in UPPERCASE format (from mapper.ts)
  // This is the PREFERRED path - data should be pre-mapped using mapProjectToVariables
  const isAlreadyMapped = 'PROJECT_NUMBER' in projectData || 'CLIENT_LEGAL_NAME' in projectData;
  
  if (isAlreadyMapped) {
    for (const [key, value] of Object.entries(projectData)) {
      if (value !== null && value !== undefined) {
        map[key] = String(value);
      }
    }
    console.log(`✓ Using pre-mapped variables from mapper.ts: ${Object.keys(map).length} variables`);
    return map;
  }
  
  // LEGACY FALLBACK: DEPRECATED - This path should no longer be used
  // All callers should use mapProjectToVariables() from mapper.ts
  // Throwing error to enforce the unified mapping standard
  const errorMessage = 
    'LEGACY MAPPING ERROR: projectData is not pre-mapped. ' +
    'All callers must use mapProjectToVariables() from mapper.ts. ' +
    'Standard flow: getProjectWithRelations() → calculateProjectPricing() → mapProjectToVariables() → generateContract()';
  
  console.error('❌ ' + errorMessage);
  console.error('   Received keys:', Object.keys(projectData).slice(0, 10).join(', '), '...');
  
  // STRICT MODE: Throw error to enforce unified mapping
  // If backward compatibility is needed, this can be changed to a warning
  throw new Error(errorMessage);
  
  /* LEGACY CODE BELOW - Kept for reference but no longer executed
  // ============================================
  // CORE VALUES - Define once, alias automatically
  // ============================================
  
  // Project Information
  const projectName = projectData.projectName || '';
  const projectNumber = projectData.projectNumber || '';
  const totalUnits = parseInt(projectData.totalUnits) || 1;
  const serviceModel = projectData.serviceModel || 'CRC';
  
  // Site/Property Information
  const siteAddress = projectData.siteAddress || '';
  const siteCity = projectData.siteCity || '';
  const siteState = projectData.siteState || '';
  const siteZip = projectData.siteZip || '';
  const siteCounty = projectData.siteCounty || projectData.projectCounty || '';
  const fullAddress = [siteAddress, siteCity, siteState, siteZip].filter(Boolean).join(', ');
  
  // Client Information
  const clientName = projectData.clientLegalName || projectData.clientFullName || '';
  const clientState = projectData.clientState || '';
  const clientEntityType = getEntityTypeText(projectData.clientEntityType);
  const clientTitle = projectData.clientTitle || '';
  
  // Child LLC Information
  const llcName = projectData.childLlcName || '';
  const llcBaseName = llcName.replace(' LLC', '').replace(', LLC', '') || 'Dvele Partners';
  const llcState = projectData.childLlcState || 'Delaware';
  
  // Dates
  const agreementDate = formatDate(projectData.agreementDate);
  const effectiveDate = formatDate(projectData.effectiveDate);
  const estimatedCompletion = calculateEstimatedCompletion(projectData);
  
  // Pricing
  const designFee = projectData.designFee || 0;
  const offsitePrice = parseFloat(projectData.preliminaryOffsitePrice || '0');
  const totalContractPrice = parseFloat(projectData.totalPreliminaryContractPrice || '0');
  const sitePrepPrice = parseFloat(projectData.sitePrepPrice || '0');
  const utilitiesPrice = parseFloat(projectData.utilitiesPrice || '0');
  const completionPrice = parseFloat(projectData.completionPrice || '0');
  // Use pricing engine totalOnsite if available, otherwise fall back to legacy calculation
  const legacyOnsiteTotal = sitePrepPrice + utilitiesPrice + completionPrice;
  const onsiteTotal = parseFloat(projectData.preliminaryOnsitePrice || '0') || legacyOnsiteTotal;
  
  // Milestones
  const m1Pct = parseFloat(projectData.milestone1Percent || '20');
  const m2Pct = parseFloat(projectData.milestone2Percent || '20');
  const m3Pct = parseFloat(projectData.milestone3Percent || '20');
  const m4Pct = parseFloat(projectData.milestone4Percent || '20');
  const m5Pct = parseFloat(projectData.milestone5Percent || '15');
  const retainagePct = parseFloat(projectData.retainagePercent || '5');
  
  // Warranty Periods
  const warrantyFitFinish = projectData.warrantyFitFinishMonths?.toString() || '24';
  const warrantyEnvelope = projectData.warrantyBuildingEnvelopeMonths?.toString() || '60';
  const warrantyStructural = projectData.warrantyStructuralMonths?.toString() || '120';
  
  // Durations
  const designDays = parseInt(projectData.designPhaseDays || '90');
  const mfgDays = parseInt(projectData.manufacturingDurationDays || '120');
  const onsiteDays = parseInt(projectData.onsiteDurationDays || '90');
  
  // ============================================
  // MAP ALL VARIABLES WITH AUTOMATIC ALIASING
  // ============================================
  
  // --- PROJECT (with aliases) ---
  map['PROJECT_NAME'] = projectName;
  map['PROJECT_NUMBER'] = projectNumber;
  map['TOTAL_UNITS'] = totalUnits.toString();
  map['PROJECT_TYPE'] = projectData.projectType || 'Single Family Residence';
  map['SERVICE_MODEL'] = serviceModel;
  map['TOTAL_MODULES'] = (totalUnits * 3).toString();
  
  // --- SITE/ADDRESS (with aliases) ---
  map['SITE_ADDRESS'] = siteAddress;
  map['SITE_CITY'] = siteCity;
  map['SITE_STATE'] = siteState;
  map['SITE_ZIP'] = siteZip;
  map['SITE_COUNTY'] = siteCounty;
  map['PROJECT_ADDRESS'] = fullAddress;
  map['DELIVERY_ADDRESS'] = fullAddress;
  map['APN'] = projectData.siteApn || '';
  map['LOT_SIZE'] = projectData.lotSize || '';
  
  // --- LEGAL JURISDICTION (shared across all contracts) ---
  map['STATE_OF_FORMATION'] = llcState;
  map['COUNTY'] = siteCounty;
  map['PROJECT_STATE'] = siteState;
  map['PROJECT_COUNTY'] = siteCounty;
  map['PROJECT_FEDERAL_DISTRICT'] = projectData.projectFederalDistrict || '';
  map['FEDERAL_DISTRICT'] = projectData.projectFederalDistrict || '';
  map['GOVERNING_LAW_STATE'] = siteState || 'California';
  map['ARBITRATION_PROVIDER'] = projectData.arbitrationProvider || 'JAMS';
  map['ARBITRATION_LOCATION'] = [siteCity, siteState].filter(Boolean).join(', ');
  
  // --- CLIENT (with aliases) ---
  map['CLIENT_LEGAL_NAME'] = clientName;
  map['CLIENT_NAME'] = clientName;
  map['CLIENT_FULL_NAME'] = clientName;
  map['CLIENT_STATE'] = clientState;
  map['CLIENT_ENTITY_TYPE'] = clientEntityType;
  map['CLIENT_TITLE'] = clientTitle;
  map['CLIENT_EMAIL'] = projectData.clientEmail || '';
  map['CLIENT_PHONE'] = projectData.clientPhone || '';
  map['CLIENT_SIGNER_NAME'] = projectData.clientSignerName || '';
  map['ENTITY_TYPE'] = clientEntityType;
  
  // --- CHILD LLC (with aliases) ---
  map['DVELE_PARTNERS_XYZ'] = llcBaseName;
  map['DVELE_PARTNERS_XYZ_LEGAL_NAME'] = llcName;
  map['DVELE_PARTNERS_XYZ_STATE'] = llcState;
  map['DVELE_PARTNERS_XYZ_ENTITY_TYPE'] = 'limited liability company';
  map['DP_X'] = llcName;
  map['DP_X_STATE'] = llcState;
  
  // --- COMPANY/DVELE (with aliases for subcontracts) ---
  map['COMPANY_NAME'] = llcName || 'Dvele, Inc.';
  map['ENTITY_TYPE'] = 'limited liability company';
  map['COMPANY_ENTITY_TYPE'] = 'limited liability company';
  map['COMPANY_SIGNATORY_NAME'] = 'Authorized Representative';
  map['COMPANY_SIGNATORY_TITLE'] = 'VP of Operations';
  map['CLIENT_NAME'] = clientName; // Alias for CLIENT_LEGAL_NAME
  map['DVELE_LEGAL_NAME'] = 'Dvele, Inc.';
  map['DVELE_ADDRESS'] = '123 Main Street, San Diego, CA 92101';
  map['DVELE_STATE'] = 'Delaware';
  map['DVELE_ENTITY_TYPE'] = 'corporation';
  
  // --- DATES ---
  map['AGREEMENT_DATE'] = agreementDate;
  map['AGREEMENT_EXECUTION_DATE'] = agreementDate;
  map['EFFECTIVE_DATE'] = effectiveDate;
  map['MASTER_AGREEMENT_DATE'] = agreementDate;
  map['ESTIMATED_COMPLETION_DATE'] = estimatedCompletion;
  map['COMPLETION_DATE'] = estimatedCompletion || 'To Be Determined';
  map['PLAN_DATE'] = agreementDate;
  map['SURVEY_DATE'] = agreementDate;
  map['GREEN_LIGHT_DATE'] = 'To Be Determined';
  map['DELIVERY_DATE'] = 'To Be Determined';
  // Note: COO_DATE, DELIVERY_READY_DATE, PRODUCTION_START_DATE, PRODUCTION_MIDPOINT_DATE,
  // PRODUCTION_COMPLETE_DATE, ONSITE_READY_DATE, ONSITE_FOUNDATION_DATE, and ONSITE_MOBILIZATION_DATE
  // are now calculated dynamically in the Manufacturing and OnSite sections below
  
  // --- TIMELINE DURATIONS ---
  map['DESIGN_PHASE_DAYS'] = designDays.toString();
  map['MANUFACTURING_DURATION_DAYS'] = mfgDays.toString();
  map['ONSITE_DURATION_DAYS'] = onsiteDays.toString();
  map['DESIGN_DURATION'] = Math.round(designDays / 7).toString();
  map['PRODUCTION_DURATION'] = Math.round(mfgDays / 7).toString();
  map['COMPLETION_DURATION'] = Math.round(onsiteDays / 7).toString();
  map['DELIVERY_DURATION'] = '1';
  map['PERMITTING_DURATION'] = '4-8';
  
  // --- WARRANTY ---
  map['WARRANTY_FIT_FINISH_MONTHS'] = warrantyFitFinish;
  map['WARRANTY_BUILDING_ENVELOPE_MONTHS'] = warrantyEnvelope;
  map['WARRANTY_STRUCTURAL_MONTHS'] = warrantyStructural;
  map['DVELE_FIT_FINISH_WARRANTY'] = warrantyFitFinish;
  map['DVELE_ENVELOPE_WARRANTY'] = warrantyEnvelope;
  map['DVELE_STRUCTURAL_WARRANTY'] = warrantyStructural;
  
  // --- DESIGN & PRICING ---
  map['DESIGN_FEE'] = formatCurrency(designFee);
  map['DESIGN_REVISION_ROUNDS'] = projectData.designRevisionRounds?.toString() || '3';
  map['PRELIMINARY_OFFSITE_PRICE'] = formatCurrency(offsitePrice);
  map['PRELIMINARY_CONTRACT_PRICE'] = formatCurrency(totalContractPrice);
  map['TOTAL_PRELIMINARY_CONTRACT_PRICE'] = formatCurrency(totalContractPrice);
  map['FINAL_CONTRACT_PRICE'] = formatCurrency(totalContractPrice);
  map['DELIVERY_INSTALLATION_PRICE'] = formatCurrency(projectData.deliveryInstallationPrice);
  
  // --- MILESTONES (ONE Agreement) ---
  map['MILESTONE_1_PERCENT'] = m1Pct.toString();
  map['MILESTONE_2_PERCENT'] = m2Pct.toString();
  map['MILESTONE_3_PERCENT'] = m3Pct.toString();
  map['MILESTONE_4_PERCENT'] = m4Pct.toString();
  map['MILESTONE_5_PERCENT'] = m5Pct.toString();
  map['RETAINAGE_PERCENT'] = retainagePct.toString();
  map['RETAINAGE_DAYS'] = projectData.retainageDays?.toString() || '60';
  map['MILESTONE_1_AMOUNT'] = formatCurrency(totalContractPrice * (m1Pct / 100));
  map['MILESTONE_2_AMOUNT'] = formatCurrency(totalContractPrice * (m2Pct / 100));
  map['MILESTONE_3_AMOUNT'] = formatCurrency(totalContractPrice * (m3Pct / 100));
  map['MILESTONE_4_AMOUNT'] = formatCurrency(totalContractPrice * (m4Pct / 100));
  map['MILESTONE_5_AMOUNT'] = formatCurrency(totalContractPrice * (m5Pct / 100));
  map['RETAINAGE_AMOUNT'] = formatCurrency(totalContractPrice * (retainagePct / 100));
  map['MILESTONE_1_NAME'] = 'Agreement Execution';
  map['MILESTONE_2_NAME'] = 'Design Completion';
  map['MILESTONE_3_NAME'] = 'Green Light / Production Start';
  map['MILESTONE_4_NAME'] = 'Production Complete';
  map['MILESTONE_5_NAME'] = 'Delivery';
  
  // --- SERVICE MODEL SELECTION ---
  map['ON_SITE_SERVICES_SELECTION'] = serviceModel === 'CRC' 
    ? 'CLIENT-RETAINED CONTRACTOR' 
    : 'COMPANY-MANAGED ON-SITE SERVICES';
  map['PRELIMINARY_ONSITE_PRICE'] = serviceModel === 'CMOS' 
    ? formatCurrency(onsiteTotal)
    : 'Not Applicable (Client-Retained Contractor)';
  
  // --- INSURANCE (static defaults) ---
  map['GL_INSURANCE_LIMIT'] = '$2,000,000';
  map['GL_AGGREGATE_LIMIT'] = '$4,000,000';
  
  // --- FEES & THRESHOLDS ---
  map['CANCELLATION_FEE_PERCENT'] = '15';
  map['MATERIAL_INCREASE_THRESHOLD'] = '10';
  map['INFLATION_ADJUSTMENT_PERCENT'] = '5';
  map['DELAY_PENALTY'] = '$500';
  
  // --- BUILDING CODES ---
  map['ENERGY_CODE'] = projectData.energyCode || 'Title 24';
  map['LOCAL_BUILDING_CODE'] = projectData.localBuildingCode || '';
  map['STATE_BUILDING_CODE'] = projectData.stateBuildingCode || 'California Building Code';
  
  // --- UNITS ---
  for (let i = 1; i <= Math.max(totalUnits, 2); i++) {
    const model = projectData[`unit${i}Model`] || '';
    const price = projectData[`unit${i}Price`] || 0;
    const modules = projectData[`unit${i}Modules`] || '2-4';
    map[`UNIT_${i}_MODEL`] = model;
    map[`UNIT_${i}_SQFT`] = projectData[`unit${i}Sqft`] || '';
    map[`UNIT_${i}_BEDROOMS`] = projectData[`unit${i}Bedrooms`]?.toString() || '';
    map[`UNIT_${i}_BATHROOMS`] = projectData[`unit${i}Bathrooms`]?.toString() || '';
    map[`UNIT_${i}_PRICE`] = formatCurrency(price);
    map[`UNIT_${i}_DESCRIPTION`] = model || `Unit ${i}`;
    map[`UNIT_${i}_MODULES`] = modules;
  }
  map['HOME_MODEL'] = projectData.unit1Model || '';
  map['HOME_MODEL_1'] = projectData.unit1Model || '';
  
  // --- CRC-SPECIFIC (Client-Retained Contractor) ---
  if (serviceModel === 'CRC') {
    map['ONSITE_PROVIDER_NAME'] = projectData.contractorName || '';
    map['CONTRACTOR_LICENSE'] = projectData.contractorLicense || '';
    map['CONTRACTOR_NAME'] = projectData.contractorName || '';
  }
  
  // --- CMOS-SPECIFIC (Company-Managed On-Site) ---
  if (serviceModel === 'CMOS') {
    map['SITE_PREP_PRICE'] = formatCurrency(sitePrepPrice);
    map['UTILITIES_PRICE'] = formatCurrency(utilitiesPrice);
    map['COMPLETION_PRICE'] = formatCurrency(completionPrice);
  }
  
  // --- MANUFACTURING PAYMENTS ---
  map['MANUFACTURING_DESIGN_PAYMENT'] = formatCurrency(projectData.manufacturingDesignPayment);
  map['MANUFACTURING_PRODUCTION_START'] = formatCurrency(projectData.manufacturingProductionStart);
  map['MANUFACTURING_PRODUCTION_COMPLETE'] = formatCurrency(projectData.manufacturingProductionComplete);
  map['MANUFACTURING_DELIVERY_READY'] = formatCurrency(projectData.manufacturingDeliveryReady);
  
  // ============================================
  // MANUFACTURER SUBCONTRACT VARIABLES
  // ============================================
  map['MANUFACTURER_NAME'] = 'Dvele, Inc.';
  map['MANUFACTURER_STATE'] = 'Delaware';
  map['MANUFACTURER_ENTITY_TYPE'] = 'corporation';
  map['MANUFACTURER_SIGNATORY_NAME'] = 'Authorized Representative';
  map['MANUFACTURER_SIGNATORY_TITLE'] = 'CEO';
  
  map['MFG_BASE_PRICE'] = formatCurrency(offsitePrice);
  map['MFG_UPGRADES'] = formatCurrency(projectData.upgrades || 0);
  map['MFG_TOTAL_PRICE'] = formatCurrency(offsitePrice);
  map['MFG_MARKUP_PERCENT'] = '0';
  map['MFG_RETAINAGE_PERCENT'] = '5';
  
  map['MFG_DEPOSIT_PERCENT'] = '20';
  map['MFG_DEPOSIT_AMOUNT'] = formatCurrency(offsitePrice * 0.20);
  map['MFG_START_PERCENT'] = '20';
  map['MFG_START_AMOUNT'] = formatCurrency(offsitePrice * 0.20);
  map['MFG_MID_PERCENT'] = '25';
  map['MFG_MID_AMOUNT'] = formatCurrency(offsitePrice * 0.25);
  map['MFG_COMPLETE_PERCENT'] = '25';
  map['MFG_COMPLETE_AMOUNT'] = formatCurrency(offsitePrice * 0.25);
  map['MFG_DELIVERY_PERCENT'] = '10';
  map['MFG_DELIVERY_AMOUNT'] = formatCurrency(offsitePrice * 0.10);

  // Manufacturing schedule dates (calculated from project timeline)
  const startDate = new Date(projectData.effectiveDate || projectData.agreementDate || Date.now());
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
  
  map['MFG_GL_LIMIT'] = '$2,000,000';
  map['MFG_GL_AGGREGATE'] = '$4,000,000';
  map['MFG_EL_LIMIT'] = '$1,000,000';
  map['MFG_AUTO_LIMIT'] = '$1,000,000';
  map['MFG_UMBRELLA_LIMIT'] = '$5,000,000';
  map['MFG_PRODUCTS_LIMIT'] = '$2,000,000';
  
  // ============================================
  // ONSITE SUBCONTRACT VARIABLES
  // ============================================
  map['ONSITE_CONTRACTOR_NAME'] = projectData.contractorName || 'To Be Determined';
  map['ONSITE_CONTRACTOR_STATE'] = projectData.contractorState || '';
  map['ONSITE_CONTRACTOR_ENTITY_TYPE'] = projectData.contractorEntityType || '';
  map['ONSITE_CONTRACTOR_SIGNATORY_NAME'] = projectData.contractorSignatory || 'Authorized Representative';
  map['ONSITE_CONTRACTOR_SIGNATORY_TITLE'] = 'President';
  map['ONSITE_DELAY_PENALTY'] = '$500';
  
  map['ONSITE_TOTAL_PRICE'] = formatCurrency(onsiteTotal);
  map['ONSITE_MARKUP_PERCENT'] = '0';
  map['ONSITE_RETAINAGE_PERCENT'] = '5';
  map['ONSITE_RETAINAGE_AMOUNT'] = formatCurrency(onsiteTotal * 0.05);
  
  map['ONSITE_PREP_PRICE'] = formatCurrency(sitePrepPrice);
  map['ONSITE_UTILITIES_PRICE'] = formatCurrency(utilitiesPrice);
  map['ONSITE_COMPLETION_PRICE'] = formatCurrency(completionPrice);
  map['ONSITE_FOUNDATION_PRICE'] = formatCurrency(sitePrepPrice * 0.5);
  map['ONSITE_SET_PRICE'] = formatCurrency(sitePrepPrice * 0.3);
  
  map['ONSITE_MOBILIZATION_PERCENT'] = '10';
  map['ONSITE_MOBILIZATION_AMOUNT'] = formatCurrency(onsiteTotal * 0.10);
  map['ONSITE_FOUNDATION_PERCENT'] = '25';
  map['ONSITE_FOUNDATION_AMOUNT'] = formatCurrency(onsiteTotal * 0.25);
  map['ONSITE_SET_PERCENT'] = '25';
  map['ONSITE_SET_AMOUNT'] = formatCurrency(onsiteTotal * 0.25);
  map['ONSITE_UTILITIES_PERCENT'] = '20';
  map['ONSITE_UTILITIES_AMOUNT'] = formatCurrency(onsiteTotal * 0.20);
  map['ONSITE_COMPLETION_PERCENT'] = '20';
  map['ONSITE_COMPLETION_AMOUNT'] = formatCurrency(onsiteTotal * 0.20);

  // OnSite schedule dates (calculated from delivery ready date)
  const onsiteStart = new Date(deliveryReady); // Uses deliveryReady from manufacturing dates above
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
  
  map['ONSITE_GL_LIMIT'] = '$2,000,000';
  map['ONSITE_GL_AGGREGATE'] = '$4,000,000';
  map['ONSITE_EL_LIMIT'] = '$1,000,000';
  map['ONSITE_AUTO_LIMIT'] = '$1,000,000';
  map['ONSITE_UMBRELLA_LIMIT'] = '$5,000,000';
  
  // Test variable placeholder
  map['TEST_VARIABLE_ADDITION'] = '';
  
  console.log(`Built variable map with ${Object.keys(map).length} variables`);
  return map;
  // END OF LEGACY CODE */
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
  // Support both camelCase (from wizard) and UPPER_CASE (from mapper) formats
  const projectNumber = (projectData.PROJECT_NUMBER || projectData.projectNumber || 'DRAFT').toString().replace(/[^a-z0-9-]/gi, '_');
  const projectName = (projectData.PROJECT_NAME || projectData.projectName || 'Contract').toString().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, '_');
  
  const typeMap: Record<string, string> = {
    'ONE': 'ONE_Agreement',
    'MANUFACTURING': 'Manufacturing_Subcontract',
    'ONSITE': 'OnSite_Subcontract'
  };
  
  const typeName = typeMap[contractType] || contractType;
  // Format: ProjectNumber_ProjectName_ContractType.pdf
  return `${projectNumber}_${projectName}_${typeName}.${format}`;
}
