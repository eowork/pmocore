--
-- PostgreSQL database dump
--


-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: building_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.building_status_enum AS ENUM (
    'OPERATIONAL',
    'UNDER_CONSTRUCTION',
    'RENOVATION',
    'CLOSED'
);


--
-- Name: building_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.building_type_enum AS ENUM (
    'ACADEMIC',
    'ADMINISTRATIVE',
    'RESIDENTIAL',
    'OTHER'
);


--
-- Name: campus_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.campus_enum AS ENUM (
    'MAIN',
    'CABADBARAN',
    'BOTH'
);


--
-- Name: condition_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.condition_enum AS ENUM (
    'POOR',
    'FAIR',
    'GOOD',
    'VERY_GOOD',
    'EXCELLENT'
);


--
-- Name: contractor_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contractor_status_enum AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'BLACKLISTED'
);


--
-- Name: department_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.department_status_enum AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


--
-- Name: fund_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fund_type_enum AS ENUM (
    'RAF_PROGRAMS',
    'RAF_PROJECTS',
    'RAF_CONTINUING',
    'IGF_MAIN',
    'IGF_CABADBARAN'
);


--
-- Name: media_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_type_enum AS ENUM (
    'IMAGE',
    'VIDEO',
    'DOCUMENT',
    'OTHER'
);


--
-- Name: module_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.module_type AS ENUM (
    'CONSTRUCTION',
    'REPAIR',
    'OPERATIONS',
    'ALL'
);


--
-- Name: operation_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.operation_type_enum AS ENUM (
    'HIGHER_EDUCATION',
    'ADVANCED_EDUCATION',
    'RESEARCH',
    'TECHNICAL_ADVISORY'
);


--
-- Name: project_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_status_enum AS ENUM (
    'PLANNING',
    'ONGOING',
    'COMPLETED',
    'ON_HOLD',
    'CANCELLED',
    'PROPOSAL',
    'COMPLETE'
);


--
-- Name: project_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_type_enum AS ENUM (
    'CONSTRUCTION',
    'REPAIR',
    'RESEARCH',
    'EXTENSION',
    'TRAINING',
    'OTHER'
);


--
-- Name: publication_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.publication_status_enum AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'PUBLISHED',
    'REJECTED'
);


--
-- Name: repair_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.repair_status_enum AS ENUM (
    'REPORTED',
    'INSPECTED',
    'APPROVED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: room_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.room_status_enum AS ENUM (
    'AVAILABLE',
    'OCCUPIED',
    'UNDER_MAINTENANCE',
    'UNAVAILABLE'
);


--
-- Name: room_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.room_type_enum AS ENUM (
    'CLASSROOM',
    'LABORATORY',
    'OFFICE',
    'CONFERENCE',
    'AUDITORIUM',
    'OTHER'
);


--
-- Name: semester_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.semester_enum AS ENUM (
    'FIRST',
    'SECOND',
    'SUMMER'
);


--
-- Name: setting_data_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.setting_data_type_enum AS ENUM (
    'STRING',
    'NUMBER',
    'BOOLEAN',
    'JSON',
    'DATE',
    'DATETIME'
);


--
-- Name: urgency_level_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.urgency_level_enum AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


