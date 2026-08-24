-- Backup Script for Migration 023
-- Date: 2026-03-06
-- Purpose: Backup operation_indicators table before DECIMAL precision expansion

-- Create backup table with current data
CREATE TABLE operation_indicators_backup_023 AS
SELECT * FROM operation_indicators;

-- Verify backup
SELECT COUNT(*) as total_records FROM operation_indicators_backup_023;

-- Show sample of backed up data
SELECT id, target_q1, target_q2, accomplishment_q1, accomplishment_q2
FROM operation_indicators_backup_023
LIMIT 5;
