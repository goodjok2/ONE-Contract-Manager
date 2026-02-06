# REPLIT AGENT PROMPT — ADD MISSING EXHIBIT CONTENT TO MATCH DOCX TEMPLATE

## CONTEXT

The contract generator produces Exhibits A–F but they are missing significant content compared to the DOCX template (the legal source of truth). The main body text of the agreement is correct — this prompt focuses exclusively on the Exhibits. Do NOT modify any main body sections (1–14) or the numbering scheme.

## WHAT'S MISSING — EXHIBIT BY EXHIBIT

---

### EXHIBIT A — PROJECT SCOPE AND COMMERCIAL TERMS

**Currently generated (PDF):** Has A.1, A.2 (pricing), A.3 (payment), A.4 (special terms)

**Template requires:** A.1 through A.8 with much more detail

#### A.1 Project Overview — FIX LABEL MISMATCHES

The overview table has label mismatches between template and output:

| Template Label | Current PDF Label | Fix |
|---------------|-------------------|-----|
| Client Type | Buyer Type | Change to "Client Type" |
| Properties | (missing) | Add row: "Properties" → `{{PROJECT_TYPE}} (see A.2)` |
| Project Number | Project Number | ✅ OK (keep) |
| Completion Model | Completion Model | ✅ OK |
| Jurisdiction(s) | Jurisdiction(s) | ✅ OK |
| Site(s) | Site(s) | ✅ OK |
| Client Notice Address / Email | Client Notice Email | Change label to "Client Notice Address / Email" |
| Dvele Notice Address / Email | Company Notice Email | Change label to "Dvele Notice Address / Email" |

#### A.2 Property & Phase Matrix — ADD (currently missing)

Add a new section A.2 with this table structure:

```html
<h3>A.2 Property & Phase Matrix</h3>
<table>
  <thead>
    <tr>
      <th>Property ID</th>
      <th>Site Address</th>
      <th>Phase</th>
      <th>Home/Model</th>
      <th>Est. Factory Start</th>
      <th>Est. Factory Complete</th>
      <th>Est. Delivery Window</th>
      <th>Target CO/Equivalent</th>
    </tr>
  </thead>
  <tbody>
    <!-- Generate one row per unit/property from project data -->
    <!-- If no units configured, show placeholder row: -->
    <tr>
      <td>P-1</td>
      <td>{{SITE_ADDRESS}}</td>
      <td>Phase 1</td>
      <td>{{HOME_MODEL}}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>
```

If the project has multiple units/properties, generate one row per unit using data from the project's units array.

#### A.3 Scope Summary — ADD (currently missing)

```html
<h3>A.3 Scope Summary (High Level; detail in Exhibits B/C)</h3>
<table>
  <thead>
    <tr>
      <th>Phase</th>
      <th>Dvele Deliverables</th>
      <th>Client/GC Deliverables</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Phase 1</td>
      <td>Per Exhibit B; responsibilities per Exhibit C</td>
      <td>Per Exhibit C</td>
    </tr>
  </tbody>
</table>
```

#### A.4 Pricing Summary — FIX LABELS

The pricing table exists but has wrong row labels. Fix these:

| Current PDF Label | Template Label | Fix |
|-------------------|---------------|-----|
| Production Price (Factory) | Offsite Services (Factory) | Change label |
| Logistics | Offsite Services (Delivery/Assembly) | Change label |
| On-Site (Company Managed) | On-site Services (if CMOS) | Change label |
| Admin Fee: 10% | Reimbursables (if any) | Change to "Reimbursables (if any)" with note "At cost plus admin fee of {{AD_FEE}}%" |

Also add a "Design / Estimate" column and a "Final Price (Greenlight Approval)" column to match the template's two-column pricing layout. If final prices aren't available yet, leave that column blank.

#### A.5 Milestones & Payment Schedule — FIX STRUCTURE

The current payment table is oversimplified. The template requires per-property/phase detail:

```html
<h3>A.5 Milestones & Payment Schedule (Per Property/Phase)</h3>
<table>
  <thead>
    <tr>
      <th>Property ID</th>
      <th>Phase</th>
      <th>Payment</th>
      <th>Trigger</th>
      <th>Amount</th>
      <th>Due</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>P-1</td><td>1</td><td>Design Fee</td><td>Execution</td><td>${{DESIGN_FEE}}</td><td>Immediate</td></tr>
    <tr><td>P-1</td><td>1</td><td>Green Light Deposit</td><td>Green Light Notice</td><td>${{GREEN_LIGHT_AMOUNT}}</td><td></td></tr>
    <tr><td>P-1</td><td>1</td><td>Factory Start</td><td>First module fabrication</td><td>${{FACTORY_START_AMOUNT}}</td><td></td></tr>
    <tr><td>P-1</td><td>1</td><td>Factory Completion</td><td>Dvele certification</td><td>${{FACTORY_COMPLETE_AMOUNT}}</td><td></td></tr>
    <tr><td>P-1</td><td>1</td><td>Delivery / Set</td><td>Delivery/set complete</td><td>${{DELIVERY_AMOUNT}}</td><td></td></tr>
    <tr><td>P-1</td><td>1</td><td>CO/Equivalent (if CMOS model)</td><td>Issuance</td><td>${{RETAINAGE_AMOUNT}}</td><td></td></tr>
  </tbody>
</table>
<p>(Add rows for each Property and Phase.)</p>
```

Keep the existing simplified percentage table as a secondary summary if desired, but the primary table must match this structure.

#### A.6 Green Light Conditions — ADD (currently missing)

```html
<h3>A.6 Green Light Conditions (Phase-Specific)</h3>
<p>Production for each Phase begins only upon:</p>
<ol>
  <li>Final design approvals for that Phase (Exhibit B Plan Set Index)</li>
  <li>Proof of Site control and authority</li>
  <li>GC engagement and Site readiness plan (if Client GC model)</li>
  <li>Permit status as required for production slot according to local requirements</li>
  <li>Proof of funds / committed financing remaining valid through commencement of production</li>
  <li>Receipt of Green Light deposit</li>
</ol>
```

#### A.7 Reporting and Meetings — ADD (currently missing)

```html
<h3>A.7 Reporting and Meetings</h3>
<ul>
  <li>Weekly production update cadence: ☐ weekly ☐ bi-weekly</li>
  <li>Primary contacts: Client: {{CLIENT_PRIMARY_CONTACT}}, Company: {{COMPANY_CONTACT}}</li>
</ul>
```

Add variable mappings for CLIENT_PRIMARY_CONTACT and COMPANY_CONTACT in mapper.ts if they don't exist:
```typescript
map['CLIENT_PRIMARY_CONTACT'] = projectData.clientLegalName || '';
map['COMPANY_CONTACT'] = 'contracts@dvele.com';
```

#### A.8 Special Commercial Terms — EXPAND

Currently only shows storage fee line. Add the remaining template content:

```html
<h3>A.8 Special Commercial Terms (if any)</h3>
<ul>
  <li>Storage fees if site not ready: ${{STORAGE_FEE_PER_DAY}}/day after {{STORAGE_FREE_DAYS}} days</li>
  <li>Delivery window assumptions, crane day assumptions, access constraints</li>
  <li>Insurance requirements for Client/GC (limits, certificates)</li>
  <li>Client shall ensure that the Project Site is accessible, prepared, and suitable for delivery, staging, and installation in accordance with Exhibit C. Any delay or cost arising from site conditions not meeting such requirements shall constitute an Excusable Delay and, if applicable, a compensable Change subject to a Change Order.</li>
</ul>
```

#### Exhibit A Signature Blocks — ADD (currently missing)

After A.8, add a dual-column signature block:

