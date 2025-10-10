-- Migration: Add performance indexes for content tracking
-- Purpose: Optimize searchStatusCourseTracking endpoint performance
-- Date: 2025-10-10

-- =====================================================
-- Indexes for content_tracking table
-- =====================================================

-- Composite index for main query filter (userId + courseId + tenantId)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_tracking_user_course_tenant 
ON content_tracking ("userId", "courseId", "tenantId");

-- Index for filtering by user and tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_tracking_user_tenant 
ON content_tracking ("userId", "tenantId");

-- Index for filtering by course and tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_tracking_course_tenant 
ON content_tracking ("courseId", "tenantId");

-- Index for ordering by created date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_tracking_created_on 
ON content_tracking ("createdOn");

-- =====================================================
-- Indexes for content_tracking_details table
-- =====================================================

-- Index for JOIN with content_tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_tracking_details_tracking_id 
ON content_tracking_details ("contentTrackingId");

-- Index for filtering by userId
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_tracking_details_user_id 
ON content_tracking_details ("userId");

-- Index for filtering by event id (eid) - used to determine status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_tracking_details_eid 
ON content_tracking_details ("eid");

-- =====================================================
-- Verify indexes were created
-- =====================================================

-- Run this query to verify all indexes:
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('content_tracking', 'content_tracking_details')
-- ORDER BY tablename, indexname;

-- =====================================================
-- Performance Notes
-- =====================================================
-- These indexes will significantly improve query performance by:
-- 1. Enabling efficient filtering on userId + courseId + tenantId combinations
-- 2. Speeding up JOINs between content_tracking and content_tracking_details
-- 3. Optimizing status determination by indexing the 'eid' field
-- 4. Supporting ORDER BY operations on createdOn
--
-- Expected improvement: 50+ seconds → 1-2 seconds for typical queries
-- =====================================================
