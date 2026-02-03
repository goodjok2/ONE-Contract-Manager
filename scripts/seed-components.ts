import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// =============================================================================
// BLOCK_ON_SITE_SCOPE_RECITALS - Recitals section election language
// =============================================================================

const BLOCK_ON_SITE_SCOPE_RECITALS_CRC = `
<p><strong>Option A – Client-Retained Contractor ("CRC")</strong></p>
<p>Client will engage and manage a licensed General Contractor of Client's choosing to perform all On-Site Services, including but not limited to: site preparation, foundation work, utility connections, module setting and installation, and completion work.</p>
<p>Under this option:</p>
<ul>
<li>Client contracts directly with and pays the General Contractor</li>
<li>Company retains approval authority over contractor selection</li>
<li>Company retains inspection and quality control authority per Exhibit F</li>
<li>General Contractor must comply with Company's installation specifications</li>
<li>Failure to meet Company standards may void all or part of Limited Warranty</li>
<li>On-Site Services costs are NOT included in this Agreement's pricing</li>
</ul>
<p>CLIENT'S ELECTION (initial one):</p>
<p>SELECTED OPTION: The {{ON_SITE_SERVICES_SELECTION}} ('On-Site Service') has been selected for this Agreement.</p>
`.trim();

const BLOCK_ON_SITE_SCOPE_RECITALS_CMOS = `
<p><strong>Option B – Company-Managed On-Site Services ("CMOS")</strong></p>
<p>Company will engage and manage qualified contractors to perform all On-Site Services under this Agreement.</p>
<p>Under this option:</p>
<ul>
<li>Company contracts with and manages all on-site contractors</li>
<li>Client's sole contractual relationship is with Company</li>
<li>All On-Site Services costs are included in this Agreement's pricing</li>
<li>Company is responsible for on-site work quality and performance</li>
<li>Full Limited Warranty coverage applies per Exhibit E</li>
</ul>
<p>CLIENT'S ELECTION (initial one):</p>
<p>SELECTED OPTION: The {{ON_SITE_SERVICES_SELECTION}} ('On-Site Service') has been selected for this Agreement.</p>
`.trim();

// =============================================================================
// BLOCK_ON_SITE_SCOPE_1.1_B - Section 1.1B Scope of Services
// =============================================================================

const BLOCK_ON_SITE_SCOPE_1_1_B_CRC = `
<p>On-Site Services (Item B above) are not included in this Agreement, Client is responsible to hire a licensed General Contractor, approved by Company, to prepare the site and complete all necessary work before the module(s) arrive at the site (see Exhibit C for details). Any contractor working on the Project must comply with Company's installation requirements to maintain warranty eligibility (see Exhibit F).</p>
<p>The Design Phase must be completed before the Production Phase begins. Transition between phases requires written confirmation from both parties (email or signed notice is acceptable). Either party may terminate this Agreement as set forth in Section 10 (Termination), with settlement of amounts due for completed work.</p>
`.trim();

const BLOCK_ON_SITE_SCOPE_1_1_B_CMOS = `
<ul>
<li><strong>Installation Services:</strong> Craning, setting, and installation supervision of modules.</li>
<li><strong>Site Construction Services:</strong> Site preparation, foundations, utilities, and completion work.</li>
</ul>
<p>The Design Phase must be completed before the Production Phase begins. Transition between phases requires written confirmation from both parties (email or signed notice is acceptable). Either party may terminate this Agreement as set forth in Section 10 (Termination), with settlement of amounts due for completed work.</p>
`.trim();

// =============================================================================
// BLOCK_ON_SITE_SCOPE_1.5 - Section 1.5 Site Readiness
// =============================================================================

const BLOCK_ON_SITE_SCOPE_1_5_CRC = `
<p>Client understands and acknowledges that all on-site preparation, foundation work, utility connections, crane staging, and post-delivery finish work are the Client's responsibility or that of Client's General Contractor as described in Exhibit F. If the site is not ready on schedule, delays and additional costs may apply, including storage fees for the module(s).</p>
`.trim();

const BLOCK_ON_SITE_SCOPE_1_5_CMOS = `
<p>Company will coordinate and manage all on-site preparation, foundation work, utility connections, crane staging, and post-delivery finish work under this Agreement. Company will ensure site readiness in coordination with the manufacturing and delivery schedule.</p>
`.trim();

