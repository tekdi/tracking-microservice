# Deployment Checklist - Performance Optimization

## 📋 Overview
This checklist guides you through deploying the performance optimization for the `/content/course/status` endpoint.

**Expected Result**: Response time reduced from **50+ seconds to 1-2 seconds** (96-98% improvement)

---

## ✅ Pre-Deployment Checklist

### 1. Review Changes
- [ ] Review modified files in git diff
- [ ] Understand the optimization approach
- [ ] Read `PERFORMANCE_OPTIMIZATION.md` for technical details

### 2. Backup Database
```bash
# Create a database backup before applying migrations
pg_dump -U username -d database_name > backup_before_optimization_$(date +%Y%m%d_%H%M%S).sql
```

### 3. Test Environment First
- [ ] Deploy to development/staging environment first
- [ ] Run tests in staging
- [ ] Verify performance improvement
- [ ] Check for any errors

---

## 🚀 Deployment Steps

### Step 1: Database Migration (Run First!)

**Important**: Run database migrations BEFORE deploying code changes.

```bash
# Connect to your database
psql -U your_username -d your_database_name

# Verify connection
\conninfo

# Run the migration
\i migrations/add_performance_indexes.sql

# Expected output:
# CREATE INDEX (x7 times - one for each index)
```

**Verification**:
```sql
-- Check that indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('content_tracking', 'content_tracking_details')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Expected: 7 new indexes
-- content_tracking: 4 indexes
-- content_tracking_details: 3 indexes
```

**Index Creation Time**: 
- Small tables (< 100K rows): < 1 minute
- Medium tables (100K-1M rows): 1-5 minutes
- Large tables (> 1M rows): 5-30 minutes

**Note**: `CREATE INDEX CONCURRENTLY` is used, so this won't lock your tables.

---

### Step 2: Deploy Code Changes

#### Option A: Using Docker

```bash
# Build new Docker image
docker build -t assessment-tracking-service:optimized .

# Stop old container
docker stop assessment-tracking-service

# Start new container
docker run -d \
  --name assessment-tracking-service \
  -p 3000:3000 \
  --env-file .env \
  assessment-tracking-service:optimized

# Check logs
docker logs -f assessment-tracking-service
```

#### Option B: Using PM2

```bash
# Navigate to project directory
cd /home/ttpl-rt-239/Documents/Pratham_Backend/assessment-tracking-microservice

# Install dependencies (if needed)
npm install

# Build the project
npm run build

# Restart the service
pm2 restart assessment-tracking-service

# Check status
pm2 status
pm2 logs assessment-tracking-service --lines 50
```

#### Option C: Using Kubernetes

```bash
# Update deployment
kubectl apply -f manifest/tracking-service.yaml

# Check rollout status
kubectl rollout status deployment/tracking-service

# Verify pods are running
kubectl get pods -l app=tracking-service

# Check logs
kubectl logs -f deployment/tracking-service
```

---

### Step 3: Verify Deployment

#### Check Service Health
```bash
# Health check endpoint
curl http://localhost:3000/health

# Expected: 200 OK
```

#### Test the Optimized Endpoint
```bash
curl --location 'http://localhost:3000/tracking/v1/content/course/status' \
--header 'tenantid: fd8f3180-9988-495b-8a0d-ed201d7d28df' \
--header 'Content-Type: application/json' \
--data '{
    "userId": ["af771398-bc1a-4350-b849-907561d25957"],
    "courseId": ["do_21430769261883392012483"]
}'

# Expected response time: 1-2 seconds (down from 50+ seconds)
```

#### Compare Performance
```bash
# Time the request
time curl [same command as above]

# Before optimization: real 0m50.000s
# After optimization:  real 0m1.500s
```

---

### Step 4: Monitor Application

#### Check Application Logs
```bash
# Look for any errors
tail -f /var/log/application.log

# Or with Docker
docker logs -f assessment-tracking-service

# Or with PM2
pm2 logs assessment-tracking-service
```

#### Monitor Database Performance
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'your_database';

