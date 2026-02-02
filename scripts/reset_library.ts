import { db } from "../server/db";
import { clauses, contractTemplates } from "../shared/schema";

async function resetLibrary() {
  console.log("Starting cleanup...");

  try {
    // 1. Delete all clauses
    console.log("Deleting clauses...");
    await db.delete(clauses);

    // 2. Delete all contract templates (Optional - strictly ensures no bad links)
    console.log("Deleting contract templates...");
    await db.delete(contractTemplates);

    console.log("✅ Success: Clause library has been wiped clean.");
  } catch (error) {
    console.error("❌ Error clearing tables:", error);
  }

  process.exit(0);
}

resetLibrary();