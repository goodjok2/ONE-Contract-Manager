# Prompt 3: Populate Component Library + Fix CRUD + Generalize Resolver

## Context
We just re-ingested the ONE Agreement with 235 clauses. All `{{BLOCK_*}}` placeholders are stored literally in clause `body_html`. Now we need the Component Library to contain the actual CRC and CMOS content that these placeholders resolve to at contract generation time.

**Current state:**
- `component_library` table has 4 records (BLOCK_ON_SITE_SCOPE × CRC/CMOS, BLOCK_WARRANTY_SECTION × CRC/CMOS) — all with `is_system: true`
- The DOCX now uses 6 **section-specific** block variable names (listed below) but the resolver in `server/services/component-library.ts` only handles the old 2 generic names
- The admin UI at `/admin` → Components has full CRUD but delete is blocked for `is_system: true` components
- The `resolveComponentTags()` function in `server/services/component-library.ts` is **hardcoded** — it checks `if (result.includes('{{BLOCK_ON_SITE_SCOPE}}'))` instead of doing a generic regex match against all `{{BLOCK_*}}` tags

## Tasks

### Task 1: Purge Old Components and Seed New Ones

Delete ALL existing `component_library` records and insert the 12 new ones below. Also delete the hardcoded fallback constants from `server/services/component-library.ts` (the `BLOCK_ON_SITE_SCOPE_CRC`, `BLOCK_ON_SITE_SCOPE_CMOS`, `BLOCK_WARRANTY_SECTION_CRC`, `BLOCK_WARRANTY_SECTION_CMOS` constants and the `HARDCODED_COMPONENTS` map) — the DB is now the single source of truth.

Update `scripts/seed-components.ts` to seed these 12 components instead of the old 4.

**All 12 components** (6 tag_names × CRC and CMOS variants):

---

#### 1. `BLOCK_ON_SITE_SCOPE_RECITALS` — CRC variant
**description:** Recitals section — Client-Retained Contractor election language
**service_model:** CRC
**is_system:** false
**content:**
```html
<p><strong>Option A – Client-Retained Contractor ("CRC")</strong></p>
<p>Client will engage and manage a licensed General Contractor of Client's choosing to perform all On-Site Services, including but not limited to: site preparation, foundation work, utility connections, module setting and installation, and completion work.</p>
<p>Under this option:</p>
<ul>
<li>Client contracts directly with and pays the General Contractor</li>
<li>Company retains approval authority over contractor selection</li>
<li>Company retains inspection and quality control authority per Exhibit F</li>
<li>General Contractor must comply with Company's installation specifications</li>
<li>Failure to meet Company standards may void all or part of Limited Warranty</li>
<li>On-Site Services costs are NOT included in this Agreement's pricing</li>
</ul>
<p>CLIENT'S ELECTION (initial one):</p>
<p>SELECTED OPTION: The {{ON_SITE_SERVICES_SELECTION}} ('On-Site Service') has been selected for this Agreement.</p>
```

#### 2. `BLOCK_ON_SITE_SCOPE_RECITALS` — CMOS variant
**description:** Recitals section — Company-Managed On-Site Services election language
**service_model:** CMOS
**is_system:** false
**content:**
```html
<p><strong>Option B – Company-Managed On-Site Services ("CMOS")</strong></p>
<p>Company will engage and manage qualified contractors to perform all On-Site Services under this Agreement.</p>
<p>Under this option:</p>
<ul>
<li>Company contracts with and manages all on-site contractors</li>
<li>Client's sole contractual relationship is with Company</li>
<li>All On-Site Services costs are included in this Agreement's pricing</li>
<li>Company is responsible for on-site work quality and performance</li>
<li>Full Limited Warranty coverage applies per Exhibit E</li>
</ul>
<p>CLIENT'S ELECTION (initial one):</p>
<p>SELECTED OPTION: The {{ON_SITE_SERVICES_SELECTION}} ('On-Site Service') has been selected for this Agreement.</p>
```

---

