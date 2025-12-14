# Database Migrations

This directory contains SQL migration scripts for the PaperTrail backend database.

## Running Migrations

### Railway (Production)

1. Go to your Railway project dashboard
2. Navigate to your MySQL database service
3. Open the "Data" or "Query" tab
4. Copy and paste the SQL from the migration file
5. Execute the script

### Local Development

```bash
# Using MySQL command line
mysql -u your_user -p your_database < migrations/001_create_login_attempts.sql

# Or using MySQL Workbench / phpMyAdmin
# Open the SQL file and execute it
```

## Migration Files

### 001_create_login_attempts.sql

**Purpose**: Creates the `login_attempts` table for per-account login abuse mitigation.

**When to run**: Before deploying the security audit changes, or immediately after deployment.

**Impact**: 
- Enables per-account lockout feature (5 failed attempts = 15 minute lockout)
- Non-critical: Auth works without this table, but lockout feature will be disabled
- The application will log a warning if the table is missing

**Verification**:
```sql
-- Check if table exists
SHOW TABLES LIKE 'login_attempts';

-- Check table structure
DESCRIBE login_attempts;
```

## Notes

- Migrations are **not** auto-run by the application
- The application degrades gracefully if tables are missing
- Always backup your database before running migrations in production
- Test migrations in a development environment first
