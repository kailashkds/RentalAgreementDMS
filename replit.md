# Overview

This project is a comprehensive Document Management System (DMS) for legal document generation and management. It provides a web-based admin panel for creating, managing, and tracking various legal document types (e.g., rental agreements, promissory notes, power of attorney). Key capabilities include a 5-step document creation wizard with validation, multi-language support (English, Hindi, Gujarati, Tamil, Marathi), customer management, society/property management, and secure file storage with granular access control. The system aims to streamline legal document processes, offering robust features for efficient and accurate document handling.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript (Vite build tool)
- **UI Components**: Shadcn/UI (built on Radix UI primitives)
- **Styling**: Tailwind CSS with CSS variables
- **State Management**: TanStack Query (server state)
- **Routing**: Wouter
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON responses
- **Middleware**: Express middleware for logging, JSON parsing, error handling
- **Development Server**: Vite development server integration

## Data Storage Solutions
- **Database**: PostgreSQL (Neon serverless hosting)
- **ORM**: Drizzle ORM
- **Schema**: Shared definitions between client and server
- **Migrations**: Drizzle Kit
- **Connection**: Connection pooling

## Object Storage & File Management
- **Storage Provider**: Google Cloud Storage
- **Upload Strategy**: Direct-to-cloud uploads using presigned URLs
- **File Upload UI**: Uppy.js
- **Access Control**: Custom ACL system with metadata-based permissions
- **Document Embedding**: Converts uploaded documents (Aadhaar, PAN, property docs) into embedded images within generated PDFs.

## Authentication & Authorization
- **Session Management**: Express sessions stored in PostgreSQL
- **User System**: Admin users with profile management; basic password-based authentication for customers
- **Access Control**: Object-level permissions with custom ACL policies

## Multi-language Support
- **Languages**: English, Hindi, Gujarati, Tamil, Marathi
- **Implementation**: Translation system with language-specific form labels and language-aware agreement template rendering.
- **Gujarati PDF Templates**: Complete Gujarati rental agreement template with authentic content structure matching traditional Indian legal document format, including Gujarati numerals, date formatting, and number-to-words conversion.

## Key Features
- **5-step Document Creation Wizard**: Includes step validation and intelligent text input fields with database search and auto-fill for addresses.
- **PDF Template Management System**: With database schema, CRUD API, professional UI, and advanced template editor featuring dynamic field insertion and live HTML preview.
- **Dynamic Field Formatting**: Automatic formatting for all PDF placeholders based on field characteristics (e.g., date formats, string capitalization).
- **Conditional Logic System**: Smart field replacement and conditional display in PDF templates (e.g., showing/hiding sections based on document uploads).
- **Amount-to-Words Conversion**: Automatic conversion of numeric amounts to Indian format words.
- **PDF Page Break Control**: Comprehensive CSS controls with `page-break-before: always` for documents. Each Aadhaar card and PAN card appears on separate pages for both landlord and tenant sections.
- **File Preview System**: Comprehensive preview functionality for all uploaded documents (PDF, image, etc.).

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting.

## Cloud Storage
- **Google Cloud Storage**: Object storage with ACL-based access control.

## UI & Component Libraries
- **Radix UI**: Headless UI primitives.
- **Shadcn/UI**: Pre-built component library.
- **Lucide React**: Icon library.
- **Uppy**: File upload library.

## Development Tools
- **Vite**: Build tool and development server.
- **TypeScript**: Type safety.
- **Tailwind CSS**: Utility-first CSS framework.
- **ESBuild**: JavaScript bundler.

## Runtime Dependencies
- **TanStack Query**: Server state management.
- **React Hook Form**: Form state management.
- **Zod**: Schema validation.
- **Wouter**: Client-side routing.
- **Bcrypt**: Password hashing.