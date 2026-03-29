-- ============================================================
-- SEED DATA – demo company, admin, manager, employees,
-- categories, and an approval rule
-- ============================================================

-- Demo company (India / INR)
INSERT INTO companies (id, name, country, currency_code, currency_symbol)
VALUES (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Acme Corp',
    'India',
    'INR',
    '₹'
) ON CONFLICT DO NOTHING;

-- Admin (dev: plain text in password_hash column)
INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role)
VALUES (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'admin@acme.com',
    'Admin@123',
    'Alice', 'Admin', 'admin'
) ON CONFLICT DO NOTHING;

-- Manager
INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role, is_manager_approver)
VALUES (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'manager@acme.com',
    'Manager@123',
    'Bob', 'Manager', 'manager', TRUE
) ON CONFLICT DO NOTHING;

-- Employee
INSERT INTO users (id, company_id, email, password_hash, first_name, last_name, role)
VALUES (
    'bbbbbbbb-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'employee@acme.com',
    'Employee@123',
    'Charlie', 'Employee', 'employee'
) ON CONFLICT DO NOTHING;

-- Manager relationship: Charlie reports to Bob
INSERT INTO employee_manager_relationships (employee_id, manager_id)
VALUES (
    'bbbbbbbb-0000-0000-0000-000000000003',
    'bbbbbbbb-0000-0000-0000-000000000002'
) ON CONFLICT DO NOTHING;

-- Default expense categories
INSERT INTO expense_categories (company_id, name, description) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Travel',         'Flights, trains, taxis'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Meals',          'Business meals & entertainment'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Accommodation',  'Hotels and lodging'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Office Supplies','Stationery, equipment'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Medical',        'Approved medical expenses'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Training',       'Courses and certifications'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Communication',  'Phone, internet bills'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Miscellaneous',  'Other approved expenses')
ON CONFLICT DO NOTHING;

-- Approval rule: sequential, manager then admin, for all amounts
INSERT INTO approval_rules (id, company_id, name, description, rule_type, is_active)
VALUES (
    'cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Standard Approval',
    'Manager approves first, then Admin for expenses above ₹10,000',
    'sequential',
    TRUE
) ON CONFLICT DO NOTHING;

-- Step 1: Employee's direct manager
INSERT INTO approval_rule_steps (rule_id, step_number, is_manager_of_employee)
VALUES (
    'cccccccc-0000-0000-0000-000000000001', 1, TRUE
) ON CONFLICT DO NOTHING;

-- Step 2: Admin (Alice)
INSERT INTO approval_rule_steps (rule_id, step_number, approver_user_id, approver_role_label)
VALUES (
    'cccccccc-0000-0000-0000-000000000001', 2,
    'bbbbbbbb-0000-0000-0000-000000000001',
    'Admin'
) ON CONFLICT DO NOTHING;
