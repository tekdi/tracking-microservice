# Caching Strategy — tracking-microservice

How Redis caching is implemented in this service, module by module: what gets
cached, how a read is served, and exactly what triggers invalidation. This
documents the actual code in `src/cache/` and the four services that consume
it, as of the `redis-layer` branch.

For the original design brief this was built against, see
`redis_caching_reference_tracking.md`. This document describes the
as-implemented behavior, including the fixes made during implementation.

---

## 1. Core mechanism (`src/cache/`)

### 1.1 One entry point: `CacheService`

No service touches Redis, `cache-manager`, or a client directly. Every
cached read goes through one method, every write goes through one other:

```ts
cacheService.getOrLoad<T>({ namespace, key, ttlSeconds, loader }): Promise<T>
cacheService.invalidate(namespace: string | string[], caller?: string): Promise<void>
```

`getOrLoad` wraps a DB call (`loader`) with a cache-aside read. `invalidate`
bumps a namespace's version counter. Nothing is ever deleted from the cache.

### 1.2 How a read is served (`getOrLoad`)

```
1. CACHE_ENABLED=false?              → run loader(), return. (no cache touched)
2. namespace in CACHE_DISABLED_NAMESPACES? → run loader(), return. (metric: bypass)
3. circuit breaker open?             → run loader(), return. (metric: bypass)
4. GET tms:v:{namespace}             → version N (missing counter ⇒ internal baseline 0)
5. GET tms:{namespace}:v{N}:{key}    → hit or miss
   - any Redis error/timeout here   → run loader(), return. (metric: error)
6. hit  → JSON.parse, return.                              (metric: hit)
   miss → run loader()                                     (metric: miss)
          if isCacheable(result): SET tms:{namespace}:v{N}:{key}
                                       = JSON.stringify(result), EX ttlSeconds
          (this SET is fire-and-forget — it never blocks or fails the request)
   return loader()'s result either way.
```

`isCacheable()` rejects `null`, `undefined`, `false`, and `[]` — nothing that
represents "not found" or "no rows" is ever cached, so a query that returns no
rows always re-hits the DB rather than caching a false negative.

### 1.3 How invalidation works

```ts
await cacheService.invalidate('content:t1', 'createContentTracking');
await cacheService.invalidate(['content:t1', 'course:t1', 'courseinprogress'], 'createContentTracking');
```

Each namespace passed gets one Redis `INCR tms:v:{namespace}`. That's the
entire invalidation primitive — no `DEL`, no pattern-scanning. Once the
counter moves from N to N+1, every previously-cached entry key
(`tms:{namespace}:v{N}:...`) becomes permanently unreachable — a harmless
orphan that expires on its own TTL. The next read for that namespace
computes entry keys under `v{N+1}` and finds nothing, so it re-hits the DB
and re-populates the cache fresh.

**Every `invalidate()` call in this codebase runs after the write has
committed, never before and never on a failed write** — invalidating before
a commit (or on a rollback) would let a concurrent read cache the pre-write
value under the new version, making it look fresh when it's actually stale
again.

A debug log line is emitted on every invalidation:
`cache INCR ns=content:t1 v=8 caller=createContentTracking` — the `caller`
argument passed to `invalidate()` is exactly the write-path method name, so
grepping logs for `cache INCR` tells you which code path touched a namespace
and when. A write path with no matching `cache INCR` line is an unhooked
write — nothing else invalidates on your behalf.

### 1.4 Resilience

- Every Redis op (`GET`/`SET`/`INCR`) is wrapped in a `CACHE_OP_TIMEOUT_MS`
  (default 150ms) timeout race. A timeout is treated exactly like a Redis
  error.
- Any cache-layer failure — timeout, connection error, corrupt JSON — falls
  back to running `loader()` directly. The request always succeeds; caching
  degrades, correctness doesn't.
- **Circuit breaker**: consecutive op failures are counted globally (not
  per-namespace). After `CACHE_CB_FAILURES` (default 5) in a row, the
  breaker opens for `CACHE_CB_COOLDOWN_MS` (default 30s) — during that
  window every `getOrLoad` skips Redis entirely and goes straight to
  `loader()`, so a dead Redis adds no latency. One successful op resets the
  failure counter; the cooldown expiring lets the next call retry Redis.
