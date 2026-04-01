# Pottery Shop Management System (نظام إدارة محل الفخار)

## Overview

A full-stack Sales & Inventory Control System for a pottery/ceramic shop ("الفخاريات الراقية" / Alfukhariyat Alraqiya). The application is designed to prevent any sales, expenses, or inventory movements outside the system, providing complete financial visibility and real-time inventory tracking.

**Core Features:**
- Point of Sale (POS) system with barcode scanning (camera-based and manual input)
- Product/inventory management with SKU tracking, low-stock alerts, and support for multiple product types (ready, handmade, material, tool, workshop)
- Purchase tracking for incoming inventory with supplier management
- Expense management (fixed and variable costs)
- Custom order tracking with status workflow (pending → in_progress → completed → cancelled)
- Fund transfers between payment methods (cash, bank transfer, online)
- User management with role-based access control (owner, manager, staff)
- Dashboard with comprehensive sales statistics and analytics
- Invoice generation (PDF) with Arabic shop branding
- Daily and monthly report generation (PDF) with email delivery
- Backup system (JSON and PDF formats) with scheduled daily backups
- AI integration via Google Gemini (chat, image generation, batch processing) through Replit AI Integrations
- Bilingual Arabic/English interface with automatic RTL/LTR switching
- Tajawal font for Arabic, Inter for English
- Dark/light theme support with customizable color themes
- Settings page for store branding, invoice customization, and theme selection

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight React router) — chosen for simplicity over React Router
- **State Management:** TanStack React Query v5 for server state management with cache invalidation patterns
- **Styling:** Tailwind CSS with shadcn/ui component library (new-york style variant)
- **Theme:** next-themes for dark/light mode support with multiple color theme options stored in localStorage
- **Charts:** Recharts for data visualization on the Analytics page
- **Animations:** Framer Motion for page transitions
- **Date Handling:** date-fns with Arabic locale
- **Barcode Scanning:** html5-qrcode for camera-based barcode/QR scanning
- **PDF Generation (client-side):** jsPDF for invoice generation
- **i18n:** Custom React Context-based bilingual system (Arabic/English) with localStorage persistence, automatic RTL/LTR switching
- **Design Direction:** Dynamic RTL/LTR layout based on selected language
- **Design Theme:** Custom pottery aesthetic with earthy tones (terracotta, sand, sage) using CSS custom properties

**Directory Structure:**
- `client/src/pages/` — Route-level page components (Dashboard, Pos, Products, Purchases, Expenses, SalesLedger, PurchasesLedger, Invoices, CustomOrders, Analytics, Backups, FundTransfers, Settings, Users, Login)
- `client/src/components/` — Reusable UI components including layout (AppLayout, Sidebar), BarcodeScanner, FloatingScannerButton, StatCard
- `client/src/components/ui/` — shadcn/ui primitive components
- `client/src/hooks/` — Custom React hooks for data fetching (use-auth, use-products, use-sales, use-purchases, use-expenses, use-stats)
- `client/src/lib/` — Utility functions (queryClient with apiRequest helper, cn utility)

### Backend Architecture
- **Framework:** Express.js with TypeScript (runs via tsx in dev, esbuild bundle in production)
- **Database ORM:** Drizzle ORM with PostgreSQL (node-postgres driver)
- **Authentication:** Passport.js with local strategy (username/password)
- **Session Management:** express-session with MemoryStore (via memorystore package) for development, connect-pg-simple available for production
- **Password Security:** Node.js crypto scrypt hashing with random salt
- **File Uploads:** Multer with disk storage (uploads/ directory), 5MB limit, images and PDFs only
- **Scheduled Tasks:** node-cron for daily automated backups
- **PDF Generation (server-side):** PDFKit for backup reports, jsPDF for invoices and reports
- **Email:** Nodemailer for sending reports and invoices via email
- **AI Integration:** Google Gemini via Replit AI Integrations (@google/genai) for chat, image generation, and batch processing

**API Routes (RESTful under `/api/`):**
- `/api/auth/*` — Authentication (login, logout, me)
- `/api/products/*` — Product CRUD operations
- `/api/sales/*` — Sales transactions with line items
- `/api/purchases/*` — Purchase/inventory intake with line items
- `/api/expenses/*` — Expense tracking (fixed/variable)
- `/api/users/*` — User management (CRUD, role assignment)
- `/api/stats/*` — Dashboard statistics and analytics data
- `/api/custom-orders/*` — Custom order management
- `/api/fund-transfers/*` — Fund transfer between payment methods
- `/api/invoices/*` — Invoice PDF generation and email
- `/api/backups/*` — Backup creation, listing, download, deletion
- `/api/reports/*` — Monthly and daily report generation
- `/api/conversations/*` — AI chat conversations (Replit integration)
- `/api/generate-image` — AI image generation (Replit integration)

