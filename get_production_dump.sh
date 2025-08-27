#!/bin/bash
# Production Database Dump Script
# Run this in your production environment

# Replace with your actual production DATABASE_URL
PRODUCTION_DB_URL="your_production_database_url_here"

# Create timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create complete database dump
pg_dump "$PRODUCTION_DB_URL" > "production_complete_dump_$TIMESTAMP.sql"

echo "Production database dump created: production_complete_dump_$TIMESTAMP.sql"
echo "File size:"
ls -lh "production_complete_dump_$TIMESTAMP.sql"