import { db } from "../server/db";
// CHECK: Is it 'templateClauses' or 'template_clauses' in your schema file?
// I have switched it to 'template_clauses' below as a guess.
import { clauses, contractTemplates, template_clauses } from "../shared/schema"; 

async function resetLibrary() {
  console.log("Starting cleanup...");

  try {
    // 1. Delete the LINKS first (Child table)
    console.log("Deleting template links...");
    await db.delete(template_clauses); // Use the variable name here

    // 2. Delete the CLAUSES (Parent table)
    console.log("Deleting clauses...");
    await db.delete(clauses);

    // 3. Delete the TEMPLATES
    console.log("Deleting contract templates...");
    await db.delete(contractTemplates);

    console.log("✅ Success: Clause library has been wiped clean.");
  } catch (error) {
    console.error("❌ Error clearing tables:", error);
  }

  process.exit(0);
}

resetLibrary();