```html
<table class="signature-table" style="width:100%; margin-top: 24pt;">
  <tr>
    <td style="width:50%; vertical-align:top; padding-right:20pt;">
      <p><strong>Accepted and agreed:</strong></p>
      <p>DVELE, INC.</p>
      <p>By: ___________________________</p>
      <p>Name: _________________________</p>
      <p>Title: ________________________</p>
      <p>Date: _________________________</p>
      <br/>
      <p>Client</p>
      <p>By: ___________________________</p>
      <p>Name: _________________________</p>
      <p>Title (if applicable): _________</p>
      <p>Date: _________________________</p>
    </td>
    <td style="width:50%; vertical-align:top; padding-left:20pt;">
      <p><strong>Post Design Approval (Greenlight):</strong></p>
      <p>DVELE, INC.</p>
      <p>By: ___________________________</p>
      <p>Name: _________________________</p>
      <p>Title: ________________________</p>
      <p>Date: _________________________</p>
      <br/>
      <p>Client</p>
      <p>By: ___________________________</p>
      <p>Name: _________________________</p>
      <p>Title (if applicable): _________</p>
      <p>Date: _________________________</p>
    </td>
  </tr>
</table>
```

---

### EXHIBIT B — HOME PLANS, SPECIFICATIONS & FINISHES

#### B.1 Plan Set Index — EXPAND

Replace the "No units configured" placeholder with the template table:

```html
<h3>B.1 Plan Set Index</h3>
<table>
  <thead>
    <tr>
      <th>Property ID</th>
      <th>Phase</th>
      <th>Model</th>
      <th>Plan Set Version</th>
      <th>Date</th>
      <th>Third-Party Review / State Approval Ref (if applicable)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>P-1</td><td>1</td><td></td><td></td><td></td><td></td></tr>
  </tbody>
</table>
```

#### B.2 Specifications — EXPAND

Replace "See attached specification schedules" with the template's itemized list:

```html
<h3>B.2 Specifications (Attach schedules or reference documents)</h3>
<ul>
  <li>Structural: [attach/ref]</li>
  <li>Envelope: [attach/ref]</li>
  <li>MEP interfaces and connection points: [attach/ref]</li>
  <li>Interior finishes: [attach/ref]</li>
  <li>Exterior finishes: [attach/ref]</li>
  <li>Appliances/fixtures package: [attach/ref]</li>
  <li>Energy/code compliance basis: [attach/ref]</li>
</ul>
```

---

### EXHIBIT C — GC / ON-SITE SCOPE & RESPONSIBILITY MATRIX

This exhibit needs the most work. The generated version only has C.1 and C.2, but the template has C.1 through C.6.

#### C.1 — CONDITIONAL CONTENT

The content of C.1 depends on the completion model:

**If CMOS (Company-Managed On-Site Services):**
Keep the current C.1 content (Company manages on-site work, bullet list of responsibilities).

**If CRC (Client GC Completion Model):**
Show the GC Information section instead:
```html
<h3>C.1 Parties / GC Information (if Client GC model)</h3>
<ul>
  <li>GC Legal Name: [●]</li>
  <li>License No.: [●] State: [●]</li>
  <li>Insurance: GL $[●], WC per law, Auto $[●] (certificates to Dvele prior to site work)</li>
</ul>
```

#### C.2 Responsibility Allocation Matrix — ADD (currently missing)

This is a large table. Add it:

