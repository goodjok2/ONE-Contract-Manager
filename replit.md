# Dvele Contract Manager

A full-stack contract and LLC management application for a modular home company to manage construction projects and associated child LLCs.

## Overview

This application helps Dvele manage construction projects through dedicated child entities. Each project creates a specific child LLC (e.g., "Dvele Partners [Project] LLC"), and the app manages this relationship with contract generation.

## Tech Stack

- **Frontend**: React (Vite) with Tailwind CSS and Shadcn UI components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL (legacy contracts/LLCs) + SQLite (projects/clients/financials)
- **State Management**: TanStack Query v5
- **Routing**: wouter
- **Forms**: react-hook-form with zod validation

## Features

- **Dashboard**: Overview with 4 stat cards (Total Contracts, Drafts, Pending Review, Signed), Recent Contracts section, Quick Start Templates, and Contract Value Overview
- **Contract Builder**: Multi-step wizard for creating new project agreements
- **Generate Contracts Wizard**: 8-step wizard at /generate-contracts for creating complete contract packages:
  - Step 1: Project Basics (name, type, total units)
  - Step 2: Service Model (CRC vs CMOS selection)
  - Step 3: Party Information (client details, contractor info for CRC)
  - Step 4: Child LLC (auto-generated name)
  - Step 5: Site & Property (address, multi-unit specifications with add/remove)
  - Step 6: Key Dates (effective, manufacturing start, completion)
  - Step 7: Financial Terms (comprehensive pricing and payment configuration):
    - Design Phase: Design fee ($1k-$100k), revision rounds
    - Preliminary Pricing: Offsite/delivery costs, CMOS-specific fields
    - Payment Milestones: 5 milestones summing to 95%, retainage settings
    - Manufacturing Payments: Design/production/delivery payment schedule
  - Step 8: Review & Generate
- **Active Contracts**: List and manage all contracts
- **Templates**: Pre-configured contract templates (DTC Standard, B2B Developer)
- **Clause Library**: Browse 276 contract clauses with filtering by contract type (ONE/MANUFACTURING/ONSITE), hierarchy level (Sections/Subsections/Paragraphs), search, expandable rows showing conditional logic, and edit capability for legal team
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
│   │   │   └── ui/                  # Shadcn UI components
│   │   ├── pages/
│   │   │   ├── dashboard.tsx        # Main dashboard with stats and templates
│   │   │   ├── agreements-new.tsx   # Contract creation wizard
│   │   │   ├── contracts.tsx        # Active contracts list
│   │   │   ├── templates.tsx        # Contract templates
│   │   │   ├── clause-library.tsx   # Clause library (placeholder)
│   │   │   ├── erp-fields.tsx       # ERP integration (placeholder)
│   │   │   ├── state-requirements.tsx # State requirements (placeholder)
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

### PostgreSQL (Legacy)
- **llcs**: Child LLC entities with name, project, status, formation details
- **contracts**: Agreements with status, value, dates

### SQLite (New Projects System)
- **projects**: Project information with number, name, status, state
- **clients**: Client details linked to projects
- **child_llcs**: Child LLC entities linked to projects
- **financials**: Budget information (design fee, prelim offsite/onsite)

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
- `POST /api/contracts/compare-service-models` - Compare CRC vs CMOS clause differences

## Navigation Structure

### Main Section
- Dashboard
- Contract Builder (/agreements/new)
- Clause Library
- Active Contracts
- Templates

### Configuration Section
- ERP Fields
- State Requirements
- Settings

## Design Decisions

- Dashboard shows 4 stat cards (Total Contracts, Drafts, Pending Review, Signed)
- Contract Value Overview shows breakdown by status (Drafts, Pending, Signed values)
- Forms use shadcn Form component with react-hook-form and zodResolver
- Dark mode uses ThemeProvider with localStorage sync
- Multi-step wizard for creating new agreements with step validation

## Running the Application

The application starts with `npm run dev` which runs both the Express backend and Vite frontend on port 5000.