-- Check slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%content_tracking%'
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_content%'
ORDER BY idx_scan DESC;
```

#### Application Performance Metrics
Monitor these metrics:
- [ ] Response time for `/content/course/status` < 2 seconds
- [ ] No increase in error rate
- [ ] Database connection pool is stable
- [ ] CPU usage is normal or decreased
- [ ] Memory usage is stable

---

## 📊 Success Criteria

### Performance Metrics
- ✅ Response time: **< 2 seconds** (was 50+ seconds)
- ✅ Database queries per request: **1** (was 100+)
- ✅ Error rate: **Same or lower** than before
- ✅ Concurrent request handling: **Improved**

### Functional Verification
- ✅ Response format matches original (same JSON structure)
- ✅ Data accuracy is correct (same counts and lists)
- ✅ All edge cases work (no users, no courses, multiple users/courses)
- ✅ No new errors in logs

---

## 🔄 Rollback Plan

If issues occur, follow this rollback procedure:

### 1. Rollback Code (Immediate)
```bash
# Using Git
git revert HEAD
npm run build
pm2 restart assessment-tracking-service

# Or with Docker
docker stop assessment-tracking-service
docker run -d --name assessment-tracking-service [previous-image]

# Or with Kubernetes
kubectl rollout undo deployment/tracking-service
```

### 2. Rollback Database (If Needed)
```bash
# Only if indexes cause issues (unlikely)
psql -U username -d database_name -f migrations/rollback_performance_indexes.sql
```

**Note**: The indexes are non-breaking and can be left in place even if code is rolled back.

---

## 🧪 Testing Scenarios

### Scenario 1: Single User, Single Course
```json
{
  "userId": ["af771398-bc1a-4350-b849-907561d25957"],
  "courseId": ["do_21430769261883392012483"]
}
```
Expected: < 2 seconds

### Scenario 2: Multiple Users, Multiple Courses
```json
{
  "userId": ["user-1", "user-2", "user-3"],
  "courseId": ["course-1", "course-2", "course-3"]
}
```
Expected: < 3 seconds

### Scenario 3: User with No Data
```json
{
  "userId": ["new-user-with-no-data"],
  "courseId": ["do_21430769261883392012483"]
}
```
Expected: Returns empty course data, < 1 second

### Scenario 4: Invalid Input
```json
{
  "userId": [],
  "courseId": ["do_21430769261883392012483"]
}
```
Expected: 400 Bad Request (validation error)

---

## 📝 Post-Deployment

### Day 1
- [ ] Monitor logs for errors
- [ ] Check response times in APM
- [ ] Verify database performance
- [ ] Collect user feedback

### Week 1
- [ ] Review performance metrics
- [ ] Analyze database index usage
- [ ] Check for any edge cases
- [ ] Document lessons learned

### Week 2
- [ ] Consider optimizing other endpoints (see `ADDITIONAL_OPTIMIZATION_OPPORTUNITIES.md`)
- [ ] Update monitoring dashboards
- [ ] Share success metrics with team

---

## 📞 Support

### Common Issues

#### Issue: "Index creation is slow"
**Solution**: This is normal for large tables. Use `CREATE INDEX CONCURRENTLY` (already done in migration).

#### Issue: "Response format changed"
**Solution**: Check the response transformation logic in lines 634-676 of the service file.

#### Issue: "Error: relation does not exist"
**Solution**: Verify database schema matches entity definitions.

#### Issue: "Performance not improved"
**Solution**: 
1. Verify indexes were created: `\di content_tracking*`
2. Check if database statistics are updated: `ANALYZE content_tracking;`
3. Review query execution plan: `EXPLAIN ANALYZE [query]`

---

## 📚 Additional Resources

- **Technical Details**: `PERFORMANCE_OPTIMIZATION.md`
- **Before/After Comparison**: `BEFORE_AFTER_COMPARISON.md`
- **Quick Summary**: `OPTIMIZATION_SUMMARY.md`
- **Future Optimizations**: `ADDITIONAL_OPTIMIZATION_OPPORTUNITIES.md`
- **Migration Scripts**: `migrations/add_performance_indexes.sql`
- **Rollback Scripts**: `migrations/rollback_performance_indexes.sql`

---

## ✨ Summary

### Files Changed
1. `src/modules/tracking_content/entities/tracking-content-entity.ts` - Added 4 indexes
2. `src/modules/tracking_content/entities/tracking-content-details-entity.ts` - Added 3 indexes
3. `src/modules/tracking_content/tracking_content.service.ts` - Optimized query

### Files Created
1. `migrations/add_performance_indexes.sql` - Database migration
2. `migrations/rollback_performance_indexes.sql` - Rollback script
3. Multiple documentation files

### Expected Improvement
**50+ seconds → 1-2 seconds (96-98% faster!)** 🚀

---

**Ready to deploy? Follow the steps above sequentially for a smooth deployment!**

*Last Updated: October 10, 2025*
