# Redis Caching — As-Built Implementation Reference

**tracking-microservice**, key prefix `tms`. This document describes what is
**actually implemented** (or must be implemented exactly as specified here),
for someone picking up this layer cold. Every namespace, key, TTL and
invalidation hook below is derived directly from source code audit.

---

## 1. How it works

### 1.1 The one rule

All caching goes through **`CacheService`** (`src/cache/cache.service.ts`).
Application code never imports a Redis, Keyv, or `cache-manager` client
directly. There are exactly two public methods:

| Method | Used for |
|---|---|
| `getOrLoad({namespace, key, ttlSeconds, loader})` | single cached read |
| `invalidate(namespace \| namespace[])` | bump version counters after a write |

Application services inject `CacheService` and call only these methods. The
existing ad-hoc `@Inject(CACHE_MANAGER)` usage in `TrackingContentService`
and `TrackingAssessmentService` is replaced by `CacheService` injection.

### 1.2 Versioned namespaces — the only invalidation primitive

Every cached value lives in a *namespace* that has a version counter. Nothing
is ever `DEL`-ed; invalidation is a single `INCR`.

```
counter:         tms:v:{namespace}               e.g. tms:v:content:t1  = 7
entry (logical): tms:{namespace}:v{N}:{key}      e.g. tms:content:t1:v7:status:abc123
```

**Read path** (`getOrLoad`):

1. If `CACHE_ENABLED=false`, return `loader()` immediately.
2. Circuit-breaker check — if open, return `loader()`.
3. `GET` the version counter. Missing ⇒ treat as `1`.
4. Build entry key with version embedded, `GET` it.
5. Hit ⇒ return. Miss ⇒ run `loader()`, `SET` if result is cacheable.

**Why versions instead of DEL** — a write that `INCR`s mid-read causes the
late `SET` to land under a superseded version — an unreachable orphan. This
is what makes cache-aside race-safe.

**Invalidation ordering is the caller's job.** `invalidate()` must be called
**after** the DB write commits and must never run on a failed write.

### 1.3 No negative caching

`isCacheable()` rejects `null`, `undefined`, `false`, and `[]`. Service
methods that return `false` for "not found" (e.g. `findContent`,
`findAssessment`) must convert to `null` inside the loader so the result is
treated as uncacheable.

### 1.4 Resilience

- `CACHE_OP_TIMEOUT_MS` (default 150 ms) per-op timeout.
- Any failure ⇒ treated as a miss; loader runs; request succeeds.
- **Circuit breaker**: after `CACHE_CB_FAILURES` consecutive failures, Redis
  is skipped for `CACHE_CB_COOLDOWN_MS`. Dead Redis adds no latency.

### 1.5 Configuration

| Variable | Default | Meaning |
|---|---|---|
| `CACHE_ENABLED` | `false` | Master switch |
| `CACHE_PROVIDER` | `memory` | `memory` \| `redis` |
| `REDIS_URL` | — | Required when provider is `redis` |
| `CACHE_KEY_PREFIX` | `tms` | Per-service prefix |
| `CACHE_DISABLED_NAMESPACES` | empty | Comma-separated bypass list |
| `CACHE_OP_TIMEOUT_MS` | `150` | Per-op timeout ms |
| `CACHE_CB_FAILURES` | `5` | Failures before breaker opens |
| `CACHE_CB_COOLDOWN_MS` | `30000` | Breaker cooldown ms |
| `CACHE_METRICS_INTERVAL_MS` | `60000` | Metrics log cadence ms |

`memory` is per-process: safe only for single-process dev. Multi-pod
deployments require `CACHE_PROVIDER=redis`.

`CACHE_ENABLED` defaults to `false`. Every PR ships with caching off; enable
per environment (dev → QA → prod).

### 1.6 Observability

- Per-namespace `hit / miss / error / bypass` counters logged every
  `CACHE_METRICS_INTERVAL_MS` as `cache metrics {...}`. Grouped by **family**
  (part before first `:`): `content:{tenantId}` reports under `content`.
- `cache INCR ns=… v=… caller=…` debug log on every invalidation. A write
  with no INCR line is an unhooked write path.
