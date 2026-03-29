-- ============================================================
-- REIMBURSEMENT MANAGEMENT SYSTEM - PostgreSQL Schema
-- Run this file as a superuser or the owner of the target DB
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. COMPANIES
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    country         VARCHAR(100) NOT NULL,
    currency_code   VARCHAR(10)  NOT NULL,   -- e.g. USD, INR, EUR
    currency_symbol VARCHAR(10),             -- e.g. $, ₹, €
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. USERS  (Admin, Manager, Employee all live here)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email                VARCHAR(255) UNIQUE NOT NULL,
    password_hash        TEXT        NOT NULL,
    first_name           VARCHAR(100) NOT NULL,
    last_name            VARCHAR(100) NOT NULL,
    role                 VARCHAR(20)  NOT NULL CHECK (role IN ('admin','manager','employee')),
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    -- If TRUE the employee's direct manager must approve first
    is_manager_approver  BOOLEAN      NOT NULL DEFAULT FALSE,
    avatar_url           TEXT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_company     ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role        ON users(company_id, role);

-- ============================================================
-- 3. EMPLOYEE → MANAGER RELATIONSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_manager_relationships (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manager_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_emp_mgr UNIQUE (employee_id, manager_id)
);

CREATE INDEX IF NOT EXISTS idx_emr_employee ON employee_manager_relationships(employee_id);
CREATE INDEX IF NOT EXISTS idx_emr_manager  ON employee_manager_relationships(manager_id);

-- ============================================================
-- 4. EXPENSE CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_categories (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_name UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_company ON expense_categories(company_id);

-- ============================================================
-- 5. EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
    id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                UUID          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id               UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id               UUID          REFERENCES expense_categories(id) ON DELETE SET NULL,

    title                     VARCHAR(255)  NOT NULL,
    description               TEXT,
    expense_date              DATE          NOT NULL,

    -- Original currency the employee entered
    amount                    NUMERIC(15,2) NOT NULL,
    currency_code             VARCHAR(10)   NOT NULL,

    -- Converted to company default currency (stored at submission time)
    amount_in_company_currency NUMERIC(15,2),
    exchange_rate              NUMERIC(18,6),

    -- Workflow state
    status                    VARCHAR(20)   NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','in_review','approved','rejected')),
    current_approval_step     INTEGER       NOT NULL DEFAULT 0,

    -- Receipt / OCR
    receipt_url               TEXT,
    ocr_raw_text              TEXT,
    ocr_data                  JSONB,        -- parsed fields: {amount, date, merchant, ...}

    -- Rejection / override notes
    admin_notes               TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_company    ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_employee   ON expenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status     ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date       ON expenses(expense_date DESC);

-- ============================================================
-- 6. APPROVAL RULES  (Admin configures per company)
-- ============================================================
-- rule_type:
--   sequential       – each step must approve in order
--   percentage       – N% of approvers must approve (parallel)
--   specific_approver – auto-approved when one key approver approves
--   hybrid           – percentage OR specific_approver
CREATE TABLE IF NOT EXISTS approval_rules (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name                 VARCHAR(255) NOT NULL,
    description          TEXT,

    -- Amount thresholds (in company currency). NULL = no limit.
    min_amount           NUMERIC(15,2),
    max_amount           NUMERIC(15,2),

    rule_type            VARCHAR(30)  NOT NULL DEFAULT 'sequential'
                         CHECK (rule_type IN ('sequential','percentage','specific_approver','hybrid')),

    -- For percentage / hybrid rules (1-100)
    percentage_threshold INTEGER      CHECK (percentage_threshold BETWEEN 1 AND 100),

    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_rules_company ON approval_rules(company_id);

-- ============================================================
-- 7. APPROVAL RULE STEPS  (Ordered steps inside a rule)
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_rule_steps (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id                 UUID        NOT NULL REFERENCES approval_rules(id) ON DELETE CASCADE,
    step_number             INTEGER     NOT NULL,   -- 1, 2, 3 …

    -- Either a specific user OR a role label OR the employee's dynamic manager
    approver_user_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
    approver_role_label     VARCHAR(100),           -- e.g. 'Finance', 'Director'

    -- If TRUE: dynamically resolved to the submitting employee's manager
    is_manager_of_employee  BOOLEAN     NOT NULL DEFAULT FALSE,

    -- If TRUE: approving triggers the "specific approver" auto-approve rule
    is_key_approver         BOOLEAN     NOT NULL DEFAULT FALSE,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_rule_step UNIQUE (rule_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_rule_steps_rule ON approval_rule_steps(rule_id);

-- ============================================================
-- 8. EXPENSE APPROVALS  (Live approval instances)
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_approvals (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id   UUID        NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    rule_id      UUID        REFERENCES approval_rules(id) ON DELETE SET NULL,
    step_number  INTEGER     NOT NULL,
    approver_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','waiting','approved','rejected','cancelled','skipped')),

    comments     TEXT,
    action_at    TIMESTAMPTZ,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ea_expense  ON expense_approvals(expense_id);
CREATE INDEX IF NOT EXISTS idx_ea_approver ON expense_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_ea_status   ON expense_approvals(status);

-- ============================================================
-- 9. REFRESH TOKENS  (for JWT refresh token rotation)
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id);

-- ============================================================
-- 10. AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL   PRIMARY KEY,
    company_id  UUID        REFERENCES companies(id) ON DELETE SET NULL,
    user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,   -- e.g. 'expense.approved'
    entity_type VARCHAR(50),             -- e.g. 'expense'
    entity_id   UUID,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity  ON audit_logs(entity_type, entity_id);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['companies','users','expenses','approval_rules']
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_updated_at ON %I; '
            'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
            tbl, tbl
        );
    END LOOP;
END;
$$;
