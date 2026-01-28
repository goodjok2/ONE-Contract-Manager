# Dvele Contract Manager

A full-stack contract and LLC management application for a modular home company to manage construction projects and associated child LLCs.

## Overview

This application helps Dvele manage construction projects through dedicated child entities. Each project creates a specific child LLC (e.g., "Dvele Partners [Project] LLC"), and the app manages this relationship with contract generation.

## Tech Stack

- **Frontend**: React (Vite) with Tailwind CSS and Shadcn UI components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL (contracts, LLCs, clauses) + SQLite (projects, clients, financials)
- **State Management**: TanStack Query v5
- **Routing**: wouter
- **Forms**: react-hook-form with zod validation

## Features

- **Dashboard**: Overview with 4 stat cards (Total Contracts, Drafts, Pending Review, Signed), Recent Contracts section, Quick Start Templates, and Contract Value Overview
- **Generate Contracts Wizard**: 9-step wizard at /generate-contracts for creating complete contract packages:
  - Step 1: Project Basics (name, type, total units)
  - Step 2: Service Model (CRC vs CMOS selection)
  - Step 3: Party Information (client details, contractor info for CRC, manufacturer/onsite contractor selection for subcontracts)
  - Step 4: Site & Property (address, multi-unit specifications with add/remove) - **moved before Child LLC**
  - Step 5: Child LLC (auto-generated name from site address) - **moved after Site & Property**
  - Step 6: Key Dates (effective, manufacturing start, completion)
  - Step 7: Financial Terms (comprehensive pricing and payment configuration):
    - Design Phase: Design fee ($1k-$100k), revision rounds
    - Preliminary Pricing: Offsite cost (auto-calculated from unit prices), delivery costs
    - CMOS-specific: Site prep (12%), Utilities (6%), Completion (8%) auto-calculated
    - Payment Milestones: 5 milestones summing to 95%, retainage settings (defaults: 20/20/20/20/15)
    - Manufacturing Payments: Design/production/delivery payment schedule
  - Step 8: Schedule & Warranty:
    - Project Schedule: Effective date, completion timeframe, phase durations
    - Timeline Visualization: Visual progress bar with phase dates
    - Warranty Terms: Fit & Finish (24mo), Building Envelope (60mo), Structural (120mo)
    - Legal Jurisdiction: State, county, federal district, arbitration provider (JAMS/AAA)
  - Step 9: Review & Generate:
    - Validation status banner (Ready to Generate / Missing Required Information)
    - Variable coverage indicator showing populated vs total variables
    - Collapsible sections: Project Overview, Parties, Property Details, Financial Terms, Schedule & Warranty
    - Edit links to jump back to specific steps
    - Contracts to be Generated section (ONE Agreement, Manufacturing Subcontract, OnSite Subcontract)
    - Clause Preview modal showing included clauses per contract
    - Generate Contract Package button (disabled until all required fields complete)
- **Autosave System**: Automatic draft saving to protect user progress
  - 2-second debounced autosave on data changes
  - Saves on step navigation (Next/Back/goToStep)
  - Creates draft with DRAFT suffix in project number
  - Preserves user-entered project numbers
  - Resume via URL: /generate-contracts?projectId={id}
  - Silent saving (no toast notifications during autosave)
- **Active Contracts**: List and manage all contracts and draft projects
  - Shows generated contract packages with expandable details
  - Shows draft projects with "Resume Draft" button to continue editing
  - Drafts link to /generate-contracts?projectId={id} for seamless resume
- **Templates**: Pre-configured contract templates (DTC Standard, B2B Developer)
- **Clause Library**: Browse 276 contract clauses with filtering by contract type (ONE/MANUFACTURING/ONSITE), hierarchy level (Sections/Subsections/Paragraphs), search, expandable rows showing conditional logic, and edit capability for legal team
- **Variable Mappings**: Configure contract variables with ERP integration support:
  - Stats cards showing Total Fields, ERP Mapped, Required counts
  - Search/filter by variable name or label
  - Table with Field Key, Label, Type, ERP Source, Clause Usage
  - Expandable rows showing which clauses use each variable
  - Add/Edit/Delete variables with Required flag and ERP source mapping
  - Prepares for future Odoo ERP integration