--
-- Name: can_modify_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_modify_user(actor_id uuid, target_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  actor_rank INTEGER;
  target_rank INTEGER;
  actor_is_superadmin BOOLEAN;
BEGIN
  -- Get actor's rank and superadmin status
  SELECT u.rank_level, COALESCE(ur.is_superadmin, FALSE)
  INTO actor_rank, actor_is_superadmin
  FROM users u
  LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_superadmin = TRUE
  WHERE u.id = actor_id;

  -- SuperAdmin can modify anyone
  IF actor_is_superadmin THEN
    RETURN TRUE;
  END IF;

  -- Get target's rank
  SELECT rank_level INTO target_rank
  FROM users
  WHERE id = target_id;

  -- Actor can only modify users with higher rank_level number (lower authority)
  RETURN actor_rank < target_rank;
END;
$$;


--
-- Name: get_user_page_permission(uuid, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_page_permission(p_user_id uuid, p_page_id character varying, p_action character varying) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
  v_permission RECORD;
BEGIN
  IF is_user_superadmin(p_user_id) THEN RETURN TRUE; END IF;
  SELECT * INTO v_permission FROM user_page_permissions
  WHERE user_id = p_user_id AND page_id = p_page_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  CASE p_action
    WHEN 'view' THEN RETURN v_permission.can_view;
    WHEN 'add' THEN RETURN v_permission.can_add;
    WHEN 'edit' THEN RETURN v_permission.can_edit;
    WHEN 'delete' THEN RETURN v_permission.can_delete;
    WHEN 'approve' THEN RETURN v_permission.can_approve;
    WHEN 'assign_staff' THEN RETURN v_permission.can_assign_staff;
    WHEN 'manage_permissions' THEN RETURN v_permission.can_manage_permissions;
    ELSE RETURN FALSE;
  END CASE;
END;
$$;


--
-- Name: is_user_superadmin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_user_superadmin(p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id
      AND is_superadmin = TRUE
  );
END;
$$;


--
-- Name: update_user_permission_overrides_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_permission_overrides_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


--
-- Name: user_has_module_access(uuid, public.module_type); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_has_module_access(p_user_id uuid, p_module public.module_type) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  has_access BOOLEAN;
BEGIN
  -- Check if user has explicit access to the module or ALL modules
  SELECT EXISTS (
    SELECT 1 FROM user_module_assignments
    WHERE user_id = p_user_id
      AND (module = p_module OR module = 'ALL')
  ) INTO has_access;

  RETURN has_access;
END;
$$;


--
-- Name: validate_permission_assignment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_permission_assignment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT is_user_superadmin(NEW.assigned_by) THEN
    RAISE EXCEPTION 'Security Violation: Only SuperAdmin can assign permissions. User % is not authorized.', NEW.assigned_by;
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    requested_module character varying(50) NOT NULL,
    requested_level character varying(30) NOT NULL,
    justification text,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    granted_level character varying(30),
    decision_note text,
    decided_by uuid,
    decided_at timestamp with time zone,
    requested_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_email character varying(255) NOT NULL,
    user_name character varying(255) NOT NULL,
    action character varying(50) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id uuid NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_trail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_trail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_id uuid,
    actor_department_id uuid,
    actor_position character varying(100),
    resource_type character varying(100) NOT NULL,
    resource_id uuid,
    action_type character varying(50) NOT NULL,
    delta jsonb,
    ip_address character varying(45),
    user_agent text,
    correlation_id uuid,
    metadata jsonb
);


--
-- Name: buildings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buildings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50),
    campus public.campus_enum NOT NULL,
    building_type public.building_type_enum NOT NULL,
    year_built integer,
    total_floors integer,
    total_area numeric(10,2),
    status public.building_status_enum NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: construction_diary_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_diary_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    entry_date date NOT NULL,
    title character varying(255),
    content text NOT NULL,
    author_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: construction_document_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_document_checklist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    document_type_id uuid NOT NULL,
    submission_status character varying(30) DEFAULT 'NOT_SUBMITTED'::character varying NOT NULL,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    current_version integer DEFAULT 0 NOT NULL,
    expiry_date date,
    linked_document_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    remarks text,
    CONSTRAINT construction_document_checklist_status_check CHECK (((submission_status)::text = ANY ((ARRAY['NOT_SUBMITTED'::character varying, 'SUBMITTED'::character varying, 'UNDER_REVIEW'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: construction_document_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_document_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    parent_id uuid,
    folder_name character varying(200) NOT NULL,
    group_code character varying(50),
    node_type character varying(30) DEFAULT 'CONTAINER'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: construction_document_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_document_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    checklist_item_id uuid NOT NULL,
    project_id uuid NOT NULL,
    document_id uuid NOT NULL,
    version integer NOT NULL,
    submitted_by uuid NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    submission_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: construction_document_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_document_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_code character varying(20) NOT NULL,
    group_label character varying(100) NOT NULL,
    type_code character varying(50) NOT NULL,
    type_label character varying(255) NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    template_url text,
    CONSTRAINT construction_document_types_group_code_check CHECK (((group_code)::text = ANY ((ARRAY['GROUP_1'::character varying, 'GROUP_2'::character varying, 'GROUP_3'::character varying, 'GROUP_4'::character varying, 'GROUP_5'::character varying, 'GROUP_6'::character varying, 'ECO_FORMS'::character varying, 'SD_ORDERS'::character varying, 'SD_REPORTS'::character varying, 'SD_CERTS'::character varying, 'CPES_DOCS'::character varying])::text[])))
);


--
-- Name: construction_gallery; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_gallery (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    image_url character varying(500) NOT NULL,
    caption character varying(255),
    category character varying(50) DEFAULT 'IN_PROGRESS'::character varying,
    is_featured boolean DEFAULT false,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    image_taken_date date,
    CONSTRAINT construction_gallery_category_check CHECK (((category)::text = ANY ((ARRAY['BEFORE'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'DOCUMENTATION'::character varying, 'PROFILE'::character varying])::text[])))
);


--
-- Name: construction_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    target_date date,
    actual_date date,
    status character varying(50) DEFAULT 'PENDING'::character varying,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    start_date date,
    actual_start_date date,
    progress numeric(5,2) DEFAULT 0.00 NOT NULL,
    category character varying(50),
    created_by character varying(36),
    updated_by character varying(36),
    updated_at timestamp with time zone
);


--
-- Name: construction_mov_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_mov_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    related_entity_type character varying(20) NOT NULL,
    related_entity_id uuid NOT NULL,
    mov_link text,
    mov_title character varying(255) NOT NULL,
    mov_description text,
    evidence_category character varying(50) DEFAULT 'other'::character varying NOT NULL,
    entry_date date,
    uploaded_by uuid,
    verification_status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    file_path character varying(500),
    file_name character varying(255),
    file_size integer,
    mime_type character varying(100),
    CONSTRAINT construction_mov_entries_related_entity_type_check CHECK (((related_entity_type)::text = ANY ((ARRAY['MILESTONE'::character varying, 'TIMELINE_ENTRY'::character varying])::text[]))),
    CONSTRAINT construction_mov_entries_verification_status_check CHECK (((verification_status)::text = ANY ((ARRAY['PENDING'::character varying, 'VERIFIED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: construction_progress_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_progress_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    report_type character varying(20) NOT NULL,
    report_date date NOT NULL,
    report_number character varying(20),
    percentage_completion numeric(5,2) DEFAULT 0 NOT NULL,
    planned_accomplishment numeric(5,2),
    slippage numeric(5,2),
    cost_incurred_to_date numeric(15,2),
    cost_incurred_this_period numeric(15,2),
    calendar_days_elapsed integer,
    percent_time_elapsed numeric(5,2),
    remarks text,
    issues_encountered text,
    mitigation_actions text,
    mov_document_id uuid,
    mov_link text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    narrative_list jsonb DEFAULT '[]'::jsonb NOT NULL,
    remarks_list jsonb DEFAULT '[]'::jsonb NOT NULL,
    issues_encountered_list jsonb DEFAULT '[]'::jsonb NOT NULL,
    mitigation_actions_list jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: construction_project_accomplishment_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_project_accomplishment_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    date_entry date NOT NULL,
    comments text,
    remarks_comments text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: construction_project_actual_accomplishment_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_project_actual_accomplishment_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid CONSTRAINT construction_project_actual_accomplishment__project_id_not_null NOT NULL,
    date_entry date CONSTRAINT construction_project_actual_accomplishment__date_entry_not_null NOT NULL,
    progress_accomplishment numeric(5,2),
    actual_percent numeric(5,2),
    target_percent numeric(5,2),
    created_at timestamp with time zone DEFAULT now() CONSTRAINT construction_project_actual_accomplishment__created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT construction_project_actual_accomplishment__updated_at_not_null NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: construction_project_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_project_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    can_view_documents boolean DEFAULT true NOT NULL,
    can_upload_documents boolean DEFAULT false NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: construction_project_financial_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_project_financial_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    report_title character varying(255) NOT NULL,
    report_date date NOT NULL,
    target_budget numeric(15,2),
    actual_spent numeric(15,2),
    status character varying(50),
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: construction_project_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_project_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    start_date date,
    end_date date,
    actual_start_date date,
    actual_end_date date,
    status character varying(50),
    progress numeric(5,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: construction_project_phases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_project_phases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    phase_name character varying(100) NOT NULL,
    phase_description text,
    target_progress numeric(5,2),
    actual_progress numeric(5,2),
    status character varying(50),
    target_start_date date,
    target_end_date date,
    actual_start_date date,
    actual_end_date date,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: construction_project_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_project_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    report_date date NOT NULL,
    physical_progress_percentage numeric(5,2) CONSTRAINT construction_project_progre_physical_progress_percenta_not_null NOT NULL,
    financial_progress_percentage numeric(5,2) CONSTRAINT construction_project_progre_financial_progress_percent_not_null NOT NULL,
    time_elapsed_percentage numeric(5,2) NOT NULL,
    slippage_percentage numeric(5,2),
    remarks text,
    reported_by uuid NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: construction_project_progress_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_project_progress_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    period character varying(50) NOT NULL,
    physical_progress numeric(5,2),
    financial_progress numeric(5,2),
    issues text,
    recommendations text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: construction_project_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_project_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid,
    name character varying(255) NOT NULL,
    role character varying(100) NOT NULL,
    department character varying(100),
    responsibilities text,
    status character varying(50) DEFAULT 'Active'::character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: construction_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    infra_project_uid bigint NOT NULL,
    project_id uuid NOT NULL,
    project_code character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    ideal_infrastructure_image character varying(255),
    beneficiaries integer,
    objectives jsonb,
    key_features jsonb,
    original_contract_duration character varying(100),
    contract_number character varying(50),
    contractor_id uuid,
    contract_amount numeric(15,2),
    start_date date,
    target_completion_date date,
    actual_completion_date date,
    project_duration character varying(100),
    project_engineer character varying(255),
    project_manager character varying(255),
    location_coordinates point,
    building_type character varying(100),
    floor_area numeric(10,2),
    number_of_floors integer,
    funding_source_id uuid,
    subcategory_id uuid,
    campus public.campus_enum NOT NULL,
    status public.project_status_enum NOT NULL,
    latitude numeric(9,6),
    longitude numeric(9,6),
    physical_progress numeric(5,2) DEFAULT 0.00,
    financial_progress numeric(5,2) DEFAULT 0.00,
    timeline_data jsonb DEFAULT '[]'::jsonb,
    gallery_images jsonb DEFAULT '[]'::jsonb,
    created_by uuid NOT NULL,
    updated_by uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    publication_status public.publication_status_enum DEFAULT 'PUBLISHED'::public.publication_status_enum,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    assigned_to uuid,
    target_physical_progress numeric(5,2) DEFAULT 100,
    target_financial_progress numeric(5,2) DEFAULT 100,
    summary text,
    scope text,
    facilities text,
    strategic_alignment text,
    output_indicators jsonb,
    outcome_indicators jsonb,
    implementing_agency character varying(255),
    project_status_category character varying(50),
    status_updates jsonb,
    readiness_documents jsonb,
    signatories jsonb,
    document_checklist_remarks jsonb DEFAULT '{}'::jsonb NOT NULL,
    incident_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    risk_register jsonb DEFAULT '[]'::jsonb NOT NULL,
    escalation_records jsonb DEFAULT '[]'::jsonb NOT NULL,
    contractor character varying(255),
    spatial_coverage character varying(500),
    municipality character varying(100),
    province character varying(100),
    co_implementing_agency character varying(255),
    attached_agency character varying(255),
    original_start_date date,
    revised_start_date date,
    original_completion_date date,
    revised_completion_date date,
    revised_project_duration character varying(100),
    as_of_date date,
    cost_incurred_to_date numeric(15,2),
    rdp_alignment jsonb,
    socioeconomic_agenda jsonb,
    csu_likha_goals jsonb,
    beneficiary_list jsonb,
    funding_source_type character varying(20),
    additional_funding_sources jsonb,
    remarks_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    personnel_groups jsonb,
    custom_key_sections jsonb DEFAULT '[]'::jsonb,
    sdg_goals jsonb DEFAULT '[]'::jsonb,
    custom_supporting_sections jsonb DEFAULT '[]'::jsonb,
    project_notes_banking jsonb,
    rdp2017_alignment jsonb,
    point_agenda_10 jsonb,
    implementation_period character varying(100),
    primary_funding_source character varying(30),
    funding_source_description character varying(255),
    CONSTRAINT construction_projects_project_status_category_check CHECK (((project_status_category)::text = ANY ((ARRAY['NEW'::character varying, 'ONGOING'::character varying, 'COMPLETED'::character varying, 'SUSPENDED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: construction_projects_infra_project_uid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.construction_projects_infra_project_uid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: construction_projects_infra_project_uid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.construction_projects_infra_project_uid_seq OWNED BY public.construction_projects.infra_project_uid;


--
-- Name: construction_revision_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_revision_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    revision_number integer NOT NULL,
    revision_type character varying(50) NOT NULL,
    revision_date date NOT NULL,
    new_start_date date,
    new_completion_date date,
    new_duration character varying(100),
    cost_adjustment numeric(15,2),
    justification text,
    approval_status character varying(50),
    mov_document_id uuid,
    mov_link text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: construction_subcategories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_subcategories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_by uuid,
    updated_by uuid
);


--
-- Name: construction_timeline_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.construction_timeline_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    entry_type character varying(20) DEFAULT 'WEEKLY'::character varying NOT NULL,
    entry_date date NOT NULL,
    period_label character varying(100),
    title character varying(255) NOT NULL,
    description text,
    weather character varying(100),
    manpower_count integer,
    equipment_used text,
    work_accomplished text,
    issues_encountered text,
    photos_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reporter_type character varying(20),
    war_number character varying(50),
    reporting_period_start date,
    reporting_period_end date,
    personnel_equipment_constraints text,
    mitigation_measures text,
    look_ahead_activities text,
    accomplishments jsonb DEFAULT '[]'::jsonb,
    signatories jsonb DEFAULT '[]'::jsonb,
    mpr_number character varying(50),
    reporting_period_month date,
    work_items jsonb DEFAULT '[]'::jsonb,
    accomplishment_summary_percent numeric(5,2),
    percent_time_elapsed numeric(5,2),
    original_contract_amount numeric(18,2),
    revised_contract_amount numeric(18,2),
    concerns_list jsonb DEFAULT '[]'::jsonb,
    billing_amount_this_period numeric(15,2),
    financial_accomplishment_percent numeric(5,2),
    CONSTRAINT construction_timeline_entries_entry_type_check CHECK (((entry_type)::text = ANY ((ARRAY['DAILY'::character varying, 'WEEKLY'::character varying, 'MONTHLY'::character varying, 'QUARTERLY'::character varying])::text[])))
);


--
-- Name: contractor_invite_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contractor_invite_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    token character varying(64) NOT NULL,
    target_email character varying(255),
    created_by uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contractor_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contractor_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text,
    full_name text NOT NULL,
    company_name character varying(255),
    phone character varying(30),
    "position" character varying(150),
    google_id character varying(255),
    avatar_url text,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contractors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contractors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    contact_person character varying(255),
    email character varying(255),
    phone character varying(20),
    address text,
    tin_number character varying(50),
    registration_number character varying(100),
    validity_date date,
    status public.contractor_status_enum NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_by uuid,
    updated_by uuid
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50),
    description text,
    parent_id uuid,
    head_id uuid,
    email character varying(255),
    phone character varying(20),
    status public.department_status_enum DEFAULT 'ACTIVE'::public.department_status_enum NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_by uuid,
    updated_by uuid
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    documentable_type character varying(100) NOT NULL,
    documentable_id uuid NOT NULL,
    document_type character varying(100) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(255) NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    description text,
    version integer DEFAULT 1,
    category character varying(50),
    extracted_text text,
    chunks jsonb,
    processed_at timestamp with time zone,
    status character varying(50) DEFAULT 'ready'::character varying,
    uploaded_by uuid NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_by uuid,
    updated_by uuid,
    lifecycle_status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    folder_id uuid,
    CONSTRAINT documents_lifecycle_status_check CHECK (((lifecycle_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'ARCHIVED'::character varying, 'DRAFT'::character varying])::text[])))
);


--
-- Name: downloadable_forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.downloadable_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_title character varying(255) NOT NULL,
    department_owner character varying(100),
    file_url character varying(500) NOT NULL,
    file_type character varying(10),
    file_size_display character varying(20),
    is_public boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: facilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_name character varying(100) NOT NULL,
    room_number character varying(50) NOT NULL,
    facility_type character varying(50) DEFAULT 'Classroom'::character varying,
    campus public.campus_enum DEFAULT 'MAIN'::public.campus_enum,
    capacity integer,
    floor_area_sqm numeric(10,2),
    condition_rating public.condition_enum DEFAULT 'GOOD'::public.condition_enum,
    features_list jsonb DEFAULT '[]'::jsonb,
    is_operational boolean DEFAULT true,
    last_inspected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fiscal_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_years (
    year integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    label character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: forms_inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forms_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    form_code character varying(100),
    description text,
    category character varying(100),
    revision_number character varying(20) DEFAULT '1.0'::character varying,
    is_active boolean DEFAULT true,
    document_id uuid,
    owning_department_id uuid,
    created_by uuid NOT NULL,
    updated_by uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: funding_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funding_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_by uuid,
    updated_by uuid,
    type character varying(20)
);


--
-- Name: gad_budget_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gad_budget_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100),
    priority character varying(20),
    status character varying(50),
    budget_allocated numeric(12,2),
    budget_utilized numeric(12,2),
    target_beneficiaries integer,
    start_date date,
    end_date date,
    year character varying(4),
    responsible character varying(255),
    data_status character varying(50) DEFAULT 'pending'::character varying,
    submitted_by uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: gad_faculty_parity_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gad_faculty_parity_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_year character varying(20) NOT NULL,
    college character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    total_faculty integer DEFAULT 0,
    male_count integer DEFAULT 0,
    female_count integer DEFAULT 0,
    gender_balance character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    submitted_by uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: gad_gpb_accomplishments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gad_gpb_accomplishments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100),
    priority character varying(20),
    status character varying(50),
    target_beneficiaries integer,
    actual_beneficiaries integer,
    target_budget numeric(12,2),
    actual_budget numeric(12,2),
    year character varying(4),
    responsible character varying(255),
    data_status character varying(50) DEFAULT 'pending'::character varying,
    submitted_by uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: gad_indigenous_parity_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gad_indigenous_parity_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_year character varying(20) NOT NULL,
    indigenous_category character varying(50) NOT NULL,
    subcategory character varying(100),
    total_participants integer DEFAULT 0,
    male_count integer DEFAULT 0,
    female_count integer DEFAULT 0,
    status character varying(50) DEFAULT 'pending'::character varying,
    submitted_by uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: gad_pwd_parity_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gad_pwd_parity_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_year character varying(20) NOT NULL,
    pwd_category character varying(50) NOT NULL,
    subcategory character varying(100),
    total_beneficiaries integer DEFAULT 0,
    male_count integer DEFAULT 0,
    female_count integer DEFAULT 0,
    status character varying(50) DEFAULT 'pending'::character varying,
    submitted_by uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: gad_staff_parity_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gad_staff_parity_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_year character varying(20) NOT NULL,
    department character varying(100) NOT NULL,
    staff_category character varying(50) NOT NULL,
    total_staff integer DEFAULT 0,
    male_count integer DEFAULT 0,
    female_count integer DEFAULT 0,
    gender_balance character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    submitted_by uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: gad_student_parity_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gad_student_parity_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_year character varying(20) NOT NULL,
    program character varying(100) NOT NULL,
    admission_male integer DEFAULT 0,
    admission_female integer DEFAULT 0,
    graduation_male integer DEFAULT 0,
    graduation_female integer DEFAULT 0,
    status character varying(50) DEFAULT 'pending'::character varying,
    submitted_by uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: gad_yearly_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gad_yearly_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_year integer NOT NULL,
    student_statistics jsonb DEFAULT '{}'::jsonb,
    faculty_statistics jsonb DEFAULT '{}'::jsonb,
    staff_statistics jsonb DEFAULT '{}'::jsonb,
    key_insights jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mediable_type character varying(100) NOT NULL,
    mediable_id uuid NOT NULL,
    media_type public.media_type_enum NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path character varying(255) NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    title character varying(255),
    description text,
    alt_text character varying(255),
    is_featured boolean DEFAULT false,
    thumbnail_url character varying(255),
    dimensions jsonb,
    tags jsonb,
    capture_date date,
    display_order integer DEFAULT 0,
    location jsonb,
    project_type character varying(50),
    uploaded_by uuid NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_by uuid,
    updated_by uuid
);


--
-- Name: mikro_orm_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mikro_orm_migrations (
    id integer NOT NULL,
    name character varying(255),
    executed_at timestamp with time zone DEFAULT now()
);


--
-- Name: mikro_orm_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mikro_orm_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mikro_orm_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mikro_orm_migrations_id_seq OWNED BY public.mikro_orm_migrations.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    notification_type character varying(50) NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    action_url character varying(255),
    related_entity_type character varying(100),
    related_entity_id uuid,
    created_by uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: operation_financials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_financials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operation_id uuid NOT NULL,
    fiscal_year integer NOT NULL,
    quarter character varying(2),
    operations_programs character varying(255) NOT NULL,
    department character varying(255),
    budget_source character varying(100),
    allotment numeric(15,2),
    target numeric(15,2),
    obligation numeric(15,2) DEFAULT 0,
    disbursement numeric(15,2) DEFAULT 0,
    utilization_per_target numeric(5,2),
    utilization_per_approved_budget numeric(5,2),
    disbursement_rate numeric(5,2),
    balance numeric(15,2),
    variance numeric(15,2),
    performance_indicator character varying(255),
    status character varying(20) DEFAULT 'active'::character varying,
    remarks text,
    created_by uuid,
    updated_by uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    fund_type public.fund_type_enum,
    project_code character varying(50),
    expense_class character varying(4),
    CONSTRAINT chk_expense_class CHECK (((expense_class)::text = ANY ((ARRAY['PS'::character varying, 'MOOE'::character varying, 'CO'::character varying])::text[]))),
    CONSTRAINT operation_financials_quarter_check CHECK (((quarter)::text = ANY ((ARRAY['Q1'::character varying, 'Q2'::character varying, 'Q3'::character varying, 'Q4'::character varying])::text[]))),
    CONSTRAINT operation_financials_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'completed'::character varying, 'pending'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: operation_indicators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_indicators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operation_id uuid NOT NULL,
    particular character varying(500) NOT NULL,
    description text,
    indicator_code character varying(100),
    uacs_code character varying(50),
    fiscal_year integer NOT NULL,
    target_q1 numeric(12,4),
    target_q2 numeric(12,4),
    target_q3 numeric(12,4),
    target_q4 numeric(12,4),
    accomplishment_q1 numeric(12,4),
    accomplishment_q2 numeric(12,4),
    accomplishment_q3 numeric(12,4),
    accomplishment_q4 numeric(12,4),
    score_q1 character varying(250),
    score_q2 character varying(250),
    score_q3 character varying(250),
    score_q4 character varying(250),
    variance_as_of date,
    variance numeric(12,4),
    average_target numeric(12,4),
    average_accomplishment numeric(12,4),
    status character varying(20) DEFAULT 'pending'::character varying,
    remarks text,
    subcategory_data jsonb,
    created_by uuid NOT NULL,
    updated_by uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    pillar_indicator_id uuid,
    reported_quarter character varying(2),
    override_rate numeric(6,2),
    override_rate_q1 numeric(6,2),
    override_rate_q2 numeric(6,2),
    override_rate_q3 numeric(6,2),
    override_rate_q4 numeric(6,2),
    override_variance numeric(8,2),
    override_variance_q1 numeric(8,2),
    override_variance_q2 numeric(8,2),
    override_variance_q3 numeric(8,2),
    override_variance_q4 numeric(8,2),
    override_total_target numeric(15,4) DEFAULT NULL::numeric,
    override_total_actual numeric(15,4) DEFAULT NULL::numeric,
    catch_up_plan text,
    facilitating_factors text,
    ways_forward text,
    mov text,
    numerator_q1 numeric(12,4),
    denominator_q1 numeric(12,4),
    numerator_q2 numeric(12,4),
    denominator_q2 numeric(12,4),
    numerator_q3 numeric(12,4),
    denominator_q3 numeric(12,4),
    numerator_q4 numeric(12,4),
    denominator_q4 numeric(12,4),
    target_numerator_q1 numeric(12,4),
    target_denominator_q1 numeric(12,4),
    target_numerator_q2 numeric(12,4),
    target_denominator_q2 numeric(12,4),
    target_numerator_q3 numeric(12,4),
    target_denominator_q3 numeric(12,4),
    target_numerator_q4 numeric(12,4),
    target_denominator_q4 numeric(12,4),
    remarks_q1 text,
    remarks_q2 text,
    remarks_q3 text,
    remarks_q4 text,
    override_total_target_fraction text,
    override_total_actual_fraction text,
    CONSTRAINT operation_indicators_reported_quarter_check CHECK (((reported_quarter)::text = ANY ((ARRAY['Q1'::character varying, 'Q2'::character varying, 'Q3'::character varying, 'Q4'::character varying])::text[]))),
    CONSTRAINT operation_indicators_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: operation_organizational_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_organizational_info (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operation_id uuid NOT NULL,
    department character varying(255),
    agency_entity character varying(255),
    operating_unit character varying(255),
    organization_code character varying(100),
    created_by uuid NOT NULL,
    updated_by uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: password_reset_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    notes text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_by uuid,
    completed_at timestamp with time zone,
    CONSTRAINT password_reset_requests_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'COMPLETED'::text, 'CANCELLED'::text])))
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: pillar_indicator_taxonomy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pillar_indicator_taxonomy (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pillar_type public.operation_type_enum NOT NULL,
    indicator_name character varying(500) NOT NULL,
    indicator_code character varying(50),
    uacs_code character varying(50),
    indicator_order integer NOT NULL,
    indicator_type character varying(20) NOT NULL,
    unit_type character varying(20) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    organizational_outcome character varying(10),
    CONSTRAINT pillar_indicator_taxonomy_indicator_type_check CHECK (((indicator_type)::text = ANY ((ARRAY['OUTCOME'::character varying, 'OUTPUT'::character varying])::text[]))),
    CONSTRAINT pillar_indicator_taxonomy_oo_check CHECK (((organizational_outcome)::text = ANY ((ARRAY['OO1'::character varying, 'OO2'::character varying, 'OO3'::character varying])::text[]))),
    CONSTRAINT pillar_indicator_taxonomy_unit_type_check CHECK (((unit_type)::text = ANY ((ARRAY['PERCENTAGE'::character varying, 'COUNT'::character varying, 'WEIGHTED_COUNT'::character varying, 'RATIO'::character varying, 'SCORE'::character varying])::text[])))
);


--
-- Name: policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100) NOT NULL,
    policy_number character varying(50),
    status character varying(50) DEFAULT 'DRAFT'::character varying NOT NULL,
    valid_from date NOT NULL,
    valid_until date,
    issuing_authority character varying(255),
    version_number character varying(20),
    effective_date date,
    file_url character varying(500),
    document_id uuid,
    created_by uuid NOT NULL,
    updated_by uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: project_contractor_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_contractor_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid CONSTRAINT project_contractor_assignments_contractor_user_id_not_null NOT NULL,
    invite_token_id uuid,
    role character varying(100),
    permissions jsonb,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    removed_at timestamp with time zone
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_code character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    project_type public.project_type_enum NOT NULL,
    start_date date,
    end_date date,
    status public.project_status_enum NOT NULL,
    budget numeric(15,2),
    campus public.campus_enum NOT NULL,
    created_by uuid NOT NULL,
    updated_by uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: quarterly_report_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quarterly_report_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quarterly_report_id uuid NOT NULL,
    fiscal_year integer NOT NULL,
    quarter character varying(2) NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    event_type character varying(30) NOT NULL,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    actioned_by uuid NOT NULL,
    actioned_at timestamp with time zone DEFAULT now(),
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT quarterly_report_submissions_event_type_check CHECK (((event_type)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'REVERTED'::character varying, 'UNLOCKED'::character varying])::text[])))
);


