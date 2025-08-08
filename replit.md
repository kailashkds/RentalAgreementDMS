# Overview

This is a comprehensive Document Management System (DMS) specifically designed for legal document generation and management. The application provides a web-based admin panel for creating, managing, and tracking multiple document types including rental agreements, promissory notes, power of attorney, and other legal documents. The system features a 5-step document creation wizard with step validation, multi-language support (English, Hindi, Gujarati, Tamil, Marathi), customer management, society/property management, and file storage capabilities with granular access control.

## Recent Changes

- **Agreement List Data Display Fixed (Aug 8, 2025)**: Resolved field mapping issues causing "not available" messages in agreement list
- **Action Buttons Implementation**: Complete functionality for Edit, Show, Download, Renew, and Duplicate agreement actions
- **Data Structure Optimization**: Fixed property address, landlord name, tenant name, and agreement period display with proper fallback logic
- **API Endpoints Enhancement**: Added authenticated renew and duplicate endpoints with proper error handling
- **PDF Template Management System**: Complete implementation with database schema, CRUD API endpoints, professional UI, and advanced template editor
- **Template Editor Features**: 3-tab interface (Basic Info, Template Editor, Preview) with intelligent dynamic field insertion and live HTML preview
- **Dynamic Field Categories**: Organized buttons for Owner, Tenant, Property, Rental Terms, and Agreement fields with one-click insertion
- **Template Filtering**: Filter templates by document type (Rental Agreement, Promissory Note, etc.) and language (English, Hindi, Gujarati, Tamil, Marathi)
- **Sample Templates**: Built-in professional rental agreement template with proper styling and all dynamic fields
- **Production Deployment Fixed**: Resolved session handling and authentication issues preventing login in production environment
- **Session Management**: Fixed cookie security settings, session persistence, and proper HTTPS handling for production
- **Admin User Initialization**: Implemented robust admin user creation with retry logic for both development and production
- **Authentication Flow**: Fixed post-login redirect loop by implementing proper session saving and page reload strategy
- **Address Autocomplete System**: Fixed production authentication issues, now fully functional in both development and production with intelligent text input fields, database search, and auto-fill for society, area, city, and pincode
- **Production Domain**: Successfully deployed to office.quickkaraar.com with admin/admin123 credentials
- **Step Validation System**: Comprehensive validation preventing progression without completing required fields across all 5 wizard steps
- **Enhanced Document Upload UI**: Professional interface with visual feedback, file size limits, and upload status indicators
- **Conditional Logic System**: Smart field replacement with if-else conditions for maintenance charge handling
- **Amount-to-Words Conversion**: Automatic conversion of numeric amounts to Indian format words (25000 → "Twenty Five Thousand")
- **Mobile Number Auto-Fill (Aug 8, 2025)**: Enhanced mobile lookup feature that automatically fills landlord/tenant details when existing mobile numbers are entered
- **Language Selection Fix (Aug 8, 2025)**: Fixed Gujarati language PDF generation bug, created Gujarati templates, and corrected language passing to PDF generator
- **Auto-Save Final Step (Aug 8, 2025)**: Removed "Create Agreement" button from final step, agreement now auto-saves when proceeding from step 4 to completion
- **Complete Gujarati Translation (Aug 8, 2025)**: Fixed step navigation titles and state field placeholders to display properly in Gujarati, achieving complete form translation
- **Smart PDF Field Formatting System (Aug 8, 2025)**: Implemented intelligent automatic formatting for ALL PDF placeholders based on field characteristics - no hardcoding required. System automatically detects and formats: string fields with underscores (property_purpose → Property Purpose), date fields (2025-08-08 → 08-08-2025), and preserves critical fields like IDs, amounts, and contact information. Fully scalable for any new fields added in the future.
- **Enhanced PDF Generation Button (Aug 8, 2025)**: Replaced dual-button system with single interactive state-driven button in Step 5. Features three states: "Create PDF" (blue) → "Creating PDF..." (with spinner) → "Download PDF" (green with icon). Provides professional user experience with visual feedback, prevents multiple clicks, and integrates agreement creation with PDF generation in one smooth workflow.
- **Field Mapping System Debugging (Aug 8, 2025)**: Fixed mapping conflicts where both `propertyDetails.furnishedStatus` and `rentalTerms.furniture` were mapping to `{{PROPERTY_FURNISHED_STATUS}}`. Removed duplicate mapping and added debugging logs to main PDF generation route to ensure proper formatting: "fully_furnished" → "Fully Furnished", "commercial" → "Commercial".
- **Cache Issue Resolution & Code Optimization (Aug 8, 2025)**: Resolved caching issues causing testing confusion between development and deployed versions. Frontend now uses correct `/api/agreements/generate-pdf` endpoint with proper data structure. Cleaned up all debugging logs for production-ready code. Both PDF field formatting ("commercial" → "Commercial", "semi_furnished" → "Semi Furnished") and Step 5 button display (only enhanced PDF button, no Next button) working correctly.
- **Final Label Translation Fixes (Aug 8, 2025)**: Completed comprehensive fix of all remaining form label issues. Fixed display of technical keys like "addressDetails", "aadharCard", "societyApartment", "copyCustomerDetails" with proper user-friendly labels. Added all missing translation keys for both English and Gujarati languages. Enhanced field validation and placeholder text throughout the form.
- **Units Correction for Notice Period & Minimum Stay (Aug 8, 2025)**: Fixed field labels and placeholders to correctly display "Notice Period (Months)" and "Minimum Stay (Months)" instead of days. Added helpful placeholder examples and validation to ensure proper data entry in months format.
- **PDF Template Editor Layout Fix (Aug 8, 2025)**: Resolved critical dialog layout issues where action buttons (Update Template/Cancel) were not visible in Template Editor tab. Fixed height constraints and scrolling behavior to ensure buttons are always accessible across all tabs (Basic Info, Template Editor, Preview) with proper content overflow handling.
- **Comprehensive Translation Key Fix (Aug 8, 2025)**: Permanently resolved recurring labeling issue where technical field names displayed instead of user-friendly labels. Conducted complete audit of all 95 translation keys used in AgreementWizard component. Added 14 missing translation keys for both English and Gujarati including: fullName, mobileNumber, copyFromCustomer, uploadPanCard, additionalClauses, and other essential form labels. This comprehensive solution prevents future occurrences of technical keys showing instead of proper translations.
- **Additional Clauses Dynamic Field Integration (Aug 8, 2025)**: Added Additional Clauses dynamic field to PDF Template Editor Agreement Fields section with {{ADDITIONAL_CLAUSES}} placeholder. Enhanced server-side field mapping to handle additionalClauses array with smart formatting (numbered clauses, line breaks, empty state handling).
- **PDF Page Break Control System (Aug 8, 2025)**: Implemented comprehensive CSS page break controls to prevent content splitting across pages. Added CSS classes: .no-page-break, .keep-together, .agreement-section, .clause-section, .signature-section, .terms-section with page-break-inside: avoid. Enhanced both server-side PDF generation and client-side print CSS with @media print rules for reliable PDF output.
- **Dynamic Document Upload Feature (Aug 8, 2025)**: Completed comprehensive document upload system with conditional PDF display. Added 5 dynamic document fields to PDF Template Editor: {{OWNER_AADHAR_URL}}, {{OWNER_PAN_URL}}, {{TENANT_AADHAR_URL}}, {{TENANT_PAN_URL}}, {{PROPERTY_DOCUMENTS_URL}}. Enhanced sample template with conditional document sections that only appear if uploaded. Added property documents upload section to form for NOC, Sale Deed, and property papers with multi-file support.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/UI component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming support
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON responses
- **Middleware**: Express middleware for logging, JSON parsing, and error handling
- **Development Server**: Vite development server integration for HMR

