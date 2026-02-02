import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addCustomTable() {
  const variableName = "Client Signature_TABLE";
  const displayName = "Client Initials";
  const description = "Table for client initials on specific terms.";
  const columns = JSON.stringify([
    { header: "Term", key: "term", type: "text", width: "80%" },
    { header: "Initials", key: "initials", type: "signature", width: "20%" }
  ]);

  try {
    // Upsert: Insert or update the table definition
    const result = await pool.query(
      `INSERT INTO table_definitions (variable_name, display_name, description, columns, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (variable_name) 
       DO UPDATE SET 
         display_name = EXCLUDED.display_name,
         description = EXCLUDED.description,
         columns = EXCLUDED.columns
       RETURNING *`,
      [variableName, displayName, description, columns]
    );

    console.log("Custom table definition upserted successfully:");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("Error adding custom table:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

addCustomTable();