```html
<h3>C.2 Responsibility Allocation Matrix</h3>
<table>
  <thead>
    <tr>
      <th>Work Category</th>
      <th>Dvele</th>
      <th>Client/GC</th>
      <th>Notes / Acceptance Standard</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Factory fabrication</td><td>✔</td><td></td><td>Per Exhibit B</td></tr>
    <tr><td>Transport coordination</td><td>☐</td><td>☐</td><td>Per Exhibit A</td></tr>
    <tr><td>Transport cost</td><td>☐</td><td>☐</td><td>Per Exhibit A</td></tr>
    <tr><td>Route surveys / escorts</td><td>☐</td><td>☐</td><td>As required</td></tr>
    <tr><td>Crane / rigging</td><td>☐</td><td>☐</td><td>Define in Exhibit A</td></tr>
    <tr><td>Site access &amp; staging</td><td></td><td>✔</td><td>Must meet delivery specs</td></tr>
    <tr><td>Clearing / grading</td><td></td><td>✔</td><td></td></tr>
    <tr><td>Foundation / footings / slab</td><td></td><td>✔</td><td>Must meet Dvele tolerances</td></tr>
    <tr><td>Utility stubs (water/sewer/power/gas)</td><td></td><td>✔</td><td>Stub locations per drawings</td></tr>
    <tr><td>Set / placement on foundation</td><td>☐</td><td>☐</td><td>If Dvele model, Dvele manages via sub</td></tr>
    <tr><td>Stitching / sealing / weatherproofing</td><td>☐</td><td>☐</td><td>Allocate clearly</td></tr>
    <tr><td>MEP reconnections</td><td>☐</td><td>☐</td><td>Allocate clearly</td></tr>
    <tr><td>Interior finish out (site)</td><td>☐</td><td>☐</td><td>Allocate clearly</td></tr>
    <tr><td>Exterior tie-ins / decks / stairs</td><td>☐</td><td>☐</td><td>Allocate clearly</td></tr>
    <tr><td>Inspections scheduling</td><td>☐ support</td><td>✔</td><td></td></tr>
    <tr><td>CO/Equivalent responsibility</td><td>☐ (if Dvele model)</td><td>✔</td><td>Election in Exhibit A</td></tr>
    <tr><td>Site safety and security</td><td></td><td>✔</td><td></td></tr>
    <tr><td>Debris removal / cleanup</td><td></td><td>✔</td><td></td></tr>
    <tr><td>Damage remediation from delivery activities</td><td>☐</td><td>☐</td><td>Allocate</td></tr>
  </tbody>
</table>
```

Note: The ☐ checkboxes represent items that are allocated per-project. In a future version, these could be dynamic based on the completion model selection. For now, render them as the template shows.

#### C.3 → renumber current C.2 to C.3

The current "C.2 Site Readiness Requirements" should become C.3 (since we added C.2 above).

#### C.4 Interfaces & Dependencies — ADD (currently missing)

```html
<h3>C.4 Interfaces &amp; Dependencies</h3>
<table>
  <thead>
    <tr>
      <th>Interface Item</th>
      <th>Providing Party</th>
      <th>Receiving Party</th>
      <th>Dependency / Deadline</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Foundation ready certification</td><td>Client/GC</td><td>Dvele</td><td>[●] days before delivery</td></tr>
    <tr><td>Utility stub verification</td><td>Client/GC</td><td>Dvele</td><td>[●] days before delivery</td></tr>
    <tr><td>Crane mobilization plan</td><td>Client/GC</td><td>Dvele</td><td>[●] days before delivery</td></tr>
  </tbody>
</table>
```

#### C.5 Responsibility Allocation — ADD (currently missing)

```html
<h3>C.5 Responsibility Allocation</h3>
<p>Responsibilities for factory work, delivery, on-site assembly, installation, inspections, and completion are allocated exclusively as set forth in this Exhibit C. Dvele's warranty and liability apply only to work performed by Dvele.</p>
```

#### C.6 Indemnity for Non-Dvele Work — ADD (currently missing)

```html
<h3>C.6 Indemnity for Non-Dvele Work (Market-Norm)</h3>
<p>Client shall defend and indemnify Dvele from third-party claims arising from Client/GC site work, safety practices, or acts/omissions of Client or its contractors, except to the extent caused by Dvele's negligence or willful misconduct.</p>
```

---

### EXHIBIT D — MILESTONES & SCHEDULE

