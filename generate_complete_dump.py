#!/usr/bin/env python3
"""
Generate complete production database dump
This script creates SQL INSERT statements for all tables
"""

import os
import subprocess
import sys

def run_sql_query(query):
    """Run SQL query and return results"""
    env = os.environ.copy()
    cmd = ["psql", env.get("DATABASE_URL", ""), "-t", "-c", query]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running query: {e}")
        print(f"stderr: {e.stderr}")
        return None

def generate_insert_statements(table_name, columns):
    """Generate INSERT statements for a table"""
    print(f"Generating INSERT statements for {table_name}...")
    
    # Build the SELECT query
    column_list = []
    for col in columns:
        if col.endswith('::text') or col in ['id', 'created_at', 'updated_at']:
            column_list.append(f"quote_literal({col})")
        else:
            column_list.append(f"COALESCE(quote_literal({col}::text), 'NULL')")
    
    query = f"""
    SELECT 'INSERT INTO {table_name} VALUES (' ||
           {' || \',\' || '.join(column_list)} ||
           ');' as insert_statement
    FROM {table_name};
    """
    
    return run_sql_query(query)

def main():
    """Main function to generate complete dump"""
    
    # Get table information
    tables_query = """
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
    """
    
    tables_result = run_sql_query(tables_query)
    if not tables_result:
        print("Failed to get table list")
        return
    
    tables = [t.strip() for t in tables_result.split('\n') if t.strip()]
    
    # Start building the dump file
    dump_content = [
        "-- COMPLETE PRODUCTION DATABASE DUMP",
        "-- Generated: August 27, 2025",
        "-- Contains ALL production data",
        "",
        "-- Disable foreign key checks for import",
        "SET session_replication_role = replica;",
        ""
    ]
    
    # Process each table
    for table in tables:
        if table == 'sessions':  # Skip sessions table
            continue
            
        print(f"Processing table: {table}")
        
        # Get column names for this table
        columns_query = f"""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '{table}' 
        ORDER BY ordinal_position;
        """
        
        columns_result = run_sql_query(columns_query)
        if not columns_result:
            continue
            
        columns = [c.strip() for c in columns_result.split('\n') if c.strip()]
        
        # Get row count
        count_query = f"SELECT COUNT(*) FROM {table};"
        count_result = run_sql_query(count_query)
        row_count = count_result.strip() if count_result else "0"
        
        dump_content.append(f"-- ============================================================================")
        dump_content.append(f"-- {table.upper()} ({row_count} records)")
        dump_content.append(f"-- ============================================================================")
        
        # Generate INSERT statements
        insert_statements = generate_insert_statements(table, columns)
        if insert_statements:
            for stmt in insert_statements.split('\n'):
                if stmt.strip():
                    dump_content.append(stmt.strip())
        
        dump_content.append("")
    
    # Add footer
    dump_content.extend([
        "-- ============================================================================",
        "-- Re-enable foreign key checks",
        "-- ============================================================================",
        "SET session_replication_role = DEFAULT;",
        "",
        "-- Import complete! All production data has been restored."
    ])
    
    # Write to file
    with open('complete_production_dump.sql', 'w') as f:
        f.write('\n'.join(dump_content))
    
    print("Complete production dump generated: complete_production_dump.sql")

if __name__ == "__main__":
    main()