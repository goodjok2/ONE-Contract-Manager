# DIAGNOSTIC PROMPT: Debug Step 3 Party Info — Silent Save Failure

## Problem
In the 9-step Contract Wizard (`/generate-contracts`), Step 3 "Party Info" allows users to create new Manufacturer and On-Site Contractor entities. When the user fills out the form and clicks Save, nothing happens — no error message, no success, the dialog just stays open or closes without saving. This blocks all progress through the wizard since you can't get past Step 3.

## What to Investigate

### 1. Check if the `contractor_entities` table exists in the database

Run this SQL:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'contractor_entities';
SELECT * FROM contractor_entities LIMIT 5;
```

If the table doesn't exist, check `shared/schema.ts` for the `contractorEntities` table definition. It should look like:
```typescript
export const contractorEntities = pgTable("contractor_entities", {
  id: serial("id").primaryKey(),
  contractorType: text("contractor_type").notNull(), // 'manufacturer', 'onsite'
  legalName: text("legal_name").notNull(),
  formationState: text("formation_state"),
  entityType: text("entity_type"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  licenseNumber: text("license_number"),
  licenseState: text("license_state"),
  licenseExpiration: text("license_expiration"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  bondAmount: integer("bond_amount"),
  insuranceAmount: integer("insurance_amount"),
  insuranceExpiration: text("insurance_expiration"),
  insuranceCarrier: text("insurance_carrier"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
```

If the table definition exists in schema.ts but the table doesn't exist in the database, run a migration: `npx drizzle-kit push`

### 2. Check if the API routes exist

Look in `server/routes/projects.ts` for these four endpoints:
```
GET  /api/contractor-entities
GET  /api/contractor-entities/type/:type
POST /api/contractor-entities
PATCH /api/contractor-entities/:id
```

If they don't exist, add them:

```typescript
// GET all active contractor entities
router.get("/contractor-entities", async (req, res) => {
  try {
    let query = db.select().from(contractorEntities).where(eq(contractorEntities.isActive, true));
    const results = await query;
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET contractor entities by type (manufacturer or onsite)
router.get("/contractor-entities/type/:type", async (req, res) => {
  try {
    const contractorType = req.params.type;
    const results = await db.select()
      .from(contractorEntities)
      .where(and(
        eq(contractorEntities.contractorType, contractorType),
        eq(contractorEntities.isActive, true)
      ));
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST create new contractor entity
router.post("/contractor-entities", async (req, res) => {
  try {
    const [result] = await db.insert(contractorEntities).values(req.body).returning();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH update contractor entity
router.patch("/contractor-entities/:id", async (req, res) => {
  try {
    const entityId = parseInt(req.params.id);
    const [result] = await db
      .update(contractorEntities)
      .set(req.body)
      .where(eq(contractorEntities.id, entityId))
      .returning();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
```

Make sure to import `contractorEntities` from the schema and `and` from drizzle-orm.

### 3. Check the frontend mutation error handling

Open `client/src/components/wizard/steps/Step3PartyInfo.tsx` and find the `createContractorMutation`. The `mutationFn` should be:
```typescript
const createContractorMutation = useMutation({
  mutationFn: async (data: Partial<ContractorEntity> & { contractorType: string; legalName: string }) => {
    const response = await apiRequest('POST', '/api/contractor-entities', data);
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/contractor-entities'] });
    queryClient.invalidateQueries({ queryKey: ['/api/contractor-entities/type/manufacturer'] });
    queryClient.invalidateQueries({ queryKey: ['/api/contractor-entities/type/onsite'] });
  },
});
```

**Common failure:** If `apiRequest` doesn't call `.json()` on the response, the mutation resolves but returns undefined, causing the `handleSaveManufacturer` function to silently fail when it tries to read `result.legalName` or `result.id`.

### 4. Add console logging to pinpoint the failure

Temporarily add this to `handleSaveManufacturer`:
```typescript
const handleSaveManufacturer = async () => {
  console.log('=== handleSaveManufacturer called ===');
  console.log('isEditMode:', isEditMode, 'editingContractorId:', editingContractorId);
  console.log('contractorForm:', contractorForm);
  try {
    // ... existing logic
    console.log('result:', result);
  } catch (error) {
    console.error('Failed to save manufacturer:', error);
  }
};
```

Then open browser DevTools Console, try to save a manufacturer, and report what logs appear.

### 5. Test the API directly

Open the browser DevTools Network tab, then try to save. Look for a POST request to `/api/contractor-entities`. Check:
- Does the request fire at all?
- What's the response status? (200, 404, 500?)
- What's in the response body?

If the request doesn't fire, the issue is in the frontend form/button wiring.
If it fires but returns 404, the route doesn't exist.
If it fires but returns 500, check the server console for the error.

## Expected Outcome
After this diagnostic, either:
1. The `contractor_entities` table is created and routes added → saving works
2. The routes exist but `.json()` parsing is missing → fix the mutation
3. A different issue is identified → report what was found

## Do Not
- Do NOT modify the wizard shell, steps, or context
- Do NOT create new wizard pages or routes
- Do NOT change Step 3's UI layout
- ONLY fix the specific API/schema issue that prevents saving