// =============================================================================
// BLOCK_ON_SITE_SCOPE_3.1 - Section 3.1 Client Responsibilities
// =============================================================================

const BLOCK_ON_SITE_SCOPE_3_1_CRC = `
<p>The Client is responsible for coordinating consultants and contractors, including civil engineers, architects, and permitting consultants, to ensure their work aligns with the services provided by Company.</p>
<p>Client must promptly notify Company in writing of any facts or changes that may impact the design, permitting, site preparation, or installation of the home.</p>
`.trim();

const BLOCK_ON_SITE_SCOPE_3_1_CMOS = `
<p>Company will coordinate with consultants and contractors, including civil engineers, architects, and permitting consultants, as needed to complete the Project. Client must promptly notify Company in writing of any facts or changes that may impact the design, permitting, site preparation, or installation of the home.</p>
`.trim();

// =============================================================================
// BLOCK_ON_SITE_SCOPE_3.4 - Section 3.4 Client Responsibilities - GC Hiring
// =============================================================================

const BLOCK_ON_SITE_SCOPE_3_4_CRC = `
<p>The Client is responsible for hiring a licensed General Contractor to perform all required on-site work, including site preparation, foundation, utility connections, crane access, and post-delivery finish work as detailed in Exhibit F. Company's scope under this Agreement does not include On-Site Services. Client is solely responsible for contracting with, managing, and paying its General Contractor.</p>
<p>Client must:</p>
<ul>
<li>Enter into a written agreement with a licensed General Contractor for all on-site work in a timely manner.</li>
<li>Ensure that the General Contractor meets all requirements in Exhibit F (Contractor Requirements).</li>
<li>Ensure that the General Contractor performs all required tasks listed in Exhibit F, including any work that must be completed before delivery.</li>
<li>Provide Company with reasonable access to inspect and approve the General Contractor's work.</li>
</ul>
<p>Company retains authority to inspect and approve (or reject) Client's General Contractor's work. If the General Contractor's work does not meet Company's standards, Company may require corrections before proceeding with delivery or installation. Client is responsible for all costs associated with corrections.</p>
`.trim();

const BLOCK_ON_SITE_SCOPE_3_4_CMOS = `
<p>Company will engage and manage qualified contractors for all site construction work under this Agreement. Company will coordinate manufacturing delivery schedules with site readiness.</p>
`.trim();

// =============================================================================
// BLOCK_ON_SITE_SCOPE_5.3 - Section 5.3 Project Schedule and Delays
// =============================================================================

const BLOCK_ON_SITE_SCOPE_5_3_CRC = `
<p>Client shall ensure that the Site is ready to receive the Home on or before the scheduled delivery date, including completion of all site work listed in Exhibit F by Client's General Contractor or other contractors. If the Site is not ready as scheduled, Company may, at its sole discretion, (a) delay delivery and charge reasonable storage and handling fees; (b) reallocate delivery logistics and factory output as needed; and/or (c) require a Change Order to reschedule delivery and adjust the Total Contract Price accordingly.</p>
`.trim();

const BLOCK_ON_SITE_SCOPE_5_3_CMOS = `
<p>If Client has elected Company-Managed On-Site Services, such services will be provided by contractors engaged by Company under this Agreement. Company will coordinate manufacturing delivery schedules with site readiness. Client acknowledges that:</p>
<ul>
<li>Company maintains full responsibility for on-site contractors;</li>
<li>Client is not a party to contracts between Company and its contractors;</li>
<li>Company and Company's Contractors are responsible for on-site work quality and performance;</li>
</ul>
`.trim();

// =============================================================================
// Component definitions - all 12 components (6 tags × CRC/CMOS)
// =============================================================================

