-- ============================================================
-- Migration: Add 'waiting' and 'cancelled' to expense_approvals status
-- Run this on existing databases where 01_create_tables.sql was already applied
-- ============================================================

ALTER TABLE expense_approvals
  DROP CONSTRAINT IF EXISTS expense_approvals_status_check;

ALTER TABLE expense_approvals
  ADD CONSTRAINT expense_approvals_status_check
  CHECK (status IN ('pending','waiting','approved','rejected','cancelled','skipped'));
