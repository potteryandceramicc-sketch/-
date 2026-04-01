# Pottery Shop Management System (نظام إدارة محل الفخار)

## Overview

A full-stack Sales & Inventory Control System for a pottery/ceramic shop. The application is designed to prevent any sales, expenses, or inventory movements outside the system, providing complete visibility into cash flow, profit margins, and real-time inventory tracking. The interface supports bilingual Arabic/English with automatic RTL/LTR switching and an earthy pottery-themed design.

**Core Features:**
- Point of Sale (POS) system for processing sales
- Product/inventory management with low-stock alerts
- Purchase tracking for incoming inventory
- Expense management (fixed and variable costs)
- User management with role-based access (owner, manager, staff)
- Dashboard with sales statistics and analytics

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Routing:** Wouter (lightweight React router)
- **State Management:** TanStack React Query for server state
- **Styling:** Tailwind CSS with shadcn/ui component library
- **Theme:** next-themes for dark/light mode support
- **Charts:** Recharts for data visualization
- **Design System:** Custom pottery theme with earthy tones (terracotta, sand, sage)

The frontend uses a component-based architecture with:
- `client/src/pages/` - Route-level page components
- `client/src/components/` - Reusable UI components
- `client/src/hooks/` - Custom React hooks for data fetching
- `client/src/lib/` - Utility functions and query client configuration

### Backend Architecture
- **Framework:** Express.js 5 with TypeScript
- **Database ORM:** Drizzle ORM with PostgreSQL
- **Authentication:** Passport.js with local strategy (username/password)
- **Session Management:** express-session with MemoryStore (development) or connect-pg-simple (production)
- **Password Security:** scrypt hashing with salt

API routes follow RESTful conventions under `/api/`:
- `/api/auth/*` - Authentication endpoints
- `/api/products/*` - Product CRUD operations
- `/api/sales/*` - Sales transactions
- `/api/purchases/*` - Purchase/inventory intake
- `/api/expenses/*` - Expense tracking
- `/api/users/*` - User management
- `/api/stats/*` - Dashboard statistics

### Data Layer
- **Schema Location:** `shared/schema.ts` - Shared between frontend and backend
- **Validation:** Zod schemas generated from Drizzle schemas using drizzle-zod
- **API Contracts:** Type-safe API definitions in `shared/routes.ts`

Key entities:
- Users (with roles: owner, manager, staff)
- Products (types: ready, handmade, material, tool, workshop)
- Sales and SaleItems
- Purchases and PurchaseItems
- Expenses (fixed/variable)

### Build System
- **Development:** Vite dev server with HMR
- **Production Build:** Vite for frontend, esbuild for backend bundling
- **Database Migrations:** Drizzle Kit with `db:push` command

## External Dependencies

### Database
- **PostgreSQL** - Primary data store
- Connection via `DATABASE_URL` environment variable
- Drizzle ORM for type-safe queries

### Authentication
- Cookie-based sessions
- Session secret via `SESSION_SECRET` environment variable

### UI Component Libraries
- **shadcn/ui** - Pre-built accessible components based on Radix UI primitives
- **Radix UI** - Headless UI primitives for accessibility
- **Lucide React** - Icon library

### Fonts
- **Tajawal** - Arabic font family loaded from Google Fonts
- Additional fonts: Architects Daughter, DM Sans, Fira Code, Geist Mono

### Development Tools (Replit-specific)
- `@replit/vite-plugin-runtime-error-modal` - Error overlay
- `@replit/vite-plugin-cartographer` - Development tooling
- `@replit/vite-plugin-dev-banner` - Development banner

## Recent Changes