## Data Storage Solutions
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema**: Shared schema definitions between client and server
- **Migrations**: Drizzle Kit for database schema management
- **Connection**: Connection pooling with @neondatabase/serverless

## Object Storage & File Management
- **Storage Provider**: Google Cloud Storage
- **Upload Strategy**: Direct-to-cloud uploads using presigned URLs
- **File Upload UI**: Uppy.js with dashboard interface for file management
- **Access Control**: Custom ACL system with metadata-based permissions
- **Storage Client**: Google Cloud Storage client with Replit sidecar authentication

## Authentication & Authorization
- **Session Management**: Express sessions stored in PostgreSQL
- **User System**: Admin users with profile management
- **Customer Authentication**: Basic password-based authentication for customers
- **Access Control**: Object-level permissions with custom ACL policies

## Multi-language Support
- **Languages**: English, Hindi, Gujarati, Tamil, Marathi
- **Implementation**: Translation system with language-specific form labels
- **Document Generation**: Language-aware agreement template rendering

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Environment**: DATABASE_URL configuration required

## Cloud Storage
- **Google Cloud Storage**: Object storage with ACL-based access control
- **Authentication**: Replit sidecar service for GCS credentials
- **Configuration**: Custom endpoint configuration for Replit environment

## UI & Component Libraries
- **Radix UI**: Headless UI primitives for accessibility
- **Shadcn/UI**: Pre-built component library with Tailwind CSS
- **Lucide React**: Icon library for UI elements
- **Uppy**: File upload library with dashboard interface

## Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type safety across the entire stack
- **Tailwind CSS**: Utility-first CSS framework
- **ESBuild**: JavaScript bundler for production builds

## Runtime Dependencies
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form state management and validation
- **Zod**: Schema validation for forms and API data
- **Wouter**: Lightweight client-side routing
- **Bcrypt**: Password hashing for user authentication