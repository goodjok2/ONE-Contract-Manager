import { db } from "../server/db";
import { sql } from "drizzle-orm";

const TABLE_DEFINITIONS = [
  {
    variable_name: "PRICING_TABLE",
    columns: [
      { header: "Item", key: "item", type: "text", width: "40%" },
      { header: "Description", key: "desc", type: "text", width: "40%" },
      { header: "Cost", key: "cost", type: "currency", width: "20%" }
    ]
  },
  {
    variable_name: "PAYMENT_SCHEDULE_TABLE",
    columns: [
      { header: "Milestone", key: "milestone", type: "text", width: "50%" },
      { header: "Due Date", key: "due_date", type: "date", width: "20%" },
      { header: "Amount", key: "amount", type: "currency", width: "30%" }
    ]
  },
  {
    variable_name: "SIGNATURE_BLOCK_TABLE",
    columns: [
      { header: "Role", key: "role", type: "text", width: "30%" },
      { header: "Name", key: "name", type: "text", width: "40%" },
      { header: "Signature", key: "sign", type: "signature", width: "30%" }
    ]
  },
  {
    variable_name: "EXHIBIT_LIST_TABLE",
    columns: [
      { header: "Exhibit ID", key: "id", type: "text", width: "20%" },
      { header: "Exhibit Name", key: "name", type: "text", width: "80%" }
    ]
  }
];

async function updateTableDefinitions() {
  console.log("📋 Table Definitions Updater");
  console.log("=".repeat(60));

  for (const tableDef of TABLE_DEFINITIONS) {
    const columnsJson = JSON.stringify(tableDef.columns);
    
    try {
      const result = await db.execute(sql`
        UPDATE table_definitions 
        SET columns = ${columnsJson}::jsonb,
            updated_at = NOW()
        WHERE variable_name = ${tableDef.variable_name}
      `);
      
      console.log(`✅ ${tableDef.variable_name}: Updated with ${tableDef.columns.length} columns`);
    } catch (error) {
      console.error(`❌ ${tableDef.variable_name}: Failed -`, error);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Verification:");
  
  const verification = await db.execute(sql`
    SELECT variable_name, columns 
    FROM table_definitions 
    WHERE variable_name IN ('PRICING_TABLE', 'PAYMENT_SCHEDULE_TABLE', 'SIGNATURE_BLOCK_TABLE', 'EXHIBIT_LIST_TABLE')
    ORDER BY variable_name
  `);
  
  for (const row of verification.rows) {
    const cols = row.columns as any[];
    console.log(`   ${row.variable_name}: ${cols?.length || 0} columns defined`);
  }
  
  console.log("\n✅ Table definitions update complete!");
  process.exit(0);
}

updateTableDefinitions().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
