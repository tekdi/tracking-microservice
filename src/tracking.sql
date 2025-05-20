CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE IF NOT EXISTS status_type AS ENUM ('in_progress', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS public.user_course_certificate
(
    "usercertificateId" uuid NOT NULL DEFAULT gen_random_uuid(),
    "userId" uuid NOT NULL,
    "courseId" character varying COLLATE pg_catalog."default" NOT NULL,
    "certificateId" character varying COLLATE pg_catalog."default",
    status status_type NOT NULL,
    "issuedOn" timestamp with time zone,
    "createdOn" timestamp with time zone,
    "updatedOn" timestamp with time zone,
    "tenantId" uuid,
    "createdBy" character varying(255) COLLATE pg_catalog."default",
    "completedOn" timestamp with time zone,
    "completionPercentage" integer,
    "lastReadContentId" character varying(255) COLLATE pg_catalog."default",
    "lastReadContentStatus" integer,
    progress integer,
    CONSTRAINT user_course_certificate_pkey PRIMARY KEY ("usercertificateId")
)


CREATE TABLE IF NOT EXISTS public.content_tracking
(
    "contentTrackingId" uuid NOT NULL DEFAULT gen_random_uuid(),
    "userId" uuid,
    "courseId" character varying(255) COLLATE pg_catalog."default",
    "contentId" character varying(255) COLLATE pg_catalog."default",
    "contentType" character varying(255) COLLATE pg_catalog."default",
    "contentMime" character varying(255) COLLATE pg_catalog."default",
    "createdOn" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "lastAccessOn" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" timestamp with time zone DEFAULT now(),
    "unitId" character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT content_tracking_pkey PRIMARY KEY ("contentTrackingId")
)

CREATE TABLE IF NOT EXISTS public.content_tracking_details
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    "contentTrackingId" uuid NOT NULL,
    "userId" uuid,
    eid character varying(255) COLLATE pg_catalog."default",
    edata jsonb,
    duration numeric,
    mode character varying(255) COLLATE pg_catalog."default",
    pageid character varying(255) COLLATE pg_catalog."default",
    type character varying(255) COLLATE pg_catalog."default",
    subtype character varying(255) COLLATE pg_catalog."default",
    summary jsonb,
    progress numeric,
    "createdOn" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" timestamp with time zone DEFAULT now(),
    CONSTRAINT content_tracking_details_pkey PRIMARY KEY (id)
)

CREATE TABLE IF NOT EXISTS public.assessment_tracking
(
    "assessmentTrackingId" uuid NOT NULL DEFAULT gen_random_uuid(),
    "userId" uuid,
    "courseId" character varying(255) COLLATE pg_catalog."default",
    "contentId" character varying(255) COLLATE pg_catalog."default",
    "attemptId" character varying(255) COLLATE pg_catalog."default",
    "createdOn" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptedOn" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "assessmentSummary" jsonb,
    "totalMaxScore" double precision,
    "totalScore" double precision,
    "updatedOn" timestamp with time zone DEFAULT now(),
    "timeSpent" numeric,
    "unitId" character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT assessment_tracking_pkey PRIMARY KEY ("assessmentTrackingId")
)

CREATE TABLE IF NOT EXISTS public.assessment_tracking_score_detail
(
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    "userId" uuid NOT NULL,
    "assessmentTrackingId" uuid NOT NULL,
    "questionId" text COLLATE pg_catalog."default",
    pass text COLLATE pg_catalog."default",
    "sectionId" text COLLATE pg_catalog."default",
    "resValue" text COLLATE pg_catalog."default",
    duration integer,
    score integer,
    "maxScore" integer,
    "queTitle" text COLLATE pg_catalog."default",
    CONSTRAINT assessment_tracking_score_detail_pkey PRIMARY KEY (id)
)

CREATE TABLE IF NOT EXISTS public."RolePermission"
(
    "rolePermissionId" uuid NOT NULL DEFAULT gen_random_uuid(),
    module character varying COLLATE pg_catalog."default" NOT NULL,
    "apiPath" character varying COLLATE pg_catalog."default" NOT NULL,
    "roleTitle" character varying COLLATE pg_catalog."default" NOT NULL,
    "requestType" text[] COLLATE pg_catalog."default" NOT NULL,
    "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone,
    "createdBy" uuid,
    "updatedBy" uuid,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("rolePermissionId")
)

