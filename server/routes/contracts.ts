import { Router } from "express";
import { db } from "../db/index";
import { pool } from "../db";
import { contracts, projects, clauses, projectUnits, homeModels, financials, exhibits, stateDisclosures } from "../../shared/schema";
import { eq, count, desc, and, sql } from "drizzle-orm";
import { getProjectWithRelations } from "./helpers";
import { mapProjectToVariables } from "../lib/mapper";
import { calculateProjectPricing } from "../services/pricingEngine";
import path from "path";
import fs from "fs";
import multer from "multer";
import { exec } from "child_process";
import { promisify } from "util";
// @ts-ignore - mammoth doesn't have type declarations
import mammoth from "mammoth";

const execAsync = promisify(exec);

const router = Router();

// Configure multer for template uploads
const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const templatesDir = path.join(process.cwd(), "server", "templates");
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }
    cb(null, templatesDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename: remove special chars, keep only alphanumeric, underscores, hyphens
    const safeName = file.originalname
      .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
      .replace(/_+/g, "_");
    cb(null, safeName);
  },
});

const templateUpload = multer({
  storage: templateStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.originalname.endsWith(".docx")) {
      cb(null, true);
    } else {
      cb(new Error("Only .docx files are allowed"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// ---------------------------------------------------------------------------
// TEMPLATE UPLOAD & INGESTION
// ---------------------------------------------------------------------------

router.post("/contracts/upload-template", templateUpload.single("template"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const objectType = req.body.objectType || "contract";
    
    console.log(`\n📤 Template uploaded: ${fileName}`);
    console.log(`   Path: ${filePath}`);
    console.log(`   Object type: ${objectType}`);
    
    try {
      let itemsCreated = 0;
      
      if (objectType === "exhibit") {
        // Process as Exhibit Library
        itemsCreated = await ingestExhibitsFromDocument(filePath);
        
        res.json({
          success: true,
          message: `Successfully ingested ${itemsCreated} exhibits`,
          objectType: "exhibit",
          itemsCreated,
          fileName,
        });
        
      } else if (objectType === "state_disclosure") {
        // Process as State Disclosure Library
        itemsCreated = await ingestStateDisclosuresFromDocument(filePath);
        
        res.json({
          success: true,
          message: `Successfully ingested ${itemsCreated} state disclosures`,
          objectType: "state_disclosure",
          itemsCreated,
          fileName,
        });
        
      } else {
        // Default: Process as Contract Agreement (clauses)
        const contractType = fileName
          .replace(/\.docx$/i, "")
          .replace(/^Template[_-]?/i, "")
          .replace(/[_-]/g, "_")
          .toUpperCase()
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
        
        console.log(`   Contract type: ${contractType}`);
        console.log(`\n🔄 Running ingestion script for: ${filePath}`);
        
        const { stdout, stderr } = await execAsync(
          `npx tsx scripts/ingest_standard_contracts.ts "${filePath}"`,
          { cwd: process.cwd(), timeout: 120000 }
        );
        
        console.log("Ingestion output:", stdout);
        if (stderr) console.error("Ingestion stderr:", stderr);
        
        // Count the blocks created for this contract type
        const countResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(clauses)
          .where(eq(clauses.contractType, contractType));
        
        itemsCreated = countResult[0]?.count || 0;
        
        res.json({
          success: true,
          message: `Successfully ingested ${itemsCreated} clauses`,
          objectType: "contract",
          contractType,
          itemsCreated,
          blocksCreated: itemsCreated, // Backwards compatibility
          fileName,
        });
      }
      
    } catch (execError: any) {
      console.error("Ingestion failed:", execError);
      
      // Clean up the uploaded file on failure
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return res.status(500).json({
        error: "Ingestion failed",
        message: execError.message || "Failed to process template",
        stdout: execError.stdout,
        stderr: execError.stderr,
      });
    }
    
  } catch (error: any) {
    console.error("Template upload failed:", error);
    res.status(500).json({ 
      error: "Upload failed", 
      message: error.message || "Failed to upload template" 
    });
  }
});

// ---------------------------------------------------------------------------
// INLINE INGESTION FUNCTIONS
// ---------------------------------------------------------------------------

// Pattern for prefix stripping (removes manual numbers like "1.1.", "a.", "i.", etc.)
const PREFIX_STRIP_PATTERN = /^(\d+(\.\d+)*|[a-z]\.|[ivx]+\.)\s+/i;
// Pattern to detect notes to ignore (paragraphs starting with !!!!)
const IGNORE_NOTES_PATTERN = /^!!!!.*/;
// Pattern for exhibit headers
const EXHIBIT_HEADER_PATTERN = /^EXHIBIT\s+([A-Z])[\s:.\-]+(.+)?$/i;
// State patterns for disclosure parsing
const STATE_HEADER_PATTERNS = [
  { pattern: /^CALIFORNIA\b/i, code: "CA" },
  { pattern: /^TEXAS\b/i, code: "TX" },
  { pattern: /^ARIZONA\b/i, code: "AZ" },
  { pattern: /^NEVADA\b/i, code: "NV" },
  { pattern: /^OREGON\b/i, code: "OR" },
  { pattern: /^WASHINGTON\b/i, code: "WA" },
  { pattern: /^COLORADO\b/i, code: "CO" },
  { pattern: /^FLORIDA\b/i, code: "FL" },
  { pattern: /^NEW\s+YORK\b/i, code: "NY" },
  { pattern: /^IDAHO\b/i, code: "ID" },
  { pattern: /^UTAH\b/i, code: "UT" },
  { pattern: /^MONTANA\b/i, code: "MT" },
  { pattern: /^NORTH\s+CAROLINA\b/i, code: "NC" },
  { pattern: /^SOUTH\s+CAROLINA\b/i, code: "SC" },
  { pattern: /^GEORGIA\b/i, code: "GA" },
  { pattern: /^TENNESSEE\b/i, code: "TN" },
];

function stripPrefix(text: string): string {
  return text.replace(PREFIX_STRIP_PATTERN, "").trim();
}

function shouldIgnoreParagraph(text: string): boolean {
  return IGNORE_NOTES_PATTERN.test(text.trim());
}

function extractTextFromElement(element: any): string {
  if (element.type === "text") {
    return element.value || "";
  }
  if (element.children) {
    return element.children.map((child: any) => extractTextFromElement(child)).join("");
  }
  return "";
}

function getHtmlTagForLevel(level: number): { open: string; close: string } {
  switch (level) {
    case 1: return { open: '<h2 class="exhibit-section-1">', close: "</h2>" };
    case 2: return { open: '<h3 class="exhibit-section-2">', close: "</h3>" };
    case 3: return { open: '<h4 class="exhibit-clause">', close: "</h4>" };
    case 4: return { open: '<h5 class="exhibit-subheader">', close: "</h5>" };
    case 5: return { open: '<p class="exhibit-body">', close: "</p>" };
    case 6: return { open: '<p class="exhibit-conspicuous"><strong>', close: "</strong></p>" };
    case 7: return { open: '<li class="exhibit-list-item">', close: "</li>" };
    default: return { open: "<p>", close: "</p>" };
  }
}

function determineLevel(styleName: string, text: string): number {
  const normalized = styleName.toLowerCase().trim();
  
  // Roman numeral list items
  if (/^(i{1,3}|iv|vi{0,3}|ix|x{0,3})\.?\s+/i.test(text)) {
    return 7;
  }
  
  if (normalized.includes("heading 1") || normalized === "heading1" || normalized === "title") return 1;
  if (normalized.includes("heading 2") || normalized === "heading2") return 2;
  if (normalized.includes("heading 3") || normalized === "heading3") return 3;
  if (normalized.includes("heading 4") || normalized === "heading4") return 4;
  if (normalized.includes("heading 5") || normalized === "heading5") return 7;
  if (normalized.includes("heading 6") || normalized === "heading6") return 6;
  
  return 5;
}

async function ingestExhibitsFromDocument(filePath: string): Promise<number> {
  console.log(`\n📑 Ingesting Exhibits from: ${filePath}`);
  
  interface StyledParagraph {
    style: string;
    text: string;
  }
  
  const styledParagraphs: StyledParagraph[] = [];
  
  await mammoth.convertToHtml(
    { path: filePath },
    {
      transformDocument: (document: any) => {
        const stack: any[] = [document];
        while (stack.length > 0) {
          const node = stack.pop();
          if (node.type === "paragraph") {
            const styleName = node.styleName || "Normal";
            const textContent = extractTextFromElement(node);
            if (textContent.trim() && !shouldIgnoreParagraph(textContent)) {
              styledParagraphs.push({
                style: styleName,
                text: stripPrefix(textContent.trim()),
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
  
  console.log(`   Found ${styledParagraphs.length} paragraphs`);
  
  // Parse exhibits
  interface ParsedExhibit {
    letter: string;
    title: string;
    content: string;
    isDynamic: boolean;
    disclosureCode: string | null;
    contractTypes: string[];
    sortOrder: number;
  }
  
  const exhibitsList: ParsedExhibit[] = [];
  let currentExhibit: ParsedExhibit | null = null;
  let contentBuilder: string[] = [];
  let inListContext = false;
  let sortOrder = 1;
  
  for (const para of styledParagraphs) {
    const headerMatch = para.text.match(EXHIBIT_HEADER_PATTERN);
    
    if (headerMatch) {
      // Save previous exhibit
      if (currentExhibit) {
        if (inListContext) {
          contentBuilder.push("</ul>");
          inListContext = false;
        }
        currentExhibit.content = contentBuilder.join("\n");
        currentExhibit.isDynamic = currentExhibit.letter === "G" || currentExhibit.letter === "H" ||
          currentExhibit.title.toLowerCase().includes("state") ||
          currentExhibit.content.includes("[STATE_DISCLOSURE:");
        if (currentExhibit.content.includes("[STATE_DISCLOSURE:")) {
          const codeMatch = currentExhibit.content.match(/\[STATE_DISCLOSURE:([A-Z0-9_]+)\]/);
          currentExhibit.disclosureCode = codeMatch ? codeMatch[1] : null;
        }
        exhibitsList.push(currentExhibit);
      }
      
      const letter = headerMatch[1].toUpperCase();
      const title = (headerMatch[2] || "").trim().replace(/^[:.\-\s]+/, "").trim();
      
      currentExhibit = {
        letter,
        title: title || `Exhibit ${letter}`,
        content: "",
        isDynamic: false,
        disclosureCode: null,
        contractTypes: ["ONE", "MANUFACTURING", "ONSITE"],
        sortOrder: sortOrder++,
      };
      contentBuilder = [];
      inListContext = false;
      
      console.log(`   Found Exhibit ${letter}: ${title}`);
      continue;
    }
    
    if (currentExhibit) {
      const level = determineLevel(para.style, para.text);
      const tags = getHtmlTagForLevel(level);
      
      if (level === 7) {
        if (!inListContext) {
          contentBuilder.push('<ul class="exhibit-roman-list">');
          inListContext = true;
        }
        contentBuilder.push(`${tags.open}${para.text}${tags.close}`);
      } else {
        if (inListContext) {
          contentBuilder.push("</ul>");
          inListContext = false;
        }
        contentBuilder.push(`${tags.open}${para.text}${tags.close}`);
      }
    }
  }
  
  // Don't forget the last exhibit
  if (currentExhibit) {
    if (inListContext) {
      contentBuilder.push("</ul>");
    }
    currentExhibit.content = contentBuilder.join("\n");
    currentExhibit.isDynamic = currentExhibit.letter === "G" || currentExhibit.letter === "H" ||
      currentExhibit.title.toLowerCase().includes("state") ||
      currentExhibit.content.includes("[STATE_DISCLOSURE:");
    exhibitsList.push(currentExhibit);
  }
  
  if (exhibitsList.length === 0) {
    console.log("   No exhibits found in document");
    return 0;
  }
  
  // Clear existing exhibits and insert new ones
  console.log(`\n   Clearing existing exhibits...`);
  await db.execute(sql`DELETE FROM exhibits`);
  
  console.log(`   Inserting ${exhibitsList.length} exhibits...`);
  for (const exhibit of exhibitsList) {
    await db.insert(exhibits).values({
      letter: exhibit.letter,
      title: exhibit.title,
      content: exhibit.content,
      isDynamic: exhibit.isDynamic,
      disclosureCode: exhibit.disclosureCode,
      contractTypes: exhibit.contractTypes,
      sortOrder: exhibit.sortOrder,
      isActive: true,
    });
  }
  
  console.log(`   ✓ Successfully ingested ${exhibitsList.length} exhibits`);
  return exhibitsList.length;
}

async function ingestStateDisclosuresFromDocument(filePath: string): Promise<number> {
  console.log(`\n📑 Ingesting State Disclosures from: ${filePath}`);
  
  interface StyledParagraph {
    style: string;
    text: string;
  }
  
  const styledParagraphs: StyledParagraph[] = [];
  
  await mammoth.convertToHtml(
    { path: filePath },
    {
      transformDocument: (document: any) => {
        const stack: any[] = [document];
        while (stack.length > 0) {
          const node = stack.pop();
          if (node.type === "paragraph") {
            const styleName = node.styleName || "Normal";
            const textContent = extractTextFromElement(node);
            if (textContent.trim() && !shouldIgnoreParagraph(textContent)) {
              styledParagraphs.push({
                style: styleName,
                text: stripPrefix(textContent.trim()),
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
  
  console.log(`   Found ${styledParagraphs.length} paragraphs`);
  
  // Parse state disclosures - split on state headers
  interface ParsedDisclosure {
    code: string;
    state: string;
    content: string;
  }
  
  const disclosuresList: ParsedDisclosure[] = [];
  let currentState: string | null = null;
  let contentBuilder: string[] = [];
  const defaultCode = "EXHIBIT_G_CONTENT";
  
  function detectStateFromText(text: string): string | null {
    for (const { pattern, code } of STATE_HEADER_PATTERNS) {
      if (pattern.test(text)) {
        return code;
      }
    }
    return null;
  }
  
  for (const para of styledParagraphs) {
    const detectedState = detectStateFromText(para.text);
    
    if (detectedState) {
      // Save previous state disclosure
      if (currentState && contentBuilder.length > 0) {
        disclosuresList.push({
          code: defaultCode,
          state: currentState,
          content: contentBuilder.join("\n"),
        });
      }
      
      currentState = detectedState;
      contentBuilder = [];
      console.log(`   Found state section: ${detectedState}`);
      continue;
    }
    
    if (currentState) {
      const level = determineLevel(para.style, para.text);
      const tags = getHtmlTagForLevel(level);
      contentBuilder.push(`${tags.open}${para.text}${tags.close}`);
    }
  }
  
  // Don't forget the last state
  if (currentState && contentBuilder.length > 0) {
    disclosuresList.push({
      code: defaultCode,
      state: currentState,
      content: contentBuilder.join("\n"),
    });
  }
  
  if (disclosuresList.length === 0) {
    console.log("   No state disclosures found in document");
    return 0;
  }
  
  // Clear existing disclosures with this code and insert new ones
  console.log(`\n   Clearing existing disclosures with code '${defaultCode}'...`);
  await db.execute(sql`DELETE FROM state_disclosures WHERE code = ${defaultCode}`);
  
  console.log(`   Inserting ${disclosuresList.length} state disclosures...`);
  for (const disclosure of disclosuresList) {
    await db.insert(stateDisclosures).values({
      code: disclosure.code,
      state: disclosure.state,
      content: disclosure.content,
    });
  }
  
  console.log(`   ✓ Successfully ingested ${disclosuresList.length} state disclosures`);
  return disclosuresList.length;
}

// Get list of existing templates
router.get("/contracts/templates", async (req, res) => {
  try {
    const templatesDir = path.join(process.cwd(), "server", "templates");
    
    if (!fs.existsSync(templatesDir)) {
      return res.json({ templates: [] });
    }
    
    const files = fs.readdirSync(templatesDir)
      .filter(f => f.endsWith(".docx") && !f.startsWith("~$"))
      .map(f => {
        const filePath = path.join(templatesDir, f);
        const stats = fs.statSync(filePath);
        const contractType = f
          .replace(/\.docx$/i, "")
          .replace(/^Template[_-]?/i, "")
          .replace(/[_-]/g, "_")
          .toUpperCase()
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
        
        return {
          fileName: f,
          contractType,
          uploadedAt: stats.mtime.toISOString(),
          size: stats.size,
        };
      });
    
    // Get clause counts for each contract type
    const clauseCounts = await db
      .select({ 
        contractType: clauses.contractType, 
        count: sql<number>`count(*)::int` 
      })
      .from(clauses)
      .groupBy(clauses.contractType);
    
    const countMap = new Map(clauseCounts.map(c => [c.contractType, c.count]));
    
    const templates = files.map(f => ({
      ...f,
      clauseCount: countMap.get(f.contractType) || 0,
    }));
    
    res.json({ templates });
    
  } catch (error: any) {
    console.error("Failed to list templates:", error);
    res.status(500).json({ error: "Failed to list templates" });
  }
});

// Delete a template
router.delete("/contracts/templates/:fileName", async (req, res) => {
  try {
    const rawFileName = req.params.fileName;
    const templatesDir = path.join(process.cwd(), "server", "templates");
    
    // Security: Sanitize fileName to prevent path traversal attacks
    // Only allow the base filename, reject any path components
    const fileName = path.basename(rawFileName);
    
    // Validate it's a .docx file
    if (!fileName.endsWith(".docx")) {
      return res.status(400).json({ error: "Invalid file type. Only .docx files can be deleted." });
    }
    
    // Validate against existing templates (allowlist approach)
    const existingFiles = fs.existsSync(templatesDir) 
      ? fs.readdirSync(templatesDir).filter(f => f.endsWith(".docx") && !f.startsWith("~$"))
      : [];
    
    if (!existingFiles.includes(fileName)) {
      return res.status(404).json({ error: "Template not found" });
    }
    
    const filePath = path.join(templatesDir, fileName);
    
    // Double-check the resolved path is within templatesDir (defense in depth)
    const resolvedPath = path.resolve(filePath);
    const resolvedTemplatesDir = path.resolve(templatesDir);
    if (!resolvedPath.startsWith(resolvedTemplatesDir)) {
      return res.status(400).json({ error: "Invalid file path" });
    }
    
    // Derive contract type
    const contractType = fileName
      .replace(/\.docx$/i, "")
      .replace(/^Template[_-]?/i, "")
      .replace(/[_-]/g, "_")
      .toUpperCase()
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    // Delete associated clauses
    await db.delete(clauses).where(eq(clauses.contractType, contractType));
    
    res.json({ 
      success: true, 
      message: `Template "${fileName}" and its clauses deleted`,
      contractType 
    });
    
  } catch (error: any) {
    console.error("Failed to delete template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// ---------------------------------------------------------------------------
// CONTRACT CRUD
// ---------------------------------------------------------------------------

router.get("/contracts/download/:fileName", async (req, res) => {
  try {
    const fileName = req.params.fileName;
    const outputDir = path.join(process.cwd(), "generated");
    const filePath = path.join(outputDir, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath, fileName);
  } catch (error) {
    console.error("Failed to download contract:", error);
    res.status(500).json({ error: "Failed to download contract" });
  }
});

router.get("/projects/:projectId/contracts", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const projectContracts = await db
      .select()
      .from(contracts)
      .where(eq(contracts.projectId, projectId));
    res.json(projectContracts);
  } catch (error) {
    console.error("Failed to fetch contracts:", error);
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

// ---------------------------------------------------------------------------
// CONTRACT CRUD
// ---------------------------------------------------------------------------

router.get("/contracts", async (req, res) => {
  try {
    const allContracts = await db
      .select({
        id: contracts.id,
        projectId: contracts.projectId,
        contractType: contracts.contractType,
        version: contracts.version,
        status: contracts.status,
        generatedAt: contracts.generatedAt,
        generatedBy: contracts.generatedBy,
        templateVersion: contracts.templateVersion,
        fileName: contracts.fileName,
        notes: contracts.notes,
        projectName: projects.name,
        projectNumber: projects.projectNumber,
      })
      .from(contracts)
      .leftJoin(projects, eq(contracts.projectId, projects.id))
      .orderBy(contracts.generatedAt);
    
    const draftProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        projectNumber: projects.projectNumber,
        status: projects.status,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.status, 'Draft'));
    
    const financialsData = await db.select().from(financials);
    const projectValues = new Map<number, number>();
    financialsData.forEach(f => {
      const value = ((f.designFee || 0) + (f.prelimOffsite || 0) + (f.prelimOnsite || 0)) / 100;
      projectValues.set(f.projectId, value);
    });
    
    const normalizeStatus = (status: string | null): string => {
      if (!status) return 'draft';
      const normalized = status.toLowerCase().replace(/\s+/g, '_');
      const statusMap: Record<string, string> = {
        'draft': 'draft',
        'pendingreview': 'pending_review',
        'pending_review': 'pending_review',
        'pending': 'pending_review',
        'approved': 'approved',
        'signed': 'signed',
        'executed': 'signed',
        'expired': 'expired',
      };
      return statusMap[normalized] || 'draft';
    };
    
    const packageMap = new Map<number, {
      packageId: number;
      projectId: number;
      projectName: string;
      projectNumber: string;
      status: string;
      contractValue: number;
      generatedAt: string;
      isDraft: boolean;
      contracts: Array<{
        id: number;
        contractType: string;
        fileName: string;
        status: string;
        generatedAt: string;
      }>;
    }>();
    
    const projectsWithContracts = new Set(allContracts.map(c => c.projectId));
    draftProjects.forEach(p => {
      if (!projectsWithContracts.has(p.id)) {
        packageMap.set(p.id, {
          packageId: p.id,
          projectId: p.id,
          projectName: p.name || 'Untitled Draft',
          projectNumber: p.projectNumber || '',
          status: 'draft',
          contractValue: projectValues.get(p.id) || 0,
          generatedAt: p.createdAt?.toISOString() || '',
          isDraft: true,
          contracts: [],
        });
      }
    });
    
    allContracts.forEach(c => {
      if (!c.projectId) return;
      
      const existing = packageMap.get(c.projectId);
      const contractInfo = {
        id: c.id,
        contractType: c.contractType || '',
        fileName: c.fileName || '',
        status: normalizeStatus(c.status),
        generatedAt: c.generatedAt?.toISOString() || '',
      };
      
      if (existing) {
        existing.contracts.push(contractInfo);
        existing.isDraft = false;
        if (c.contractType === 'one_agreement') {
          existing.status = normalizeStatus(c.status);
        }
      } else {
        packageMap.set(c.projectId, {
          packageId: c.projectId,
          projectId: c.projectId,
          projectName: c.projectName || 'Unknown Project',
          projectNumber: c.projectNumber || '',
          status: normalizeStatus(c.status),
          contractValue: projectValues.get(c.projectId) || 0,
          generatedAt: c.generatedAt?.toISOString() || '',
          isDraft: false,
          contracts: [contractInfo],
        });
      }
    });
    
    const packages = Array.from(packageMap.values()).map(pkg => ({
      ...pkg,
      title: `${pkg.projectName} Contract Package`,
      clientName: pkg.projectName,
      contractCount: pkg.contracts.length,
    }));
    
    packages.sort((a, b) => {
      if (a.isDraft && !b.isDraft) return -1;
      if (!a.isDraft && b.isDraft) return 1;
      return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
    });
    
    res.json(packages);
  } catch (error) {
    console.error("Failed to fetch contracts:", error);
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

router.post("/contracts", async (req, res) => {
  try {
    const { projectId, contractType, status } = req.body;
    
    // Normalize status to ensure consistency
    const normalizedStatus = status === "draft" ? "Draft" : status;
    const contractData = { ...req.body, status: normalizedStatus };
    
    // Version control: If creating a new Draft, use a transaction to atomically
    // delete existing Drafts for the same project/type and insert the new one
    if (projectId && contractType && normalizedStatus === "Draft") {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Delete existing drafts for same project/type
        const deleteResult = await client.query(
          `DELETE FROM contracts 
           WHERE project_id = $1 AND contract_type = $2 AND status = 'Draft'
           RETURNING id`,
          [projectId, contractType]
        );
        
        if (deleteResult.rowCount && deleteResult.rowCount > 0) {
          console.log(`🔄 Version control: Replacing ${deleteResult.rowCount} existing draft(s) for project ${projectId}, type ${contractType}`);
        }
        
        // Insert new contract
        const insertResult = await client.query(
          `INSERT INTO contracts (project_id, contract_type, version, status, generated_at, generated_by, template_version, file_path, file_name, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            contractData.projectId,
            contractData.contractType,
            contractData.version || 1,
            contractData.status || 'Draft',
            contractData.generatedAt || new Date(),
            contractData.generatedBy || null,
            contractData.templateVersion || null,
            contractData.filePath || null,
            contractData.fileName || null,
            contractData.notes || null
          ]
        );
        
        await client.query('COMMIT');
        res.json(insertResult.rows[0]);
      } catch (txError) {
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        client.release();
      }
    } else {
      // Non-draft contracts: simple insert
      const [result] = await db.insert(contracts).values(contractData).returning();
      res.json(result);
    }
  } catch (error) {
    console.error("Failed to create contract:", error);
    res.status(500).json({ error: "Failed to create contract" });
  }
});

// Cleanup endpoint - remove duplicate draft contracts, keeping only the latest
router.post("/contracts/cleanup-duplicates", async (req, res) => {
  try {
    // Find all projects with duplicate drafts
    const duplicatesQuery = `
      WITH ranked AS (
        SELECT id, project_id, contract_type, status, generated_at,
               ROW_NUMBER() OVER (PARTITION BY project_id, contract_type, status ORDER BY generated_at DESC) as rn
        FROM contracts
        WHERE status = 'Draft'
      )
      SELECT id FROM ranked WHERE rn > 1
    `;
    
    const result = await pool.query(duplicatesQuery);
    const duplicateIds = result.rows.map(r => r.id);
    
    if (duplicateIds.length === 0) {
      return res.json({ success: true, message: "No duplicates found", deletedCount: 0 });
    }
    
    // Delete the duplicates
    const deleteQuery = `DELETE FROM contracts WHERE id = ANY($1)`;
    await pool.query(deleteQuery, [duplicateIds]);
    
    console.log(`🧹 Cleaned up ${duplicateIds.length} duplicate draft contracts`);
    
    res.json({ 
      success: true, 
      message: `Deleted ${duplicateIds.length} duplicate draft contracts`,
      deletedCount: duplicateIds.length,
      deletedIds: duplicateIds
    });
  } catch (error) {
    console.error("Failed to cleanup duplicates:", error);
    res.status(500).json({ error: "Failed to cleanup duplicates" });
  }
});

router.get("/contracts/:id", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const [contract] = await db
      .select({
        id: contracts.id,
        projectId: contracts.projectId,
        contractType: contracts.contractType,
        version: contracts.version,
        status: contracts.status,
        generatedAt: contracts.generatedAt,
        generatedBy: contracts.generatedBy,
        templateVersion: contracts.templateVersion,
        fileName: contracts.fileName,
        filePath: contracts.filePath,
        notes: contracts.notes,
        projectName: projects.name,
        projectNumber: projects.projectNumber,
      })
      .from(contracts)
      .leftJoin(projects, eq(contracts.projectId, projects.id))
      .where(eq(contracts.id, contractId));
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.json(contract);
  } catch (error) {
    console.error("Failed to fetch contract:", error);
    res.status(500).json({ error: "Failed to fetch contract" });
  }
});

router.get("/contracts/:id/clauses", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
    
    if (!contract) {
      return res.status(404).json({ error: "Contract not found" });
    }

    const contractTypeMap: Record<string, string> = {
      'one_agreement': 'ONE_AGREEMENT',
      'ONE': 'ONE_AGREEMENT',
      'ONE Agreement': 'ONE_AGREEMENT',
      'ONE_AGREEMENT': 'ONE_AGREEMENT',
      'manufacturing_sub': 'OFFSITE',
      'MANUFACTURING': 'OFFSITE',
      'OFFSITE': 'OFFSITE',
      'onsite_sub': 'ON_SITE',
      'ONSITE': 'ON_SITE',
      'ON_SITE': 'ON_SITE',
    };
    
    const templateType = contractTypeMap[contract.contractType] || 'ONE_AGREEMENT';
    
    const clauseQuery = `
      SELECT c.id, c.name, c.content, c.hierarchy_level, c.risk_level, c.clause_code as section_number
      FROM clauses c
      WHERE c.contract_type = $1 OR c.contract_type = 'ALL'
      ORDER BY c.sort_order, c.clause_code
    `;
    
    const result = await pool.query(clauseQuery, [templateType]);
    
    let variables: Record<string, string | number | boolean | null> = {};
    if (contract.projectId) {
      const projectData = await getProjectWithRelations(contract.projectId);
      if (projectData) {
        const { mapProjectToVariables } = await import('../lib/mapper');
        const { calculateProjectPricing } = await import('../services/pricingEngine');
        
        // Calculate pricing to populate table variables
        let pricingSummary = null;
        try {
          pricingSummary = await calculateProjectPricing(contract.projectId);
        } catch (e) {
          console.warn('Pricing calculation failed for clause preview:', e);
        }
        
        variables = mapProjectToVariables(projectData, pricingSummary || undefined);
      }
    }
    
    const clausesWithValues = result.rows.map((clause: any) => {
      let content = clause.content || '';
      
      content = content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match: string, varName: string) => {
        const value = variables[varName];
        if (value !== null && value !== undefined && value !== '') {
          return String(value);
        }
        return match;
      });
      
      return {
        ...clause,
        content
      };
    });
    
    res.json(clausesWithValues);
  } catch (error) {
    console.error("Failed to fetch contract clauses:", error);
    res.status(500).json({ error: "Failed to fetch clauses" });
  }
});

router.patch("/contracts/:id", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const [result] = await db
      .update(contracts)
      .set(req.body)
      .where(eq(contracts.id, contractId))
      .returning();
    res.json(result);
  } catch (error) {
    console.error("Failed to update contract:", error);
    res.status(500).json({ error: "Failed to update contract" });
  }
});

router.post("/contracts/:id/send", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const { sentTo } = req.body;
    
    const [result] = await db
      .update(contracts)
      .set({
        status: "Sent",
        sentAt: new Date(),
        sentTo,
      })
      .where(eq(contracts.id, contractId))
      .returning();
    
    res.json(result);
  } catch (error) {
    console.error("Failed to mark contract as sent:", error);
    res.status(500).json({ error: "Failed to mark contract as sent" });
  }
});

router.post("/contracts/:id/execute", async (req, res) => {
  try {
    const contractId = parseInt(req.params.id);
    const { executedFilePath } = req.body;
    
    const [result] = await db
      .update(contracts)
      .set({
        status: "Executed",
        executedAt: new Date(),
        executedFilePath,
      })
      .where(eq(contracts.id, contractId))
      .returning();
    
    res.json(result);
  } catch (error) {
    console.error("Failed to mark contract as executed:", error);
    res.status(500).json({ error: "Failed to mark contract as executed" });
  }
});

// ---------------------------------------------------------------------------
// CONTRACT GENERATION
// ---------------------------------------------------------------------------

router.get("/contracts/variables/:contractType", async (req, res) => {
  try {
    const { contractType } = req.params;
    
    const query = `
      SELECT DISTINCT 
        cv.variable_name,
        cv.display_name,
        cv.data_type,
        cv.category,
        cv.description,
        cv.default_value,
        cv.is_required
      FROM contract_variables cv
      WHERE $1 = ANY(cv.used_in_contracts)
      ORDER BY cv.category, cv.variable_name
    `;
    
    const result = await pool.query(query, [contractType.toUpperCase()]);
    
    const byCategory = result.rows.reduce((acc: Record<string, any[]>, variable: any) => {
      const category = variable.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(variable);
      return acc;
    }, {});
    
    res.json({
      contractType: contractType.toUpperCase(),
      totalVariables: result.rows.length,
      categories: Object.keys(byCategory),
      variablesByCategory: byCategory,
      allVariables: result.rows
    });
    
  } catch (error) {
    console.error("Error fetching required variables:", error);
    res.status(500).json({ 
      error: "Failed to fetch required variables",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/contracts/preview-clauses", async (req, res) => {
  try {
    const { contractType, projectData } = req.body;
    
    if (!contractType || !projectData) {
      return res.status(400).json({ 
        error: "Both contractType and projectData are required" 
      });
    }
    
    const templateQuery = `
      SELECT * FROM contract_templates
      WHERE contract_type = $1 AND status = 'active'
      LIMIT 1
    `;
    
    const templateResult = await pool.query(templateQuery, [contractType.toUpperCase()]);
    
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ 
        error: `No active template found for: ${contractType}` 
      });
    }
    
    const template = templateResult.rows[0];
    
    let clauseIds = [...(template.base_clause_ids || [])];
    
    const conditionalRules = template.conditional_rules || {};
    for (const [conditionKey, ruleSet] of Object.entries(conditionalRules)) {
      const projectValue = projectData[conditionKey];
      const rules = ruleSet as Record<string, number[]>;
      if (projectValue !== undefined && rules[String(projectValue)]) {
        clauseIds.push(...rules[String(projectValue)]);
      }
    }
    
    if (clauseIds.length === 0) {
      return res.json({
        contractType: contractType.toUpperCase(),
        template: template.display_name,
        summary: { totalClauses: 0, sections: 0, subsections: 0, paragraphs: 0 },
        allClauses: []
      });
    }
    
    const clausesQuery = `
      SELECT 
        id, clause_code, parent_clause_id, hierarchy_level, sort_order,
        name, category, contract_type, content, variables_used, conditions,
        risk_level, negotiable
      FROM clauses
      WHERE id = ANY($1)
      ORDER BY sort_order
    `;
    
    const clausesResult = await pool.query(clausesQuery, [clauseIds]);
    const clausesList = clausesResult.rows;
    
    const sections = clausesList.filter((c: any) => c.hierarchy_level === 1);
    const subsections = clausesList.filter((c: any) => c.hierarchy_level === 2);
    const paragraphs = clausesList.filter((c: any) => c.hierarchy_level === 3);
    const conditionalIncluded = clausesList.filter((c: any) => c.conditions !== null);
    
    res.json({
      contractType: contractType.toUpperCase(),
      template: template.display_name,
      summary: {
        totalClauses: clausesList.length,
        sections: sections.length,
        subsections: subsections.length,
        paragraphs: paragraphs.length,
        conditionalIncluded: conditionalIncluded.length
      },
      conditionalClauses: conditionalIncluded.map((c: any) => ({
        code: c.clause_code,
        name: c.name,
        conditions: c.conditions,
        category: c.category
      })),
      allClauses: clausesList.map((c: any) => ({
        code: c.clause_code,
        level: c.hierarchy_level,
        name: c.name,
        category: c.category,
        variablesUsed: c.variables_used,
        conditional: c.conditions !== null
      }))
    });
    
  } catch (error) {
    console.error("Error previewing clauses:", error);
    res.status(500).json({ 
      error: "Failed to preview clauses",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/contracts/generate-package", async (req, res) => {
  try {
    const { projectData } = req.body;
    
    if (!projectData) {
      return res.status(400).json({ 
        error: "Project data is required",
        message: "Please provide projectData object with all required variables"
      });
    }
    
    console.log('\n=== WIZARD DATA RECEIVED ===');
    console.log(JSON.stringify(projectData, null, 2));
    console.log('=== END WIZARD DATA ===\n');
    
    console.log("Generating contract package for project:", projectData.PROJECT_NAME);
    
    const enrichedData = {
      ...projectData,
      IS_CRC: projectData.SERVICE_MODEL === "CRC",
      IS_CMOS: projectData.SERVICE_MODEL === "CMOS",
      CONTRACT_DATE: projectData.CONTRACT_DATE || new Date().toISOString().split("T")[0]
    };
    
    const generateSingleContract = async (contractType: string) => {
      const templateQuery = `
        SELECT * FROM contract_templates
        WHERE contract_type = $1 AND status = 'active'
        LIMIT 1
      `;
      
      const templateResult = await pool.query(templateQuery, [contractType]);
      
      if (templateResult.rows.length === 0) {
        throw new Error(`No active template found for contract type: ${contractType}`);
      }
      
      const template = templateResult.rows[0];
      
      let clauseIds = [...(template.base_clause_ids || [])];
      const conditionalRules = template.conditional_rules || {};
      
      for (const [conditionKey, ruleSet] of Object.entries(conditionalRules)) {
        const projectValue = enrichedData[conditionKey];
        const rules = ruleSet as Record<string, number[]>;
        if (projectValue !== undefined && rules[String(projectValue)]) {
          clauseIds.push(...rules[String(projectValue)]);
        }
      }
      
      if (clauseIds.length === 0) {
        return { content: "", filename: `${contractType}_empty.docx`, clauseCount: 0 };
      }
      
      const clausesQuery = `
        SELECT clause_code, hierarchy_level, name, content, variables_used
        FROM clauses
        WHERE id = ANY($1)
        ORDER BY sort_order
      `;
      
      const clausesResult = await pool.query(clausesQuery, [clauseIds]);
      const clausesList = clausesResult.rows;
      
      let documentText = "";
      for (const clause of clausesList) {
        if (clause.hierarchy_level === 1) {
          documentText += `\n\n${clause.name.toUpperCase()}\n\n`;
        } else if (clause.hierarchy_level === 2) {
          documentText += `\n${clause.name}\n\n`;
        } else {
          documentText += "\n";
        }
        documentText += clause.content + "\n";
      }
      
      documentText = documentText.replace(/\{\{([A-Z_]+)\}\}/g, (match, varName) => {
        const value = enrichedData[varName];
        if (value === undefined || value === null) {
          return `[${varName}]`;
        }
        if (typeof value === "boolean") return value ? "Yes" : "No";
        if (typeof value === "number") return value.toLocaleString();
        return String(value);
      });
      
      const projectName = enrichedData.PROJECT_NAME || "Unnamed";
      const sanitizedName = projectName.replace(/[^a-z0-9]/gi, "_");
      const filename = `${sanitizedName}_${contractType}_${Date.now()}.docx`;
      
      return {
        content: documentText,
        filename,
        clauseCount: clausesList.length
      };
    };
    
    const [oneAgreement, manufacturing, onsite] = await Promise.all([
      generateSingleContract("ONE"),
      generateSingleContract("MANUFACTURING"),
      generateSingleContract("ONSITE")
    ]);
    
    res.json({
      success: true,
      message: "Contract package generated successfully",
      projectName: enrichedData.PROJECT_NAME,
      serviceModel: enrichedData.SERVICE_MODEL,
      contracts: {
        one_agreement: {
          filename: oneAgreement.filename,
          content: oneAgreement.content,
          clauseCount: oneAgreement.clauseCount
        },
        manufacturing_subcontract: {
          filename: manufacturing.filename,
          content: manufacturing.content,
          clauseCount: manufacturing.clauseCount
        },
        onsite_subcontract: {
          filename: onsite.filename,
          content: onsite.content,
          clauseCount: onsite.clauseCount
        }
      },
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Error generating contract package:", error);
    res.status(500).json({ 
      error: "Failed to generate contract package",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/contracts/download-all-zip", async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }
    
    const fullProject = await getProjectWithRelations(projectId);
    if (!fullProject) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    const { mapProjectToVariables, formatCentsAsCurrency, centsToDollars } = await import('../lib/mapper');
    const { calculateProjectPricing } = await import('../services/pricingEngine');
    
    // Calculate pricing FIRST so we can pass it to mapProjectToVariables
    let pricingSummary: any = null;
    try {
      pricingSummary = await calculateProjectPricing(projectId);
      console.log(`✓ Pricing calculated for ZIP: contractValue=${pricingSummary.contractValue}, paymentSchedule=${pricingSummary.paymentSchedule?.length || 0} items`);
    } catch (pricingError) {
      console.warn(`⚠️ Pricing engine error (using fallback):`, pricingError);
    }
    
    // Now call mapProjectToVariables WITH the pricingSummary so tables are populated
    const projectData = mapProjectToVariables(fullProject, pricingSummary || undefined);
    
    console.log(`\n=== Generating ALL contracts as ZIP for project ${projectId} ===`);
    console.log(`Project: ${projectData.PROJECT_NUMBER} - ${projectData.PROJECT_NAME}`);
    
    try {
      const projectUnitsData = await db
        .select({
          unitLabel: projectUnits.unitLabel,
          modelName: homeModels.name,
        })
        .from(projectUnits)
        .innerJoin(homeModels, eq(projectUnits.modelId, homeModels.id))
        .where(eq(projectUnits.projectId, projectId));
      
      if (pricingSummary && pricingSummary.unitCount > 0) {
        projectData.DESIGN_FEE = centsToDollars(pricingSummary.breakdown.totalDesignFee);
        projectData.DESIGN_FEE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalDesignFee);
        projectData.PRELIM_OFFSITE = centsToDollars(pricingSummary.breakdown.totalOffsite);
        projectData.PRELIM_OFFSITE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalOffsite);
        projectData.PRELIMINARY_OFFSITE_PRICE = formatCentsAsCurrency(pricingSummary.breakdown.totalOffsite);
        projectData.PRELIM_ONSITE = centsToDollars(pricingSummary.breakdown.totalOnsite);
        projectData.PRELIM_ONSITE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalOnsite);
        projectData.PRELIMINARY_ONSITE_PRICE = formatCentsAsCurrency(pricingSummary.breakdown.totalOnsite);
        projectData.PRELIM_CONTRACT_PRICE = centsToDollars(pricingSummary.grandTotal);
        projectData.PRELIM_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.PRELIMINARY_CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.PRELIMINARY_TOTAL_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.FINAL_CONTRACT_PRICE = centsToDollars(pricingSummary.grandTotal);
        projectData.FINAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
        
        pricingSummary.paymentSchedule.forEach((milestone: { name: string; percentage: number; amount: number; phase?: string }, index: number) => {
          const num = index + 1;
          projectData[`MILESTONE_${num}_NAME`] = milestone.name;
          projectData[`MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
          projectData[`MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
          projectData[`MILESTONE_${num}_PHASE`] = milestone.phase || null;
          projectData[`CLIENT_MILESTONE_${num}_NAME`] = milestone.name;
          projectData[`CLIENT_MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
          projectData[`CLIENT_MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
          
          if (milestone.name === 'Retainage' || milestone.name.toLowerCase().includes('retainage')) {
            projectData.RETAINAGE_PERCENT = `${milestone.percentage}%`;
            projectData.RETAINAGE_AMOUNT = formatCentsAsCurrency(milestone.amount);
          }
        });
        
        const unitCounts: Record<string, { count: number; labels: string[] }> = {};
        projectUnitsData.forEach(unit => {
          if (!unitCounts[unit.modelName]) {
            unitCounts[unit.modelName] = { count: 0, labels: [] };
          }
          unitCounts[unit.modelName].count++;
          unitCounts[unit.modelName].labels.push(unit.unitLabel);
        });
        
        const unitSummaryParts = Object.entries(unitCounts).map(([model, data]) => 
          `${data.count}x ${model} (${data.labels.join(', ')})`
        );
        const unitSummary = `${pricingSummary.unitCount} Unit${pricingSummary.unitCount !== 1 ? 's' : ''}: ${unitSummaryParts.join(', ')}`;
        
        projectData.HOME_MODEL = unitSummary;
        projectData.UNIT_MODEL_LIST = pricingSummary.unitModelSummary || unitSummary;
        projectData.TOTAL_UNITS = pricingSummary.unitCount;
        
        projectData.TOTAL_PROJECT_BUDGET = centsToDollars(pricingSummary.projectBudget);
        projectData.TOTAL_PROJECT_BUDGET_WRITTEN = formatCentsAsCurrency(pricingSummary.projectBudget);
        projectData.TOTAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
        projectData.TOTAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRICING_SERVICE_MODEL = pricingSummary.serviceModel;
        
        projectData.CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRELIM_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
        projectData.PRELIM_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRELIMINARY_CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRELIMINARY_TOTAL_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.FINAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
        projectData.FINAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
        
        console.log(`Pricing Engine injected: Contract Value = ${formatCentsAsCurrency(pricingSummary.contractValue)}, Project Budget = ${formatCentsAsCurrency(pricingSummary.projectBudget)}, Service Model = ${pricingSummary.serviceModel}, Units = ${pricingSummary.unitCount}`);
      }
    } catch (pricingError) {
      console.warn('Pricing engine calculation failed, using legacy values:', pricingError);
    }
    
    const { generateContract, getContractFilename } = await import('../lib/contractGenerator');
    const archiver = (await import('archiver')).default;
    
    const contractTypes: Array<'ONE' | 'MANUFACTURING' | 'ONSITE'> = ['ONE', 'MANUFACTURING', 'ONSITE'];
    
    const generatedContracts: Array<{ buffer: Buffer; filename: string }> = [];
    
    for (const contractType of contractTypes) {
      try {
        const buffer = await generateContract({
          contractType,
          projectData,
          format: 'pdf'
        });
        const filename = getContractFilename(contractType, projectData, 'pdf');
        generatedContracts.push({ buffer, filename });
        console.log(`Generated ${contractType}: ${filename} (${buffer.length} bytes)`);
      } catch (err) {
        console.error(`Failed to generate ${contractType}:`, err);
      }
    }
    
    if (generatedContracts.length === 0) {
      return res.status(500).json({ error: "Failed to generate any contracts" });
    }
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    const zipFilename = `${projectData.PROJECT_NUMBER || 'Contracts'}_Package.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    
    archive.pipe(res);
    
    for (const contract of generatedContracts) {
      archive.append(contract.buffer, { name: contract.filename });
    }
    
    await archive.finalize();
    
    console.log(`ZIP archive created with ${generatedContracts.length} contracts`);
    
  } catch (error) {
    console.error("Error generating ZIP:", error);
    res.status(500).json({ 
      error: "Failed to generate contract package",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/contracts/download-pdf", async (req, res) => {
  try {
    const { contractType, projectId, projectData: legacyProjectData } = req.body;
    
    if (!contractType) {
      return res.status(400).json({ error: "contractType is required" });
    }
    
    let projectData: any;
    
    if (projectId) {
      const fullProject = await getProjectWithRelations(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const { mapProjectToVariables, formatCentsAsCurrency, centsToDollars } = await import('../lib/mapper');
      const { calculateProjectPricing } = await import('../services/pricingEngine');
      
      // Calculate pricing FIRST so we can pass it to mapProjectToVariables
      let pricingSummary: any = null;
      try {
        pricingSummary = await calculateProjectPricing(projectId);
        console.log(`✓ Pricing calculated for PDF: contractValue=${pricingSummary.contractValue}, paymentSchedule=${pricingSummary.paymentSchedule?.length || 0} items`);
      } catch (pricingError) {
        console.warn(`⚠️ Pricing engine error (using fallback):`, pricingError);
      }
      
      // Now call mapProjectToVariables WITH the pricingSummary so tables are populated
      projectData = mapProjectToVariables(fullProject, pricingSummary || undefined);
      
      console.log(`\n=== Generating ${contractType} contract for project ${projectId} ===`);
      console.log(`Project: ${projectData.PROJECT_NUMBER} - ${projectData.PROJECT_NAME}`);
      console.log(`Service Model: ${projectData.ON_SITE_SELECTION}`);
      
      try {
        const projectUnitsData = await db
          .select({
            unitLabel: projectUnits.unitLabel,
            modelName: homeModels.name,
          })
          .from(projectUnits)
          .innerJoin(homeModels, eq(projectUnits.modelId, homeModels.id))
          .where(eq(projectUnits.projectId, projectId));
        
        if (pricingSummary && pricingSummary.unitCount > 0) {
          projectData.DESIGN_FEE = centsToDollars(pricingSummary.breakdown.totalDesignFee);
          projectData.DESIGN_FEE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalDesignFee);
          projectData.PRELIM_OFFSITE = centsToDollars(pricingSummary.breakdown.totalOffsite);
          projectData.PRELIM_OFFSITE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalOffsite);
          projectData.PRELIMINARY_OFFSITE_PRICE = formatCentsAsCurrency(pricingSummary.breakdown.totalOffsite);
          projectData.PRELIM_ONSITE = centsToDollars(pricingSummary.breakdown.totalOnsite);
          projectData.PRELIM_ONSITE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalOnsite);
          projectData.PRELIMINARY_ONSITE_PRICE = formatCentsAsCurrency(pricingSummary.breakdown.totalOnsite);
          projectData.PRELIM_CONTRACT_PRICE = centsToDollars(pricingSummary.grandTotal);
          projectData.PRELIM_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.grandTotal);
          projectData.PRELIMINARY_CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
          projectData.PRELIMINARY_TOTAL_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
          projectData.FINAL_CONTRACT_PRICE = centsToDollars(pricingSummary.grandTotal);
          projectData.FINAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.grandTotal);
          projectData.CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
          
          pricingSummary.paymentSchedule.forEach((milestone: { name: string; percentage: number; amount: number; phase?: string }, index: number) => {
            const num = index + 1;
            projectData[`MILESTONE_${num}_NAME`] = milestone.name;
            projectData[`MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
            projectData[`MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
            projectData[`MILESTONE_${num}_PHASE`] = milestone.phase;
            projectData[`CLIENT_MILESTONE_${num}_NAME`] = milestone.name;
            projectData[`CLIENT_MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
            projectData[`CLIENT_MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
            
            if (milestone.name === 'Retainage' || milestone.name.toLowerCase().includes('retainage')) {
              projectData.RETAINAGE_PERCENT = `${milestone.percentage}%`;
              projectData.RETAINAGE_AMOUNT = formatCentsAsCurrency(milestone.amount);
            }
          });
          
          const unitCounts: Record<string, { count: number; labels: string[] }> = {};
          projectUnitsData.forEach(unit => {
            if (!unitCounts[unit.modelName]) {
              unitCounts[unit.modelName] = { count: 0, labels: [] };
            }
            unitCounts[unit.modelName].count++;
            unitCounts[unit.modelName].labels.push(unit.unitLabel);
          });
          
          const unitSummaryParts = Object.entries(unitCounts).map(([model, data]) => 
            `${data.count}x ${model} (${data.labels.join(', ')})`
          );
          const unitSummary = `${pricingSummary.unitCount} Unit${pricingSummary.unitCount !== 1 ? 's' : ''}: ${unitSummaryParts.join(', ')}`;
          
          projectData.HOME_MODEL = unitSummary;
          projectData.UNIT_MODEL_LIST = pricingSummary.unitModelSummary || unitSummary;
          projectData.TOTAL_UNITS = pricingSummary.unitCount;
          
          projectData.TOTAL_PROJECT_BUDGET = centsToDollars(pricingSummary.projectBudget);
          projectData.TOTAL_PROJECT_BUDGET_WRITTEN = formatCentsAsCurrency(pricingSummary.projectBudget);
          projectData.TOTAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
          projectData.TOTAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
          projectData.PRICING_SERVICE_MODEL = pricingSummary.serviceModel;
          
          projectData.CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
          projectData.PRELIM_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
          projectData.PRELIM_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
          projectData.PRELIMINARY_CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
          projectData.PRELIMINARY_TOTAL_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
          projectData.FINAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
          projectData.FINAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
          
          console.log(`Pricing Engine injected: Contract Value = ${formatCentsAsCurrency(pricingSummary.contractValue)}, Project Budget = ${formatCentsAsCurrency(pricingSummary.projectBudget)}, Service Model = ${pricingSummary.serviceModel}, Units = ${pricingSummary.unitCount}`);
        }
      } catch (pricingError) {
        console.warn('Pricing engine calculation failed, using legacy values:', pricingError);
      }
    } else if (legacyProjectData) {
      // LEGACY MODE IS NO LONGER SUPPORTED - Reject with clear error
      // All callers must use projectId to ensure proper variable mapping
      return res.status(400).json({ 
        error: "Legacy projectData input is no longer supported",
        message: "Please use 'projectId' instead of 'projectData'. The standard flow requires: projectId → getProjectWithRelations() → mapProjectToVariables() → generateContract()",
        action: "Update your API call to use { projectId: <number>, contractType: <string> }"
      });
    } else {
      return res.status(400).json({ error: "Either projectId or projectData is required" });
    }

    const { generateContract, getContractFilename } = await import('../lib/contractGenerator');
    
    const buffer = await generateContract({
      contractType: contractType as 'ONE' | 'MANUFACTURING' | 'ONSITE',
      projectData,
      format: 'pdf'
    });

    const filename = getContractFilename(contractType, projectData, 'pdf');
    
    console.log(`Generated ${contractType} contract: ${buffer.length} bytes`);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ 
      error: "Failed to generate document",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Draft Preview - Generate HTML preview of contract without PDF conversion
// Uses the same data enrichment as the PDF route to ensure parity
router.post("/contracts/draft-preview", async (req, res) => {
  try {
    const { contractType, projectId } = req.body;
    
    if (!contractType) {
      return res.status(400).json({ error: "contractType is required" });
    }
    
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required for draft preview" });
    }
    
    // Get full project data
    const fullProject = await getProjectWithRelations(projectId);
    if (!fullProject) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    const { mapProjectToVariables, formatCentsAsCurrency, centsToDollars } = await import('../lib/mapper');
    const { calculateProjectPricing } = await import('../services/pricingEngine');
    
    // Calculate pricing FIRST (same as PDF route)
    let pricingSummary: any = null;
    try {
      pricingSummary = await calculateProjectPricing(projectId);
      console.log(`✓ Pricing calculated for preview: contractValue=${pricingSummary.contractValue}, paymentSchedule=${pricingSummary.paymentSchedule?.length || 0} items`);
    } catch (pricingError) {
      console.warn(`⚠️ Pricing engine error (using fallback):`, pricingError);
    }
    
    // Map project to variables WITH pricingSummary (same as PDF route)
    const projectData = mapProjectToVariables(fullProject, pricingSummary || undefined);
    
    console.log(`\n=== Generating ${contractType} DRAFT PREVIEW for project ${projectId} ===`);
    console.log(`Project: ${projectData.PROJECT_NUMBER} - ${projectData.PROJECT_NAME}`);
    console.log(`Service Model: ${projectData.ON_SITE_SELECTION}`);
    
    // Apply the same pricing/milestone/unit enrichment as PDF route
    try {
      const projectUnitsData = await db
        .select({
          unitLabel: projectUnits.unitLabel,
          modelName: homeModels.name,
        })
        .from(projectUnits)
        .innerJoin(homeModels, eq(projectUnits.modelId, homeModels.id))
        .where(eq(projectUnits.projectId, projectId));
      
      if (pricingSummary && pricingSummary.unitCount > 0) {
        projectData.DESIGN_FEE = centsToDollars(pricingSummary.breakdown.totalDesignFee);
        projectData.DESIGN_FEE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalDesignFee);
        projectData.PRELIM_OFFSITE = centsToDollars(pricingSummary.breakdown.totalOffsite);
        projectData.PRELIM_OFFSITE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalOffsite);
        projectData.PRELIMINARY_OFFSITE_PRICE = formatCentsAsCurrency(pricingSummary.breakdown.totalOffsite);
        projectData.PRELIM_ONSITE = centsToDollars(pricingSummary.breakdown.totalOnsite);
        projectData.PRELIM_ONSITE_WRITTEN = formatCentsAsCurrency(pricingSummary.breakdown.totalOnsite);
        projectData.PRELIMINARY_ONSITE_PRICE = formatCentsAsCurrency(pricingSummary.breakdown.totalOnsite);
        projectData.PRELIM_CONTRACT_PRICE = centsToDollars(pricingSummary.grandTotal);
        projectData.PRELIM_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.PRELIMINARY_CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.PRELIMINARY_TOTAL_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.FINAL_CONTRACT_PRICE = centsToDollars(pricingSummary.grandTotal);
        projectData.FINAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.grandTotal);
        projectData.CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.grandTotal);
        
        pricingSummary.paymentSchedule.forEach((milestone: { name: string; percentage: number; amount: number; phase?: string }, index: number) => {
          const num = index + 1;
          projectData[`MILESTONE_${num}_NAME`] = milestone.name;
          projectData[`MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
          projectData[`MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
          projectData[`MILESTONE_${num}_PHASE`] = milestone.phase || '';
          projectData[`CLIENT_MILESTONE_${num}_NAME`] = milestone.name;
          projectData[`CLIENT_MILESTONE_${num}_PERCENT`] = `${milestone.percentage}%`;
          projectData[`CLIENT_MILESTONE_${num}_AMOUNT`] = formatCentsAsCurrency(milestone.amount);
          
          if (milestone.name === 'Retainage' || milestone.name.toLowerCase().includes('retainage')) {
            projectData.RETAINAGE_PERCENT = `${milestone.percentage}%`;
            projectData.RETAINAGE_AMOUNT = formatCentsAsCurrency(milestone.amount);
          }
        });
        
        const unitCounts: Record<string, { count: number; labels: string[] }> = {};
        projectUnitsData.forEach((unit: { unitLabel: string; modelName: string }) => {
          if (!unitCounts[unit.modelName]) {
            unitCounts[unit.modelName] = { count: 0, labels: [] };
          }
          unitCounts[unit.modelName].count++;
          unitCounts[unit.modelName].labels.push(unit.unitLabel);
        });
        
        const unitSummaryParts = Object.entries(unitCounts).map(([model, data]) => 
          `${data.count}x ${model} (${data.labels.join(', ')})`
        );
        const unitSummary = `${pricingSummary.unitCount} Unit${pricingSummary.unitCount !== 1 ? 's' : ''}: ${unitSummaryParts.join(', ')}`;
        
        projectData.HOME_MODEL = unitSummary;
        projectData.UNIT_MODEL_LIST = pricingSummary.unitModelSummary || unitSummary;
        projectData.TOTAL_UNITS = pricingSummary.unitCount;
        
        projectData.TOTAL_PROJECT_BUDGET = centsToDollars(pricingSummary.projectBudget);
        projectData.TOTAL_PROJECT_BUDGET_WRITTEN = formatCentsAsCurrency(pricingSummary.projectBudget);
        projectData.TOTAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
        projectData.TOTAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRICING_SERVICE_MODEL = pricingSummary.serviceModel;
        
        projectData.CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRELIM_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
        projectData.PRELIM_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRELIMINARY_CONTRACT_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.PRELIMINARY_TOTAL_PRICE = formatCentsAsCurrency(pricingSummary.contractValue);
        projectData.FINAL_CONTRACT_PRICE = centsToDollars(pricingSummary.contractValue);
        projectData.FINAL_CONTRACT_PRICE_WRITTEN = formatCentsAsCurrency(pricingSummary.contractValue);
        
        console.log(`Preview Pricing: Contract Value = ${formatCentsAsCurrency(pricingSummary.contractValue)}, Units = ${pricingSummary.unitCount}`);
      }
    } catch (pricingError) {
      console.warn('Pricing enrichment failed for preview, using base values:', pricingError);
    }
    
    // Generate HTML (not PDF)
    const { generateContract } = await import('../lib/contractGenerator');
    
    const buffer = await generateContract({
      contractType: contractType as 'ONE' | 'MANUFACTURING' | 'ONSITE',
      projectData,
      format: 'html'
    });
    
    const html = buffer.toString('utf-8');
    
    console.log(`Generated ${contractType} draft preview: ${html.length} chars`);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    
  } catch (error) {
    console.error("Error generating draft preview:", error);
    res.status(500).json({ 
      error: "Failed to generate preview",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

router.post("/contracts/compare-service-models", async (req, res) => {
  try {
    const { projectData } = req.body;
    
    if (!projectData) {
      return res.status(400).json({ error: "projectData is required" });
    }
    
    const getClauses = async (serviceModel: string) => {
      const modifiedData = { ...projectData, serviceModel };
      
      const templateQuery = `
        SELECT id, base_clause_ids, conditional_rules, display_name FROM contract_templates
        WHERE contract_type IN ('ONE', 'ONE_AGREEMENT')
      `;
      const templateResult = await pool.query(templateQuery);
      
      if (templateResult.rows.length === 0) {
        return { clauses: [], clauseIds: [] };
      }
      
      const template = templateResult.rows[0];
      const clauseIds = template.base_clause_ids || [];
      
      if (clauseIds.length === 0) {
        return { clauses: [], clauseIds: [] };
      }
      
      const clausesQuery = `
        SELECT id, clause_code, name, category, conditions, hierarchy_level
        FROM clauses
        WHERE id = ANY($1)
        ORDER BY sort_order
      `;
      
      const clausesResult = await pool.query(clausesQuery, [clauseIds]);
      
      const filteredClauses = clausesResult.rows.filter((clause: any) => {
        if (!clause.conditions) return true;
        const conditions = clause.conditions;
        if (conditions.service_model) {
          return conditions.service_model === serviceModel || conditions.service_model === "BOTH";
        }
        return true;
      });
      
      return { clauses: filteredClauses, clauseIds: filteredClauses.map((c: any) => c.id) };
    };
    
    const [crcResult, cmosResult] = await Promise.all([
      getClauses("CRC"),
      getClauses("CMOS")
    ]);
    
    const crcOnly = crcResult.clauses.filter(
      (c: any) => !cmosResult.clauseIds.includes(c.id)
    );
    const cmosOnly = cmosResult.clauses.filter(
      (c: any) => !crcResult.clauseIds.includes(c.id)
    );
    const shared = crcResult.clauses.filter(
      (c: any) => cmosResult.clauseIds.includes(c.id)
    );
    
    res.json({
      crc: {
        totalClauses: crcResult.clauses.length,
        clauses: crcResult.clauses
      },
      cmos: {
        totalClauses: cmosResult.clauses.length,
        clauses: cmosResult.clauses
      },
      comparison: {
        crcOnly: crcOnly.map((c: any) => ({ id: c.id, code: c.clause_code, name: c.name })),
        cmosOnly: cmosOnly.map((c: any) => ({ id: c.id, code: c.clause_code, name: c.name })),
        shared: shared.length,
        crcTotal: crcResult.clauses.length,
        cmosTotal: cmosResult.clauses.length
      }
    });
  } catch (error) {
    console.error("Failed to compare service models:", error);
    res.status(500).json({ error: "Failed to compare service models" });
  }
});

// ---------------------------------------------------------------------------
// CLAUSES
// ---------------------------------------------------------------------------

router.get("/clauses", async (req, res) => {
  try {
    const { contractType, category, search, hierarchyLevel } = req.query;
    
    let query = `
      SELECT 
        id, clause_code, parent_clause_id, hierarchy_level, sort_order,
        name, category, contract_type, content, variables_used, conditions,
        risk_level, negotiable, created_at, updated_at
      FROM clauses
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;
    
    if (contractType && contractType !== 'ALL') {
      query += ` AND contract_type = $${paramCount}`;
      params.push(contractType);
      paramCount++;
    }
    
    if (category) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    if (hierarchyLevel) {
      query += ` AND hierarchy_level = $${paramCount}`;
      params.push(parseInt(hierarchyLevel as string));
      paramCount++;
    }
    
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR content ILIKE $${paramCount} OR clause_code ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    query += ` ORDER BY sort_order, clause_code`;
    
    const result = await pool.query(query, params);
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT contract_type) as contract_types,
        COUNT(DISTINCT category) as categories,
        COUNT(*) FILTER (WHERE conditions IS NOT NULL) as conditional
      FROM clauses
    `;
    const statsResult = await pool.query(statsQuery);
    
    res.json({
      clauses: result.rows,
      stats: statsResult.rows[0]
    });
  } catch (error) {
    console.error("Failed to fetch clauses:", error);
    res.status(500).json({ error: "Failed to fetch clauses" });
  }
});

router.get("/clauses/meta/categories", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM clauses
      GROUP BY category
      ORDER BY category
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch clause categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/clauses/meta/contract-types", async (req, res) => {
  try {
    const result = await db
      .select({
        contractType: clauses.contractType,
        count: count(),
      })
      .from(clauses)
      .groupBy(clauses.contractType)
      .orderBy(clauses.contractType);
    res.json(result.map(r => ({ contract_type: r.contractType, count: Number(r.count) })));
  } catch (error) {
    console.error("Failed to fetch contract types:", error);
    res.status(500).json({ error: "Failed to fetch contract types" });
  }
});

router.get("/clauses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        id, clause_code, parent_clause_id, hierarchy_level, sort_order,
        name, category, contract_type, content, variables_used, conditions,
        risk_level, negotiable, created_at, updated_at
      FROM clauses
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Clause not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to fetch clause:", error);
    res.status(500).json({ error: "Failed to fetch clause" });
  }
});

router.patch("/clauses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, content, conditions, riskLevel, negotiable, variablesUsed } = req.body;
    
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }
    if (content !== undefined) {
      updateFields.push(`content = $${paramCount}`);
      values.push(content);
      paramCount++;
    }
    if (conditions !== undefined) {
      updateFields.push(`conditions = $${paramCount}`);
      values.push(JSON.stringify(conditions));
      paramCount++;
    }
    if (riskLevel !== undefined) {
      updateFields.push(`risk_level = $${paramCount}`);
      values.push(riskLevel);
      paramCount++;
    }
    if (negotiable !== undefined) {
      updateFields.push(`negotiable = $${paramCount}`);
      values.push(negotiable);
      paramCount++;
    }
    if (variablesUsed !== undefined) {
      updateFields.push(`variables_used = $${paramCount}`);
      values.push(variablesUsed);
      paramCount++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await pool.query(`
      UPDATE clauses SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Clause not found" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update clause:", error);
    res.status(500).json({ error: "Failed to update clause" });
  }
});

// ---------------------------------------------------------------------------
// DEBUG ENDPOINTS
// ---------------------------------------------------------------------------

router.get('/debug/variables-in-clauses', async (req, res) => {
  try {
    const clausesResult = await pool.query('SELECT content FROM clauses');
    const clausesList = clausesResult.rows;
    
    const variableSet = new Set<string>();
    
    clausesList.forEach((clause: any) => {
      const content = clause.content || '';
      const matches = content.match(/\{\{([A-Z_0-9]+)\}\}/g);
      if (matches) {
        matches.forEach((match: string) => {
          const varName = match.replace(/[{}]/g, '');
          variableSet.add(varName);
        });
      }
    });
    
    const variables = Array.from(variableSet).sort();
    
    res.json({
      totalVariables: variables.length,
      variables: variables,
      clausesChecked: clausesList.length
    });
    
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
