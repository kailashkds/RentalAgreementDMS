# Overview

This is a comprehensive Document Management System (DMS) specifically designed for legal document generation and management. The application provides a web-based admin panel for creating, managing, and tracking multiple document types including rental agreements, promissory notes, power of attorney, and other legal documents. The system features a 5-step document creation wizard with step validation, multi-language support (English, Hindi, Gujarati, Tamil, Marathi), customer management, society/property management, and file storage capabilities with granular access control.

## Recent Changes

- **Step Validation System**: Implemented comprehensive validation preventing progression without completing required fields across all 5 wizard steps
- **Enhanced Document Upload UI**: Improved Aadhar/PAN card upload interface with visual feedback, file size limits (5MB), and upload status indicators
- **Smart Button Behavior**: Next button disabled when validation fails, with toast notifications for incomplete steps
- **Complete Form Structure**: Added proper address validation for landlord, tenant, and property details with required field validation
- **Professional UI**: Updated document upload cards with green success states, file format indicators, and responsive design
- **Deployment Documentation**: Added comprehensive README with step-by-step deployment instructions including nginx configuration

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