- `writeCacheEntry` (the `SET` after a miss) is fire-and-forget: its
  success/failure feeds the same breaker/metrics but is never awaited by the
  caller, so a slow or failing cache write never adds latency to the
  response.

### 1.5 Providers

`CACHE_PROVIDER=memory` (default) uses `MemoryCacheStore` — a per-process
`Map`, fine for single-instance dev, **not** safe across multiple pods since
each process has its own version counters.

`CACHE_PROVIDER=redis` uses `RedisCacheStore` (`redis` v4 client against
`REDIS_URL`). This is what multi-pod deployments must use — version counters
live in the shared Redis instance, so an `INCR` from any pod is immediately
visible to all of them.

Both implement the same three-method `CacheStore` interface
(`get`/`set`/`incr`), which is why `CacheService` doesn't know or care which
one it's talking to.

### 1.6 Config (`CACHE_*` env vars) — see `.env`

| Variable | Default | Effect |
|---|---|---|
| `CACHE_ENABLED` | `false` | master on/off switch |
| `CACHE_PROVIDER` | `memory` | `memory` \| `redis` |
| `REDIS_URL` | — | required when provider is `redis` |
| `CACHE_KEY_PREFIX` | `tms` | prefixes every key |
| `CACHE_DISABLED_NAMESPACES` | empty | comma-separated bypass list, matched by family (before first `:`) or exact namespace |
| `CACHE_OP_TIMEOUT_MS` | `150` | per-op timeout |
| `CACHE_CB_FAILURES` / `CACHE_CB_COOLDOWN_MS` | `5` / `30000` | circuit breaker |
| `CACHE_METRICS_INTERVAL_MS` | `60000` | how often `cache metrics {...}` is logged |

`GET /v1/tracking/health` reports live cache status (`enabled`, `provider`,
`redis` up/down, `circuitOpen`, `disabledNamespaces`, and the current
hit/miss/error/bypass counters) via `cacheService.getHealthInfo()`.

---

## 2. `tracking_content.service.ts`

TTL constants declared at the top of the file:
`CONTENT_READ_TTL_SECONDS=300`, `CONTENT_STATUS_TTL_SECONDS=60`,
`COURSE_STATUS_TTL_SECONDS=60`, `COURSE_IN_PROGRESS_TTL_SECONDS=60`.

### 2.1 Reads

| Method | Namespace | Key | TTL |
|---|---|---|---|
| `getContentTrackingDetails` | `contentread:{contentTrackingId}` | `core:{tenantId}` | 300s |
| `searchContentTracking` | `content:{tenantId}` | `search:{hash(userId,contentId,courseId,unitId)}` | 60s |
| `searchStatusContentTracking` | `content:{tenantId}` | `status:{hash(userId[],contentId[],courseId[],unitId[])}` | 60s |
| `searchStatusCourseTracking` (default) | `course:{tenantId}` | `status:{hash(userId[],courseId[])}` | 60s |
| `searchStatusCourseTracking` (`type=dashboard`) | `course:{tenantId}` | `dashboard:{hash(userId[],courseId[])}` | 60s |
| `searchStatusUnitTracking` | `content:{tenantId}` | `unitstatus:{hash(userId[],unitId[],courseId)}` | 60s |
| `courseInProgress` | `courseinprogress` (no tenant scope) | `{hash(userId[])}` | 60s |

