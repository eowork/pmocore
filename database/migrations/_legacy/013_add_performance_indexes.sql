-- Migration 013: Add Performance Indexes
-- Phase BR: Database Index Optimization
-- Purpose: Improve query performance for production workloads

-- ============================================================================
-- RECORD ASSIGNMENTS INDEXES (CRITICAL)
-- These tables are queried frequently for permission checks
-- ============================================================================

-- Index for looking up assignments by module and record
-- Used in: GET /api/{module}/:id (to fetch assigned users)
CREATE INDEX IF NOT EXISTS idx_record_assignments_module_record
ON record_assignments(module, record_id);

-- Index for looking up all records assigned to a user
-- Used in: GET /api/{module} (to filter visible records)
CREATE INDEX IF NOT EXISTS idx_record_assignments_user
ON record_assignments(user_id);

-- ============================================================================
-- USERS INDEXES
-- ============================================================================

-- Index for rank-based approval checks
-- Used in: Approval workflows to verify user rank
CREATE INDEX IF NOT EXISTS idx_users_rank_level
ON users(rank_level)
WHERE deleted_at IS NULL;

-- ============================================================================
-- PUBLICATION STATUS INDEXES
-- Used for filtering records by publication state (DRAFT, PENDING_REVIEW, PUBLISHED)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_construction_projects_publication_status
ON construction_projects(publication_status)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_repair_projects_publication_status
ON repair_projects(publication_status)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_university_operations_publication_status
ON university_operations(publication_status)
WHERE deleted_at IS NULL;

-- ============================================================================
-- CAMPUS SCOPING INDEXES
-- Used for filtering records by campus (MAIN, CABADBARAN, BOTH)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_construction_projects_campus
ON construction_projects(campus)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_repair_projects_campus
ON repair_projects(campus)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_university_operations_campus
ON university_operations(campus)
WHERE deleted_at IS NULL;

-- ============================================================================
-- CREATED_BY INDEXES
-- Used for filtering records created by a specific user
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_construction_projects_created_by
ON construction_projects(created_by)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_repair_projects_created_by
ON repair_projects(created_by)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_university_operations_created_by
ON university_operations(created_by)
WHERE deleted_at IS NULL;

-- ============================================================================
-- COMPOSITE INDEXES
-- For complex queries combining multiple filters
-- ============================================================================

-- Campus + Publication Status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_construction_projects_campus_status
ON construction_projects(campus, publication_status)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_repair_projects_campus_status
ON repair_projects(campus, publication_status)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_university_operations_campus_status
ON university_operations(campus, publication_status)
WHERE deleted_at IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to verify indexes are being used:
--
-- EXPLAIN ANALYZE
-- SELECT * FROM record_assignments WHERE module = 'construction-projects' AND record_id = '<uuid>';
--
-- EXPLAIN ANALYZE
-- SELECT * FROM construction_projects WHERE campus = 'MAIN' AND publication_status = 'PUBLISHED' AND deleted_at IS NULL;
-- ============================================================================
