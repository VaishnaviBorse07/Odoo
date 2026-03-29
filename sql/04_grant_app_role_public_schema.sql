-- Run in DBeaver while connected as postgres to database reimbursement_db
-- Fixes: "permission denied for schema public" when using reimbursement_app

GRANT USAGE, CREATE ON SCHEMA public TO reimbursement_app;

-- If tables already exist (created by postgres), let the app role use them:
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO reimbursement_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO reimbursement_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO reimbursement_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO reimbursement_app;