const components = [
  // BLOCK_ON_SITE_SCOPE_RECITALS
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_RECITALS",
    service_model: "CRC",
    description: "Recitals section — Client-Retained Contractor election language",
    content: BLOCK_ON_SITE_SCOPE_RECITALS_CRC,
    is_system: false,
  },
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_RECITALS",
    service_model: "CMOS",
    description: "Recitals section — Company-Managed On-Site Services election language",
    content: BLOCK_ON_SITE_SCOPE_RECITALS_CMOS,
    is_system: false,
  },
  // BLOCK_ON_SITE_SCOPE_1.1_B
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_1.1_B",
    service_model: "CRC",
    description: "Section 1.1B Scope of Services — CRC: On-Site not included",
    content: BLOCK_ON_SITE_SCOPE_1_1_B_CRC,
    is_system: false,
  },
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_1.1_B",
    service_model: "CMOS",
    description: "Section 1.1B Scope of Services — CMOS: Installation and site construction included",
    content: BLOCK_ON_SITE_SCOPE_1_1_B_CMOS,
    is_system: false,
  },
  // BLOCK_ON_SITE_SCOPE_1.5
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_1.5",
    service_model: "CRC",
    description: "Section 1.5 — CRC: Client responsible for all on-site prep",
    content: BLOCK_ON_SITE_SCOPE_1_5_CRC,
    is_system: false,
  },
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_1.5",
    service_model: "CMOS",
    description: "Section 1.5 — CMOS: Company manages site readiness",
    content: BLOCK_ON_SITE_SCOPE_1_5_CMOS,
    is_system: false,
  },
  // BLOCK_ON_SITE_SCOPE_3.1
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_3.1",
    service_model: "CRC",
    description: "Section 3.1 Client Responsibilities — CRC: Client coordinates consultants",
    content: BLOCK_ON_SITE_SCOPE_3_1_CRC,
    is_system: false,
  },
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_3.1",
    service_model: "CMOS",
    description: "Section 3.1 Client Responsibilities — CMOS: Company coordinates consultants",
    content: BLOCK_ON_SITE_SCOPE_3_1_CMOS,
    is_system: false,
  },
  // BLOCK_ON_SITE_SCOPE_3.4
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_3.4",
    service_model: "CRC",
    description: "Section 3.4 Client Responsibilities — CRC: Client hires GC with detailed obligations",
    content: BLOCK_ON_SITE_SCOPE_3_4_CRC,
    is_system: false,
  },
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_3.4",
    service_model: "CMOS",
    description: "Section 3.4 Client Responsibilities — CMOS: Company manages contractors",
    content: BLOCK_ON_SITE_SCOPE_3_4_CMOS,
    is_system: false,
  },
  // BLOCK_ON_SITE_SCOPE_5.3
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_5.3",
    service_model: "CRC",
    description: "Section 5.3 Project Schedule and Delays — CRC: Client ensures site ready",
    content: BLOCK_ON_SITE_SCOPE_5_3_CRC,
    is_system: false,
  },
  {
    tag_name: "BLOCK_ON_SITE_SCOPE_5.3",
    service_model: "CMOS",
    description: "Section 5.3 Project Schedule and Delays — CMOS: Company coordinates delivery with site",
    content: BLOCK_ON_SITE_SCOPE_5_3_CMOS,
    is_system: false,
  },
];

async function seedComponents() {
  const client = await pool.connect();
  
  try {
    console.log("Starting component library seeding (12 new components)...\n");
    
    const orgResult = await client.query(
      `SELECT id FROM organizations LIMIT 1`
    );
    
    if (orgResult.rows.length === 0) {
      console.error("No organization found. Please seed organizations first.");
      return;
    }
    
    const organizationId = orgResult.rows[0].id;
    console.log(`Using organization ID: ${organizationId}`);
    
    // Clear existing components
    const deleteResult = await client.query(`DELETE FROM component_library WHERE organization_id = $1`, [organizationId]);
    console.log(`Cleared ${deleteResult.rowCount} existing components\n`);
    
    for (const component of components) {
      console.log(`Creating component ${component.tag_name} (${component.service_model})...`);
      await client.query(
        `INSERT INTO component_library 
         (organization_id, tag_name, service_model, description, content, is_system)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [organizationId, component.tag_name, component.service_model, component.description, component.content, component.is_system]
      );
    }
    
    console.log("\nComponent library seeding complete!");
    console.log(`Total components created: ${components.length}`);
    
    // Verification
    const verifyResult = await client.query(`
      SELECT tag_name, service_model, is_system, length(content) as content_length
      FROM component_library 
      WHERE organization_id = $1
      ORDER BY tag_name, service_model
    `, [organizationId]);
    
    console.log("\nVerification:");
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.tag_name} (${row.service_model}): ${row.content_length} chars, is_system=${row.is_system}`);
    });
    
  } catch (error) {
    console.error("Error seeding components:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedComponents().catch(console.error);