#### 3. `BLOCK_ON_SITE_SCOPE_1.1_B` — CRC variant
**description:** Section 1.1B Scope of Services — CRC: On-Site not included
**service_model:** CRC
**is_system:** false
**content:**
```html
<p>On-Site Services (Item B above) are not included in this Agreement, Client is responsible to hire a licensed General Contractor, approved by Company, to prepare the site and complete all necessary work before the module(s) arrive at the site (see Exhibit C for details). Any contractor working on the Project must comply with Company's installation requirements to maintain warranty eligibility (see Exhibit F).</p>
<p>The Design Phase must be completed before the Production Phase begins. Transition between phases requires written confirmation from both parties (email or signed notice is acceptable). Either party may terminate this Agreement as set forth in Section 10 (Termination), with settlement of amounts due for completed work.</p>
```

#### 4. `BLOCK_ON_SITE_SCOPE_1.1_B` — CMOS variant
**description:** Section 1.1B Scope of Services — CMOS: Installation and site construction included
**service_model:** CMOS
**is_system:** false
**content:**
```html
<ul>
<li><strong>Installation Services:</strong> Craning, setting, and installation supervision of modules.</li>
<li><strong>Site Construction Services:</strong> Site preparation, foundations, utilities, and completion work.</li>
</ul>
<p>The Design Phase must be completed before the Production Phase begins. Transition between phases requires written confirmation from both parties (email or signed notice is acceptable). Either party may terminate this Agreement as set forth in Section 10 (Termination), with settlement of amounts due for completed work.</p>
```

---

#### 5. `BLOCK_ON_SITE_SCOPE_1.5` — CRC variant
**description:** Section 1.5 — CRC: Client responsible for all on-site prep
**service_model:** CRC
**is_system:** false
**content:**
```html
<p>Client understands and acknowledges that all on-site preparation, foundation work, utility connections, crane staging, and post-delivery finish work are the Client's responsibility or that of Client's General Contractor as described in Exhibit F. If the site is not ready on schedule, delays and additional costs may apply, including storage fees for the module(s).</p>
```

#### 6. `BLOCK_ON_SITE_SCOPE_1.5` — CMOS variant
**description:** Section 1.5 — CMOS: Company manages site readiness
**service_model:** CMOS
**is_system:** false
**content:**
```html
<p>Company will coordinate and manage all on-site preparation, foundation work, utility connections, crane staging, and post-delivery finish work under this Agreement. Company will ensure site readiness in coordination with the manufacturing and delivery schedule.</p>
```

---

#### 7. `BLOCK_ON_SITE_SCOPE_3.1` — CRC variant
**description:** Section 3.1 Client Responsibilities — CRC: Client coordinates consultants
**service_model:** CRC
**is_system:** false
**content:**
```html
<p>The Client is responsible for coordinating consultants and contractors, including civil engineers, architects, and permitting consultants, to ensure their work aligns with the services provided by Company.</p>
<p>Client must promptly notify Company in writing of any facts or changes that may impact the design, permitting, site preparation, or installation of the home.</p>
```

#### 8. `BLOCK_ON_SITE_SCOPE_3.1` — CMOS variant
**description:** Section 3.1 Client Responsibilities — CMOS: Company coordinates consultants
**service_model:** CMOS
**is_system:** false
**content:**
```html
<p>Company will coordinate with consultants and contractors, including civil engineers, architects, and permitting consultants, as needed to complete the Project. Client must promptly notify Company in writing of any facts or changes that may impact the design, permitting, site preparation, or installation of the home.</p>
```

---

#### 9. `BLOCK_ON_SITE_SCOPE_3.4` — CRC variant
**description:** Section 3.4 Client Responsibilities — CRC: Client hires GC with detailed obligations
**service_model:** CRC
**is_system:** false
**content:**
```html
<p>The Client is responsible for hiring a licensed General Contractor to perform all required on-site work, including site preparation, foundation, utility connections, crane access, and post-delivery finish work as detailed in Exhibit F. Company's scope under this Agreement does not include On-Site Services. Client is solely responsible for contracting with, managing, and paying its General Contractor.</p>
<p>Client must:</p>
<ul>
<li>Enter into a written agreement with a licensed General Contractor for all on-site work in a timely manner.</li>
<li>Ensure that the General Contractor meets all requirements in Exhibit F (Contractor Requirements).</li>
<li>Ensure that the General Contractor performs all required tasks listed in Exhibit F, including any work that must be completed before delivery.</li>
<li>Provide Company with reasonable access to inspect and approve the General Contractor's work.</li>
</ul>
<p>Company retains authority to inspect and approve (or reject) Client's General Contractor's work. If the General Contractor's work does not meet Company's standards, Company may require corrections before proceeding with delivery or installation. Client is responsible for all costs associated with corrections.</p>
```

