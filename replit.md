# Dvele Contract Manager

## Overview

Dvele Contract Manager is a full-stack application designed to streamline the management of construction projects and their associated child LLCs for a modular home company. The system facilitates the creation and administration of specific child LLCs for each project (e.g., "Dvele Partners [Project] LLC") and automates contract generation based on these entities.

The project's vision is to provide a comprehensive platform that reduces manual overhead in legal and project administration, ensuring compliance and efficiency in Dvele's construction operations. It aims to integrate project management with legal document generation, offering robust tools for contract and LLC lifecycle management.

## User Preferences

The user prefers an iterative development approach, with clear communication about changes and progress. They value detailed explanations for complex features and architectural decisions. The user expects the agent to ask for confirmation before implementing significant changes or making irreversible modifications to the codebase or database schema. They prioritize maintainability and clean code practices.

## System Architecture

The application is built on a modern full-stack architecture.

**Frontend**:
- **Framework**: React (Vite)
- **Styling**: Tailwind CSS for utility-first styling.
- **UI Components**: Shadcn UI for pre-built, accessible components.
- **State Management**: TanStack Query v5 for data fetching, caching, and synchronization.
- **Routing**: `wouter` for a lightweight routing solution.
- **Forms**: `react-hook-form` with `zod` for schema validation.
- **UI/UX Decisions**:
    - **Dashboard**: Features 4 key stat cards (Total Contracts, Drafts, Pending Review, Signed), a Recent Contracts section, Quick Start Templates, and a Contract Value Overview.
    - **Multi-step Wizard**: A 9-step wizard for contract generation (`/generate-contracts`) with autosave functionality, step validation, and a review/generate final step.
    - **Theme**: Supports Dark Mode.
    - **LLC Naming**: Automated child LLC naming convention "DP + Project_Address + LLC".
    - **Phase C UI Updates (Jan 2026)**:
        - Site Address moved from Step 4 to Step 1 for better workflow
        - Optional Billing Address with "different from site" checkbox
        - Step 4 renamed "Home Models" (was "Site & Home")
        - Step 5 renamed "Company Entity" (was "Child LLC")
        - "Manufacturing" labels changed to "Offsite (Manufacturing)"
        - Step 9 enhanced with Project Type, Company Entity display, and "Show Missing" variable toggle

**Backend**:
- **Framework**: Express.js
- **Language**: TypeScript for type safety.
- **API**: RESTful API endpoints for managing contracts, projects, LLCs, clauses, variables, and contractor entities.
- **Modular Route Architecture (Jan 2026)**: Routes split into domain-focused modules for maintainability:
    - `server/routes/index.ts` - Central router combining all modules
    - `server/routes/projects.ts` - Projects, clients, units, details, home models, milestones, warranty, contractors
    - `server/routes/financials.ts` - Pricing engine, financials, pricing summary
    - `server/routes/contracts.ts` - Contract CRUD, generation, clauses, PDF/DOCX download
    - `server/routes/llc.ts` - LLC entity management
    - `server/routes/system.ts` - Dashboard stats, variables, variable mappings, admin endpoints
    - `server/routes/helpers.ts` - Shared helper functions (getProjectWithRelations)

**Database**:
- **Primary Database**: PostgreSQL is used for all persistent data including `llcs`, `contracts`, `clauses`, `projects`, `clients`, `financials`, `projectDetails`, `milestones`, `warrantyTerms`, `contractors`, `contractor_entities`, and `contract_variables`.

