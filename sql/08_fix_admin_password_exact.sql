-- Set demo passwords as plain text (backend uses string match, not bcrypt).
-- Run on reimbursement_db.

UPDATE users SET password_hash = 'Admin@123' WHERE email = 'admin@acme.com';
UPDATE users SET password_hash = 'Manager@123' WHERE email = 'manager@acme.com';
UPDATE users SET password_hash = 'Employee@123' WHERE email = 'employee@acme.com';
