# Dvele Contract Manager

## Overview

Dvele Contract Manager is a full-stack application designed to streamline the management of construction projects and their associated child LLCs for a modular home company. The system facilitates the creation and administration of specific child LLCs for each project (e.g., "Dvele Partners [Project] LLC") and automates contract generation based on these entities. The project aims to reduce manual overhead in legal and project administration, ensuring compliance and efficiency in construction operations by integrating project management with legal document generation and offering robust tools for contract and LLC lifecycle management.

## User Preferences

The user prefers an iterative development approach, with clear communication about changes and progress. They value detailed explanations for complex features and architectural decisions. The user expects the agent to ask for confirmation before implementing significant changes or making irreversible modifications to the codebase or database schema. They prioritize maintainability and clean code practices.

## System Architecture

The application is built on a modern full-stack architecture.

**Frontend**:
- **Framework**: React (Vite)
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI
- **State Management**: TanStack Query v5
- **Routing**: `wouter`
- **Forms**: `react-hook-form` with `zod`
- **UI/UX Decisions**:
    - **Dashboard**: Features key stats, recent contracts, quick start templates, and contract value overview.
    - **Multi-step Wizard**: A 9-step wizard for contract generation with autosave, validation, and review steps.
    - **Theme**: Supports Dark Mode.
    - **LLC Naming**: Automated child LLC naming convention "DP + Project_Address + LLC".
    - **Wizard Enhancements**: Site Address moved to Step 1, optional Billing Address, renamed steps (e.g., "Home Models", "Company Entity"), enhanced Step 9 with project type and company entity display.
    - **Admin UI**: CRUD for Exhibit Library.

**Backend**:
- **Framework**: Express.js
- **Language**: TypeScript
- **API**: RESTful API for managing contracts, projects, LLCs, clauses, variables, contractors, and system data.
- **Modular Route Architecture**: Routes are organized into domain-focused modules (e.g., `projects.ts`, `contracts.ts`, `llc.ts`).

**Database**:
- **Primary Database**: PostgreSQL for all persistent data including `contracts`, `clauses`, `projects`, `clients`, `financials`, `projectDetails`, `milestones`, `warrantyTerms`, `contractors`, `contractor_entities`, `contract_variables`.
- **Phase A (Complete)**: Atomic Clauses Architecture - clauses table refactored to use `slug`, `header_text`, `body_html`, `level`, `parent_id`, `order`, `contract_types` (JSONB), `tags` (JSONB). Database uses snake_case column names.
- **Phase B (Complete)**: Smart Ingestor with regex-powered hierarchy detection for Roman numeral lists and automatic body paragraph appending.
- **Phase C (Complete)**: System Restoration - API backward compatibility with `content` field reconstruction from header+body, table_definitions seeded for Variable Library.
- **Phase D (Complete)**: Atomic UI & HTML Preview Upgrade - Editor UI with separate Header/Body fields, hierarchy-based styling (L1-L4 blue, L6 amber conspicuous, L7-L8 indented). Reorder endpoint fixed to use snake_case columns. All SQL queries use snake_case: `header_text`, `body_html`, `parent_id`, `updated_at`, `contract_types`.
- **Phase E (Complete)**: Contract Viewer & Preview Logic updated - Endpoints reconstructing legacy `content` field from atomic `header_text`/`body_html` for frontend compatibility. Preview rendering with level-based CSS classes.
- **Phase F (Complete)**: Smart Merge Ingestion - Heading 5 paragraphs >60 chars without list markers are merged into previous clause's bodyHtml instead of creating new tree nodes. Reduced clause count from 174 to 137. UI cleanup removed debug labels and added title truncation.