--
-- Name: quarterly_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quarterly_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fiscal_year integer NOT NULL,
    quarter character varying(2) NOT NULL,
    title text,
    publication_status character varying(20) DEFAULT 'DRAFT'::character varying,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    unlock_requested_by uuid,
    unlock_requested_at timestamp with time zone,
    unlock_request_reason text,
    unlocked_by uuid,
    unlocked_at timestamp with time zone,
    submission_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT quarterly_reports_publication_status_check CHECK (((publication_status)::text = ANY ((ARRAY['DRAFT'::character varying, 'PENDING_REVIEW'::character varying, 'PUBLISHED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT quarterly_reports_quarter_check CHECK (((quarter)::text = ANY ((ARRAY['Q1'::character varying, 'Q2'::character varying, 'Q3'::character varying, 'Q4'::character varying])::text[])))
);


--
-- Name: record_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.record_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module character varying(50) NOT NULL,
    record_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid,
    role character varying(100),
    department character varying(150),
    phone character varying(30),
    personnel_category character varying(50),
    project_role character varying(100),
    permissions jsonb,
    CONSTRAINT record_assignments_module_check CHECK (((module)::text = ANY ((ARRAY['CONSTRUCTION'::character varying, 'REPAIR'::character varying, 'OPERATIONS'::character varying])::text[])))
);


--
-- Name: repair_pow_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_pow_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_project_id uuid NOT NULL,
    item_number character varying(50) NOT NULL,
    description text NOT NULL,
    unit character varying(20) NOT NULL,
    quantity numeric(15,2) NOT NULL,
    estimated_material_cost numeric(15,2) NOT NULL,
    estimated_labor_cost numeric(15,2) NOT NULL,
    estimated_project_cost numeric(15,2) NOT NULL,
    unit_cost numeric(15,2) NOT NULL,
    is_unit_cost_overridden boolean DEFAULT false,
    date_entry date NOT NULL,
    status character varying(50) DEFAULT 'Active'::character varying,
    remarks text,
    category character varying(100) NOT NULL,
    phase character varying(100) NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: repair_project_accomplishment_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_project_accomplishment_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_project_id uuid CONSTRAINT repair_project_accomplishment_record_repair_project_id_not_null NOT NULL,
    date_entry date NOT NULL,
    comments text,
    remarks_comments text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: repair_project_actual_accomplishment_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_project_actual_accomplishment_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_project_id uuid CONSTRAINT repair_project_actual_accomplishment_repair_project_id_not_null NOT NULL,
    date_entry date CONSTRAINT repair_project_actual_accomplishment_record_date_entry_not_null NOT NULL,
    progress_accomplishment numeric(5,2),
    actual_percent numeric(5,2),
    target_percent numeric(5,2),
    created_at timestamp with time zone DEFAULT now() CONSTRAINT repair_project_actual_accomplishment_record_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT repair_project_actual_accomplishment_record_updated_at_not_null NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: repair_project_financial_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_project_financial_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_project_id uuid NOT NULL,
    report_title character varying(255) NOT NULL,
    report_date date NOT NULL,
    target_budget numeric(15,2),
    actual_spent numeric(15,2),
    status character varying(50),
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: repair_project_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_project_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_project_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    start_date date,
    end_date date,
    actual_start_date date,
    actual_end_date date,
    status character varying(50),
    progress numeric(5,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: repair_project_phases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_project_phases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_project_id uuid NOT NULL,
    phase_name character varying(100) NOT NULL,
    phase_description text,
    target_progress numeric(5,2),
    actual_progress numeric(5,2),
    status character varying(50),
    target_start_date date,
    target_end_date date,
    actual_start_date date,
    actual_end_date date,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: repair_project_progress_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_project_progress_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_project_id uuid NOT NULL,
    period character varying(50) NOT NULL,
    physical_progress numeric(5,2),
    financial_progress numeric(5,2),
    issues text,
    recommendations text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: repair_project_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_project_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    repair_project_id uuid NOT NULL,
    user_id uuid,
    name character varying(255) NOT NULL,
    role character varying(100) NOT NULL,
    department character varying(100),
    responsibilities text,
    status character varying(50) DEFAULT 'Active'::character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: repair_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    project_code character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    building_name character varying(255) NOT NULL,
    floor_number character varying(20),
    room_number character varying(20),
    specific_location character varying(255),
    repair_type_id uuid NOT NULL,
    urgency_level public.urgency_level_enum DEFAULT 'LOW'::public.urgency_level_enum NOT NULL,
    is_emergency boolean DEFAULT false NOT NULL,
    campus public.campus_enum NOT NULL,
    reported_by character varying(255),
    reported_date timestamp with time zone DEFAULT now(),
    inspection_date date,
    inspector_id uuid,
    inspection_findings text,
    status public.repair_status_enum NOT NULL,
    start_date date,
    end_date date,
    budget numeric(15,2),
    project_manager_id uuid,
    contractor_id uuid,
    completion_date date,
    facility_id uuid,
    assigned_technician character varying(255),
    created_by uuid NOT NULL,
    updated_by uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    physical_progress numeric(5,2) DEFAULT 0.00,
    financial_progress numeric(5,2) DEFAULT 0.00,
    actual_cost numeric(15,2),
    publication_status public.publication_status_enum DEFAULT 'PUBLISHED'::public.publication_status_enum,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    assigned_to uuid
);


--
-- Name: repair_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_by uuid,
    updated_by uuid
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: room_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    assessment_date date NOT NULL,
    academic_year character varying(20) NOT NULL,
    semester public.semester_enum NOT NULL,
    subject_code character varying(50),
    subject_description character varying(255),
    number_of_students integer,
    class_schedule text,
    functionality_score integer,
    utility_systems_score integer,
    sanitation_score integer,
    equipment_score integer,
    furniture_score integer,
    space_management_score integer,
    safety_score integer,
    overall_score numeric(5,2),
    overall_condition public.condition_enum,
    functionality_details json,
    utility_systems_details json,
    sanitation_details json,
    equipment_details json,
    furniture_details json,
    space_management_details json,
    safety_details json,
    assessor_id uuid NOT NULL,
    assessor_position character varying(100),
    remarks text,
    recommended_actions text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid NOT NULL,
    room_number character varying(20) NOT NULL,
    floor_number integer NOT NULL,
    room_type public.room_type_enum NOT NULL,
    capacity integer,
    area numeric(10,2),
    status public.room_status_enum NOT NULL,
    is_airconditioned boolean DEFAULT false,
    has_projector boolean DEFAULT false,
    has_whiteboard boolean DEFAULT true,
    is_wheelchair_accessible boolean DEFAULT false,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text,
    setting_group character varying(50) NOT NULL,
    data_type public.setting_data_type_enum NOT NULL,
    is_public boolean DEFAULT false,
    description text,
    updated_by uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_by uuid
);


--
-- Name: university_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operation_type public.operation_type_enum NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    code character varying(50),
    start_date date,
    end_date date,
    status public.project_status_enum NOT NULL,
    budget numeric(15,2),
    campus public.campus_enum NOT NULL,
    coordinator_id uuid,
    created_by uuid NOT NULL,
    updated_by uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    publication_status public.publication_status_enum DEFAULT 'PUBLISHED'::public.publication_status_enum,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    assigned_to uuid,
    fiscal_year integer,
    status_q1 character varying(20) DEFAULT 'DRAFT'::character varying,
    status_q2 character varying(20) DEFAULT 'DRAFT'::character varying,
    status_q3 character varying(20) DEFAULT 'DRAFT'::character varying,
    status_q4 character varying(20) DEFAULT 'DRAFT'::character varying,
    CONSTRAINT university_operations_status_q1_check CHECK (((status_q1)::text = ANY ((ARRAY['DRAFT'::character varying, 'PENDING_REVIEW'::character varying, 'PUBLISHED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT university_operations_status_q2_check CHECK (((status_q2)::text = ANY ((ARRAY['DRAFT'::character varying, 'PENDING_REVIEW'::character varying, 'PUBLISHED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT university_operations_status_q3_check CHECK (((status_q3)::text = ANY ((ARRAY['DRAFT'::character varying, 'PENDING_REVIEW'::character varying, 'PUBLISHED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT university_operations_status_q4_check CHECK (((status_q4)::text = ANY ((ARRAY['DRAFT'::character varying, 'PENDING_REVIEW'::character varying, 'PUBLISHED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: university_operations_personnel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_operations_personnel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category character varying(100) NOT NULL,
    can_add boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    can_approve boolean DEFAULT false NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: university_statistics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.university_statistics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    academic_year integer NOT NULL,
    enrolled_students integer DEFAULT 0,
    graduates_count integer DEFAULT 0,
    research_projects_count integer DEFAULT 0,
    extension_beneficiaries integer DEFAULT 0,
    programs_offered integer DEFAULT 0,
    research_projects_active integer DEFAULT 0,
    research_publications integer DEFAULT 0,
    research_budget_utilized numeric(15,2),
    total_research_budget numeric(15,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    campus text
);


--
-- Name: user_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_departments (
    user_id uuid NOT NULL,
    department_id uuid NOT NULL,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: user_module_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_module_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    module public.module_type NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_page_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_page_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    page_id character varying(100) NOT NULL,
    can_view boolean DEFAULT true NOT NULL,
    can_add boolean DEFAULT false NOT NULL,
    can_edit boolean DEFAULT false NOT NULL,
    can_delete boolean DEFAULT false NOT NULL,
    can_approve boolean DEFAULT false NOT NULL,
    can_assign_staff boolean DEFAULT false NOT NULL,
    can_manage_permissions boolean DEFAULT false NOT NULL,
    assigned_by uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid
);


--
-- Name: user_permission_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permission_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    module_key character varying(50) NOT NULL,
    can_access boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid,
    granted_level character varying(30)
);


--
-- Name: user_pillar_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_pillar_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pillar_type character varying(50) NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_pillar_type CHECK (((pillar_type)::text = ANY ((ARRAY['HIGHER_EDUCATION'::character varying, 'ADVANCED_EDUCATION'::character varying, 'RESEARCH'::character varying, 'TECHNICAL_ADVISORY'::character varying])::text[])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    is_superadmin boolean DEFAULT false NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    phone character varying(20),
    avatar_url character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    last_password_change_at timestamp with time zone,
    failed_login_attempts integer DEFAULT 0,
    account_locked_until timestamp with time zone,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    google_id character varying(255),
    username character varying(100) NOT NULL,
    rank_level integer DEFAULT 100,
    campus text,
    status character varying(50) DEFAULT 'ACTIVE'::character varying,
    updated_by uuid,
    middle_name text,
    display_name character varying(255),
    created_by uuid,
    profile_completed boolean DEFAULT false NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_users_rank_level CHECK (((rank_level >= 10) AND (rank_level <= 100)))
);


--
-- Name: construction_projects infra_project_uid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects ALTER COLUMN infra_project_uid SET DEFAULT nextval('public.construction_projects_infra_project_uid_seq'::regclass);


--
-- Name: mikro_orm_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mikro_orm_migrations ALTER COLUMN id SET DEFAULT nextval('public.mikro_orm_migrations_id_seq'::regclass);


--
-- Name: access_requests access_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: audit_trail audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_pkey PRIMARY KEY (id);


--
-- Name: buildings buildings_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_code_key UNIQUE (code);


--
-- Name: buildings buildings_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_name_key UNIQUE (name);


--
-- Name: buildings buildings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_pkey PRIMARY KEY (id);


--
-- Name: construction_diary_entries construction_diary_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_diary_entries
    ADD CONSTRAINT construction_diary_entries_pkey PRIMARY KEY (id);


--
-- Name: construction_document_checklist construction_document_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_checklist
    ADD CONSTRAINT construction_document_checklist_pkey PRIMARY KEY (id);


--
-- Name: construction_document_checklist construction_document_checklist_project_id_document_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_checklist
    ADD CONSTRAINT construction_document_checklist_project_id_document_type_id_key UNIQUE (project_id, document_type_id);


--
-- Name: construction_document_folders construction_document_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_folders
    ADD CONSTRAINT construction_document_folders_pkey PRIMARY KEY (id);


--
-- Name: construction_document_submissions construction_document_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_submissions
    ADD CONSTRAINT construction_document_submissions_pkey PRIMARY KEY (id);


--
-- Name: construction_document_types construction_document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_types
    ADD CONSTRAINT construction_document_types_pkey PRIMARY KEY (id);


--
-- Name: construction_document_types construction_document_types_type_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_types
    ADD CONSTRAINT construction_document_types_type_code_key UNIQUE (type_code);


--
-- Name: construction_gallery construction_gallery_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_gallery
    ADD CONSTRAINT construction_gallery_pkey PRIMARY KEY (id);


--
-- Name: construction_milestones construction_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_pkey PRIMARY KEY (id);


--
-- Name: construction_mov_entries construction_mov_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_mov_entries
    ADD CONSTRAINT construction_mov_entries_pkey PRIMARY KEY (id);


--
-- Name: construction_progress_reports construction_progress_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_progress_reports
    ADD CONSTRAINT construction_progress_reports_pkey PRIMARY KEY (id);


--
-- Name: construction_project_accomplishment_records construction_project_accomplishment_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_accomplishment_records
    ADD CONSTRAINT construction_project_accomplishment_records_pkey PRIMARY KEY (id);


--
-- Name: construction_project_actual_accomplishment_records construction_project_actual_accomplishment_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_actual_accomplishment_records
    ADD CONSTRAINT construction_project_actual_accomplishment_records_pkey PRIMARY KEY (id);


--
-- Name: construction_project_assignments construction_project_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_assignments
    ADD CONSTRAINT construction_project_assignments_pkey PRIMARY KEY (id);


--
-- Name: construction_project_financial_reports construction_project_financial_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_financial_reports
    ADD CONSTRAINT construction_project_financial_reports_pkey PRIMARY KEY (id);


--
-- Name: construction_project_milestones construction_project_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_milestones
    ADD CONSTRAINT construction_project_milestones_pkey PRIMARY KEY (id);


--
-- Name: construction_project_phases construction_project_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_phases
    ADD CONSTRAINT construction_project_phases_pkey PRIMARY KEY (id);


--
-- Name: construction_project_progress construction_project_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_progress
    ADD CONSTRAINT construction_project_progress_pkey PRIMARY KEY (id);


--
-- Name: construction_project_progress_summaries construction_project_progress_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_progress_summaries
    ADD CONSTRAINT construction_project_progress_summaries_pkey PRIMARY KEY (id);


--
-- Name: construction_project_team_members construction_project_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_team_members
    ADD CONSTRAINT construction_project_team_members_pkey PRIMARY KEY (id);


--
-- Name: construction_projects construction_projects_infra_project_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_infra_project_uid_key UNIQUE (infra_project_uid);


--
-- Name: construction_projects construction_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_pkey PRIMARY KEY (id);


--
-- Name: construction_projects construction_projects_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_project_id_key UNIQUE (project_id);


--
-- Name: construction_revision_orders construction_revision_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_revision_orders
    ADD CONSTRAINT construction_revision_orders_pkey PRIMARY KEY (id);


--
-- Name: construction_subcategories construction_subcategories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_subcategories
    ADD CONSTRAINT construction_subcategories_name_key UNIQUE (name);


--
-- Name: construction_subcategories construction_subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_subcategories
    ADD CONSTRAINT construction_subcategories_pkey PRIMARY KEY (id);


--
-- Name: construction_timeline_entries construction_timeline_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_timeline_entries
    ADD CONSTRAINT construction_timeline_entries_pkey PRIMARY KEY (id);


--
-- Name: contractor_invite_tokens contractor_invite_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_invite_tokens
    ADD CONSTRAINT contractor_invite_tokens_pkey PRIMARY KEY (id);


--
-- Name: contractor_invite_tokens contractor_invite_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_invite_tokens
    ADD CONSTRAINT contractor_invite_tokens_token_key UNIQUE (token);


--
-- Name: contractor_users contractor_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_users
    ADD CONSTRAINT contractor_users_email_key UNIQUE (email);


--
-- Name: contractor_users contractor_users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_users
    ADD CONSTRAINT contractor_users_google_id_key UNIQUE (google_id);


--
-- Name: contractor_users contractor_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_users
    ADD CONSTRAINT contractor_users_pkey PRIMARY KEY (id);


--
-- Name: contractors contractors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractors
    ADD CONSTRAINT contractors_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: downloadable_forms downloadable_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downloadable_forms
    ADD CONSTRAINT downloadable_forms_pkey PRIMARY KEY (id);


--
-- Name: facilities facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (id);


--
-- Name: fiscal_years fiscal_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_years
    ADD CONSTRAINT fiscal_years_pkey PRIMARY KEY (year);


--
-- Name: forms_inventory forms_inventory_form_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms_inventory
    ADD CONSTRAINT forms_inventory_form_code_key UNIQUE (form_code);


--
-- Name: forms_inventory forms_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms_inventory
    ADD CONSTRAINT forms_inventory_pkey PRIMARY KEY (id);


--
-- Name: funding_sources funding_sources_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funding_sources
    ADD CONSTRAINT funding_sources_name_key UNIQUE (name);


--
-- Name: funding_sources funding_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funding_sources
    ADD CONSTRAINT funding_sources_pkey PRIMARY KEY (id);


--
-- Name: gad_budget_plans gad_budget_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_budget_plans
    ADD CONSTRAINT gad_budget_plans_pkey PRIMARY KEY (id);


--
-- Name: gad_faculty_parity_data gad_faculty_parity_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_faculty_parity_data
    ADD CONSTRAINT gad_faculty_parity_data_pkey PRIMARY KEY (id);


--
-- Name: gad_gpb_accomplishments gad_gpb_accomplishments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_gpb_accomplishments
    ADD CONSTRAINT gad_gpb_accomplishments_pkey PRIMARY KEY (id);


--
-- Name: gad_indigenous_parity_data gad_indigenous_parity_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_indigenous_parity_data
    ADD CONSTRAINT gad_indigenous_parity_data_pkey PRIMARY KEY (id);


--
-- Name: gad_pwd_parity_data gad_pwd_parity_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_pwd_parity_data
    ADD CONSTRAINT gad_pwd_parity_data_pkey PRIMARY KEY (id);


--
-- Name: gad_staff_parity_data gad_staff_parity_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_staff_parity_data
    ADD CONSTRAINT gad_staff_parity_data_pkey PRIMARY KEY (id);


--
-- Name: gad_student_parity_data gad_student_parity_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_student_parity_data
    ADD CONSTRAINT gad_student_parity_data_pkey PRIMARY KEY (id);


--
-- Name: gad_yearly_profiles gad_yearly_profiles_academic_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_yearly_profiles
    ADD CONSTRAINT gad_yearly_profiles_academic_year_key UNIQUE (academic_year);


--
-- Name: gad_yearly_profiles gad_yearly_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_yearly_profiles
    ADD CONSTRAINT gad_yearly_profiles_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: mikro_orm_migrations mikro_orm_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mikro_orm_migrations
    ADD CONSTRAINT mikro_orm_migrations_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: operation_financials operation_financials_operation_id_fiscal_year_quarter_opera_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_financials
    ADD CONSTRAINT operation_financials_operation_id_fiscal_year_quarter_opera_key UNIQUE (operation_id, fiscal_year, quarter, operations_programs);


--
-- Name: operation_financials operation_financials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_financials
    ADD CONSTRAINT operation_financials_pkey PRIMARY KEY (id);


--
-- Name: operation_indicators operation_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_indicators
    ADD CONSTRAINT operation_indicators_pkey PRIMARY KEY (id);


--
-- Name: operation_organizational_info operation_organizational_info_operation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_organizational_info
    ADD CONSTRAINT operation_organizational_info_operation_id_key UNIQUE (operation_id);


--
-- Name: operation_organizational_info operation_organizational_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_organizational_info
    ADD CONSTRAINT operation_organizational_info_pkey PRIMARY KEY (id);


--
-- Name: password_reset_requests password_reset_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_pkey PRIMARY KEY (id);


--
-- Name: project_contractor_assignments pca_project_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contractor_assignments
    ADD CONSTRAINT pca_project_user_unique UNIQUE (project_id, user_id);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pillar_indicator_taxonomy pillar_indicator_taxonomy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pillar_indicator_taxonomy
    ADD CONSTRAINT pillar_indicator_taxonomy_pkey PRIMARY KEY (id);


--
-- Name: policies policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_pkey PRIMARY KEY (id);


--
-- Name: project_contractor_assignments project_contractor_assignment_project_id_contractor_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contractor_assignments
    ADD CONSTRAINT project_contractor_assignment_project_id_contractor_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_contractor_assignments project_contractor_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contractor_assignments
    ADD CONSTRAINT project_contractor_assignments_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: quarterly_report_submissions quarterly_report_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_report_submissions
    ADD CONSTRAINT quarterly_report_submissions_pkey PRIMARY KEY (id);


--
-- Name: quarterly_reports quarterly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_reports
    ADD CONSTRAINT quarterly_reports_pkey PRIMARY KEY (id);


--
-- Name: record_assignments record_assignments_module_record_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_assignments
    ADD CONSTRAINT record_assignments_module_record_id_user_id_key UNIQUE (module, record_id, user_id);


--
-- Name: record_assignments record_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_assignments
    ADD CONSTRAINT record_assignments_pkey PRIMARY KEY (id);


--
-- Name: repair_pow_items repair_pow_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_pow_items
    ADD CONSTRAINT repair_pow_items_pkey PRIMARY KEY (id);


--
-- Name: repair_project_accomplishment_records repair_project_accomplishment_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_accomplishment_records
    ADD CONSTRAINT repair_project_accomplishment_records_pkey PRIMARY KEY (id);


--
-- Name: repair_project_actual_accomplishment_records repair_project_actual_accomplishment_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_actual_accomplishment_records
    ADD CONSTRAINT repair_project_actual_accomplishment_records_pkey PRIMARY KEY (id);


--
-- Name: repair_project_financial_reports repair_project_financial_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_financial_reports
    ADD CONSTRAINT repair_project_financial_reports_pkey PRIMARY KEY (id);


--
-- Name: repair_project_milestones repair_project_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_milestones
    ADD CONSTRAINT repair_project_milestones_pkey PRIMARY KEY (id);


--
-- Name: repair_project_phases repair_project_phases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_phases
    ADD CONSTRAINT repair_project_phases_pkey PRIMARY KEY (id);


--
-- Name: repair_project_progress_summaries repair_project_progress_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_progress_summaries
    ADD CONSTRAINT repair_project_progress_summaries_pkey PRIMARY KEY (id);


--
-- Name: repair_project_team_members repair_project_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_team_members
    ADD CONSTRAINT repair_project_team_members_pkey PRIMARY KEY (id);


--
-- Name: repair_projects repair_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_pkey PRIMARY KEY (id);


--
-- Name: repair_projects repair_projects_project_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_project_code_key UNIQUE (project_code);


--
-- Name: repair_projects repair_projects_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_project_id_key UNIQUE (project_id);


--
-- Name: repair_types repair_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_types
    ADD CONSTRAINT repair_types_name_key UNIQUE (name);


--
-- Name: repair_types repair_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_types
    ADD CONSTRAINT repair_types_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: room_assessments room_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_assessments
    ADD CONSTRAINT room_assessments_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: university_statistics uniq_academic_year_campus; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_statistics
    ADD CONSTRAINT uniq_academic_year_campus UNIQUE (academic_year, campus);


--
-- Name: pillar_indicator_taxonomy uniq_pillar_indicator; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pillar_indicator_taxonomy
    ADD CONSTRAINT uniq_pillar_indicator UNIQUE (pillar_type, indicator_name);


--
-- Name: construction_project_assignments unique_const_proj_assignment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_assignments
    ADD CONSTRAINT unique_const_proj_assignment UNIQUE (user_id, project_id);


--
-- Name: university_operations_personnel unique_univ_ops_personnel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations_personnel
    ADD CONSTRAINT unique_univ_ops_personnel UNIQUE (user_id, category);


--
-- Name: user_page_permissions unique_user_page_permission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_page_permissions
    ADD CONSTRAINT unique_user_page_permission UNIQUE (user_id, page_id);


--
-- Name: university_operations university_operations_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations
    ADD CONSTRAINT university_operations_code_key UNIQUE (code);


--
-- Name: university_operations_personnel university_operations_personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations_personnel
    ADD CONSTRAINT university_operations_personnel_pkey PRIMARY KEY (id);


--
-- Name: university_operations university_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations
    ADD CONSTRAINT university_operations_pkey PRIMARY KEY (id);


--
-- Name: university_statistics university_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_statistics
    ADD CONSTRAINT university_statistics_pkey PRIMARY KEY (id);


--
-- Name: user_permission_overrides uq_user_module; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT uq_user_module UNIQUE (user_id, module_key);


--
-- Name: user_module_assignments uq_user_module_assignment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_assignments
    ADD CONSTRAINT uq_user_module_assignment UNIQUE (user_id, module);


--
-- Name: user_pillar_assignments uq_user_pillar; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pillar_assignments
    ADD CONSTRAINT uq_user_pillar UNIQUE (user_id, pillar_type);


--
-- Name: user_departments user_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT user_departments_pkey PRIMARY KEY (user_id, department_id);


--
-- Name: user_module_assignments user_module_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_assignments
    ADD CONSTRAINT user_module_assignments_pkey PRIMARY KEY (id);


--
-- Name: user_page_permissions user_page_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_page_permissions
    ADD CONSTRAINT user_page_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permission_overrides user_permission_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_pkey PRIMARY KEY (id);


--
-- Name: user_pillar_assignments user_pillar_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pillar_assignments
    ADD CONSTRAINT user_pillar_assignments_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: access_requests_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX access_requests_status_index ON public.access_requests USING btree (status);


--
-- Name: access_requests_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX access_requests_user_id_index ON public.access_requests USING btree (user_id);


--
-- Name: construction_projects_project_code_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX construction_projects_project_code_active_idx ON public.construction_projects USING btree (project_code) WHERE (deleted_at IS NULL);


--
-- Name: idx_activity_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id);


--
-- Name: idx_activity_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user ON public.activity_logs USING btree (user_id);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_actor ON public.audit_trail USING btree (actor_id);


--
-- Name: idx_audit_correlation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_correlation ON public.audit_trail USING btree (correlation_id);


--
-- Name: idx_audit_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_occurred ON public.audit_trail USING btree (occurred_at);


--
-- Name: idx_audit_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_resource ON public.audit_trail USING btree (resource_type, resource_id);


--
-- Name: idx_buildings_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buildings_campus ON public.buildings USING btree (campus);


--
-- Name: idx_buildings_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buildings_name ON public.buildings USING btree (name);


--
-- Name: idx_buildings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buildings_status ON public.buildings USING btree (status);


--
-- Name: idx_buildings_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_buildings_type ON public.buildings USING btree (building_type);


--
-- Name: idx_conproj_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conproj_campus ON public.construction_projects USING btree (campus);


--
-- Name: idx_conproj_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conproj_code ON public.construction_projects USING btree (project_code);


--
-- Name: idx_conproj_contractor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conproj_contractor ON public.construction_projects USING btree (contractor_id);


--
-- Name: idx_conproj_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conproj_project_id ON public.construction_projects USING btree (project_id);


--
-- Name: idx_conproj_start_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conproj_start_date ON public.construction_projects USING btree (start_date);


--
-- Name: idx_conproj_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conproj_status ON public.construction_projects USING btree (status);


--
-- Name: idx_conproj_target_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conproj_target_date ON public.construction_projects USING btree (target_completion_date);


--
-- Name: idx_construction_document_folders_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_construction_document_folders_parent ON public.construction_document_folders USING btree (parent_id);


--
-- Name: idx_construction_document_folders_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_construction_document_folders_project ON public.construction_document_folders USING btree (project_id);


--
-- Name: idx_construction_projects_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_construction_projects_assigned_to ON public.construction_projects USING btree (assigned_to);


--
-- Name: idx_construction_projects_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_construction_projects_campus ON public.construction_projects USING btree (campus) WHERE (deleted_at IS NULL);


--
-- Name: idx_construction_projects_campus_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_construction_projects_campus_status ON public.construction_projects USING btree (campus, publication_status) WHERE (deleted_at IS NULL);


--
-- Name: idx_construction_projects_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_construction_projects_created_by ON public.construction_projects USING btree (created_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_construction_projects_publication_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_construction_projects_publication_status ON public.construction_projects USING btree (publication_status);


--
-- Name: idx_contractor_assignments_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contractor_assignments_project ON public.project_contractor_assignments USING btree (project_id);


--
-- Name: idx_contractor_invite_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contractor_invite_token ON public.contractor_invite_tokens USING btree (token);


--
-- Name: idx_contractors_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contractors_name ON public.contractors USING btree (name);


--
-- Name: idx_contractors_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contractors_status ON public.contractors USING btree (status);


--
-- Name: idx_cpa_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpa_project ON public.construction_project_assignments USING btree (project_id);


--
-- Name: idx_cpa_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpa_user ON public.construction_project_assignments USING btree (user_id);


--
-- Name: idx_cpp_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpp_date ON public.construction_project_progress USING btree (report_date);


--
-- Name: idx_cpp_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpp_project ON public.construction_project_progress USING btree (project_id);


--
-- Name: idx_cpr_project_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpr_project_date ON public.construction_progress_reports USING btree (project_id, report_date DESC);


--
-- Name: idx_cro_project_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cro_project_date ON public.construction_revision_orders USING btree (project_id, revision_date DESC);


--
-- Name: idx_cro_project_revnum; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cro_project_revnum ON public.construction_revision_orders USING btree (project_id, revision_number);


--
-- Name: idx_departments_head; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_head ON public.departments USING btree (head_id);


--
-- Name: idx_departments_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_name ON public.departments USING btree (name);


--
-- Name: idx_departments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_parent ON public.departments USING btree (parent_id);


--
-- Name: idx_departments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_status ON public.departments USING btree (status);


--
-- Name: idx_diary_entries_entry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_diary_entries_entry_date ON public.construction_diary_entries USING btree (project_id, entry_date DESC);


--
-- Name: idx_diary_entries_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_diary_entries_project_id ON public.construction_diary_entries USING btree (project_id);


--
-- Name: idx_doc_checklist_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_checklist_project ON public.construction_document_checklist USING btree (project_id);


--
-- Name: idx_doc_checklist_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_checklist_status ON public.construction_document_checklist USING btree (project_id, submission_status);


--
-- Name: idx_doc_submissions_checklist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_submissions_checklist ON public.construction_document_submissions USING btree (checklist_item_id);


--
-- Name: idx_doc_submissions_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_submissions_project ON public.construction_document_submissions USING btree (project_id);


--
-- Name: idx_documents_docpair; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_docpair ON public.documents USING btree (documentable_type, documentable_id);


--
-- Name: idx_documents_folder_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_folder_id ON public.documents USING btree (folder_id);


--
-- Name: idx_documents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_type ON public.documents USING btree (document_type);


--
-- Name: idx_documents_uploader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_uploader ON public.documents USING btree (uploaded_by);


--
-- Name: idx_fiscal_years_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fiscal_years_active ON public.fiscal_years USING btree (year) WHERE (is_active = true);


--
-- Name: idx_forms_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_forms_code ON public.forms_inventory USING btree (form_code);


--
-- Name: idx_forms_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_forms_dept ON public.forms_inventory USING btree (owning_department_id);


--
-- Name: idx_media_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_featured ON public.media USING btree (is_featured);


--
-- Name: idx_media_pair; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_pair ON public.media USING btree (mediable_type, mediable_id);


--
-- Name: idx_media_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_type ON public.media USING btree (media_type);


--
-- Name: idx_media_uploader; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_uploader ON public.media USING btree (uploaded_by);


--
-- Name: idx_mov_entries_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_entries_entity ON public.construction_mov_entries USING btree (related_entity_type, related_entity_id);


--
-- Name: idx_mov_entries_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mov_entries_project_id ON public.construction_mov_entries USING btree (project_id);


--
-- Name: idx_notifications_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_entity ON public.notifications USING btree (related_entity_type, related_entity_id);


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (notification_type);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_of_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_of_department ON public.operation_financials USING btree (department);


--
-- Name: idx_of_expense_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_of_expense_class ON public.operation_financials USING btree (expense_class);


--
-- Name: idx_of_fund_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_of_fund_type ON public.operation_financials USING btree (fund_type);


--
-- Name: idx_of_fund_type_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_of_fund_type_operation ON public.operation_financials USING btree (operation_id, fund_type) WHERE (deleted_at IS NULL);


--
-- Name: idx_of_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_of_operation ON public.operation_financials USING btree (operation_id);


--
-- Name: idx_of_operation_expense; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_of_operation_expense ON public.operation_financials USING btree (operation_id, expense_class) WHERE (deleted_at IS NULL);


--
-- Name: idx_of_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_of_program ON public.operation_financials USING btree (operations_programs);


--
-- Name: idx_of_project_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_of_project_code ON public.operation_financials USING btree (project_code);


--
-- Name: idx_of_quarter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_of_quarter ON public.operation_financials USING btree (quarter);


--
-- Name: idx_of_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_of_status ON public.operation_financials USING btree (status);


--
-- Name: idx_of_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_of_year ON public.operation_financials USING btree (fiscal_year);


--
-- Name: idx_oi_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oi_code ON public.operation_indicators USING btree (indicator_code);


--
-- Name: idx_oi_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oi_created_by ON public.operation_indicators USING btree (created_by);


--
-- Name: idx_oi_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oi_operation ON public.operation_indicators USING btree (operation_id);


--
-- Name: idx_oi_pillar_indicator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oi_pillar_indicator ON public.operation_indicators USING btree (pillar_indicator_id);


--
-- Name: idx_oi_reported_quarter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oi_reported_quarter ON public.operation_indicators USING btree (reported_quarter);


--
-- Name: idx_oi_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oi_status ON public.operation_indicators USING btree (status);


--
-- Name: idx_oi_subcategory_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oi_subcategory_data ON public.operation_indicators USING gin (subcategory_data);


--
-- Name: idx_oi_uacs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oi_uacs ON public.operation_indicators USING btree (uacs_code);


--
-- Name: idx_oi_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_oi_year ON public.operation_indicators USING btree (fiscal_year);


--
-- Name: idx_ooi_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ooi_department ON public.operation_organizational_info USING btree (department);


--
-- Name: idx_ooi_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ooi_operation ON public.operation_organizational_info USING btree (operation_id);


--
-- Name: idx_ooi_org_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ooi_org_code ON public.operation_organizational_info USING btree (organization_code);


--
-- Name: idx_operation_indicators_pillar_indicator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operation_indicators_pillar_indicator_id ON public.operation_indicators USING btree (pillar_indicator_id);


--
-- Name: idx_permissions_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_name ON public.permissions USING btree (name);


--
-- Name: idx_permissions_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_permissions_resource ON public.permissions USING btree (resource);


--
-- Name: idx_pit_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pit_active ON public.pillar_indicator_taxonomy USING btree (is_active);


--
-- Name: idx_pit_oo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pit_oo ON public.pillar_indicator_taxonomy USING btree (organizational_outcome);


--
-- Name: idx_pit_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pit_order ON public.pillar_indicator_taxonomy USING btree (pillar_type, indicator_order);


--
-- Name: idx_pit_pillar_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pit_pillar_type ON public.pillar_indicator_taxonomy USING btree (pillar_type);


--
-- Name: idx_policies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policies_status ON public.policies USING btree (status);


--
-- Name: idx_policies_validity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policies_validity ON public.policies USING btree (valid_from, valid_until);


--
-- Name: idx_projects_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_campus ON public.projects USING btree (campus);


--
-- Name: idx_projects_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_status ON public.projects USING btree (status);


--
-- Name: idx_projects_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_type ON public.projects USING btree (project_type);


--
-- Name: idx_prr_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_prr_status ON public.password_reset_requests USING btree (status);


--
-- Name: idx_qr_submissions_fiscal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qr_submissions_fiscal ON public.quarterly_report_submissions USING btree (fiscal_year, quarter);


--
-- Name: idx_qr_submissions_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qr_submissions_report ON public.quarterly_report_submissions USING btree (quarterly_report_id);


--
-- Name: idx_quarterly_reports_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quarterly_reports_created_by ON public.quarterly_reports USING btree (created_by);


--
-- Name: idx_quarterly_reports_fiscal_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quarterly_reports_fiscal_year ON public.quarterly_reports USING btree (fiscal_year);


--
-- Name: idx_quarterly_reports_publication_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quarterly_reports_publication_status ON public.quarterly_reports USING btree (publication_status);


--
-- Name: idx_quarterly_reports_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_quarterly_reports_unique_active ON public.quarterly_reports USING btree (fiscal_year, quarter) WHERE (deleted_at IS NULL);


--
-- Name: idx_quarterly_reports_unlock_requested; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quarterly_reports_unlock_requested ON public.quarterly_reports USING btree (unlock_requested_by) WHERE (unlock_requested_by IS NOT NULL);


--
-- Name: idx_rass_assessor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rass_assessor ON public.room_assessments USING btree (assessor_id);


--
-- Name: idx_rass_ay; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rass_ay ON public.room_assessments USING btree (academic_year);


--
-- Name: idx_rass_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rass_date ON public.room_assessments USING btree (assessment_date);


--
-- Name: idx_rass_room; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rass_room ON public.room_assessments USING btree (room_id);


--
-- Name: idx_rass_sem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rass_sem ON public.room_assessments USING btree (semester);


--
-- Name: idx_record_assignments_assigned_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_record_assignments_assigned_at ON public.record_assignments USING btree (assigned_at DESC);


--
-- Name: idx_record_assignments_module_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_record_assignments_module_record ON public.record_assignments USING btree (module, record_id);


--
-- Name: idx_record_assignments_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_record_assignments_record ON public.record_assignments USING btree (module, record_id);


--
-- Name: idx_record_assignments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_record_assignments_user ON public.record_assignments USING btree (user_id);


--
-- Name: idx_repair_projects_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_projects_assigned_to ON public.repair_projects USING btree (assigned_to);


--
-- Name: idx_repair_projects_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_projects_campus ON public.repair_projects USING btree (campus) WHERE (deleted_at IS NULL);


--
-- Name: idx_repair_projects_campus_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_projects_campus_status ON public.repair_projects USING btree (campus, publication_status) WHERE (deleted_at IS NULL);


--
-- Name: idx_repair_projects_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_projects_created_by ON public.repair_projects USING btree (created_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_repair_projects_publication_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repair_projects_publication_status ON public.repair_projects USING btree (publication_status);


--
-- Name: idx_repairs_building; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repairs_building ON public.repair_projects USING btree (building_name);


--
-- Name: idx_repairs_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repairs_campus ON public.repair_projects USING btree (campus);


--
-- Name: idx_repairs_emergency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repairs_emergency ON public.repair_projects USING btree (is_emergency);


--
-- Name: idx_repairs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repairs_status ON public.repair_projects USING btree (status);


--
-- Name: idx_repairs_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_repairs_type ON public.repair_projects USING btree (repair_type_id);


--
-- Name: idx_rooms_building; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_building ON public.rooms USING btree (building_id);


--
-- Name: idx_rooms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_status ON public.rooms USING btree (status);


--
-- Name: idx_rooms_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rooms_type ON public.rooms USING btree (room_type);


--
-- Name: idx_rpi_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rpi_category ON public.repair_pow_items USING btree (category);


--
-- Name: idx_rpi_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rpi_date ON public.repair_pow_items USING btree (date_entry);


--
-- Name: idx_rpi_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rpi_phase ON public.repair_pow_items USING btree (phase);


--
-- Name: idx_rpi_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rpi_project ON public.repair_pow_items USING btree (repair_project_id);


--
-- Name: idx_sys_settings_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sys_settings_group ON public.system_settings USING btree (setting_group);


--
-- Name: idx_timeline_entries_entry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_entries_entry_date ON public.construction_timeline_entries USING btree (entry_date DESC);


--
-- Name: idx_timeline_entries_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timeline_entries_project_id ON public.construction_timeline_entries USING btree (project_id);


--
-- Name: idx_univ_ops_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_univ_ops_campus ON public.university_operations USING btree (campus);


--
-- Name: idx_univ_ops_coordinator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_univ_ops_coordinator ON public.university_operations USING btree (coordinator_id);


--
-- Name: idx_univ_ops_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_univ_ops_status ON public.university_operations USING btree (status);


--
-- Name: idx_univ_ops_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_univ_ops_type ON public.university_operations USING btree (operation_type);


--
-- Name: idx_university_operations_assigned_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_university_operations_assigned_to ON public.university_operations USING btree (assigned_to);


--
-- Name: idx_university_operations_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_university_operations_campus ON public.university_operations USING btree (campus) WHERE (deleted_at IS NULL);


--
-- Name: idx_university_operations_campus_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_university_operations_campus_status ON public.university_operations USING btree (campus, publication_status) WHERE (deleted_at IS NULL);


--
-- Name: idx_university_operations_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_university_operations_created_by ON public.university_operations USING btree (created_by) WHERE (deleted_at IS NULL);


--
-- Name: idx_university_operations_publication_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_university_operations_publication_status ON public.university_operations USING btree (publication_status);


--
-- Name: idx_uo_fiscal_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uo_fiscal_year ON public.university_operations USING btree (fiscal_year) WHERE (deleted_at IS NULL);


--
-- Name: idx_uo_fiscal_year_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uo_fiscal_year_campus ON public.university_operations USING btree (fiscal_year, campus) WHERE (deleted_at IS NULL);


--
-- Name: idx_uop_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uop_category ON public.university_operations_personnel USING btree (category);


--
-- Name: idx_uop_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uop_user ON public.university_operations_personnel USING btree (user_id);


--
-- Name: idx_upp_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upp_page ON public.user_page_permissions USING btree (page_id);


--
-- Name: idx_upp_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_upp_user ON public.user_page_permissions USING btree (user_id);


--
-- Name: idx_us_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_us_campus ON public.university_statistics USING btree (campus);


--
-- Name: idx_user_module_assignments_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_module_assignments_module ON public.user_module_assignments USING btree (module);


--
-- Name: idx_user_module_assignments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_module_assignments_user_id ON public.user_module_assignments USING btree (user_id);


--
-- Name: idx_user_permission_overrides_module_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permission_overrides_module_key ON public.user_permission_overrides USING btree (module_key);


--
-- Name: idx_user_permission_overrides_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permission_overrides_user_id ON public.user_permission_overrides USING btree (user_id);


--
-- Name: idx_user_roles_assigned_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_assigned_by ON public.user_roles USING btree (assigned_by);


--
-- Name: idx_user_roles_is_superadmin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_is_superadmin ON public.user_roles USING btree (is_superadmin) WHERE (is_superadmin = true);


--
-- Name: idx_users_campus; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_campus ON public.users USING btree (campus);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_google_id ON public.users USING btree (google_id) WHERE (google_id IS NOT NULL);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_rank_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_rank_level ON public.users USING btree (rank_level);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_users_username_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username_lower ON public.users USING btree (lower((username)::text));


--
-- Name: projects_project_code_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX projects_project_code_active_idx ON public.projects USING btree (project_code) WHERE (deleted_at IS NULL);


--
-- Name: uq_oi_quarterly_per_quarter; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_oi_quarterly_per_quarter ON public.operation_indicators USING btree (operation_id, pillar_indicator_id, fiscal_year, reported_quarter) WHERE ((deleted_at IS NULL) AND (reported_quarter IS NOT NULL));


--
-- Name: uq_operation_indicators_orphan; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_operation_indicators_orphan ON public.operation_indicators USING btree (operation_id, lower(TRIM(BOTH FROM particular)), fiscal_year) WHERE ((deleted_at IS NULL) AND (pillar_indicator_id IS NULL));


--
-- Name: users_email_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_active_unique ON public.users USING btree (email) WHERE (deleted_at IS NULL);


--
-- Name: users_google_id_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_google_id_active_unique ON public.users USING btree (google_id) WHERE ((deleted_at IS NULL) AND (google_id IS NOT NULL));


--
-- Name: users_username_active_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username_active_unique ON public.users USING btree (username) WHERE (deleted_at IS NULL);


--
-- Name: user_page_permissions trg_validate_upp_assignment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_upp_assignment BEFORE INSERT OR UPDATE ON public.user_page_permissions FOR EACH ROW EXECUTE FUNCTION public.validate_permission_assignment();


--
-- Name: user_permission_overrides trigger_user_permission_overrides_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_user_permission_overrides_updated_at BEFORE UPDATE ON public.user_permission_overrides FOR EACH ROW EXECUTE FUNCTION public.update_user_permission_overrides_updated_at();


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_trail audit_trail_actor_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_actor_department_id_fkey FOREIGN KEY (actor_department_id) REFERENCES public.departments(id);


--
-- Name: audit_trail audit_trail_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_trail
    ADD CONSTRAINT audit_trail_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id);


--
-- Name: contractor_invite_tokens cit_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_invite_tokens
    ADD CONSTRAINT cit_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: construction_diary_entries construction_diary_entries_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_diary_entries
    ADD CONSTRAINT construction_diary_entries_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: construction_diary_entries construction_diary_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_diary_entries
    ADD CONSTRAINT construction_diary_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: construction_document_checklist construction_document_checklist_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_checklist
    ADD CONSTRAINT construction_document_checklist_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.construction_document_types(id);


--
-- Name: construction_document_checklist construction_document_checklist_linked_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_checklist
    ADD CONSTRAINT construction_document_checklist_linked_document_id_fkey FOREIGN KEY (linked_document_id) REFERENCES public.documents(id);


--
-- Name: construction_document_checklist construction_document_checklist_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_checklist
    ADD CONSTRAINT construction_document_checklist_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: construction_document_checklist construction_document_checklist_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_checklist
    ADD CONSTRAINT construction_document_checklist_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: construction_document_checklist construction_document_checklist_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_checklist
    ADD CONSTRAINT construction_document_checklist_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: construction_document_folders construction_document_folders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_folders
    ADD CONSTRAINT construction_document_folders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: construction_document_folders construction_document_folders_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_folders
    ADD CONSTRAINT construction_document_folders_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: construction_document_folders construction_document_folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_folders
    ADD CONSTRAINT construction_document_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.construction_document_folders(id) ON DELETE CASCADE;


--
-- Name: construction_document_folders construction_document_folders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_folders
    ADD CONSTRAINT construction_document_folders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: construction_document_folders construction_document_folders_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_folders
    ADD CONSTRAINT construction_document_folders_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: construction_document_submissions construction_document_submissions_checklist_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_submissions
    ADD CONSTRAINT construction_document_submissions_checklist_item_id_fkey FOREIGN KEY (checklist_item_id) REFERENCES public.construction_document_checklist(id);


--
-- Name: construction_document_submissions construction_document_submissions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_submissions
    ADD CONSTRAINT construction_document_submissions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: construction_document_submissions construction_document_submissions_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_document_submissions
    ADD CONSTRAINT construction_document_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: construction_gallery construction_gallery_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_gallery
    ADD CONSTRAINT construction_gallery_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: construction_milestones construction_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_milestones
    ADD CONSTRAINT construction_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: construction_mov_entries construction_mov_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_mov_entries
    ADD CONSTRAINT construction_mov_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: construction_mov_entries construction_mov_entries_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_mov_entries
    ADD CONSTRAINT construction_mov_entries_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: construction_progress_reports construction_progress_reports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_progress_reports
    ADD CONSTRAINT construction_progress_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id);


--
-- Name: construction_project_accomplishment_records construction_project_accomplishment_records_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_accomplishment_records
    ADD CONSTRAINT construction_project_accomplishment_records_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id);


--
-- Name: construction_project_actual_accomplishment_records construction_project_actual_accomplishment_reco_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_actual_accomplishment_records
    ADD CONSTRAINT construction_project_actual_accomplishment_reco_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id);


--
-- Name: construction_project_assignments construction_project_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_assignments
    ADD CONSTRAINT construction_project_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: construction_project_assignments construction_project_assignments_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_assignments
    ADD CONSTRAINT construction_project_assignments_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: construction_project_assignments construction_project_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_assignments
    ADD CONSTRAINT construction_project_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: construction_project_financial_reports construction_project_financial_reports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_financial_reports
    ADD CONSTRAINT construction_project_financial_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id);


--
-- Name: construction_project_milestones construction_project_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_milestones
    ADD CONSTRAINT construction_project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id);


--
-- Name: construction_project_phases construction_project_phases_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_phases
    ADD CONSTRAINT construction_project_phases_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id);


--
-- Name: construction_project_progress construction_project_progress_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_progress
    ADD CONSTRAINT construction_project_progress_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id);


--
-- Name: construction_project_progress construction_project_progress_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_progress
    ADD CONSTRAINT construction_project_progress_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id);


--
-- Name: construction_project_progress_summaries construction_project_progress_summaries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_progress_summaries
    ADD CONSTRAINT construction_project_progress_summaries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id);


--
-- Name: construction_project_team_members construction_project_team_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_team_members
    ADD CONSTRAINT construction_project_team_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id);


--
-- Name: construction_project_team_members construction_project_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_team_members
    ADD CONSTRAINT construction_project_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: construction_projects construction_projects_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: construction_projects construction_projects_contractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.contractors(id);


--
-- Name: construction_projects construction_projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: construction_projects construction_projects_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: construction_projects construction_projects_funding_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_funding_source_id_fkey FOREIGN KEY (funding_source_id) REFERENCES public.funding_sources(id);


--
-- Name: construction_projects construction_projects_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: construction_projects construction_projects_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: construction_projects construction_projects_subcategory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.construction_subcategories(id);


--
-- Name: construction_projects construction_projects_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: construction_projects construction_projects_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_projects
    ADD CONSTRAINT construction_projects_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: construction_revision_orders construction_revision_orders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_revision_orders
    ADD CONSTRAINT construction_revision_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id);


--
-- Name: construction_subcategories construction_subcategories_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_subcategories
    ADD CONSTRAINT construction_subcategories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: construction_subcategories construction_subcategories_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_subcategories
    ADD CONSTRAINT construction_subcategories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: construction_timeline_entries construction_timeline_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_timeline_entries
    ADD CONSTRAINT construction_timeline_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: construction_timeline_entries construction_timeline_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_timeline_entries
    ADD CONSTRAINT construction_timeline_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: contractor_invite_tokens contractor_invite_tokens_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_invite_tokens
    ADD CONSTRAINT contractor_invite_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: contractor_invite_tokens contractor_invite_tokens_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractor_invite_tokens
    ADD CONSTRAINT contractor_invite_tokens_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: departments departments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: departments departments_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_head_id_fkey FOREIGN KEY (head_id) REFERENCES public.users(id);


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id);