- `GET /health` reports `cache.redis` status plus `disabledNamespaces` and
  counters. Informational only.

---

## 2. Namespace catalog

| Namespace | Width | Holds | TTL |
|---|---|---|---|
| `contentread:{contentTrackingId}` | narrow | `GET /content/read/:id` | 300 s |
| `content:{tenantId}` | wide | search, status, unit-status responses | 60 s |
| `course:{tenantId}` | wide | course-status and dashboard responses | 60 s |
| `courseinprogress` | global | course-inprogress responses | 60 s |
| `assessmentread:{assessmentTrackingId}` | narrow | `GET /assessment/read/:id` | 300 s |
| `assessment:{tenantId}` | wide | assessment search and status responses | 60 s |
| `usercert:{tenantId}` | wide | user-cert get and search responses | 120 s |

TTL constants are declared next to their consumers:

```
CONTENT_READ_TTL_SECONDS      = 300   (tracking_content.service.ts)
CONTENT_STATUS_TTL_SECONDS    = 60    (tracking_content.service.ts)
COURSE_STATUS_TTL_SECONDS     = 60    (tracking_content.service.ts)
ASSESSMENT_READ_TTL_SECONDS   = 300   (tracking_assessment.service.ts)
ASSESSMENT_STATUS_TTL_SECONDS = 60    (tracking_assessment.service.ts)
USERCERT_TTL_SECONDS          = 120   (user_certificate.service.ts)
```

---

## 3. Module-by-module: what is cached

### 3.1 tracking_content — `tracking_content.service.ts`

| Read | Namespace | Key | TTL |
|---|---|---|---|
| `GET /content/read/:id` | `contentread:{contentTrackingId}` | `core:{tenantId}` | 300 s |
| `POST /content/search` | `content:{tenantId}` | `search:{hash(userId,contentId,courseId,unitId)}` | 60 s |
| `POST /content/search/status` | `content:{tenantId}` | `status:{hash(userId[],contentId[],courseId[],unitId[])}` | 60 s |
| `POST /content/course/status` (default) | `course:{tenantId}` | `status:{hash(userId[],courseId[])}` | 60 s |
| `POST /content/course/status` (type=dashboard) | `course:{tenantId}` | `dashboard:{hash(userId[],courseId[])}` | 60 s |
| `POST /content/unit/status` | `content:{tenantId}` | `unitstatus:{hash(userId[],unitId[],courseId)}` | 60 s |
| `POST /content/course/inprogress` | `courseinprogress` | `{hash(userId[])}` | 60 s |

**Design notes:**

- `contentread` is **narrow** (per record). Invalidating it bumps only that
  one record's counter; the wide `content:{tenantId}` counter is unaffected.
- `content:{tenantId}` is **wide** — one INCR makes all search, status, and
  unit-status entries for a tenant stale simultaneously.
- `course:{tenantId}` is **separate** from `content:{tenantId}` because the
  dashboard code path joins `user_course_certificate`. A `user_certificate`
  write must also bump `course:{tenantId}` (see §4).
- `courseinprogress` has **no tenant scope** — the SQL does not filter by
  `tenantId`. It is global; any content write bumps it.
- `POST /content/list` (`searchContentRecords`) is **NOT cached** — see §6.

The existing ad-hoc caching in `getContentTrackingDetails` (direct
`cacheService.get()` / `cacheService.set()` calls) is replaced by
`CacheService.getOrLoad()`.

### 3.2 tracking_assessment — `tracking_assessment.service.ts`

| Read | Namespace | Key | TTL |
|---|---|---|---|
| `GET /assessment/read/:id` | `assessmentread:{assessmentTrackingId}` | `core:{tenantId}` | 300 s |
| `POST /assessment/search` | `assessment:{tenantId}` | `search:{hash(userId,contentId,courseId,unitId)}` | 60 s |
| `POST /assessment/search/status` | `assessment:{tenantId}` | `status:{hash(userId[],contentId[],courseId[],unitId[])}` | 60 s |

**Design notes:**

- `assessment:{tenantId}` is **wide** — one INCR makes all search and status
  entries for a tenant stale.