- **Contract Preview**: Preview clauses with CRC/CMOS service model toggle, variable preview showing populated/empty status, and comparison view between service models
- **LLC Administration**: Create and manage child LLC entities with auto-generated names, status tracking (forming/active/closed), member management, and compliance monitoring
- **LLC Detail Page**: Tabbed interface (Overview, Documents, Members, Compliance) for detailed LLC management
- **Settings**: Company configuration and theme settings
- **Dark Mode**: Toggle between light and dark themes

## Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── app-sidebar.tsx      # Navigation sidebar (Main + Configuration sections)
│   │   │   ├── theme-provider.tsx   # Dark mode context provider
│   │   │   ├── theme-toggle.tsx     # Theme toggle button
│   │   │   ├── wizard/              # Contract wizard components (modular refactor)
│   │   │   │   ├── WizardContext.tsx # Centralized wizard state management (React Context)
│   │   │   │   ├── WizardShell.tsx   # Main wizard container with progress, navigation
│   │   │   │   └── index.ts         # Barrel exports for wizard module
│   │   │   └── ui/                  # Shadcn UI components
│   │   ├── pages/
│   │   │   ├── dashboard.tsx        # Main dashboard with stats and templates
│   │   │   ├── agreements-new.tsx   # Contract creation wizard
│   │   │   ├── contracts.tsx        # Active contracts list
│   │   │   ├── templates.tsx        # Contract templates
│   │   │   ├── clause-library.tsx   # Clause library browser
│   │   │   ├── variable-mappings.tsx # Contract variable management with ERP integration
│   │   │   ├── llc-admin.tsx        # LLC CRUD management
│   │   │   ├── llc-detail.tsx       # LLC detail page with tabbed interface
│   │   │   └── settings.tsx         # App settings
│   │   └── App.tsx                  # Main app with routing
├── server/
│   ├── routes.ts                    # API endpoints
│   ├── storage.ts                   # PostgreSQL database operations
│   ├── db/                          # SQLite database (Drizzle)
│   │   ├── index.ts                 # Database connection
│   │   └── schema.ts                # SQLite schema (projects, clients, child_llcs, financials)
│   └── lib/
│       └── mapper.ts                # Contract template variable mapper
└── shared/
    └── schema.ts                    # PostgreSQL schema (llcs, contracts, users)