--
-- Name: departments departments_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: documents documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: documents documents_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: documents documents_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.construction_document_folders(id) ON DELETE SET NULL;


--
-- Name: documents documents_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: contractors fk_contractors_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractors
    ADD CONSTRAINT fk_contractors_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: contractors fk_contractors_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contractors
    ADD CONSTRAINT fk_contractors_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: construction_project_assignments fk_cpa_project; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.construction_project_assignments
    ADD CONSTRAINT fk_cpa_project FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: repair_projects fk_deleted_by_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT fk_deleted_by_user FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: funding_sources fk_funding_sources_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funding_sources
    ADD CONSTRAINT fk_funding_sources_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: funding_sources fk_funding_sources_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funding_sources
    ADD CONSTRAINT fk_funding_sources_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: forms_inventory forms_inventory_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms_inventory
    ADD CONSTRAINT forms_inventory_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: forms_inventory forms_inventory_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms_inventory
    ADD CONSTRAINT forms_inventory_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: forms_inventory forms_inventory_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms_inventory
    ADD CONSTRAINT forms_inventory_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: forms_inventory forms_inventory_owning_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms_inventory
    ADD CONSTRAINT forms_inventory_owning_department_id_fkey FOREIGN KEY (owning_department_id) REFERENCES public.departments(id);


