import mammoth from "mammoth";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";
import { db } from "../server/db";
import { clauses } from "../shared/schema";
import { sql } from "drizzle-orm";

// =============================================================================
// CONFIGURATION
// =============================================================================

const TEMPLATE_PATH = path.join(process.cwd(), "server", "templates", "ONE_Agreement_Master.docx");

// Contract types this template belongs to
const CONTRACT_TYPES = ["ONE"];

// Regex patterns for detecting list items (Roman numerals, letters)
const LIST_ITEM_REGEX = /^\s*(\(?[ivxIVX]+\.?\)?|[a-z]\.|\([a-z]\))\s+/;

// =============================================================================
// MAMMOTH STYLE MAPPING
// =============================================================================

const styleMap = [
  "p[style-name='Title'] => h1.title",
  "p[style-name='Heading 1'] => h1",
  "p[style-name='Heading 2'] => h2",
  "p[style-name='Heading 3'] => h3",
  "p[style-name='Heading 4'] => h4",
  "p[style-name='Heading 5'] => h5",
  "p[style-name='Heading 6'] => h6",
];

// =============================================================================
// SMART LEVEL DETECTION
// =============================================================================

interface SmartLevelResult {
  level: number;
  isListItem: boolean;
}

function getSmartLevel(tagName: string, text: string): SmartLevelResult {
  const tag = tagName.toLowerCase();
  
  switch (tag) {
    case "h1":
      return { level: 1, isListItem: false };
    case "h2":
      return { level: 2, isListItem: false };
    case "h3":
      return { level: 3, isListItem: false };
    case "h4":
      return { level: 4, isListItem: false };
    case "h6":
      // Heading 6 = Level 6 (Conspicuous text)
      return { level: 6, isListItem: false };
    case "h5":
      // Smart detection: Check if it's a Roman numeral list item
      if (LIST_ITEM_REGEX.test(text)) {
        return { level: 7, isListItem: true };
      }
      // Otherwise it's a standard Level 5 clause
      return { level: 5, isListItem: false };
    default:
      return { level: 0, isListItem: false };
  }
}

// =============================================================================
// SLUG GENERATION
// =============================================================================

function generateSlug(headerText: string, level: number, order: number): string {
  // Create a URL-friendly slug from the header text
  const cleanText = headerText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);
  
  return `l${level}-${order}-${cleanText || "clause"}`;
}

// =============================================================================
// MAIN INGESTOR
// =============================================================================

