-- ============================================================================
-- CLOUDCLASS DATABASE SYSTEM - CORE SCHEMA DEFINITION (DDL)
-- Oracle PL/SQL Compatible (Oracle 11g, 12c, 18c, 19c, 21c, 23c, & Oracle APEX/LiveSQL)
-- ============================================================================
-- Description: Core tables for Login/Authentication, Security Auditing,
--              Faculty Rosters, Student Rosters, Courses, Assignments,
--              and Student Submissions.
-- ============================================================================

-- Drop tables if re-running (Children first, then parents)
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE submission_history CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE submissions CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE assignments CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE course_enrollments CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE courses CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE student_profiles CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE faculty_profiles CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE login_logs CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE users CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

-- Drop sequences if re-running
BEGIN
    FOR seq IN (SELECT sequence_name FROM user_sequences WHERE sequence_name IN (
        'SEQ_USERS_ID', 'SEQ_LOGIN_LOGS_ID', 'SEQ_FACULTY_ID', 'SEQ_STUDENTS_ID',
        'SEQ_COURSES_ID', 'SEQ_ENROLLMENTS_ID', 'SEQ_ASSIGNMENTS_ID',
        'SEQ_SUBMISSIONS_ID', 'SEQ_SUB_HISTORY_ID'
    )) LOOP
        EXECUTE IMMEDIATE 'DROP SEQUENCE ' || seq.sequence_name;
    END LOOP;
END;
/

-- ============================================================================
-- 1. SEQUENCES
-- ============================================================================
CREATE SEQUENCE seq_users_id         START WITH 1001 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_login_logs_id    START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_faculty_id       START WITH 501 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_students_id      START WITH 2001 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_courses_id       START WITH 101 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_enrollments_id   START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_assignments_id   START WITH 10001 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_submissions_id   START WITH 50001 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_sub_history_id   START WITH 1 INCREMENT BY 1 NOCACHE;

-- ============================================================================
-- 2. USERS & AUTHENTICATION TABLE
-- Stores credentials, roles, account lockout state, and login metadata
-- ============================================================================
CREATE TABLE users (
    user_id             NUMBER(10)          DEFAULT seq_users_id.NEXTVAL,
    username            VARCHAR2(50)        NOT NULL,
    email               VARCHAR2(120)       NOT NULL,
    password_hash       VARCHAR2(128)       NOT NULL, -- SHA-256 / SHA-512 hex string
    password_salt       VARCHAR2(64)        NOT NULL, -- Cryptographic random salt
    role                VARCHAR2(20)        NOT NULL, -- 'STUDENT', 'FACULTY', 'ADMIN'
    status              VARCHAR2(20)        DEFAULT 'ACTIVE' NOT NULL, -- 'ACTIVE', 'LOCKED', 'SUSPENDED'
    failed_attempts     NUMBER(3)           DEFAULT 0 NOT NULL,
    last_login_at       TIMESTAMP WITH TIME ZONE,
    last_password_change TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_users_id PRIMARY KEY (user_id),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (role IN ('STUDENT', 'FACULTY', 'ADMIN')),
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'LOCKED', 'SUSPENDED'))
);

-- ============================================================================
-- 3. LOGIN AUDIT & SESSION LOGS
-- Tracks every login attempt (successful or failed), IP address, and security reason
-- ============================================================================
CREATE TABLE login_logs (
    log_id              NUMBER(12)          DEFAULT seq_login_logs_id.NEXTVAL,
    user_id             NUMBER(10),
    attempted_email     VARCHAR2(120)       NOT NULL,
    ip_address          VARCHAR2(45)        DEFAULT '127.0.0.1',
    user_agent          VARCHAR2(255),
    login_status        VARCHAR2(20)        NOT NULL, -- 'SUCCESS', 'FAILED', 'LOCKED'
    failure_reason      VARCHAR2(100),                -- 'INVALID_CREDENTIALS', 'ACCOUNT_LOCKED', etc.
    attempt_timestamp   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_login_logs_id PRIMARY KEY (log_id),
    CONSTRAINT fk_login_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT chk_login_status CHECK (login_status IN ('SUCCESS', 'FAILED', 'LOCKED'))
);

