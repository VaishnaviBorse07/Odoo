-- ============================================================
-- REIMBURSEMENT MANAGEMENT - DB Roles & Application User
-- Run as a PostgreSQL superuser (e.g. postgres)
-- ============================================================

-- 1. Create the application database (skip if already exists)
-- psql -U postgres -c "CREATE DATABASE reimbursement_db;"

-- 2. Create a dedicated application role with limited privileges
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reimbursement_app') THEN
        CREATE ROLE reimbursement_app WITH LOGIN PASSWORD 'AppStr0ngP@ss!';
    END IF;
END;
$$;

-- 3. Grant connect + schema usage
GRANT CONNECT ON DATABASE reimbursement_db TO reimbursement_app;
GRANT USAGE   ON SCHEMA public             TO reimbursement_app;

-- 4. Grant DML on all current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO reimbursement_app;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO reimbursement_app;

-- 5. Ensure future tables are also accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO reimbursement_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT                  ON SEQUENCES TO reimbursement_app;

-- 6. (Optional) Read-only role for reporting / analytics
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reimbursement_readonly') THEN
        CREATE ROLE reimbursement_readonly WITH LOGIN PASSWORD 'ReadOnly@2024!';
    END IF;
END;
$$;

GRANT CONNECT ON DATABASE reimbursement_db       TO reimbursement_readonly;
GRANT USAGE   ON SCHEMA public                   TO reimbursement_readonly;
GRANT SELECT  ON ALL TABLES IN SCHEMA public     TO reimbursement_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO reimbursement_readonly;
