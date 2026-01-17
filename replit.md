# Dvele Contract Manager

## Overview

Dvele Contract Manager is an internal contract management system for a modular home construction company. It handles construction projects, LLCs, and contracts with a focus on clarity, efficiency, and professional workflow management. The application follows a productivity-focused design system inspired by Linear, Notion, and Asana.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (light/dark mode support)
- **Form Handling**: React Hook Form with Zod validation via @hookform/resolvers

### Backend Architecture
- **Framework**: Express 5 running on Node.js with TypeScript
- **API Design**: RESTful JSON API with `/api` prefix
- **Build Process**: esbuild for server bundling, Vite for client bundling
- **Development**: Hot module replacement via Vite dev server middleware

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: Shared schema in `shared/schema.ts` for type safety across client and server
- **Validation**: Zod schemas generated from Drizzle schemas using drizzle-zod
- **Database**: PostgreSQL (connection via DATABASE_URL environment variable)

### Project Structure
```
client/           # React frontend
  src/
    components/   # UI components (app-specific and shadcn/ui)
    pages/        # Route pages (Dashboard, LLCAdmin, NewAgreement, Settings)
    hooks/        # Custom React hooks
    lib/          # Utilities and query client
server/           # Express backend
  routes.ts       # API route definitions
  storage.ts      # Database access layer
  db.ts           # Database connection
shared/           # Shared types and schemas
  schema.ts       # Drizzle schema definitions
```

### Key Data Models
- **LLCs**: Project entities with status tracking (pending, in_formation, active, dissolved)
- **Contracts**: Agreements linked to LLCs with status workflow (draft, pending_review, approved, signed, expired)
- **Users**: Basic authentication support

## External Dependencies

### Database
- PostgreSQL database required via `DATABASE_URL` environment variable
- Drizzle Kit for schema migrations (`npm run db:push`)

### UI Libraries
- Radix UI primitives for accessible components
- Lucide React for icons
- Embla Carousel for carousel functionality
- Recharts for charting (via shadcn/ui chart component)
- Vaul for drawer component

### Development Tools
- Replit-specific plugins for development (cartographer, dev-banner, runtime-error-modal)
- tsx for TypeScript execution in development