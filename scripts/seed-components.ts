import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BLOCK_ON_SITE_SCOPE_CRC = `
<p><strong>Option A – Client-Retained Contractor ("CRC")</strong></p>
<p>Client has elected to retain a separate licensed general contractor ("Site Contractor") to perform all on-site construction services, including but not limited to: site preparation, foundation work, utility connections, module setting and crane services, exterior finishing, and all other work required to complete the Home on the Site.</p>
<p>Company's scope of work under this Agreement is expressly limited to the design, engineering, manufacturing, and delivery of the modular components ("Modules") to the Site. Company shall have no responsibility for, and expressly disclaims any liability arising from, the on-site construction work performed by the Site Contractor or any other party retained by Client.</p>
<p>Client acknowledges and agrees that:</p>
<p>(i) Client is solely responsible for selecting, contracting with, and supervising the Site Contractor;</p>
<p>(ii) Client shall ensure the Site Contractor is properly licensed, insured, and qualified to perform the required work;</p>
<p>(iii) Company's Limited Warranty does not extend to any work performed by the Site Contractor;</p>
<p>(iv) Client shall coordinate with Company regarding delivery scheduling and Module placement requirements.</p>
`.trim();

const BLOCK_ON_SITE_SCOPE_CMOS = `
<p><strong>Option B – Company-Managed On-Site Services ("CMOS")</strong></p>
<p>Client has elected to have Company manage and coordinate all on-site construction services required to complete the Home on the Site. Company shall retain qualified subcontractors to perform site preparation, foundation work, utility connections, module setting and crane services, exterior finishing, and all other work required to complete the Home.</p>
<p>Company's scope of work under this Agreement includes the design, engineering, manufacturing, delivery, and installation of the modular components, as well as coordination of all on-site construction activities through substantial completion.</p>
<p>Client acknowledges and agrees that:</p>
<p>(i) Company shall select and manage all on-site subcontractors;</p>
<p>(ii) The Total Contract Price includes all on-site construction costs;</p>
<p>(iii) Company's Limited Warranty extends to the on-site work performed under Company's supervision;</p>
<p>(iv) Company shall provide a single point of contact for all construction-related matters.</p>
`.trim();

const BLOCK_WARRANTY_SECTION_CRC = `
<p><strong>Limited Warranty – Client-Retained Contractor Projects</strong></p>
<p>Company warrants the Modules manufactured by Company against defects in materials and workmanship for a period of one (1) year from the date of delivery to the Site ("Warranty Period"). This warranty covers only the modular components manufactured by Company and expressly excludes:</p>
<p>(i) Any defects or damage arising from transportation, handling, or storage after delivery;</p>
<p>(ii) Any work performed by the Site Contractor or other parties not employed by Company;</p>
<p>(iii) Normal wear and tear, cosmetic imperfections, or minor variations in materials;</p>
<p>(iv) Damage caused by misuse, neglect, or failure to maintain the Home;</p>
<p>(v) Any modifications or alterations made without Company's prior written approval.</p>
<p>Client's sole remedy under this warranty is repair or replacement, at Company's option, of the defective component. Company shall not be liable for any consequential, incidental, or indirect damages.</p>
`.trim();

const BLOCK_WARRANTY_SECTION_CMOS = `
<p><strong>Limited Warranty – Company-Managed On-Site Projects</strong></p>
<p>Company warrants the completed Home against defects in materials and workmanship for a period of one (1) year from the date of substantial completion ("Warranty Period"). This comprehensive warranty covers:</p>
<p>(i) The modular components manufactured by Company;</p>
<p>(ii) On-site construction work performed under Company's supervision;</p>
<p>(iii) Mechanical, electrical, and plumbing systems installed as part of the Home;</p>
<p>(iv) Foundation and structural elements.</p>
<p>This warranty expressly excludes:</p>
<p>(i) Normal wear and tear, cosmetic imperfections, or minor variations in materials;</p>
<p>(ii) Damage caused by misuse, neglect, or failure to maintain the Home;</p>
<p>(iii) Any modifications or alterations made without Company's prior written approval;</p>
<p>(iv) Landscaping, fencing, or other site improvements not included in the scope of work.</p>
<p>Client's sole remedy under this warranty is repair or replacement, at Company's option, of the defective component or workmanship. Company shall not be liable for any consequential, incidental, or indirect damages.</p>
`.trim();

const components = [
  {
    tag_name: "BLOCK_ON_SITE_SCOPE",
    service_model: "CRC",
    description: "On-site construction scope for Client-Retained Contractor projects",
    content: BLOCK_ON_SITE_SCOPE_CRC,
    is_system: true,
  },
  {
    tag_name: "BLOCK_ON_SITE_SCOPE",
    service_model: "CMOS",
    description: "On-site construction scope for Company-Managed On-Site projects",
    content: BLOCK_ON_SITE_SCOPE_CMOS,
    is_system: true,
  },
  {
    tag_name: "BLOCK_WARRANTY_SECTION",
    service_model: "CRC",
    description: "Warranty terms for Client-Retained Contractor projects",
    content: BLOCK_WARRANTY_SECTION_CRC,
    is_system: true,
  },
  {
    tag_name: "BLOCK_WARRANTY_SECTION",
    service_model: "CMOS",
    description: "Warranty terms for Company-Managed On-Site projects",
    content: BLOCK_WARRANTY_SECTION_CMOS,
    is_system: true,
  },
];

async function seedComponents() {
  const client = await pool.connect();
  
  try {
    console.log("Starting component library seeding...");
    
    const orgResult = await client.query(
      `SELECT id FROM organizations LIMIT 1`
    );
    
    if (orgResult.rows.length === 0) {
      console.error("No organization found. Please seed organizations first.");
      return;
    }
    
    const organizationId = orgResult.rows[0].id;
    console.log(`Using organization ID: ${organizationId}`);
    
    for (const component of components) {
      const existingResult = await client.query(
        `SELECT id FROM component_library 
         WHERE organization_id = $1 AND tag_name = $2 AND service_model = $3`,
        [organizationId, component.tag_name, component.service_model]
      );
      
      if (existingResult.rows.length > 0) {
        console.log(`Component ${component.tag_name} (${component.service_model}) already exists, updating...`);
        await client.query(
          `UPDATE component_library SET 
           content = $1, description = $2, is_system = $3, updated_at = NOW()
           WHERE id = $4`,
          [component.content, component.description, component.is_system, existingResult.rows[0].id]
        );
      } else {
        console.log(`Creating component ${component.tag_name} (${component.service_model})...`);
        await client.query(
          `INSERT INTO component_library 
           (organization_id, tag_name, service_model, description, content, is_system)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [organizationId, component.tag_name, component.service_model, component.description, component.content, component.is_system]
        );
      }
    }
    
    console.log("Component library seeding complete!");
    
  } catch (error) {
    console.error("Error seeding components:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedComponents().catch(console.error);