--
-- Name: forms_inventory forms_inventory_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms_inventory
    ADD CONSTRAINT forms_inventory_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: gad_budget_plans gad_budget_plans_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_budget_plans
    ADD CONSTRAINT gad_budget_plans_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: gad_budget_plans gad_budget_plans_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_budget_plans
    ADD CONSTRAINT gad_budget_plans_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: gad_faculty_parity_data gad_faculty_parity_data_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_faculty_parity_data
    ADD CONSTRAINT gad_faculty_parity_data_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: gad_faculty_parity_data gad_faculty_parity_data_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_faculty_parity_data
    ADD CONSTRAINT gad_faculty_parity_data_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: gad_gpb_accomplishments gad_gpb_accomplishments_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_gpb_accomplishments
    ADD CONSTRAINT gad_gpb_accomplishments_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: gad_gpb_accomplishments gad_gpb_accomplishments_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_gpb_accomplishments
    ADD CONSTRAINT gad_gpb_accomplishments_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: gad_indigenous_parity_data gad_indigenous_parity_data_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_indigenous_parity_data
    ADD CONSTRAINT gad_indigenous_parity_data_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: gad_indigenous_parity_data gad_indigenous_parity_data_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_indigenous_parity_data
    ADD CONSTRAINT gad_indigenous_parity_data_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: gad_pwd_parity_data gad_pwd_parity_data_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_pwd_parity_data
    ADD CONSTRAINT gad_pwd_parity_data_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: gad_pwd_parity_data gad_pwd_parity_data_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_pwd_parity_data
    ADD CONSTRAINT gad_pwd_parity_data_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: gad_staff_parity_data gad_staff_parity_data_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_staff_parity_data
    ADD CONSTRAINT gad_staff_parity_data_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: gad_staff_parity_data gad_staff_parity_data_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_staff_parity_data
    ADD CONSTRAINT gad_staff_parity_data_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: gad_student_parity_data gad_student_parity_data_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_student_parity_data
    ADD CONSTRAINT gad_student_parity_data_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: gad_student_parity_data gad_student_parity_data_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gad_student_parity_data
    ADD CONSTRAINT gad_student_parity_data_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: media media_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: media media_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: media media_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: media media_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: notifications notifications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: operation_financials operation_financials_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_financials
    ADD CONSTRAINT operation_financials_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: operation_financials operation_financials_operation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_financials
    ADD CONSTRAINT operation_financials_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES public.university_operations(id);


