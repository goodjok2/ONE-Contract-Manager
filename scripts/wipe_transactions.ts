import { db } from "../server/db";
import { 
  contracts, 
  contractClauses, 
  projects, 
  projectUnits, 
  clients, 
  llcs,
  financials,
  projectDetails
} from "../shared/schema";

async function wipeTransactions() {
  console.log("🧹 Starting Transaction Wipe...");

  try {
    // 1. Delete Contract Data (The End Result)
    console.log("...Deleting Contract Clauses");
    await db.delete(contractClauses);

    console.log("...Deleting Contracts");
    await db.delete(contracts);

    // 2. Delete Project Data (The Source)
    // Note: Delete children of Project first
    console.log("...Deleting Project Units");
    await db.delete(projectUnits);

    console.log("...Deleting Project Details");
    await db.delete(projectDetails);

    console.log("...Deleting Financials");
    await db.delete(financials);

    console.log("...Deleting Projects");
    await db.delete(projects);

    // 3. Delete Entities (The Parents)
    console.log("...Deleting Auto-Generated LLCs");
    await db.delete(llcs); 

    console.log("...Deleting Clients");
    await db.delete(clients);

    console.log("✅ Success: All transaction data wiped. Configuration data remains.");
  } catch (error) {
    console.error("❌ Error wiping data:", error);
  }

  process.exit(0);
}

wipeTransactions();