-- ============================================================================
-- 4. FACULTY PROFILES TABLE
-- Academic details and departmental affiliation for faculty members
-- ============================================================================
CREATE TABLE faculty_profiles (
    faculty_id          NUMBER(10)          DEFAULT seq_faculty_id.NEXTVAL,
    user_id             NUMBER(10)          NOT NULL,
    employee_code       VARCHAR2(30)        NOT NULL,
    full_name           VARCHAR2(100)       NOT NULL,
    department          VARCHAR2(80)        NOT NULL,
    designation         VARCHAR2(60)        DEFAULT 'Assistant Professor',
    phone_number        VARCHAR2(20),
    office_room         VARCHAR2(40),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_faculty_id PRIMARY KEY (faculty_id),
    CONSTRAINT uq_faculty_user UNIQUE (user_id),
    CONSTRAINT uq_faculty_code UNIQUE (employee_code),
    CONSTRAINT fk_faculty_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================================================
-- 5. STUDENT PROFILES TABLE
-- Enrollment roster, roll number / college ID, batch, and semester info
-- ============================================================================
CREATE TABLE student_profiles (
    student_id          NUMBER(10)          DEFAULT seq_students_id.NEXTVAL,
    user_id             NUMBER(10)          NOT NULL,
    roll_number         VARCHAR2(30)        NOT NULL, -- e.g. 6-digit college ID
    full_name           VARCHAR2(100)       NOT NULL,
    department          VARCHAR2(80)        NOT NULL,
    semester            NUMBER(2)           DEFAULT 1 NOT NULL,
    batch_year          VARCHAR2(10)        NOT NULL, -- e.g. '2024-2028'
    phone_number        VARCHAR2(20),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_student_id PRIMARY KEY (student_id),
    CONSTRAINT uq_student_user UNIQUE (user_id),
    CONSTRAINT uq_student_roll UNIQUE (roll_number),
    CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_student_sem CHECK (semester BETWEEN 1 AND 12)
);

-- ============================================================================
-- 6. COURSES / SUBJECTS TABLE
-- Courses offered and assigned to faculty instructors
-- ============================================================================
CREATE TABLE courses (
    course_id           NUMBER(10)          DEFAULT seq_courses_id.NEXTVAL,
    course_code         VARCHAR2(20)        NOT NULL, -- e.g. 'CS401'
    course_name         VARCHAR2(120)       NOT NULL,
    department          VARCHAR2(80)        NOT NULL,
    credits             NUMBER(2)           DEFAULT 3 NOT NULL,
    faculty_id          NUMBER(10)          NOT NULL,
    semester            NUMBER(2)           NOT NULL,
    academic_year       VARCHAR2(10)        NOT NULL, -- e.g. '2025-2026'
    is_active           CHAR(1)             DEFAULT 'Y' NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_courses_id PRIMARY KEY (course_id),
    CONSTRAINT uq_course_code UNIQUE (course_code),
    CONSTRAINT fk_courses_faculty FOREIGN KEY (faculty_id) REFERENCES faculty_profiles(faculty_id),
    CONSTRAINT chk_courses_active CHECK (is_active IN ('Y', 'N'))
);

-- ============================================================================
-- 7. COURSE ENROLLMENTS TABLE
-- Maps students to courses they are taking
-- ============================================================================
CREATE TABLE course_enrollments (
    enrollment_id       NUMBER(10)          DEFAULT seq_enrollments_id.NEXTVAL,
    course_id           NUMBER(10)          NOT NULL,
    student_id          NUMBER(10)          NOT NULL,
    enrolled_at         TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    status              VARCHAR2(20)        DEFAULT 'ENROLLED' NOT NULL, -- 'ENROLLED', 'DROPPED', 'COMPLETED'
    CONSTRAINT pk_enrollments_id PRIMARY KEY (enrollment_id),
    CONSTRAINT uq_enrollment_student UNIQUE (course_id, student_id),
    CONSTRAINT fk_enroll_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    CONSTRAINT fk_enroll_student FOREIGN KEY (student_id) REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    CONSTRAINT chk_enroll_status CHECK (status IN ('ENROLLED', 'DROPPED', 'COMPLETED'))
);

-- ============================================================================
-- 8. ASSIGNMENTS TABLE (GIVEN BY FACULTY)
-- Stores all assignments posted by faculty for courses
-- ============================================================================
CREATE TABLE assignments (
    assignment_id       NUMBER(10)          DEFAULT seq_assignments_id.NEXTVAL,
    course_id           NUMBER(10)          NOT NULL,
    faculty_id          NUMBER(10)          NOT NULL,
    assignment_code     VARCHAR2(30),                 -- e.g. 'LAB-01', 'HW-03'
    title               VARCHAR2(200)       NOT NULL,
    instructions        CLOB                NOT NULL, -- Detailed instructions/problem statement
    max_points          NUMBER(5, 2)        DEFAULT 100.00 NOT NULL,
    deadline            TIMESTAMP WITH TIME ZONE NOT NULL,
    allowed_file_types  VARCHAR2(100)       DEFAULT '.pdf,.zip,.doc,.docx',
    max_file_size_mb    NUMBER(3)           DEFAULT 10 NOT NULL,
    status              VARCHAR2(20)        DEFAULT 'PUBLISHED' NOT NULL, -- 'DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_assignments_id PRIMARY KEY (assignment_id),
    CONSTRAINT fk_assign_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    CONSTRAINT fk_assign_faculty FOREIGN KEY (faculty_id) REFERENCES faculty_profiles(faculty_id),
    CONSTRAINT chk_assign_points CHECK (max_points > 0),
    CONSTRAINT chk_assign_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'))
);

-- ============================================================================
-- 9. SUBMISSIONS TABLE (SUBMITTED BY STUDENTS)
-- Stores student work, timestamps, late indicators, grades, and faculty feedback
-- ============================================================================
CREATE TABLE submissions (
    submission_id       NUMBER(12)          DEFAULT seq_submissions_id.NEXTVAL,
    assignment_id       NUMBER(10)          NOT NULL,
    student_id          NUMBER(10)          NOT NULL,
    submitted_at        TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    file_name           VARCHAR2(255)       NOT NULL,
    storage_path        VARCHAR2(500)       NOT NULL, -- Cloud Storage URL or server relative path
    file_size_kb        NUMBER(10),
    student_note        VARCHAR2(1000),
    status              VARCHAR2(25)        DEFAULT 'SUBMITTED' NOT NULL,
    -- 'SUBMITTED', 'LATE', 'UNDER_REVIEW', 'GRADED', 'REJECTED', 'RESUBMITTED'
    marks_obtained      NUMBER(5, 2),
    faculty_feedback    CLOB,
    graded_by           NUMBER(10),                   -- References faculty_profiles
    graded_at           TIMESTAMP WITH TIME ZONE,
    attempt_number      NUMBER(2)           DEFAULT 1 NOT NULL,
    is_verified         CHAR(1)             DEFAULT 'N' NOT NULL,
    rejection_reason    VARCHAR2(255),
    CONSTRAINT pk_submissions_id PRIMARY KEY (submission_id),
    CONSTRAINT uq_sub_assign_stud UNIQUE (assignment_id, student_id, attempt_number),
    CONSTRAINT fk_sub_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_student FOREIGN KEY (student_id) REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_grader FOREIGN KEY (graded_by) REFERENCES faculty_profiles(faculty_id) ON DELETE SET NULL,
    CONSTRAINT chk_sub_status CHECK (status IN ('SUBMITTED', 'LATE', 'UNDER_REVIEW', 'GRADED', 'REJECTED', 'RESUBMITTED')),
    CONSTRAINT chk_sub_marks CHECK (marks_obtained IS NULL OR marks_obtained >= 0),
    CONSTRAINT chk_sub_verified CHECK (is_verified IN ('Y', 'N'))
);

-- ============================================================================
-- 10. SUBMISSION HISTORY & AUDIT LOG TABLE
-- Logs grade changes, resubmissions, and grading modifications for compliance
-- ============================================================================
CREATE TABLE submission_history (
    history_id          NUMBER(12)          DEFAULT seq_sub_history_id.NEXTVAL,
    submission_id       NUMBER(12)          NOT NULL,
    action_type         VARCHAR2(30)        NOT NULL, -- 'SUBMITTED', 'RESUBMITTED', 'GRADED', 'REGRADED', 'REJECTED'
    previous_marks      NUMBER(5, 2),
    new_marks           NUMBER(5, 2),
    performed_by_user   NUMBER(10)          NOT NULL,
    action_timestamp    TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    remarks             VARCHAR2(500),
    CONSTRAINT pk_sub_history_id PRIMARY KEY (history_id),
    CONSTRAINT fk_history_submission FOREIGN KEY (submission_id) REFERENCES submissions(submission_id) ON DELETE CASCADE,
    CONSTRAINT fk_history_user FOREIGN KEY (performed_by_user) REFERENCES users(user_id)
);

-- ============================================================================
-- 11. PERFORMANCE INDEXES
-- Index high-cardinality search/filter columns and foreign keys
-- ============================================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_login_logs_user ON login_logs(user_id, attempt_timestamp);
CREATE INDEX idx_faculty_user ON faculty_profiles(user_id);
CREATE INDEX idx_student_user ON student_profiles(user_id);
CREATE INDEX idx_student_roll ON student_profiles(roll_number);
CREATE INDEX idx_courses_faculty ON courses(faculty_id);
CREATE INDEX idx_enroll_student ON course_enrollments(student_id);
CREATE INDEX idx_enroll_course ON course_enrollments(course_id);
CREATE INDEX idx_assign_course ON assignments(course_id);
CREATE INDEX idx_assign_faculty ON assignments(faculty_id);
CREATE INDEX idx_assign_deadline ON assignments(deadline);
CREATE INDEX idx_sub_assignment ON submissions(assignment_id);
CREATE INDEX idx_sub_student ON submissions(student_id);
CREATE INDEX idx_sub_status ON submissions(status);
CREATE INDEX idx_sub_history_sub ON submission_history(submission_id);

PROMPT Schema tables, sequences, constraints, and indexes created successfully.
