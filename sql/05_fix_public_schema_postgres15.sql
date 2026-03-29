-- If you still see "permission denied for schema public" AFTER fixing .env
-- (single DATABASE_URL=, user postgres), run this in DBeaver as postgres on reimbursement_db.

GRANT USAGE, CREATE ON SCHEMA public TO postgres;
ALTER SCHEMA public OWNER TO postgres;

-- Optional (dev only): allow any DB user to create objects in public — not for production
-- GRANT USAGE, CREATE ON SCHEMA public TO PUBLIC;
