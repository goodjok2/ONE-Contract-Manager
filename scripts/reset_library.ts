import { db } from "../server/db";
// We need to import the junction table to delete from it first
import { clauses, contractTemplates, templateClauses } from "../shared/schema"; 

async function resetLibrary() {
  console.log("Starting cleanup...");

  try {
    // 1. Delete the LINKS first (The junction table)
    console.log("Deleting template links...");
    await db.delete(templateClauses);

    // 2. NOW it is safe to delete the CLAUSES
    console.log("Deleting clauses...");
    await db.delete(clauses);

    // 3. Finally, delete the TEMPLATES
    console.log("Deleting contract templates...");
    await db.delete(contractTemplates);

    console.log("✅ Success: Clause library has been wiped clean.");
  } catch (error) {
    console.error("❌ Error clearing tables:", error);
  }

  process.exit(0);
}

resetLibrary();