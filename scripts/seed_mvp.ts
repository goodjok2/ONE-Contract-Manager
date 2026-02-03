import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedMvpData() {
  console.log("Starting MVP seed...");
  
  try {
    await pool.query("BEGIN");

    // 1. Create default organization (Dvele)
    const orgResult = await pool.query(`
      INSERT INTO organizations (id, name, slug, created_at)
      VALUES (1, 'Dvele', 'dvele', NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
      RETURNING *
    `);
    console.log("Organization created:", orgResult.rows[0]);

    // Reset the sequence if needed
    await pool.query(`SELECT setval('organizations_id_seq', (SELECT MAX(id) FROM organizations))`);

    // 2. Create default admin user
    const userResult = await pool.query(`
      INSERT INTO users (organization_id, email, name, role, created_at)
      VALUES (1, 'admin@dvele.com', 'Dvele Admin', 'admin', NOW())
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING *
    `);
    console.log("Admin user created:", userResult.rows[0]);

    // 3. Seed initial home models
    const homeModels = [
      { name: 'Trinity', modelCode: 'TRI-01', sqFt: 750, bedrooms: 1, bathrooms: 1, designFee: 1500000, offsiteBasePrice: 25000000, onsiteEstPrice: 8000000 },
      { name: 'Salt Point', modelCode: 'SP-01', sqFt: 1200, bedrooms: 2, bathrooms: 2, designFee: 2000000, offsiteBasePrice: 35000000, onsiteEstPrice: 12000000 },
      { name: 'Sonoma', modelCode: 'SON-01', sqFt: 1800, bedrooms: 3, bathrooms: 2, designFee: 2500000, offsiteBasePrice: 45000000, onsiteEstPrice: 15000000 },
      { name: 'Carmel', modelCode: 'CAR-01', sqFt: 2400, bedrooms: 4, bathrooms: 3, designFee: 3000000, offsiteBasePrice: 55000000, onsiteEstPrice: 18000000 },
    ];

    for (const model of homeModels) {
      await pool.query(`
        INSERT INTO home_models (organization_id, name, model_code, sq_ft, bedrooms, bathrooms, design_fee, offsite_base_price, onsite_est_price, created_at)
        VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT DO NOTHING
      `, [model.name, model.modelCode, model.sqFt, model.bedrooms, model.bathrooms, model.designFee, model.offsiteBasePrice, model.onsiteEstPrice]);
    }
    console.log("Home models seeded:", homeModels.length);

    // 4. Update existing LLCs to belong to organization 1
    const llcsUpdated = await pool.query(`
      UPDATE llcs SET organization_id = 1 WHERE organization_id IS NULL
    `);
    console.log("LLCs linked to org 1:", llcsUpdated.rowCount);

    // 5. Seed contractor entities (default manufacturers)
    await pool.query(`
      INSERT INTO contractor_entities (organization_id, legal_name, contractor_type, entity_type, state, created_at)
      VALUES (1, 'Dvele AZ, LLC', 'manufacturer', 'LLC', 'AZ', NOW())
      ON CONFLICT DO NOTHING
    `);
    console.log("Contractor entities seeded");

    // 6. Update existing projects to belong to organization 1
    const projectsUpdated = await pool.query(`
      UPDATE projects SET organization_id = 1 WHERE organization_id IS NULL
    `);
    console.log("Projects linked to org 1:", projectsUpdated.rowCount);

    // 7. Update existing contracts to belong to organization 1
    const contractsUpdated = await pool.query(`
      UPDATE contracts SET organization_id = 1 WHERE organization_id IS NULL
    `);
    console.log("Contracts linked to org 1:", contractsUpdated.rowCount);

    await pool.query("COMMIT");
    console.log("MVP seed completed successfully!");
    
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error("Error seeding MVP data:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedMvpData();