**Core Features & Design Patterns**:
- **Autosave System**: Debounced 2-second autosave for draft projects.
- **Contract Generation Wizard**: Structured, multi-step process for creating contract packages with dynamic pricing.
- **Unit Builder**: Allows adding home models (from `project_units` table) during contract generation.
- **Clause Library**: Comprehensive, searchable library of contract clauses with filtering and editing.
- **Variable Mappings**: System for configuring and mapping contract variables.
- **LLC Administration**: CRUD operations for child LLC entities.
- **Pricing Engine Integration**: Dynamic injection of pricing data into contracts.
- **Dynamic HTML Tables**: Contract variables like `{{PRICING_BREAKDOWN_TABLE}}` and `{{PAYMENT_SCHEDULE_TABLE}}` render as styled HTML tables in generated contracts.
- **Schedule Duration Variables**: Project-level schedule fields populate contract variables for Exhibit D schedules.
- **Unified Variable Mapping**: `server/lib/mapper.ts` serves as the single source of truth for variable definitions.
- **Intelligent Discovery-Based Contract Ingestor**: Script (`scripts/ingest_standard_contracts.ts`) automatically ingests .docx contract templates, derives contract types, extracts content based on Word styles, detects patterns, extracts variables, and builds a hierarchical clause structure. Supports single-file ingestion and appending.
- **State-Specific Provision Filtering**: Ingestor detects state-specific sections (e.g., "CALIFORNIA PROVISIONS") and tags clauses with conditions. The contract generator filters blocks based on `PROJECT_STATE`.
- **Contract Template Upload & Auto-Ingest**: UI and API for uploading .docx templates with automatic ingestion into the clause library.
- **Variable Registry Sync**: Script (`scripts/sync_variables.ts`) synchronizes variables used in clauses with a central registry, inferring data types and marking required fields.
- **8-Level Smart Logic Ingestor**: Maps Word styles to an 8-level hierarchy, detects smart tags like `[STATE_DISCLOSURE:XXXX]`, and handles service model conditions.
- **State Disclosure Double-Lookup System**: Uses a `state_disclosures` table for dynamic lookup of state-specific content based on `disclosure_code` and `PROJECT_STATE`.
- **Inline State Disclosure Tag Resolution**: Supports `[STATE_DISCLOSURE:XXXX]` tags embedded in clause content and exhibits. These tags are automatically resolved during contract generation by looking up the disclosure content from the state_disclosures table based on the tag code and project state. Tags are preloaded for performance and replaced with actual disclosure text.
- **4-Level Hierarchical Styling**: PDF contracts apply dynamic CSS styling for 4 hierarchy levels based on clause structure.
- **Exhibit Library**: Manages contract exhibits with CRUD functionality, supporting dynamic content, variable placeholders, and contract type associations.
- **State Disclosure Library Management**: Full CRUD UI for managing state-specific legal disclosures, with state/code filtering, accessible via Configuration menu. Supports 16 states (AZ, CA, CO, FL, GA, ID, IL, MA, MI, NV, NY, OR, PA, TX, UT, WA).
- **Universal Template Ingestor**: Enhanced UI for uploading various template types (Contract Agreement, Exhibit Library, State Disclosure Library) with intelligent ingestion logic for each.
- **Clause Explorer UI (Phase 10)**: Two-pane layout with 35% hierarchical tree panel and 65% editor+preview. Features L1-L8 nesting visualization with position-based numbering (e.g., 1, 1.1, 1.2), multi-select contract type tagging (ONE, CMOS, CRC, ONSITE), live HTML preview with hierarchy-aware styling, and drag-and-drop reordering with cycle detection.
- **Component Library**: Dedicated page for previewing dynamic TABLE variables (PRICING_BREAKDOWN_TABLE, PAYMENT_SCHEDULE_TABLE, UNIT_SPEC_TABLE) with live project data. Uses Sandbox project (ID: 106) for testing.
- **Multi-Contract Type Tagging**: Clauses support array of contract_types for flexible many-to-many associations. API filters with `ANY(contract_types)` for backward compatibility.

## External Dependencies

- **PostgreSQL**: Primary database.
- **Vite**: Frontend build tool.
- **React**: Frontend library.
- **Express.js**: Backend framework.
- **Tailwind CSS**: Styling framework.
- **Shadcn UI**: UI components.
- **TanStack Query v5**: Data fetching.
- **wouter**: Routing.
- **react-hook-form**: Form management.
- **zod**: Schema validation.
- **JAMS/AAA**: Referenced arbitration providers.
- **Odoo ERP**: Planned future integration.