- `assessmentread` is **narrow** — bumped only on update or delete of that
  specific record.
- `POST /assessment/list` is **NOT cached** — see §6.
- `POST /assessment/offline-assessment-status` is **NOT cached** — crosses
  `assessment_tracking` + `answersheet_submissions`; live AI status.
- The existing ad-hoc caching in `getAssessmentTrackingDetails` is replaced
  by `CacheService.getOrLoad()`.

### 3.3 user_certificate — `user_certificate.service..ts`

| Read | Namespace | Key | TTL |
|---|---|---|---|
| `POST /user_certificate/status/get` | `usercert:{tenantId}` | `get:{userId}:{courseId}` | 120 s |
| `POST /user_certificate/status/search` | `usercert:{tenantId}` | `search:{hash(filters,limit,offset)}` | 120 s |

**Design notes:**

- `usercert:{tenantId}` is **wide** — one INCR covers both endpoints.
- Use `request.tenantId` (set by `TenantGuard`) as the namespace dimension,
  not the DTO's `tenantId` field.
- `searchUsersCourses` has dynamic filters but per-tenant volume is low and
  TTL is short; it is cacheable because filters+pagination are hashed into key.

### 3.4 Not cached — certificate, ai_assessment, answer_sheet_submissions, telemetry

- **certificate**: all endpoints proxy the RC Credentials external API or
  write to `user_course_certificate`.
- **ai_assessment**: `status` transitions via webhook; stale status for the
  TTL window is unacceptable.
- **answer_sheet_submissions**: same — status is webhook-driven.
- **telemetry**: deprecated no-op stub.

---

## 4. Invalidation matrix — every hooked write path

`invalidate()` is called at **13 sites** across **3 service files**. All run
after the DB write. A write with no INCR log line is an unhooked path.

### tracking_content.service.ts

| Write | HTTP | Bumps |
|---|---|---|
| `createContentTracking` | `POST /content/create` | `content:{tenantId}`, `course:{tenantId}`, `courseinprogress` |
| `deleteContentTracking` | `DELETE /content/delete/:id` | `contentread:{contentTrackingId}`, `content:{tenantId}`, `course:{tenantId}`, `courseinprogress` |

- `tenantId` comes from `request.tenantId` (TenantGuard).
- `deleteContentTracking` must snapshot `contentTrackingId` and `tenantId`
  from the pre-delete `findOne` result, before the delete executes.
- `course:{tenantId}` is bumped because the dashboard path in
  `searchStatusCourseTracking` includes `user_course_certificate` data. A
  new content row changes course completion numbers.
- `courseinprogress` has no tenant scope, so bump on every content write.

### tracking_assessment.service.ts

| Write | HTTP | Bumps |
|---|---|---|
| `createAssessmentTracking` | `POST /assessment/create` | `assessment:{tenantId}` |
| `updateAssessmentTracking` | `POST /assessment/update/:id` | `assessmentread:{assessmentTrackingId}`, `assessment:{tenantId}` |
| `deleteAssessmentTracking` | `DELETE /assessment/delete/:id` | `assessmentread:{assessmentTrackingId}`, `assessment:{tenantId}` |

- `createAssessmentTracking` has two code paths (normal save and Manual
  override). Both commit before Kafka publish. Bump after save, before return.
- `updateAssessmentTracking` has a `findOne` pre-check; extract `tenantId`
  from `existingRecord.tenantId`.
- `deleteAssessmentTracking` pre-fetches via `findOne`; use
  `getAssessmentData.tenantId` before the delete.

### user_certificate.service..ts

| Write | HTTP | Bumps |
|---|---|---|
| `enrollUserForCourse` | `POST /user_certificate/status/create` | `usercert:{tenantId}`, `course:{tenantId}` |
| `updateUserStatusForCourse` | `POST /user_certificate/status/update` | `usercert:{tenantId}`, `course:{tenantId}` |
| `importUserDataForCertificate` | `POST /user_certificate/import/user` | `usercert:{tenantId}` |

- `enrollUserForCourse` and `updateUserStatusForCourse` bump `course:{tenantId}`
  because the dashboard path in `searchStatusCourseTracking` queries
  `user_course_certificate`. Enrollment or status change makes that dashboard
  stale.