--
-- Name: operation_financials operation_financials_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_financials
    ADD CONSTRAINT operation_financials_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: operation_indicators operation_indicators_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_indicators
    ADD CONSTRAINT operation_indicators_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: operation_indicators operation_indicators_operation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_indicators
    ADD CONSTRAINT operation_indicators_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES public.university_operations(id);


--
-- Name: operation_indicators operation_indicators_pillar_indicator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_indicators
    ADD CONSTRAINT operation_indicators_pillar_indicator_id_fkey FOREIGN KEY (pillar_indicator_id) REFERENCES public.pillar_indicator_taxonomy(id);


--
-- Name: operation_indicators operation_indicators_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_indicators
    ADD CONSTRAINT operation_indicators_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: operation_organizational_info operation_organizational_info_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_organizational_info
    ADD CONSTRAINT operation_organizational_info_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: operation_organizational_info operation_organizational_info_operation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_organizational_info
    ADD CONSTRAINT operation_organizational_info_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES public.university_operations(id);


--
-- Name: operation_organizational_info operation_organizational_info_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_organizational_info
    ADD CONSTRAINT operation_organizational_info_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: password_reset_requests password_reset_requests_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_requests
    ADD CONSTRAINT password_reset_requests_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_contractor_assignments pca_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contractor_assignments
    ADD CONSTRAINT pca_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: policies policies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: policies policies_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: policies policies_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: policies policies_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: project_contractor_assignments project_contractor_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contractor_assignments
    ADD CONSTRAINT project_contractor_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: project_contractor_assignments project_contractor_assignments_invite_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contractor_assignments
    ADD CONSTRAINT project_contractor_assignments_invite_token_id_fkey FOREIGN KEY (invite_token_id) REFERENCES public.contractor_invite_tokens(id);