#### D.1 Design / Pre-Production Milestones — EXPAND

Replace the current "Design Duration: 60 days / Permitting Duration: 60 days" with the template's milestone table:

```html
<h3>D.1 Design / Pre-Production Milestones</h3>
<table>
  <thead>
    <tr>
      <th>Milestone</th>
      <th>Deliverable</th>
      <th>Client Inputs Needed</th>
      <th>Review Period</th>
      <th>Target Date</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>D-1 Kickoff</td><td>Project brief + intake</td><td>Site docs</td><td>5 biz days</td><td></td></tr>
    <tr><td>D-2 Schematic</td><td>Schematic set</td><td>Finish selections</td><td>10 biz days</td><td></td></tr>
    <tr><td>D-3 Permit Set</td><td>Stamped drawings</td><td>Site/GC coordination</td><td>10 biz days</td><td></td></tr>
    <tr><td>D-4 Green Light Package</td><td>Final plan set + budget</td><td>Proof of funds</td><td>5 biz days</td><td></td></tr>
  </tbody>
</table>
```

#### D.2 Production Milestones — EXPAND

Replace the current "Production Duration: 120 days / Delivery Duration: 60 days" with:

```html
<h3>D.2 Production Milestones</h3>
<table>
  <thead>
    <tr>
      <th>Milestone</th>
      <th>Deliverable / Trigger</th>
      <th>Certification Method</th>
      <th>Target Date</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>P-1 Factory Start</td><td>First module fabrication</td><td>Email certificate</td><td></td></tr>
    <tr><td>P-2 Factory Completion</td><td>All modules complete</td><td>Email certificate</td><td></td></tr>
    <tr><td>P-3 Delivery/Set</td><td>Delivery and set complete</td><td>Field report</td><td></td></tr>
    <tr><td>P-4 CO/Equivalent (if Dvele model)</td><td>Issuance</td><td>Copy of approval</td><td></td></tr>
  </tbody>
</table>
```

---

### EXHIBIT E — LIMITED WARRANTY

This exhibit is missing the most content. The generated version only has the warranty scope table and a few exclusions. The template has extensive legal content.

#### Add Statutory Notice Block (BEFORE warranty content)

```html
<div class="statutory-notice" style="border: 1px solid #000; padding: 12pt; margin-bottom: 16pt; font-size: 10pt;">
  <p><strong>PURSUANT TO CAL. COM. CODE § 1201(b)(10), THIS SECTION (ALONG WITH SECTION 6, ABOVE) CHANGES YOUR EXISTING WARRANTY RIGHTS UNDER CALIFORNIA LAW, AND REPLACES CERTAIN EXISTING WARRANTIES WITH OUR OWN LIMITED WARRANTY. PLEASE READ THE ENTIRE SECTION CAREFULLY AND INITIAL AFTER READING ONLY IF YOU AGREE. YOU HAVE THE RIGHT TO CONSULT WITH AN ATTORNEY BEFORE AGREEING TO WAIVE THESE RIGHTS.</strong></p>
  <p>If you have read, understand, and agree to Exhibit E, please initial here: _____</p>
</div>
```

#### Add Definitions Section

```html
<h3>Definitions</h3>
<p>"<strong>Covered Component</strong>" means those specific systems and structural elements described in Sections 3 and 4 below, which were originally supplied by Dvele or its authorized manufacturers.</p>
<p>"<strong>Repair</strong>" means correction of the defect by restoring the Covered Component to proper working condition.</p>
<p>"<strong>Repair/Replacement</strong>" means correction of the defect by providing a comparable component and installing it.</p>
<p>"<strong>Term of Coverage</strong>" begins on the date the Home leaves Dvele's factory and continues according to the applicable coverage period (2-, 5-, or 10-year).</p>
<p>"<strong>Failure to Perform Its Intended Function</strong>" means the operational or structural failure of a Covered Component due to a defect to the extent that:</p>
<ol type="i">
  <li>the component no longer functions as designed, or</li>
  <li>continued use would be unsafe or materially impractical</li>
</ol>
```