#### 10. `BLOCK_ON_SITE_SCOPE_3.4` — CMOS variant
**description:** Section 3.4 Client Responsibilities — CMOS: Company manages contractors
**service_model:** CMOS
**is_system:** false
**content:**
```html
<p>Company will engage and manage qualified contractors for all site construction work under this Agreement. Company will coordinate manufacturing delivery schedules with site readiness.</p>
```

---

#### 11. `BLOCK_ON_SITE_SCOPE_5.3` — CRC variant
**description:** Section 5.3 Project Schedule and Delays — CRC: Client ensures site ready
**service_model:** CRC
**is_system:** false
**content:**
```html
<p>Client shall ensure that the Site is ready to receive the Home on or before the scheduled delivery date, including completion of all site work listed in Exhibit F by Client's General Contractor or other contractors. If the Site is not ready as scheduled, Company may, at its sole discretion, (a) delay delivery and charge reasonable storage and handling fees; (b) reallocate delivery logistics and factory output as needed; and/or (c) require a Change Order to reschedule delivery and installation.</p>
```

#### 12. `BLOCK_ON_SITE_SCOPE_5.3` — CMOS variant
**description:** Section 5.3 Project Schedule and Delays — CMOS: Company coordinates delivery with site
**service_model:** CMOS
**is_system:** false
**content:**
```html
<p>If Client has elected Company-Managed On-Site Services, such services will be provided by contractors engaged by Company under this Agreement. Company will coordinate manufacturing delivery schedules with site readiness. Client acknowledges that:</p>
<ul>
<li>Company maintains full responsibility for on-site contractors;</li>
<li>Client is not a party to contracts between Company and its contractors;</li>
<li>Company and Company's Contractors are responsible for on-site work quality and performance;</li>
</ul>
```

---

### Task 2: Generalize the Resolver

Replace the hardcoded tag matching in `resolveComponentTags()` in `server/services/component-library.ts` with a **generic regex approach**:

```typescript
// Find ALL {{BLOCK_*}} tags in the content
const blockTagRegex = /\{\{(BLOCK_[A-Z0-9_.]+)\}\}/g;
const blockMatches = [...new Set(content.matchAll(blockTagRegex))].map(m => m[1]);

// Resolve each one from DB
for (const tagName of blockMatches) {
  const blockContent = await fetchComponentFromDB(tagName, context.organizationId, onSiteType);
  if (blockContent) {
    result = result.replace(new RegExp(`\\{\\{${tagName.replace(/\./g, '\\.')}\\}\\}`, 'g'), blockContent);
  } else {
    console.warn(`⚠️ No component found for {{${tagName}}} with service_model=${onSiteType}`);
    // Leave the placeholder in place so it shows up as unresolved in preview
  }
}
```

**Keep the TABLE_ tag resolution** (`PRICING_BREAKDOWN_TABLE`, `PAYMENT_SCHEDULE_TABLE`, `UNIT_PRICING_TABLE`, `EXHIBIT_LIST_TABLE`) — those are computed components, not DB lookups. But move them AFTER the generic BLOCK_ resolution so blocks can contain table variables that get resolved in a second pass.

Also remove the `HARDCODED_COMPONENTS` map and the hardcoded HTML constants from `component-library.ts`. Remove the synchronous `renderComponent()` function — only `renderComponentAsync()` should exist since DB lookups are async.

Update the synchronous `resolveBlockTags()` in `server/lib/contractGenerator.ts` (around line 768) to also use the async DB-first approach, or replace its callers with calls to `resolveComponentTags()`.