```

## Database Schema

### PostgreSQL (Consolidated)
All data now uses PostgreSQL tables:
- **llcs**: LLC entities with full administration features (name, projectId, status, EIN, registered agent, compliance tracking, members)
- **contracts**: Agreements with status, value, dates
- **clauses**: Contract clauses with hierarchy, content, conditions
- **projects**: Project information with number, name, status, state
- **clients**: Client details linked to projects  
- **financials**: Budget information (design fee, prelim offsite/onsite)
- **projectDetails**: Additional project metadata
- **milestones**: Payment milestone definitions
- **warrantyTerms**: Warranty period configurations
- **contractors**: Project-specific contractor assignments (manufacturer, onsite_general) linked to projects
- **contractor_entities**: Reusable contractor entities (manufacturers, on-site contractors) with legal info, licensing, contact details
- **contract_variables**: Variable definitions for contract generation with ERP mapping support

## API Endpoints

- `GET /api/dashboard/stats` - Dashboard statistics (contract counts and values by status)
- `GET /api/contracts` - List all contracts
- `POST /api/contracts` - Create new contract
- `GET /api/projects` - List all projects with relations
- `POST /api/projects` - Create new project with client, LLC, and financials
- `GET /api/llcs` - List all LLCs
- `GET /api/llcs/:id` - Get single LLC by ID
- `POST /api/llcs` - Create new LLC
- `PATCH /api/llcs/:id` - Update LLC fields (status, members, compliance, etc.)
- `DELETE /api/llcs/:id` - Delete LLC
- `GET /api/clauses` - List clauses with optional filters (contractType, hierarchyLevel, search)
- `PATCH /api/clauses/:id` - Update clause (name, content, risk_level, negotiable)
- `GET /api/variables` - List all contract variables by category
- `GET /api/variable-mappings` - List all variables with stats and clause usage
- `POST /api/variable-mappings` - Create new variable
- `PATCH /api/variable-mappings/:id` - Update variable
- `DELETE /api/variable-mappings/:id` - Delete variable
- `POST /api/contracts/compare-service-models` - Compare CRC vs CMOS clause differences
- `GET /api/contractor-entities` - List all contractor entities (optionally filter by type)
- `GET /api/contractor-entities/type/:type` - Get contractor entities by type (manufacturer/onsite)
- `POST /api/contractor-entities` - Create new contractor entity
- `PATCH /api/contractor-entities/:id` - Update contractor entity

## Navigation Structure

### Main Section
- Dashboard
- Generate Contracts (/generate-contracts)
- Active Contracts (/contracts)
- LLC Admin (/llc-admin)
- Templates (/templates)

### Configuration Section
- Clause Library (/clause-library)
- Variable Mappings (/variable-mappings)
- Contract Preview (/contract-preview)
- Settings (/settings)

## Design Decisions

- Dashboard shows 4 stat cards (Total Contracts, Drafts, Pending Review, Signed)
- Contract Value Overview shows breakdown by status (Drafts, Pending, Signed values)
- Forms use shadcn Form component with react-hook-form and zodResolver
- Dark mode uses ThemeProvider with localStorage sync
- Multi-step wizard for creating new agreements with step validation

## Running the Application

The application starts with `npm run dev` which runs both the Express backend and Vite frontend on port 5000.

## Development Notes

### Wizard Module Refactoring

The Generate Contracts wizard is being refactored into modular components:

- **WizardContext.tsx**: Centralized state management using React Context
  - Provides `useWizard` hook for accessing wizard state and actions
  - Exports: `WizardProvider`, `useWizard`, constants (`US_STATES`, `ENTITY_TYPES`, `FEDERAL_DISTRICTS`)
  - Contains `SHELL_TESTING_MODE` flag for development
  
- **WizardShell.tsx**: Main wizard container component
  - Progress indicator with step count and percentage
  - Step pills for navigation between steps
  - Navigation buttons (Back, Save Draft, Next)
  - Validation error display

- **Shell Testing Mode**: 
  - Single source of truth: Exported from `WizardContext.tsx` as `SHELL_TESTING_MODE`
  - Imported by `WizardShell.tsx` for consistent behavior
  - When `SHELL_TESTING_MODE = true`:
    - Form validation is skipped (can advance without filling fields)
    - All step indicators are clickable (can jump to any step)
    - Enables testing wizard navigation and UI without implementing forms
  - **Important**: Set `SHELL_TESTING_MODE = false` before adding actual step content components
  - To disable: Change the export in `WizardContext.tsx` line 7

### LLC Naming Convention

Child LLCs use the format "DP + Project_Address + LLC" (e.g., "DP 123 Main Street LLC"):
- **Generate Contracts Wizard**: Uses `generateLLCName()` from `client/src/lib/llcUtils.ts` with site address
- **LLC Admin**: Uses the same utility with project address field
- **Legacy Pages**: Use inline naming with project name when address is unavailable

LLC name is editable until status changes to "active" or "formed". When completing the Generate Contracts wizard, a new child LLC is auto-created in "forming" status.

### Backup Files

- `generate-contracts.old.tsx`: Full implementation backup of the original 9-step wizard for reference when extracting step components