#### Add Warranty Commencement

```html
<h3>Warranty Commencement</h3>
<p>Warranties begin on the <strong>earlier</strong> of:</p>
<ol type="i">
  <li>Substantial completion of factory delivery and installation on site, or</li>
  <li><strong>30 days after factory delivery</strong>, unless delays are caused by Dvele.</li>
</ol>
<p>This timing ensures protection begins as soon as the modules are delivered and ready for occupancy.</p>
```

#### Warranty Scope Table — KEEP existing but verify it has these three rows:

| Warranty Type | Duration | Covered Components |
|---|---|---|
| Fit and Finish | 2 Years | Interior/exterior finishes (e.g., paint, trim, drywall, cabinets, flooring, siding, tile) |
| Building Envelope | 5 Years | Roof, exterior walls, foundation system (excluding on-site foundation work not performed by Dvele) |
| Structural | 10 Years | Structural frame, floor structure, roof structure, load-bearing walls |

#### Add Systems Coverage (2 Years)

```html
<h3>Systems Coverage (2 Years)</h3>
<p>Dvele warrants that the following systems will be free of material defects and operate as intended during the first two (2) years:</p>
<ol type="i">
  <li><strong>Plumbing System</strong>: Supply and drain lines, waste pipes, toilets, faucets, sinks, tubs (excluding hot tubs or spas), water heater.</li>
  <li><strong>Electrical System</strong>: Service panel, circuit breakers, interior wiring, outlets, switches, and light fixtures.</li>
  <li><strong>HVAC System</strong>: Ductwork, furnace, vents, thermostat, and connections.</li>
</ol>
```

#### Add Appliance and Fixture Coverage

```html
<h3>Appliance and Fixture Coverage (Pass-Through)</h3>
<p>Dvele provides no separate warranty for appliances or fixtures (e.g., ranges, refrigerators, dishwashers, lighting fixtures, HVAC units, etc.) but will pass through to Client all applicable manufacturer warranties. Defects in installation by Dvele are covered under the Fit and Finish warranty for two (2) years.</p>
```

#### Exclusions — EXPAND to full 10 items

The current output has only 6 exclusions. Add the missing 4:

The complete list (10 items) should be:
1. Cosmetic issues not affecting functionality
2. Damage caused by Client, contractors, or others not retained by Dvele
3. Any defect resulting from improper setup, foundation work, or site conditions not performed by Dvele
4. Normal wear and tear or lack of maintenance
5. Modifications or repairs performed by others without Dvele's written approval
6. Water intrusion due to site grading, landscaping, or foundation work not performed by Dvele
7. Appliances or components subject to manufacturer recalls or third-party warranties
8. Acts of God (fire, flood, earthquake, windstorm, etc.)
9. Rodent, pest, or insect damage
10. Use of the Home for commercial or rental purposes unless expressly approved in writing

#### Add Claims and Remedies

```html
<h3>Claims and Remedies</h3>
<ol type="i">
  <li>Claims must be submitted to Dvele in writing within thirty (30) days of discovering the defect.</li>
  <li>No coverage is available for claims made after the applicable warranty period expires.</li>
  <li>Client must provide access for Dvele to inspect and assess the claimed defect.</li>
  <li>Emergency repairs may be authorized by Client only in cases of immediate hazard or safety risk, and only if Dvele is not reasonably available. Client must retain original parts for inspection.</li>
</ol>
```

#### Add Limits of Liability

```html
<h3>Limits of Liability</h3>
<p>Dvele's total liability under this Limited Warranty shall not exceed the Total Purchase Price of the Home. Dvele shall not be liable for any consequential, special, indirect, or incidental damages.</p>
```

---

### EXHIBIT F — STATE-SPECIFIC PROVISIONS

This exhibit is mostly correct. The only change:

#### F.2 — Keep the Arizona-specific content AND add the template's generic fallback

The PDF currently has AZ-specific content which is good. But the template also has a generic instruction line. Add this as a comment/note above the state-specific content:

```html
<h3>F.2 Consumer / Statutory Notices</h3>
<p><em>[Insert any required statutory disclosures, cancellation rights, specific warranty notices, or arbitration disclosures required by the governing state for the Client type (end customer (DTC) vs developer (B2B)). Any provision not required by law is void.]</em></p>
<!-- State-specific content below -->
<p><strong>ARIZONA NOTICE:</strong> This transaction is subject to the Arizona Registrar of Contractors requirements. Verify contractor licensing at www.azroc.gov.</p>
```

---

## VARIABLE MAPPINGS TO ADD

In `server/lib/mapper.ts`, ensure these variables are mapped (add if missing):

```typescript
// Exhibit A variables
map['BUYER_TYPE'] = projectData.buyerType || 'End Customer';
map['PROJECT_TYPE'] = projectData.projectType || 'Single';
map['AD_FEE'] = projectData.adminFeePercent?.toString() || '10';
map['STORAGE_FEE_PER_DAY'] = projectData.storageFeePerDay?.toString() || '150';
map['STORAGE_FREE_DAYS'] = projectData.storageFreeDays?.toString() || '14';

// Exhibit A contacts
map['CLIENT_PRIMARY_CONTACT'] = projectData.clientLegalName || '';
map['COMPANY_CONTACT'] = 'contracts@dvele.com';
map['CLIENT_EMAIL'] = projectData.clientEmail || '';
map['COMPANY_EMAIL'] = 'contracts@dvele.com';

// Pricing variables (may already exist — verify)
map['DESIGN_FEE'] = formatCurrency(projectData.designFee) || '';
map['PRODUCTION_PRICE'] = formatCurrency(projectData.productionPrice) || '';
map['LOGISTICS_PRICE'] = formatCurrency(projectData.logisticsPrice) || '';
map['ONSITE_PRICE'] = formatCurrency(projectData.onsitePrice) || '';
map['TOTAL_PROJECT_PRICE'] = formatCurrency(projectData.totalProjectPrice) || '';
```

---

## IMPLEMENTATION NOTES

1. **Do NOT modify main body sections 1–14.** This prompt is ONLY for Exhibits A–F.
2. **Do NOT change the numbering scheme.** That is handled by a separate prompt.
3. The Exhibit content is rendered as HTML in `server/lib/contractGenerator.ts` — likely in a function called `renderExhibitsHTML()` or similar. Find that function and add/modify the exhibit sections there.
4. If exhibits are stored as clauses in the database, you may need to add new clause records for the missing sections. Check the exhibits table and the clause rendering pipeline to determine the best approach.
5. Tables should use the existing table CSS styles already in `getContractStyles()`.

## VERIFICATION

After implementing, generate a contract and verify:
1. ✅ Exhibit A has sections A.1 through A.8
2. ✅ A.2 Property & Phase Matrix table is present
3. ✅ A.3 Scope Summary table is present
4. ✅ A.4 pricing labels match template (Offsite Services, not Production Price)
5. ✅ A.5 has per-property/phase payment table
6. ✅ A.6 Green Light Conditions (6 numbered items) is present
7. ✅ A.7 Reporting and Meetings is present
8. ✅ A.8 has full special terms content
9. ✅ Exhibit A has dual-column signature blocks at the end
10. ✅ Exhibit B has plan set index table and 7 specification items
11. ✅ Exhibit C has all 6 sections (C.1–C.6) including responsibility matrix
12. ✅ Exhibit D has milestone tables (not just duration lines)
13. ✅ Exhibit E has statutory notice, definitions, commencement, systems coverage, appliance coverage, all 10 exclusions, claims/remedies, and limits of liability
14. ✅ Exhibit F has generic instruction + state-specific content
