# Additional Performance Optimization Opportunities

## Summary
While optimizing the `/content/course/status` endpoint, I discovered **several other endpoints** with identical N+1 query problems that should also be optimized.

---

## 🔴 Critical - Similar Performance Issues Found

### 1. `searchStatusUnitTracking()` - /content/unit/status
**Location**: `src/modules/tracking_content/tracking_content.service.ts` (Lines 699-788)

**Problem**: Identical N+1 pattern as the course endpoint
- Triple nested loops (users → units → content items)
- Sequential database queries
- Same performance issue: likely 50+ seconds

**Lines**:
```typescript
for (let ii = 0; ii < userIdArray.length; ii++) {
  for (let jj = 0; jj < unitIdArray.length; jj++) {
    const result = await this.dataSource.query(...);  // Query per unit
    for (let i = 0; i < result.length; i++) {
      const result_details = await this.dataSource.query(...);  // N+1 queries!
    }
  }
}
```

**Recommendation**: Apply the same optimization pattern as `searchStatusCourseTracking()`
**Priority**: HIGH 🔴

---

### 2. `searchStatusContentTracking()` - /content/search/status  
**Location**: `src/modules/tracking_content/tracking_content.service.ts` (Lines 377-530)

**Problem**: N+1 query problem
- Nested loops with sequential queries
- Similar pattern to course endpoint

**Lines**:
```typescript
for (let ii = 0; ii < userIdArray.length; ii++) {
  const result = await this.dataSource.query(...);
  for (let i = 0; i < result.length; i++) {
    const result_details = await this.dataSource.query(...);  // N+1 queries!
  }
}
```

**Recommendation**: Apply similar optimization with JOINs and aggregation
**Priority**: HIGH 🔴

---

### 3. `searchContentTracking()` - /content/search
**Location**: `src/modules/tracking_content/tracking_content.service.ts` (Lines 297-376)

**Problem**: N+1 query problem
- Loop with sequential queries for details

**Lines**:
```typescript
const result = await this.dataSource.query(...);
for (let i = 0; i < result.length; i++) {
  const result_details = await this.dataSource.query(...);  // N+1 queries!
}
```

**Recommendation**: Use JOIN instead of separate queries
**Priority**: MEDIUM 🟡

---

### 4. `updateAssessmentTracking()` - Assessment Updates
**Location**: `src/modules/tracking_assessment/tracking_assessment.service.ts` (Lines ~400)

**Problem**: Multiple sequential UPDATE queries in nested loops
- Updates each question detail individually

**Lines**:
```typescript
for (const section of updateObject.assessmentSummary) {
  for (const dataItem of itemData) {
    await this.assessmentTrackingScoreDetailRepository.update(...);  // N queries!
  }
}
```

**Recommendation**: Batch updates or use single query with unnest/json
**Priority**: MEDIUM 🟡

---

### 5. `searchAssessmentTrackingold()` - Assessment Search
**Location**: `src/modules/tracking_assessment/tracking_assessment.service.ts` (Lines ~520)

**Problem**: N+1 query problem (note: method name has "old" - might be deprecated)

**Lines**:
```typescript
const result = await this.dataSource.query(...);
for (let i = 0; i < result.length; i++) {
  const result_score = await this.dataSource.query(...);  // N+1 queries!
}
```

**Recommendation**: If still in use, optimize with JOINs. Otherwise, delete.
**Priority**: LOW (if deprecated) 🟢

---

## Optimization Template

For each of these methods, apply the same pattern:

### Step 1: Add Indexes (if not already added)
Already done for `content_tracking` and `content_tracking_details` tables.

### Step 2: Rewrite Query
Replace:
```typescript
// BAD - N+1 queries
for (const item of items) {
  const details = await query(item.id);
}
```

With:
```typescript
// GOOD - Single query with JOIN
const query = `
  WITH data_with_details AS (
    SELECT 
      main.*,
      details.*,
      -- Compute aggregations in SQL
      COUNT(*) as total,
      SUM(...) as sum_value
    FROM main_table main
    LEFT JOIN details_table details ON main.id = details.main_id
    WHERE main.id = ANY($1)
    GROUP BY main.id, details.id
  )
  SELECT * FROM data_with_details;
`;
const results = await this.dataSource.query(query, [itemIds]);
```

---

## Priority Recommendations

### Immediate (Do Now)
✅ `searchStatusCourseTracking()` - **DONE!**

### High Priority (Do Next)
1. 🔴 `searchStatusUnitTracking()` - Identical problem, likely same 50+ sec performance
2. 🔴 `searchStatusContentTracking()` - Similar N+1 issue

### Medium Priority (Do Soon)
3. 🟡 `searchContentTracking()` - Moderate performance impact
4. 🟡 `updateAssessmentTracking()` - Impacts write performance