**Core Features & Design Patterns**:
- **Autosave System**: Implemented with a 2-second debounced save mechanism for draft projects, saving on navigation and preserving user input.
- **Contract Generation Wizard**: A structured, multi-step process for creating contract packages, including dynamic pricing calculation from selected home model units and integration with a pricing engine.
- **Unit Builder**: Located in Step 4 (Site & Property). Allows adding home models from the database (`project_units` table). Step 1 shows a read-only Total Units count.
- **Known Issue**: Wizard "Next" button may stay disabled after saving draft - step navigation gating logic needs investigation.
- **Clause Library**: A comprehensive, searchable library of 276 contract clauses with filtering and editing capabilities.
- **Variable Mappings**: System to configure and map contract variables, with preparation for Odoo ERP integration.
- **LLC Administration**: CRUD operations for child LLC entities, including status tracking, member management, and compliance monitoring.
- **Pricing Engine Integration**: Dynamic injection of pricing data into contract generation, including design fees, manufacturing costs, onsite costs, and payment milestones.
- **Dynamic HTML Tables (Jan 2026)**: Contract variables `{{PRICING_BREAKDOWN_TABLE}}` and `{{PAYMENT_SCHEDULE_TABLE}}` render as styled HTML tables with inline CSS for PDF compatibility. Use the Clause Library UI to add these placeholders to clauses like ONE-EXHIBIT-C (Payment Schedule) and ONE-RECITAL-A (Pricing). Migration endpoint at POST `/api/debug/migrate-clauses` scans for candidate clauses.
- **Schedule Duration Variables (Jan 2026)**: Project-level schedule fields (`design_duration`, `permitting_duration`, `production_duration`, `delivery_duration`, `completion_duration`, `estimated_delivery_date`, `estimated_completion_date`) are stored on the `projects` table. These populate contract variables like `{{DESIGN_DURATION}}`, `{{PRODUCTION_DURATION}}`, `{{DELIVERY_DATE}}`, `{{COMPLETION_DATE}}` for Exhibit D schedules. Migration endpoint: POST `/api/debug/migrate-schedule-columns`.
- **Foundation Cleanup (Jan 2026)**:
    - Deleted legacy .docx templates from `server/templates/`
    - Removed `/api/contracts/download-docx` route (now 100% HTML-to-PDF engine)
    - Unified variable mapping: `server/lib/mapper.ts` is now the single source of truth
    - Standard generation flow: `getProjectWithRelations()` → `calculateProjectPricing()` → `mapProjectToVariables()` → `generateContract()`
    - Exported `SUPPORTED_VARIABLES` and `VARIABLE_CATEGORIES` from mapper.ts for UI Variable Library
    - Fixed type mismatches between PostgreSQL Date fields and mapper string types
    - **Strict Enforcement (Jan 30, 2026)**:
        - `buildVariableMap()` throws error when unmapped data is passed
        - `/api/contracts/download-pdf` rejects legacy `projectData` with 400 error
        - All callers must use `projectId` parameter for unified variable mapping
        - Legacy code in buildVariableMap is commented out for reference only
- **Intelligent Discovery-Based Contract Ingestor (Jan 30, 2026)**:
    - Ingestion script: `scripts/ingest_standard_contracts.ts` using mammoth library
    - Auto-discovers .docx files in `server/templates/` and derives contract type from filename
    - Style-based extraction: Maps Word styles (Heading 1→section, Heading 2→clause, Normal→paragraph)
    - Pattern detection fallback for uppercase headers, section numbers, and short titles
    - Clean slate approach: DELETE FROM clauses before each ingestion ensures no duplicates
    - Ingestion results: ONE_AGREEMENT (326 blocks), OFFSITE (100 blocks), ON_SITE (130 blocks) = 556 total
    - Tree structure: `parent_clause_id` references create proper hierarchy (clauses → sections)
    - Variable extraction: `{{VARIABLE_NAME}}` patterns auto-detected and stored in `variables_used` array
    - Contract type mapping: contractTypeMap in routes handles user-facing types (ONE, OFFSITE, ONSITE) ↔ database types (ONE_AGREEMENT, OFFSITE, ON_SITE)
    - Run script: `npx tsx scripts/ingest_standard_contracts.ts`
- **State-Specific Provision Filtering (Jan 30, 2026)**:
    - Ingestor detects state-specific sections (e.g., "CALIFORNIA PROVISIONS", "TEXAS PROVISIONS") and tags with `conditions: {"PROJECT_STATE": "CA"}`
    - `STATE_PATTERNS` array supports 12 states: CA, TX, AZ, CO, FL, GA, NV, NC, OR, TN, UT, WA
    - `detectStateProvision()` function scans section headers for state names/abbreviations
    - Contract generator `buildBlockTree()` filters blocks based on `PROJECT_STATE` condition
    - Mapper provides `PROJECT_STATE` and `PROJECT_STATE_CODE` variables from `project.state` field
    - Recursive filtering: child blocks are excluded when their parent is filtered out
    - Blocks without state conditions are always included (standard contract content)
    - Verified: CA project filters TX/AZ, TX project filters CA/AZ - numbering remains sequential