--
-- Name: project_contractor_assignments project_contractor_assignments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contractor_assignments
    ADD CONSTRAINT project_contractor_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.construction_projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: projects projects_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: quarterly_report_submissions quarterly_report_submissions_actioned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_report_submissions
    ADD CONSTRAINT quarterly_report_submissions_actioned_by_fkey FOREIGN KEY (actioned_by) REFERENCES public.users(id);


--
-- Name: quarterly_report_submissions quarterly_report_submissions_quarterly_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_report_submissions
    ADD CONSTRAINT quarterly_report_submissions_quarterly_report_id_fkey FOREIGN KEY (quarterly_report_id) REFERENCES public.quarterly_reports(id);


--
-- Name: quarterly_report_submissions quarterly_report_submissions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_report_submissions
    ADD CONSTRAINT quarterly_report_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: quarterly_report_submissions quarterly_report_submissions_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_report_submissions
    ADD CONSTRAINT quarterly_report_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: quarterly_reports quarterly_reports_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_reports
    ADD CONSTRAINT quarterly_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: quarterly_reports quarterly_reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_reports
    ADD CONSTRAINT quarterly_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: quarterly_reports quarterly_reports_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_reports
    ADD CONSTRAINT quarterly_reports_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: quarterly_reports quarterly_reports_unlock_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_reports
    ADD CONSTRAINT quarterly_reports_unlock_requested_by_fkey FOREIGN KEY (unlock_requested_by) REFERENCES public.users(id);