**Retrieval detail**: `getContentTrackingDetails` is the simplest case — the
whole method body is now just `cacheService.getOrLoad({...})` wrapping
`findContent()`, with `findContent`'s `false` (not-found) return converted
to `null` inside the loader so it's never cached (§1.2's no-negative-caching
rule). The four `search*`/`status*` methods keep all their existing
SQL/loop logic exactly as it was — it's just moved inside the `loader:
async () => {...}` closure, so the query only runs on a cache miss; the
surrounding validation, tenant-header checks, and response shaping are
unchanged.

`courseInProgress` deliberately has no tenant dimension in its namespace
because the underlying SQL (`courseInProgress`) never filters by `tenantId`
— there is no sound per-tenant key to use. It's global, so any content write
anywhere bumps it (over-invalidates a bit, but is always correct).

`POST /content/list` (`searchContentRecords`) is **not cached** — six
filterable columns with open-ended values and arbitrary pagination make the
key space unbounded.

### 2.2 Invalidation

| Write method | Bumps | Why |
|---|---|---|
| `createContentTracking` | `content:{tenantId}`, `course:{tenantId}`, `courseinprogress` | new row changes search/status results, course dashboard completion counts, and the global in-progress list |
| `deleteContentTracking` | `contentread:{contentTrackingId}`, `content:{tenantId}`, `course:{tenantId}`, `courseinprogress` | same reasoning, plus the narrow per-record read namespace |

`deleteContentTracking` snapshots `tenantId` from the pre-delete `findOne`
result (`getContentData.tenantId`), captured **before** the row is deleted —
by the time `invalidate()` runs, the row (and any tenant header) is gone, so
this is the only reliable source. (This replaced the previous behavior of
reading `tenantId` from request headers, which is spoofable and could
invalidate the wrong tenant's namespace.)

Both invalidations run after the DB write/delete succeeds, before the Kafka
publish call.

---

## 3. `tracking_assessment.service.ts`

TTL constants: `ASSESSMENT_READ_TTL_SECONDS=300`,
`ASSESSMENT_STATUS_TTL_SECONDS=60`.

### 3.1 Reads

| Method | Namespace | Key | TTL |
|---|---|---|---|
| `getAssessmentTrackingDetails` | `assessmentread:{assessmentTrackingId}` | `core:{tenantId}` | 300s |
| `searchAssessmentTracking` | `assessment:{tenantId}` | `search:{hash(userId,contentId,courseId,unitId)}` | 60s |
| `searchStatusAssessmentTracking` (courseId+unitId+contentId branch) | `assessment:{tenantId}` | `status:{hash(userId[],contentId[],courseId[],unitId[])}` | 60s |
| `searchStatusAssessmentTracking` (userId-only branch) | `assessment:{tenantId}` | `status:{hash(userId[],null,null,null)}` | 60s |

`getAssessmentTrackingDetails` follows the identical pattern to
`getContentTrackingDetails` — `findAssessment`'s `false` is converted to
`null` inside the loader. `searchAssessmentTracking` uses `request.tenantId`
(set by `TenantGuard`) for the namespace even though its own SQL doesn't
filter rows by tenant — that's a pre-existing gap in that query, unrelated
to caching, and out of scope here; the cache namespace still correctly
partitions by the caller's tenant so no cross-tenant cache pollution is
introduced.

`searchStatusAssessmentTracking` has two branches with different filter
shapes (with course/unit/content vs. userId-only), so each hashes only the
filters it actually uses into its own cache key — they share the same wide
`assessment:{tenantId}` namespace and so also share invalidation.

`POST /assessment/list` and `POST /assessment/offline-assessment-status`
are **not cached** — the list endpoint for the same unbounded-key-space
reason as content/list; offline-assessment-status crosses
`assessment_tracking` and `answersheet_submissions` and reflects live AI
processing status, where a 60s-stale read would be actively wrong.

### 3.2 Invalidation

| Write method | Bumps | Why |
|---|---|---|
| `createAssessmentTracking` | `assessment:{tenantId}` | new row changes search/status |
| `updateAssessmentTracking` | `assessmentread:{assessmentTrackingId}`, `assessment:{tenantId}` | both the single-record read and aggregate views are stale |
| `deleteAssessmentTracking` | `assessmentread:{assessmentTrackingId}`, `assessment:{tenantId}` | same |

`updateAssessmentTracking` reads `tenantId` off the `existingRecord` fetched
by its pre-update `findOne` (not the update payload). `deleteAssessmentTracking`
does the same off `getAssessmentData`, fetched before the delete executes.
Both invalidate after `.save()`/`.delete()` succeeds.

---

## 4. `user_certificate.service..ts`

TTL constant: `USERCERT_TTL_SECONDS=120`.

### 4.1 Reads

| Method | Namespace | Key | TTL |
|---|---|---|---|
| `fetchUserStatusForCourse` (`POST /user_certificate/status/get`) | `usercert:{tenantId}` | `get:{userId}:{courseId}` | 120s |
| `searchUsersCourses` (`POST /user_certificate/status/search`) | `usercert:{tenantId}` | `search:{hash(filters, limit, offset)}` | 120s |

`fetchUserStatusForCourse` now sources its tenant scope from
`request.tenantId` (set by `TenantGuard`) rather than the request body's
`tenantId` field — the body value is caller-supplied and was previously
being trusted directly for the DB lookup; fixed as part of wiring in the
cache so the namespace can't be spoofed by sending a different `tenantId` in
the payload than the tenant header.

`searchUsersCourses` hashes the entire dynamic `filters` object plus
`limit`/`offset` into the key — the query is fully dynamic
(`queryBuilder.andWhere` per filter key), so the cache key has to capture
whatever combination of filters was actually requested. Cacheable despite
being dynamic because per-tenant volume is low and the TTL is short (per the
reference doc's design note).

### 4.2 Invalidation

| Write method | Bumps | Why |
|---|---|---|
| `enrollUserForCourse` | `usercert:{tenantId}`, `course:{tenantId}` | new enrollment; also feeds the content module's course dashboard |
| `updateUserStatusForCourse` | `usercert:{tenantId}`, `course:{tenantId}` | status change; same cross-module reasoning |
| `importUserDataForCertificate` | `usercert:{tenantId}` only | creates an already-completed record, not a status transition the course dashboard reflects |

`course:{tenantId}` here is the **same namespace** `tracking_content.service.ts`
reads from in `searchStatusCourseTracking`'s dashboard branch — that query
joins `user_course_certificate`, so any write to that table has to bump the
content module's namespace too. This is intentional cross-module coupling,
not a leak: the two services never import each other, they just agree on
the namespace string `course:{tenantId}`.

---

## 5. `certificate.service.ts`

No reads are cached here — every endpoint either proxies the external RC
Credentials API or writes to `user_course_certificate`. There's exactly one
invalidation hook.

| Method | Bumps | Why |
|---|---|---|
| `updateUserCertificate` (internal, called from `issueCertificateAfterCourseCompletion`) | `usercert:{tenantId}`, `course:{tenantId}` | certificate issuance changes both the user's cert status and the course dashboard |

`tenantId` isn't present on the `issueCredential` payload this method
receives, so it's read off `userCertificate.tenantId` — the record fetched
by `findOne` just above, before it's saved. Invalidation runs immediately
after `.save()` succeeds, before the Kafka publish.

---

## 6. Cross-module namespace map

Namespaces aren't 1:1 with services — three of them are written to from
more than one file. This is the full picture of who reads and who writes
each namespace:

| Namespace | Read by | Written (invalidated) by |
|---|---|---|
| `contentread:{id}` | tracking_content | tracking_content (delete only) |
| `content:{tenantId}` | tracking_content | tracking_content (create, delete) |
| `course:{tenantId}` | tracking_content (dashboard) | tracking_content, user_certificate, certificate |
| `courseinprogress` | tracking_content | tracking_content (create, delete) |
| `assessmentread:{id}` | tracking_assessment | tracking_assessment (update, delete) |
| `assessment:{tenantId}` | tracking_assessment | tracking_assessment (create, update, delete) |
| `usercert:{tenantId}` | user_certificate | user_certificate, certificate |

`course:{tenantId}` and `usercert:{tenantId}` are the two namespaces with
more than one writer — both are documented above at the point they're
bumped, and both point back to this table so the "why does *this* module
bump *that* namespace" question always has one place to look.

---

## 7. Adding a new cached read (checklist)

1. Pick a namespace shape: wide per-tenant (`content:{tenantId}`) for
   search/aggregate endpoints, narrow per-record (`contentread:{id}`) for
   single-record reads.
2. Add the namespace, key shape, and TTL to this file and to
   `redis_caching_reference_tracking.md`.
3. Grep every `.save()`/`.update()`/`.delete()`/repository write **and**
   Kafka publisher that touches the underlying table(s) — every one of them
   needs an `invalidate()` call after it commits.
4. If the read joins multiple tables, every write path for *every* table it
   touches must bump the namespace (see `course:{tenantId}` above).
5. Never invalidate before a commit or on a failed write.
6. Convert any "not found" sentinel (`false`, empty result) to `null`
   inside the loader — `isCacheable()` already rejects it, this is just
   making sure the loader's return type does too.
7. Test hit, miss, write→next-read-fresh, and Redis-down passthrough.
8. Leave `CACHE_ENABLED=false` in the PR; enable per environment.