### Low Priority (Investigate)
5. 🟢 `searchAssessmentTrackingold()` - May be deprecated (check usage)

---

## Estimated Impact

| Endpoint | Current Est. | Optimized Est. | Improvement |
|----------|--------------|----------------|-------------|
| `/content/course/status` | 50s | 1-2s | ✅ **25-50x** (DONE) |
| `/content/unit/status` | 50s | 1-2s | 🔴 **25-50x** (TODO) |
| `/content/search/status` | 30s | 1s | 🔴 **30x** (TODO) |
| `/content/search` | 10s | 0.5s | 🟡 **20x** (TODO) |
| Assessment updates | 5s | 0.2s | 🟡 **25x** (TODO) |

**Total potential improvement: 4-5 endpoints could be 20-50x faster!**

---

## Code Reusability

Consider creating a **shared utility function** for these optimizations:

```typescript
// src/common/utils/query-optimizer.ts
export class QueryOptimizer {
  /**
   * Optimize content tracking queries with status aggregation
   */
  static buildContentStatusQuery(
    groupBy: 'courseId' | 'unitId',
    userIds: string[],
    groupIds: string[],
    tenantId: string
  ): { query: string; params: any[] } {
    const query = `
      WITH content_status AS (
        SELECT 
          ct."userId",
          ct."${groupBy}",
          ct."contentId",
          -- Reusable status determination
          CASE 
            WHEN MAX(CASE WHEN ctd.eid = 'END' THEN 1 ELSE 0 END) = 1 THEN 'Completed'
            WHEN MAX(CASE WHEN ctd.eid = 'START' THEN 1 ELSE 0 END) = 1 THEN 'In_Progress'
            ELSE 'Not_Started'
          END as status
        FROM content_tracking ct
        LEFT JOIN content_tracking_details ctd ON ct."contentTrackingId" = ctd."contentTrackingId"
        WHERE 
          ct."userId" = ANY($1::uuid[])
          AND ct."${groupBy}" = ANY($2)
          AND ct."tenantId" = $3
        GROUP BY ct."userId", ct."${groupBy}", ct."contentId", ct."contentTrackingId", ct."createdOn"
      ),
      summary AS (
        SELECT 
          "userId",
          "${groupBy}",
          COUNT(*) FILTER (WHERE status = 'In_Progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'Completed') as completed,
          array_agg("contentId") FILTER (WHERE status = 'In_Progress') as in_progress_list,
          array_agg("contentId") FILTER (WHERE status = 'Completed') as completed_list
        FROM content_status
        GROUP BY "userId", "${groupBy}"
      )
      SELECT * FROM summary ORDER BY "userId", "${groupBy}";
    `;
    
    return {
      query,
      params: [userIds, groupIds, tenantId]
    };
  }
}
```

Then reuse it:
```typescript
// In service methods
const { query, params } = QueryOptimizer.buildContentStatusQuery(
  'courseId',
  userIdArray,
  courseIdArray,
  tenantId
);
const results = await this.dataSource.query(query, params);
```

This would make optimization consistent and easier to maintain!

---

## Testing Strategy

For each optimized endpoint:

1. **Capture baseline**: Test current performance
2. **Apply optimization**: Implement changes
3. **Verify correctness**: Ensure same output
4. **Measure improvement**: Compare performance
5. **Load test**: Verify under concurrent load

### Sample Test Script
```bash
#!/bin/bash

# Test all endpoints before/after optimization
endpoints=(
  "/content/course/status"
  "/content/unit/status"
  "/content/search/status"
)

for endpoint in "${endpoints[@]}"; do
  echo "Testing $endpoint..."
  time curl -X POST "http://api.example.com$endpoint" \
    -H "tenantid: $TENANT_ID" \
    -H "Content-Type: application/json" \
    -d '{"userId": ["..."], "courseId": ["..."]}'
done
```

---

## Next Steps

1. ✅ **Completed**: `/content/course/status` optimization
2. 🔄 **Recommended Next**: Optimize `/content/unit/status` (identical pattern)
3. 🔄 **Then**: Optimize `/content/search/status`
4. 📝 **Consider**: Create shared utility class for reusable query patterns
5. 🧪 **Always**: Test thoroughly and monitor in production

---

## Questions for Discussion

1. Should we optimize all endpoints at once or incrementally?
2. Is `searchAssessmentTrackingold()` still in use? Can it be deleted?
3. Should we create a shared utility class for these query patterns?
4. What's the current traffic/usage for each of these endpoints?
5. Are there other similar patterns elsewhere in the codebase?

---

**Need help optimizing these endpoints? Let me know which one to tackle next!**
