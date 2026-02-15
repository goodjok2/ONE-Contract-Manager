import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedMasterEFTemplate() {
  const client = await pool.connect();
  
  try {
    console.log('Checking for existing MASTER_EF template...');
    
    const existingTemplate = await client.query(
      `SELECT id FROM contract_templates WHERE contract_type = 'MASTER_EF' LIMIT 1`
    );
    
    let templateId: number;
    
    if (existingTemplate.rows.length > 0) {
      templateId = existingTemplate.rows[0].id;
      console.log(`MASTER_EF template already exists with ID ${templateId}`);
    } else {
      console.log('Creating MASTER_EF template...');
      const insertResult = await client.query(
        `INSERT INTO contract_templates (name, display_name, contract_type, status, version, is_active, organization_id)
         VALUES ('Master EF Agreement', 'Master EF Agreement', 'MASTER_EF', 'active', '1.0', true, 1)
         RETURNING id`
      );
      templateId = insertResult.rows[0].id;
      console.log(`Created MASTER_EF template with ID ${templateId}`);
    }
    
    const existingClauses = await client.query(
      `SELECT COUNT(*) as count FROM template_clauses WHERE template_id = $1`,
      [templateId]
    );
    
    if (parseInt(existingClauses.rows[0].count) > 0) {
      console.log(`Template ${templateId} already has ${existingClauses.rows[0].count} clauses linked. Skipping.`);
    } else {
      console.log('Populating template_clauses with MASTER_EF clauses...');
      
      const insertClauses = await client.query(
        `INSERT INTO template_clauses (template_id, clause_id, order_index)
         SELECT $1, id, ROW_NUMBER() OVER (ORDER BY "order", id) * 10
         FROM clauses 
         WHERE contract_types @> '["MASTER_EF"]'::jsonb
         ORDER BY "order", id`,
        [templateId]
      );
      
      console.log(`Inserted ${insertClauses.rowCount} clauses into template_clauses for template ${templateId}`);
    }
    
    const verifyResult = await client.query(
      `SELECT t.id, t.name, t.contract_type, 
              (SELECT COUNT(*) FROM template_clauses tc WHERE tc.template_id = t.id) as clause_count
       FROM contract_templates t
       WHERE t.contract_type = 'MASTER_EF'`
    );
    
    if (verifyResult.rows.length > 0) {
      const template = verifyResult.rows[0];
      console.log(`\nVerification:`);
      console.log(`  Template ID: ${template.id}`);
      console.log(`  Name: ${template.name}`);
      console.log(`  Contract Type: ${template.contract_type}`);
      console.log(`  Clause Count: ${template.clause_count}`);
    }
    
    console.log('\nMaster EF template seeding complete!');
    
  } finally {
    client.release();
    await pool.end();
  }
}

seedMasterEFTemplate().catch(console.error);
