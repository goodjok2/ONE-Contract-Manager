import { db } from "../server/db";
import { tableDefinitions } from "../shared/schema";
import { sql } from "drizzle-orm";

interface ColumnDefinition {
  header: string;
  type: string;
  width: string;
}

interface TableDefinitionSeed {
  variableName: string;
  displayName: string;
  columns: ColumnDefinition[];
  description?: string;
}

const TABLE_DEFINITIONS: TableDefinitionSeed[] = [
  {
    variableName: "PRICING_TABLE",
    displayName: "Pricing Breakdown",
    columns: [],
    description: "Dynamic pricing breakdown table showing line items and totals"
  },
  {
    variableName: "PAYMENT_SCHEDULE_TABLE",
    displayName: "Payment Schedule",
    columns: [],
    description: "Payment milestone schedule with amounts and due dates"
  },
  {
    variableName: "SIGNATURE_BLOCK_TABLE",
    displayName: "Signature Block",
    columns: [],
    description: "Contract signature block with client and company signatures"
  },
  {
    variableName: "EXHIBIT_LIST_TABLE",
    displayName: "Exhibit List",
    columns: [],
    description: "List of contract exhibits and attachments"
  },
  {
    variableName: "CUSTOMER_ACKNOWLEDGE_TABLE",
    displayName: "Customer Acknowledgement",
    columns: [
      { header: "Term", type: "text", width: "80%" },
      { header: "Initials", type: "signature", width: "20%" }
    ],
    description: "Customer acknowledgement table with initialing requirements"
  },
  {
    variableName: "WHAT_HAPPENS_NEXT_TABLE",
    displayName: "Project Flow Table",
    columns: [],
    description: "Visual timeline of project phases and next steps"
  }
];

async function seedTableDefinitions(): Promise<void> {
  console.log("\n📊 Seeding Table Definitions");
  console.log("=".repeat(50));

  // Clear existing table definitions
  console.log("🗑️  Clearing existing table definitions...");
  await db.execute(sql`TRUNCATE TABLE table_definitions RESTART IDENTITY CASCADE`);

  // Insert each table definition
  for (const def of TABLE_DEFINITIONS) {
    await db.insert(tableDefinitions).values({
      variableName: def.variableName,
      displayName: def.displayName,
      columns: def.columns,
      description: def.description || null
    });
    console.log(`   ✓ ${def.variableName} -> "${def.displayName}"`);
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Seeded ${TABLE_DEFINITIONS.length} table definitions\n`);
}

seedTableDefinitions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Seed failed:", err);
    process.exit(1);
  });
