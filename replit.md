# Dvele Contract Manager

A full-stack contract and LLC management application for a modular home company to manage construction projects and associated child LLCs.

## Overview

This application helps Dvele manage construction projects through dedicated child entities. Each project creates a specific child LLC (e.g., "Dvele Partners [Project] LLC"), and the app manages this relationship with contract generation.

## Tech Stack

- **Frontend**: React (Vite) with Tailwind CSS and Shadcn UI components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: TanStack Query v5
- **Routing**: wouter
- **Forms**: react-hook-form with zod validation

## Features

- **Dashboard**: Overview with stats cards showing Active Projects, Pending LLCs, and Total Contract Value (approved/signed contracts only)
- **LLC Administration**: Create and manage child LLC entities for construction projects
- **New Agreement**: Create contracts and associate them with LLCs
- **Settings**: Company configuration, notification preferences, and theme settings
- **Dark Mode**: Toggle between light and dark themes with localStorage persistence

## Project Structure

```
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── app-sidebar.tsx      # Main navigation sidebar
│   │   │   ├── theme-provider.tsx   # Dark mode context provider
│   │   │   ├── theme-toggle.tsx     # Theme toggle button
│   │   │   └── ui/                  # Shadcn UI components
│   │   ├── pages/
│   │   │   ├── dashboard.tsx        # Main dashboard with stats
│   │   │   ├── llc-admin.tsx        # LLC CRUD management
│   │   │   ├── new-agreement.tsx    # Contract creation form
│   │   │   └── settings.tsx         # App settings
│   │   └── App.tsx                  # Main app with routing
├── server/
│   ├── routes.ts                    # API endpoints
│   ├── storage.ts                   # Database operations
│   └── index.ts                     # Express server
└── shared/
    └── schema.ts                    # Drizzle schema with relations
```

## Database Schema

- **llcs**: Stores child LLC entities with name, project, status, formation details
- **contracts**: Stores agreements linked to LLCs with status, value, dates

## API Endpoints

- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/llcs` - List all LLCs
- `POST /api/llcs` - Create new LLC
- `DELETE /api/llcs/:id` - Delete LLC
- `GET /api/contracts` - List all contracts
- `POST /api/contracts` - Create new contract

## Design Decisions

- Forms use shadcn Form component with react-hook-form and zodResolver
- Dashboard totalContractValue only counts approved/signed contracts (draft contracts excluded)
- Dark mode uses ThemeProvider with localStorage sync
- Schema uses explicit Drizzle relations() for LLC-Contract relationship

## Running the Application

The application starts with `npm run dev` which runs both the Express backend and Vite frontend on port 5000.