- `importUserDataForCertificate` creates a completed certificate record, not
  a status transition visible in course-status dashboards — bumps `usercert`
  only.

### certificate.service.ts

| Write | Bumps |
|---|---|
| `updateUserCertificate` (internal, called from `issueCertificateAfterCourseCompletion`) | `usercert:{tenantId}`, `course:{tenantId}` |

- `tenantId` is not on the `issueCredential` DTO. Read it from the
  `userCertificate` record fetched by `findOne` before the save.

---

## 5. Not cached — deliberate

| Endpoint | Reason |
|---|---|
| `POST /content/list` | Arbitrary sort/pagination/filter; unbounded key space |
| `POST /assessment/list` | Same |
| `POST /assessment/offline-assessment-status` | Crosses two tables; live AI status |
| `GET /ai-assessment/read/:id` | Status changes frequently via webhook |
| `POST /ai-assessment/search` | Status-dependent; low volume |
| `GET /answer-sheet-submissions/read/:id` | Webhook-driven status |
| `POST /answer-sheet-submissions/search` | Status-dependent |
| `POST /certificate/*` | External API proxy; write-heavy |
| `POST /telemetry` | Deprecated no-op |

---

## 6. Known constraints

### 6.1 `POST /content/list` and `POST /assessment/list` — never cache

Six filterable columns, open-ended values, and arbitrary pagination multiply
the key space unboundedly. The memory cost and invalidation complexity outweigh
the benefit of a 60 s cache on one page of admin results.

### 6.2 `courseinprogress` has no tenant scope

The SQL in `courseInProgress` does not filter by `tenantId`. There is no sound
per-tenant namespace. Every content write bumps this global namespace — more
invalidation than necessary but always correct. To narrow scope, the SQL must
first accept a `tenantId` parameter.

### 6.3 `course:{tenantId}` is a cross-module namespace

It is bumped by three services: `tracking_content`, `user_certificate`, and
`certificate`. This is correct and intentional — the response it caches
aggregates data from both `content_tracking` and `user_course_certificate`.

### 6.4 Existing in-memory cache must be removed before enabling Redis

`app.module.ts` currently registers `MemoryStore` globally and two service
constructors inject `@Inject(CACHE_MANAGER)` with direct `get/set` calls.
Both must be replaced with `CacheService` before setting `CACHE_ENABLED=true`.
Running both in parallel means two caches with no coordinated invalidation.

---

## 7. Adding a new cached read — checklist

1. Pick pattern: wide per-tenant namespace (aggregations/search) or narrow
   per-record namespace (single-record reads).
2. Add namespace, key shape, and TTL to §2 and §3.
3. **Enumerate every write path** that touches the underlying data. Grep
   repository `.save()`, `.update()`, `.delete()` calls AND Kafka publishers.
4. If the read crosses multiple tables, ensure all write paths for all tables
   bump the namespace.
5. Invalidate **after commit only**, never before, never on a failed write.
6. Never cache `null`, `undefined`, `false`, or `[]`.
7. Test: hit, miss, write→next-read-fresh, Redis-down passthrough.
8. Ship behind `CACHE_ENABLED=false`; enable per environment.

---

## 8. Rollout and rollback

**Dev (memory):** `CACHE_ENABLED=true`, `CACHE_PROVIDER=memory`. Exercise a
write→read cycle on each namespace. A stale read means a missing invalidation
hook. `error` and `bypass` must be zero.

**QA (Redis, multi-pod):** `CACHE_PROVIDER=redis`, `REDIS_URL=…`,
`CACHE_KEY_PREFIX=tms`. Version counters become shared across pods.

**Turning one namespace off** — config, no redeploy:
```
CACHE_DISABLED_NAMESPACES=course,content
CACHE_DISABLED_NAMESPACES=usercert:{specific-tenantId}
```
Matching is by family (before first `:`) or exact namespace. INCRs still run
while bypassed, so re-enabling is safe.

**Full stop:** `CACHE_ENABLED=false` — instant, deploy-free rollback.