- **Contract Template Upload & Auto-Ingest (Jan 30, 2026)**:
    - Upload UI: `client/src/pages/templates-upload.tsx` with drag-drop file zone
    - Backend API: `POST /api/contracts/upload-template` (multer-based .docx upload)
    - Template listing: `GET /api/contracts/templates` returns existing templates with clause counts
    - Template deletion: `DELETE /api/contracts/templates/:fileName` (path-traversal protected)
    - Ingestion script updated: `scripts/ingest_standard_contracts.ts` now supports single-file mode via CLI argument
    - Append-friendly: Single-file ingestion only deletes clauses for the specific contract_type
    - Navigation: "Import Templates" link added to sidebar under Configuration
    - Run single-file ingest: `npx tsx scripts/ingest_standard_contracts.ts <path-to-file.docx>`
- **Variable Registry Sync (Jan 30, 2026)**:
    - Sync script: `scripts/sync_variables.ts` reads `VARIABLE_CATEGORIES` from mapper.ts
    - Clean slate approach: Uses DB transaction to DELETE + INSERT all 193 variables atomically
    - Auto-assigns metadata: category, dataType, isRequired, displayName, description
    - Data type inference: date, currency, number, boolean, text based on variable name patterns
    - 9 core project identifiers marked as required
    - Run script: `npx tsx scripts/sync_variables.ts`
    - UI displays unregistered variables (used in clauses but not in registry) with warning icons
    - "Register" button allows quick addition of unregistered variables to the registry
- **8-Level Smart Logic Ingestor (Jan 31, 2026)**:
    - Style-to-Level Mapping: Heading 1→Level 1 (Agreement Parts), Heading 2→Level 2 (Major Sections), Heading 3→Level 3 (Clauses), Heading 4→Level 4 (Sub-headers), Normal→Level 5 (Body), Heading 6→Level 6 (Conspicuous), Heading 5→Level 7 (Roman Lists)
    - Smart Tag Detection:
        - `[STATE_DISCLOSURE:XXXX]` pattern sets block_type='dynamic_disclosure', stores code in disclosure_code column
        - CRC/CMOS keywords in Heading 2/3 trigger service_model_condition inheritance to all child blocks
    - Cleanup/Sanitization: Prefix stripping with regex `^(\d+(\.\d+)*|[a-z]\.|[ivx]+\.)\s+`, paragraphs starting with `!!!!` are skipped
    - Schema: Added `disclosure_code` and `service_model_condition` columns to clauses table
    - Detection functions: `detectStateDisclosure()`, `detectServiceModel()`, `stripPrefix()`, `shouldIgnoreParagraph()`
    - Run: `npx tsx scripts/ingest_standard_contracts.ts <path-to-file.docx>`
- **4-Level Hierarchical Styling (Jan 30, 2026)**:
    - "Clean Look" CSS styling with 4 hierarchy levels in PDF contracts:
        - Level 1 (hierarchy_level 1): Section headers - Bold, blue (#1a73e8), uppercase, blue underline
        - Level 2 (hierarchy_level 2): Subsection headers - Bold, black, left-justified
        - Level 3 (hierarchy_level 3): Numbered paragraphs - Hanging indent (0.35in), dot notation (1.1.1)
        - Level 4 (hierarchy_level 4): List items - Fully indented (0.5in), lowercase Roman numerals (i., ii., iii.)
    - `applyDynamicNumbering()` uses `clause.hierarchy_level` (not tree depth) for numbering format
    - `toLowerRoman()` helper converts integers to lowercase Roman numerals
    - `renderBlockNode()` uses both `block_type` and `hierarchy_level` for rendering decisions
    - CSS classes: `.section-header`, `.subsection-header`, `.paragraph-numbered`, `.list-item-roman`

## External Dependencies

- **PostgreSQL**: Primary database for all application data.
- **Vite**: Frontend build tool.
- **React**: Frontend library.
- **Express.js**: Backend web application framework.
- **Tailwind CSS**: Utility-first CSS framework.
- **Shadcn UI**: UI component library.
- **TanStack Query v5**: Data fetching and state management.
- **wouter**: Frontend router.
- **react-hook-form**: Form management library.
- **zod**: Schema declaration and validation library.
- **JAMS/AAA**: Arbitration providers referenced in warranty terms.
- **Odoo ERP**: Planned future integration for variable mapping.