### Task 3: Fix Component CRUD

**Problem:** All existing components have `is_system: true`, which hides the delete button in the UI and blocks deletion on the backend. Since the new components are NOT system components (they're user-editable contract content), seed them all with `is_system: false`.

**Backend fix in `server/routes/components.ts`:**
- The `is_system` guard on DELETE is correct behavior — keep it. But ensure that when components are created through the UI, they default to `is_system: false`.
- Add a confirmation step: the DELETE route should return `{ message: "Component deleted", id: <id> }` so the frontend can show the right toast.

**Frontend fix in `client/src/pages/admin/components.tsx`:**
- The delete button is already conditionally rendered with `{!component.is_system && (...)}` — this is correct.
- Add a "Delete All Non-System" bulk action button for cleanup convenience.
- The Create Component dialog should NOT show an `is_system` toggle — only seeding scripts set that.
- When editing a component, show the `tag_name` as read-only (changing tag names would break clause references).
- Add a "Duplicate" button that copies an existing component's content into the create dialog — useful for creating the CRC variant from CMOS or vice versa.

**Frontend: Component Library page (`client/src/pages/component-library.tsx`)**
This page currently only shows TABLE components (from `table_definitions`). It should ALSO show BLOCK components (from `component_library`) in a separate section in the sidebar, grouped by tag_name with CRC/CMOS sub-items. This gives a unified view of all contract components.

### Task 4: Verification

After seeding, run this verification:

```sql
-- Should return 12 rows (6 tag_names × 2 service_models)
SELECT tag_name, service_model, is_system, 
       length(content) as content_length,
       substring(content, 1, 80) as preview
FROM component_library 
ORDER BY tag_name, service_model;
```

Expected output:
| tag_name | service_model | is_system | rows |
|---|---|---|---|
| BLOCK_ON_SITE_SCOPE_1.1_B | CRC | false | ✓ |
| BLOCK_ON_SITE_SCOPE_1.1_B | CMOS | false | ✓ |
| BLOCK_ON_SITE_SCOPE_1.5 | CRC | false | ✓ |
| BLOCK_ON_SITE_SCOPE_1.5 | CMOS | false | ✓ |
| BLOCK_ON_SITE_SCOPE_3.1 | CRC | false | ✓ |
| BLOCK_ON_SITE_SCOPE_3.1 | CMOS | false | ✓ |
| BLOCK_ON_SITE_SCOPE_3.4 | CRC | false | ✓ |
| BLOCK_ON_SITE_SCOPE_3.4 | CMOS | false | ✓ |
| BLOCK_ON_SITE_SCOPE_5.3 | CRC | false | ✓ |
| BLOCK_ON_SITE_SCOPE_5.3 | CMOS | false | ✓ |
| BLOCK_ON_SITE_SCOPE_RECITALS | CRC | false | ✓ |
| BLOCK_ON_SITE_SCOPE_RECITALS | CMOS | false | ✓ |

Also verify resolution works by checking the clause preview for a clause containing `{{BLOCK_ON_SITE_SCOPE_RECITALS}}` — it should render the CRC or CMOS content based on the project's on-site service selection.

## Files to modify
- `scripts/seed-components.ts` — replace with 12 new components
- `server/services/component-library.ts` — remove hardcoded constants, generalize resolver
- `server/lib/contractGenerator.ts` — update `resolveBlockTags()` to use async DB lookup
- `server/routes/components.ts` — keep is_system guard, minor response cleanup
- `client/src/pages/admin/components.tsx` — add Duplicate button, read-only tag_name on edit
- `client/src/pages/component-library.tsx` — add BLOCK components section to sidebar

## Important constraints
- Do NOT modify the `clauses` table — the `{{BLOCK_*}}` placeholders in `body_html` are correct as-is
- Do NOT modify the `component_library` schema — current columns are sufficient
- The old `BLOCK_ON_SITE_SCOPE` and `BLOCK_WARRANTY_SECTION` tag names are retired — do not create components with those names
- All new components must have `is_system: false` so they are editable and deletable in the UI
