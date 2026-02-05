// @ts-ignore - mammoth doesn't have type declarations
import mammoth from "mammoth";
import * as fs from "fs";

async function main() {
  const buffer = fs.readFileSync("server/templates/Master_Agreement_EF.docx");
  
  const styleMap = [
    "p[style-name='Heading 1'] => h1.heading1:fresh",
    "p[style-name='Heading 2'] => h2.heading2:fresh", 
    "p[style-name='Heading 3'] => h3.heading3:fresh",
    "p[style-name='Heading 4'] => h4.heading4:fresh",
    "p[style-name='Heading 5'] => h5.heading5:fresh",
    "p[style-name='Heading 6'] => h6.heading6:fresh",
    "p[style-name='Title'] => h1.title:fresh",
  ];
  
  const result = await mammoth.convertToHtml({ buffer }, { styleMap });
  const html = result.value;
  console.log("HTML length:", html.length);
  
  // Count headings
  const h1Count = (html.match(/<h1/g) || []).length;
  const h2Count = (html.match(/<h2/g) || []).length;
  const h3Count = (html.match(/<h3/g) || []).length;
  const h4Count = (html.match(/<h4/g) || []).length;
  const h5Count = (html.match(/<h5/g) || []).length;
  const h6Count = (html.match(/<h6/g) || []).length;
  console.log("H1:", h1Count, "H2:", h2Count, "H3:", h3Count, "H4:", h4Count, "H5:", h5Count, "H6:", h6Count);
  
  // Save to file
  fs.writeFileSync("/tmp/master_ef_html.txt", html);
  console.log("Saved to /tmp/master_ef_html.txt");
}

main();