--
-- Name: quarterly_reports quarterly_reports_unlocked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quarterly_reports
    ADD CONSTRAINT quarterly_reports_unlocked_by_fkey FOREIGN KEY (unlocked_by) REFERENCES public.users(id);


--
-- Name: record_assignments record_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_assignments
    ADD CONSTRAINT record_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: record_assignments record_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.record_assignments
    ADD CONSTRAINT record_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: repair_pow_items repair_pow_items_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_pow_items
    ADD CONSTRAINT repair_pow_items_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: repair_pow_items repair_pow_items_repair_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_pow_items
    ADD CONSTRAINT repair_pow_items_repair_project_id_fkey FOREIGN KEY (repair_project_id) REFERENCES public.repair_projects(id);


--
-- Name: repair_project_accomplishment_records repair_project_accomplishment_records_repair_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_accomplishment_records
    ADD CONSTRAINT repair_project_accomplishment_records_repair_project_id_fkey FOREIGN KEY (repair_project_id) REFERENCES public.repair_projects(id);


--
-- Name: repair_project_actual_accomplishment_records repair_project_actual_accomplishment_rec_repair_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_actual_accomplishment_records
    ADD CONSTRAINT repair_project_actual_accomplishment_rec_repair_project_id_fkey FOREIGN KEY (repair_project_id) REFERENCES public.repair_projects(id);


--
-- Name: repair_project_financial_reports repair_project_financial_reports_repair_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_financial_reports
    ADD CONSTRAINT repair_project_financial_reports_repair_project_id_fkey FOREIGN KEY (repair_project_id) REFERENCES public.repair_projects(id);


--
-- Name: repair_project_milestones repair_project_milestones_repair_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_milestones
    ADD CONSTRAINT repair_project_milestones_repair_project_id_fkey FOREIGN KEY (repair_project_id) REFERENCES public.repair_projects(id);


--
-- Name: repair_project_phases repair_project_phases_repair_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_phases
    ADD CONSTRAINT repair_project_phases_repair_project_id_fkey FOREIGN KEY (repair_project_id) REFERENCES public.repair_projects(id);


--
-- Name: repair_project_progress_summaries repair_project_progress_summaries_repair_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_progress_summaries
    ADD CONSTRAINT repair_project_progress_summaries_repair_project_id_fkey FOREIGN KEY (repair_project_id) REFERENCES public.repair_projects(id);


--
-- Name: repair_project_team_members repair_project_team_members_repair_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_team_members
    ADD CONSTRAINT repair_project_team_members_repair_project_id_fkey FOREIGN KEY (repair_project_id) REFERENCES public.repair_projects(id);


--
-- Name: repair_project_team_members repair_project_team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_project_team_members
    ADD CONSTRAINT repair_project_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: repair_projects repair_projects_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: repair_projects repair_projects_contractor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES public.contractors(id);


--
-- Name: repair_projects repair_projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: repair_projects repair_projects_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: repair_projects repair_projects_inspector_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES public.users(id);


--
-- Name: repair_projects repair_projects_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: repair_projects repair_projects_project_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_project_manager_id_fkey FOREIGN KEY (project_manager_id) REFERENCES public.users(id);


--
-- Name: repair_projects repair_projects_repair_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_repair_type_id_fkey FOREIGN KEY (repair_type_id) REFERENCES public.repair_types(id);


--
-- Name: repair_projects repair_projects_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: repair_projects repair_projects_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: repair_projects repair_projects_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_projects
    ADD CONSTRAINT repair_projects_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: repair_types repair_types_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_types
    ADD CONSTRAINT repair_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: repair_types repair_types_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_types
    ADD CONSTRAINT repair_types_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: role_permissions role_permissions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: room_assessments room_assessments_assessor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_assessments
    ADD CONSTRAINT room_assessments_assessor_id_fkey FOREIGN KEY (assessor_id) REFERENCES public.users(id);


--
-- Name: room_assessments room_assessments_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_assessments
    ADD CONSTRAINT room_assessments_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id);


--
-- Name: rooms rooms_building_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id);


--
-- Name: system_settings system_settings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: university_operations university_operations_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations
    ADD CONSTRAINT university_operations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: university_operations university_operations_coordinator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations
    ADD CONSTRAINT university_operations_coordinator_id_fkey FOREIGN KEY (coordinator_id) REFERENCES public.users(id);


--
-- Name: university_operations university_operations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations
    ADD CONSTRAINT university_operations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: university_operations_personnel university_operations_personnel_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations_personnel
    ADD CONSTRAINT university_operations_personnel_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: university_operations_personnel university_operations_personnel_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations_personnel
    ADD CONSTRAINT university_operations_personnel_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: university_operations_personnel university_operations_personnel_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations_personnel
    ADD CONSTRAINT university_operations_personnel_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: university_operations university_operations_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations
    ADD CONSTRAINT university_operations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: university_operations university_operations_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations
    ADD CONSTRAINT university_operations_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: university_operations university_operations_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.university_operations
    ADD CONSTRAINT university_operations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: user_departments user_departments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT user_departments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: user_departments user_departments_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT user_departments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: user_departments user_departments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_departments
    ADD CONSTRAINT user_departments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_module_assignments user_module_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_assignments
    ADD CONSTRAINT user_module_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_module_assignments user_module_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_module_assignments
    ADD CONSTRAINT user_module_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_page_permissions user_page_permissions_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_page_permissions
    ADD CONSTRAINT user_page_permissions_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_page_permissions user_page_permissions_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_page_permissions
    ADD CONSTRAINT user_page_permissions_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id);


--
-- Name: user_page_permissions user_page_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_page_permissions
    ADD CONSTRAINT user_page_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_permission_overrides user_permission_overrides_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: user_permission_overrides user_permission_overrides_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: user_permission_overrides user_permission_overrides_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permission_overrides
    ADD CONSTRAINT user_permission_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_pillar_assignments user_pillar_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pillar_assignments
    ADD CONSTRAINT user_pillar_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_pillar_assignments user_pillar_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_pillar_assignments
    ADD CONSTRAINT user_pillar_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: users users_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--