- **AI OCR Service Fixed**: Successfully fixed the "AI service not configured" error by implementing a native fetch-based connection to the Replit AI Integration endpoint. This bypasses SDK initialization issues and provides more reliable product code scanning.
- **System Startup Fixed**: Fixed a crash caused by a missing Gemini API key. The system now starts normally and handles the absence of the key gracefully.
- **Dependency Management**: Installed all required Node.js 22 dependencies and updated the environment.
- **Database Initialization**: Successfully pushed the database schema and initialized the tables, fixing "relation does not exist" errors.
- **OCR Logic Update**: Refactored the AI-powered OCR code to match the correct Google Gemini 1.5 Flash API structure for better reliability.
- **Workflow Configuration**: Set up the "Start System" workflow to automatically run the development server on port 5000.
- **Email Integration**: Configured the system to use the user's Gmail account for sending invoices, daily reports, and backups.
- **Daily Metrics Section**: Shows today's sales, orders count, sold items cost, actual profit (sales - cost - variable expenses)
- **Inventory Value Card**: Displays total current inventory cost
- **Fixed Expenses Section**: Lists all fixed expenses for the month with category, amount, and date
- **Aggregate Reports Section**: Weekly sales, monthly sales, monthly purchases, total monthly expenses
- **Monthly PDF Reports**: Download PDF report button, automatic email to potteryandceramicc@gmail.com

### POS System Updates
- Added optional customer name and email fields in checkout
- Discount field at sale level (not just item level)
- All fields saved to database for reporting

### Email Integration
- Nodemailer configured for Gmail
- Monthly financial reports sent as PDF attachments
- Environment variables: EMAIL_USER, EMAIL_PASS required for email functionality

### Sales & Purchases
- **Sales Ledger**: Shows product names with expandable details showing all items per sale
- **Purchases Ledger**: New page showing purchase history with supplier, products, and expandable item details
- **POS System**: Seller selection dropdown populated from users list (required before completing sale)
- **Auto-Expense**: Purchases automatically create expense entries with category "مشتريات مخزون"

### User Management
- Owner can edit employee details (name, role) and optionally change passwords
- All authenticated users can view user list (for seller selection in POS)

### Products
- Fixed product edit functionality with working edit dialog for all product fields

### UI/UX
- Redesigned login page with gradient background and pottery-themed decorations
- Added purchases ledger link to sidebar navigation

### Smart Invoice System (January 2026)
- **Invoice PDF Generation**: Professional English invoices auto-generated after each sale
- **Invoice Design**: Modern, clean, minimal with shop logo, QR code, two phone numbers, return policy
- **Invoice Content**: Invoice number (INV-YEAR-XXXXX), date, customer name/phone, products table, subtotal, discount, total
- **Auto-Email**: Invoices automatically sent to shop email (potteryandceramicc@gmail.com) and customer email if provided
- **Invoices Page**: New page at /invoices showing all invoices grouped by customer with downloadable PDFs
- **Customer Phone Field**: Added optional phone field to POS checkout
- **Invoice Download**: PDF download available from both Invoices page and direct API endpoint (/api/invoices/:saleId/download)

### API Key System
- Owners can generate secure API keys with full system permissions
- Keys grant owner-level access for external integrations
- API key management in user settings

### Advanced Visual Analytics (February 2026)
- **Analytics Page**: New /analytics page with comprehensive data visualization
- **Top Products Chart**: Bar chart showing top 10 selling products by quantity and revenue
- **Peak Hours Analysis**: Bar chart displaying sales count and revenue by hour of day
- **Monthly Profits Comparison**: Line chart comparing sales, expenses, and profit trends over 12 months
- **Revenue Distribution**: Pie chart showing revenue percentage by product
- **Summary Cards**: Total revenue, total quantity sold, peak hour, and 12-month profit overview
- **API Endpoints**: /api/analytics/top-products, /api/analytics/peak-hours, /api/analytics/monthly-profits

### Automated Backup System (February 2026)
- **Backup Management Page**: New /backups page for managing system backups
- **Create Backups**: One-click backup creation (owner-only) storing all system data as JSON or PDF
- **PDF Reports**: English-only professional PDF backup reports with products (by SKU), sales, expenses summary
- **Currency**: All PDF reports use Qatar Riyal (QAR) currency
- **Automated Daily Backups**: PDF backup generated automatically at 23:59 (Oman timezone) daily
- **Email Notifications**: Daily backup PDF automatically emailed to shop email (potteryandceramicc@gmail.com)
- **Backup Contents**: Products, sales, expenses, purchases, custom orders all included
- **Download Backups**: Download backup files as JSON or PDF for external storage
- **Delete Backups**: Owner-only backup deletion with confirmation dialog
- **Storage Statistics**: Shows backup count (JSON/PDF), last backup date, and total storage size
- **API Endpoints**: /api/backups/create (POST), /api/backups/create-pdf (POST), /api/backups (GET), /api/backups/:filename/download (GET), /api/backups/:filename/download-pdf (GET), /api/backups/:filename (DELETE)
- **Cron Job**: node-cron scheduled task for end-of-day automated backup with timezone support