async function ingestDocument(): Promise<void> {
  console.log("\n📄 Smart Atomic Clause Ingestor");
  console.log("=".repeat(60));
  console.log(`Template: ${TEMPLATE_PATH}`);
  console.log(`Contract Types: ${CONTRACT_TYPES.join(", ")}`);
  console.log("");

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`❌ Template file not found: ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  // Step 1: Truncate existing clauses
  console.log("🗑️  Truncating clauses table...");
  await db.execute(sql`TRUNCATE TABLE clauses RESTART IDENTITY CASCADE`);
  console.log("   ✓ Table truncated\n");

  // Step 2: Convert DOCX to HTML using mammoth
  console.log("📖 Converting DOCX to HTML...");
  const buffer = fs.readFileSync(TEMPLATE_PATH);
  const result = await mammoth.convertToHtml({ buffer }, { styleMap });
  
  if (result.messages.length > 0) {
    console.log("   Mammoth messages:");
    result.messages.forEach((msg) => console.log(`     - ${msg.message}`));
  }
  console.log("   ✓ Conversion complete\n");

  // Step 3: Parse HTML with cheerio
  console.log("🔍 Parsing HTML structure...");
  const $ = cheerio.load(result.value);
  
  // Parent stack: tracks the current parent ID for each level
  const parents: { [level: number]: number | null } = {
    1: null, 2: null, 3: null, 4: null, 
    5: null, 6: null, 7: null, 8: null
  };

  // Track the last inserted clause for body text appending
  let lastClauseId: number | null = null;
  let lastClauseLevel: number = 0;

  // Counters
  let totalClauses = 0;
  let romanNumeralLists = 0;
  let bodyAppendCount = 0;
  let orderCounter = 0;

  // Collect all direct children elements
  const elements = $("body").children().toArray();
  console.log(`   Found ${elements.length} top-level elements\n`);

  console.log("📝 Processing elements...");

  for (const el of elements) {
    const $el = $(el);
    const tagName = (el as any).tagName?.toLowerCase() || (el as any).name?.toLowerCase() || "";
    const text = $el.text().trim();
    const html = $el.html() || "";

    // Skip empty elements
    if (!text && !html) continue;

    // Check if this is a heading element
    const isHeading = /^h[1-6]$/.test(tagName);

    if (isHeading) {
      // Determine the smart level
      const { level: targetLevel, isListItem } = getSmartLevel(tagName, text);

      if (targetLevel === 0) continue;

      if (isListItem) {
        romanNumeralLists++;
      }

      // Get parent ID - find nearest ancestor (not just one level up)
      let parentId: number | null = null;
      if (targetLevel > 1) {
        for (let i = targetLevel - 1; i >= 1; i--) {
          if (parents[i] !== null) {
            parentId = parents[i];
            break;
          }
        }
      }

      // Generate slug
      orderCounter++;
      const slug = generateSlug(text, targetLevel, orderCounter);

      // Insert the clause
      const [inserted] = await db.insert(clauses).values({
        slug,
        headerText: text,
        bodyHtml: null, // Body will be appended from following paragraphs
        level: targetLevel,
        parentId,
        order: orderCounter * 10, // Leave gaps for future insertions
        contractTypes: CONTRACT_TYPES,
        tags: isListItem ? ["list-item"] : [],
      }).returning();

      // Update parent stack
      parents[targetLevel] = inserted.id;

      // Clear lower-level parents (they're no longer active)
      for (let i = targetLevel + 1; i <= 8; i++) {
        parents[i] = null;
      }

      // Track last clause for body appending
      lastClauseId = inserted.id;
      lastClauseLevel = targetLevel;
      totalClauses++;

      // Progress logging (every 50 clauses)
      if (totalClauses % 50 === 0) {
        console.log(`   ... processed ${totalClauses} clauses`);
      }

    } else if (tagName === "p" && lastClauseId !== null) {
      // This is a paragraph - append to the last clause's bodyHtml
      const currentClause = await db.select().from(clauses).where(sql`id = ${lastClauseId}`);
      
      if (currentClause.length > 0) {
        const existingBody = currentClause[0].bodyHtml || "";
        const newBody = existingBody + (existingBody ? "\n" : "") + `<p>${html}</p>`;
        
        await db.update(clauses)
          .set({ bodyHtml: newBody })
          .where(sql`id = ${lastClauseId}`);
        
        bodyAppendCount++;
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 INGESTION SUMMARY");
  console.log("=".repeat(60));
  console.log(`   Total clauses created: ${totalClauses}`);
  console.log(`   Roman numeral list items (L7): ${romanNumeralLists}`);
  console.log(`   Body paragraphs appended: ${bodyAppendCount}`);
  console.log(`   Contract types: ${CONTRACT_TYPES.join(", ")}`);
  console.log("");

  // Show level distribution
  const levelDist = await db.execute(sql`
    SELECT level, COUNT(*) as count 
    FROM clauses 
    GROUP BY level 
    ORDER BY level
  `);
  
  console.log("📈 Level Distribution:");
  for (const row of levelDist.rows as any[]) {
    console.log(`   Level ${row.level}: ${row.count} clauses`);
  }

  console.log("\n✅ Ingestion complete!\n");
}

// =============================================================================
// EXECUTION
// =============================================================================

ingestDocument()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Ingestion failed:", err);
    process.exit(1);
  });
