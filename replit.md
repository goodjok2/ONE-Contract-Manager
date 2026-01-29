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