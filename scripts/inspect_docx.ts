import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import { parseStringPromise } from "xml2js";

interface StyleInfo {
  count: number;
  examples: string[];
}

async function inspectDocx(filePath: string): Promise<void> {
  console.log(`\n📄 DOCX Style Inspector`);
  console.log(`   File: ${filePath}\n`);
  console.log("=".repeat(80));

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const zip = new AdmZip(filePath);
  const documentXml = zip.readAsText("word/document.xml");

  const doc = await parseStringPromise(documentXml, { 
    explicitArray: true,
    preserveChildrenOrder: true
  });

  const styles = new Map<string, StyleInfo>();

  // Extract text from w:t elements only
  function getTextContent(node: any): string {
    if (!node) return "";
    
    // Handle text nodes directly
    if (typeof node === "string") return node;
    
    // Handle w:t text elements
    if (node["w:t"]) {
      const textNodes = node["w:t"];
      if (Array.isArray(textNodes)) {
        return textNodes.map((t: any) => {
          if (typeof t === "string") return t;
          if (t._) return t._;
          if (t.$ && typeof t === "object") return "";
          return "";
        }).join("");
      }
    }
    
    // Handle w:r run elements
    if (node["w:r"]) {
      const runs = node["w:r"];
      if (Array.isArray(runs)) {
        return runs.map(getTextContent).join("");
      }
    }
    
    // Recursively handle arrays
    if (Array.isArray(node)) {
      return node.map(getTextContent).join("");
    }
    
    // Recursively handle objects (but skip non-text elements)
    if (typeof node === "object") {
      let text = "";
      for (const key of Object.keys(node)) {
        if (key === "w:r" || key === "w:t") {
          text += getTextContent(node[key]);
        }
      }
      return text;
    }
    
    return "";
  }

  function traverseParagraphs(body: any): void {
    if (!body) return;

    const paragraphs = body["w:p"];
    if (!paragraphs) return;

    const paraArray = Array.isArray(paragraphs) ? paragraphs : [paragraphs];

    paraArray.forEach((para: any) => {
      let styleId = "Normal";

      // Get paragraph properties
      const pPr = para["w:pPr"];
      if (pPr && Array.isArray(pPr) && pPr[0]) {
        const props = pPr[0];
        if (props["w:pStyle"] && Array.isArray(props["w:pStyle"]) && props["w:pStyle"][0]) {
          const pStyle = props["w:pStyle"][0];
          if (pStyle.$ && pStyle.$["w:val"]) {
            styleId = pStyle.$["w:val"];
          }
        }
      }

      // Get text content
      const text = getTextContent(para).trim();

      if (!styles.has(styleId)) {
        styles.set(styleId, { count: 0, examples: [] });
      }

      const info = styles.get(styleId)!;
      info.count++;

      if (info.examples.length < 3 && text.length > 0) {
        info.examples.push(text.slice(0, 120));
      }
    });
  }

  const body = doc["w:document"]?.["w:body"];
  if (body && Array.isArray(body)) {
    traverseParagraphs(body[0]);
  }

  // Print results sorted by style name
  console.log("\n📋 DISTINCT PARAGRAPH STYLE IDs FOUND:\n");

  const sortedStyles = Array.from(styles.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  sortedStyles.forEach(([styleId, info]) => {
    console.log(`\n🔹 Style: "${styleId}" (${info.count} paragraphs)`);
    if (info.examples.length > 0) {
      console.log("   Example text:");
      info.examples.forEach((example, i) => {
        const truncated = example.length > 100 ? example.slice(0, 100) + "..." : example;
        console.log(`     ${i + 1}. "${truncated}"`);
      });
    } else {
      console.log("   (No text content - likely empty or structural)");
    }
  });

  console.log("\n" + "=".repeat(80));
  console.log(`\n📊 SUMMARY`);
  console.log(`   Total distinct styles: ${styles.size}`);
  
  // Group by heading levels
  const headingStyles = sortedStyles.filter(([id]) => id.startsWith("Heading"));
  console.log(`   Heading styles found: ${headingStyles.map(([id]) => id).join(", ") || "None"}`);
  
  console.log("\n");
}

// Main execution
const templatePath = path.join(process.cwd(), "server", "templates", "ONE_Agreement_Master.docx");

inspectDocx(templatePath).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