### UI/UX Improvements (February 2026)
- **Enhanced Dashboard**: New financial summary section with gross profit, net profit, and profit margin calculations
- **Gradient Cards**: Modern gradient background cards for key metrics with professional styling
- **Products Filter**: Fully functional filter system with product type and low stock filters
- **Visual Consistency**: Improved CSS with better shadows, transitions, and hover effects
- **Responsive Design**: Better mobile responsiveness across all pages
- **Color Scheme**: Refined pottery-themed color palette with improved contrast

### Daily Financial Report System (February 2026)
- **Comprehensive Daily Report**: New daily financial report with complete accounting summary
- **Report Contents**: Daily sales, expenses breakdown (fixed/variable), purchases, inventory status, net profit calculations
- **Auto Email**: Daily report automatically sent to potteryandceramicc@gmail.com at 23:59 (Oman time)
- **PDF Download**: Download daily report from Dashboard (/api/reports/daily/download)

### Mobile Barcode Scanning (February 2026)
- **BarcodeScanner Component**: Reusable camera-based scanner with barcode reading and AI-powered OCR
- **Barcode Reading**: Uses html5-qrcode library for fast barcode/QR code scanning
- **AI-Powered OCR**: Uses Gemini Vision AI for accurate reading of handwritten/printed 4-digit product codes (0000-9999)
- **Manual Input**: Keyboard button allows manual entry of 4-digit code when scanning fails
- **Camera Controls**: Front/back camera selection with toggle button, flash/torch control
- **Audio/Haptic Feedback**: Beep sounds and vibration on successful scans
- **POS Integration**: Scan button in POS page with continuous scanning mode for fast checkout
- **Product Search**: Products searched by SKU suffix (e.g., scan "0012" finds "VASE-0012")
- **Multiple Products Handling**: Popup dialog for selecting when multiple products match same number
- **Products Page Integration**: Scan button to fill SKU field when adding/editing products
- **Auto-redirect**: When scanned code not found, redirects to Products page with pre-filled SKU
- **API Endpoints**: /api/products/by-suffix/:suffix for SKU suffix search, /api/ocr/read-number for AI-powered OCR
- **Professional PDF Design**: Color-coded sections, financial summary box, sales details table
- **Currency**: All reports use Qatar Riyal (QAR)
- **Products in PDF**: Listed by SKU code (not Arabic names) for English-only PDF reports

### Comprehensive Settings Page (February 2026)
- **Settings Page**: New /settings page (owner/manager access) with multiple configuration sections
- **Store Info**: Editable shop name (Arabic/English), two phone numbers displayed on invoices
- **Logo Upload**: Upload custom shop logo that appears on invoices and PDF reports
- **Return Policy**: Editable text field for return policy displayed on invoices
- **Theme Color Picker**: 8 color themes (terracotta, sage, ocean, plum, rose, gold, charcoal, teal) - changes primary color across entire app
- **Theme Persistence**: Theme color saved to database and loaded on app startup via ThemeColorLoader
- **User Performance Analytics**: Click any employee to see their weekly/monthly sales stats (total sales, revenue, items sold, detailed sales list)
- **Dynamic Invoice Settings**: Invoice PDF generation uses store settings from database instead of hardcoded values
- **Store Settings Table**: New `store_settings` key-value table in database
- **API Endpoints**: /api/settings (GET/PUT), /api/settings/logo (POST/GET), /api/users/:id/performance (GET)
- **Sidebar Integration**: Settings link added to owner/manager section of sidebar