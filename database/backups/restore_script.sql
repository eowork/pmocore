-- Restore Script for Migration 023
-- Date: 2026-03-06
-- Purpose: Restore operation_indicators data if migration fails

-- WARNING: This will overwrite current data with backed up data

-- Step 1: Drop current table (DANGEROUS - only use if migration failed!)
-- DROP TABLE operation_indicators;

-- Step 2: Recreate table from backup
-- CREATE TABLE operation_indicators AS
-- SELECT * FROM operation_indicators_backup_023;

-- Step 3: Verify restore
-- SELECT COUNT(*) as total_records FROM operation_indicators;

-- Alternative: Restore specific records only
-- UPDATE operation_indicators
-- SET target_q1 = b.target_q1,
--     target_q2 = b.target_q2,
--     target_q3 = b.target_q3,
--     target_q4 = b.target_q4,
--     accomplishment_q1 = b.accomplishment_q1,
--     accomplishment_q2 = b.accomplishment_q2,
--     accomplishment_q3 = b.accomplishment_q3,
--     accomplishment_q4 = b.accomplishment_q4
-- FROM operation_indicators_backup_023 b
-- WHERE operation_indicators.id = b.id;

-- Clean up backup table after successful restore
-- DROP TABLE operation_indicators_backup_023;
