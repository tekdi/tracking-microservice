-- Rollback Migration: Remove performance indexes for content tracking
-- Purpose: Rollback the performance optimization indexes if needed
-- Date: 2025-10-10

-- =====================================================
-- Drop indexes for content_tracking table
-- =====================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_content_tracking_user_course_tenant;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_tracking_user_tenant;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_tracking_course_tenant;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_tracking_created_on;

-- =====================================================
-- Drop indexes for content_tracking_details table
-- =====================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_content_tracking_details_tracking_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_tracking_details_user_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_content_tracking_details_eid;

-- =====================================================
-- Verify indexes were dropped
-- =====================================================

-- Run this query to verify indexes were removed:
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('content_tracking', 'content_tracking_details')
-- ORDER BY tablename, indexname;
