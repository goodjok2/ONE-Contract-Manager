const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>CONSTRUCTION CONTRACT</w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:t>Project Number: {PROJECT_NUMBER}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Project Name: {PROJECT_NAME}</w:t></w:r></w:p>
    <w:p><w:r><w:t>State: {PROJECT_STATE}</w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:t>CLIENT INFORMATION</w:t></w:r></w:p>
    <w:p><w:r><w:t>Legal Name: {CLIENT_LEGAL_NAME}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Address: {CLIENT_ADDRESS}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Email: {CLIENT_EMAIL}</w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:t>LLC ENTITY</w:t></w:r></w:p>
    <w:p><w:r><w:t>Entity Name: {DVELE_PARTNERS_XYZ}</w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:t>FINANCIAL TERMS</w:t></w:r></w:p>
    <w:p><w:r><w:t>Design Fee: {DESIGN_FEE}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Preliminary Offsite Price: {PRELIMINARY_OFFSITE_PRICE}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Preliminary Onsite Price: {PRELIMINARY_ONSITE_PRICE}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Preliminary Total: {PRELIMINARY_TOTAL_PRICE}</w:t></w:r></w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p><w:r><w:t>Building Code Reference: {BUILDING_CODE_REFERENCE}</w:t></w:r></w:p>
  </w:body>
</w:document>`;

const zip = new PizZip();

zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

zip.file('word/document.xml', content);

const out = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
const outputPath = path.join(__dirname, 'template.docx');
fs.writeFileSync(outputPath, out);
console.log('Template created successfully at:', outputPath);