**Server Directory Structure:**
- `server/index.ts` — Express app setup, middleware, HTTP server creation
- `server/routes.ts` — All API route registration, authentication setup, cron jobs
- `server/storage.ts` — Data access layer (IStorage interface with Drizzle implementation)
- `server/db.ts` — Database connection (PostgreSQL via node-postgres Pool + Drizzle)
- `server/invoices.ts` — Invoice PDF generation logic
- `server/reports.ts` — Monthly report generation
- `server/daily-report.ts` — Daily report generation
- `server/backup-pdf.ts` — Backup PDF generation
- `server/static.ts` — Production static file serving
- `server/vite.ts` — Development Vite middleware setup
- `server/replit_integrations/` — AI integration modules (chat, image, batch)

### Shared Code
- `shared/schema.ts` — Drizzle ORM table definitions and Zod validation schemas (users, products, sales, saleItems, expenses, purchases, purchaseItems, customOrders, fundTransfers, storeSettings)
- `shared/routes.ts` — API contract definitions with Zod schemas for request/response validation
- `shared/models/chat.ts` — Chat conversation and message table definitions for AI integration

### Database Schema (PostgreSQL via Drizzle ORM)
Key tables:
- **users** — id, username, password (hashed), name, role (owner/manager/staff), isActive, apiKey
- **products** — id, sku (unique), name, type (ready/handmade/material/tool/workshop), category, purchasePrice, salePrice, quantity, minStockLevel, supplier, artisanName, isUnique, manufacturingTime, isActive
- **sales** — id, userId, totalAmount, paymentMethod, discount, customerName/Email/Phone, notes, date
- **saleItems** — id, saleId, productId, quantity, unitPrice
- **purchases** — id, userId, supplier, totalAmount, paymentMethod, notes, date
- **purchaseItems** — id, purchaseId, productId, quantity, costPrice
- **expenses** — id, category, amount, type (fixed/variable), notes, date
- **customOrders** — custom handmade orders with status workflow
- **fundTransfers** — transfers between payment methods (cash ↔ transfer ↔ online)
- **storeSettings** — key-value store for application configuration
- **conversations** / **messages** — AI chat history

### Build System
- **Development:** `tsx server/index.ts` with Vite dev server middleware for HMR
- **Production Build:** Custom build script (`script/build.ts`) that runs Vite for client build and esbuild for server bundling
- **Database Migrations:** `drizzle-kit push` for schema synchronization

### Role-Based Access Control
- **Owner:** Full access to all features including user management, settings, and destructive operations
- **Manager:** Access to most features, can delete records
- **Staff:** Basic POS and inventory operations only

## External Dependencies

### Database
- **PostgreSQL** — Primary data store, connected via `DATABASE_URL` environment variable
- **Drizzle ORM** — Type-safe SQL query builder and schema management
- **drizzle-kit** — Database migration tooling (`db:push` command)

### AI Services (Replit AI Integrations)
- **Google Gemini** via `@google/genai` package
  - `gemini-2.5-flash` — Fast text generation for chat
  - `gemini-2.5-pro` — Advanced reasoning
  - `gemini-2.5-flash-image` — Image generation
- Environment variables: `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`

### Email
- **Nodemailer** — For sending invoice PDFs, daily/monthly reports, and backup files via email

### PDF Generation
- **jsPDF** — Client-side and server-side invoice/report PDF generation
- **PDFKit** — Server-side backup PDF generation

### Key NPM Packages
- `passport` + `passport-local` — Authentication
- `express-session` + `memorystore` + `connect-pg-simple` — Session management
- `multer` — File upload handling
- `node-cron` — Scheduled task execution (daily backups)
- `html5-qrcode` — Barcode/QR code scanning in browser
- `recharts` — Data visualization charts
- `date-fns` — Date formatting with Arabic locale support
- `framer-motion` — Animations
- `next-themes` — Theme management
- `zod` + `drizzle-zod` — Runtime validation
- `nanoid` — Unique ID generation