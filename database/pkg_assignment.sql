-- ============================================================================
-- CLOUDCLASS DATABASE SYSTEM - ASSIGNMENT MANAGEMENT PACKAGE
-- Oracle PL/SQL Compatible
-- ============================================================================
-- Description: Manages creation, modification, status changes, and queries for
--              assignments created and assigned by faculty members.
-- ============================================================================

CREATE OR REPLACE PACKAGE pkg_assignment AS
    -- Create a new assignment by a verified faculty member
    PROCEDURE create_assignment(
        p_course_id          IN NUMBER,
        p_faculty_id         IN NUMBER,
        p_title              IN VARCHAR2,
        p_instructions       IN CLOB,
        p_max_points         IN NUMBER,
        p_deadline           IN TIMESTAMP WITH TIME ZONE,
        p_assignment_code    IN VARCHAR2 DEFAULT NULL,
        p_allowed_file_types IN VARCHAR2 DEFAULT '.pdf,.zip,.doc,.docx',
        p_max_file_size_mb   IN NUMBER DEFAULT 10,
        o_assignment_id      OUT NUMBER,
        o_status_msg         OUT VARCHAR2
    );

    -- Update an existing assignment
    PROCEDURE update_assignment(
        p_assignment_id      IN NUMBER,
        p_faculty_id         IN NUMBER,
        p_title              IN VARCHAR2,
        p_instructions       IN CLOB,
        p_max_points         IN NUMBER,
        p_deadline           IN TIMESTAMP WITH TIME ZONE,
        p_allowed_file_types IN VARCHAR2,
        p_max_file_size_mb   IN NUMBER,
        o_status_msg         OUT VARCHAR2
    );

    -- Change assignment publication status ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED')
    PROCEDURE set_assignment_status(
        p_assignment_id IN NUMBER,
        p_faculty_id    IN NUMBER,
        p_new_status    IN VARCHAR2,
        o_status_msg    OUT VARCHAR2
    );

    -- Enroll a student in a course
    PROCEDURE enroll_student(
        p_course_id   IN NUMBER,
        p_student_id  IN NUMBER,
        o_status_msg  OUT VARCHAR2
    );

    -- Retrieve all assignments created by a faculty member
    FUNCTION get_faculty_assignments(
        p_faculty_id IN NUMBER
    ) RETURN SYS_REFCURSOR;

    -- Retrieve active assignments available to an enrolled student
    FUNCTION get_student_assignments(
        p_student_id IN NUMBER
    ) RETURN SYS_REFCURSOR;
END pkg_assignment;
/

CREATE OR REPLACE PACKAGE BODY pkg_assignment AS

    -- ------------------------------------------------------------------------
    -- CREATE_ASSIGNMENT
    -- ------------------------------------------------------------------------
    PROCEDURE create_assignment(
        p_course_id          IN NUMBER,
        p_faculty_id         IN NUMBER,
        p_title              IN VARCHAR2,
        p_instructions       IN CLOB,
        p_max_points         IN NUMBER,
        p_deadline           IN TIMESTAMP WITH TIME ZONE,
        p_assignment_code    IN VARCHAR2 DEFAULT NULL,
        p_allowed_file_types IN VARCHAR2 DEFAULT '.pdf,.zip,.doc,.docx',
        p_max_file_size_mb   IN NUMBER DEFAULT 10,
        o_assignment_id      OUT NUMBER,
        o_status_msg         OUT VARCHAR2
    ) IS
        v_faculty_assigned NUMBER;
    BEGIN
        o_assignment_id := NULL;

        -- 1. Verify faculty teaches this course
        SELECT COUNT(*)
        INTO   v_faculty_assigned
        FROM   courses
        WHERE  course_id = p_course_id
          AND  faculty_id = p_faculty_id
          AND  is_active = 'Y';

        IF v_faculty_assigned = 0 THEN
            o_status_msg := 'ERROR: You are not authorized to create assignments for this course or course is inactive.';
            RETURN;
        END IF;

        -- 2. Validate deadline is in the future
        IF p_deadline <= SYSTIMESTAMP THEN
            o_status_msg := 'ERROR: Assignment deadline must be set to a future date/time.';
            RETURN;
        END IF;

        -- 3. Validate points
        IF p_max_points <= 0 THEN
            o_status_msg := 'ERROR: Max points must be greater than zero.';
            RETURN;
        END IF;

        -- 4. Insert assignment
        INSERT INTO assignments (
            course_id, faculty_id, assignment_code, title, instructions,
            max_points, deadline, allowed_file_types, max_file_size_mb, status
        ) VALUES (
            p_course_id, p_faculty_id, TRIM(p_assignment_code), TRIM(p_title), p_instructions,
            p_max_points, p_deadline, TRIM(p_allowed_file_types), p_max_file_size_mb, 'PUBLISHED'
        ) RETURNING assignment_id INTO o_assignment_id;

        COMMIT;
        o_status_msg := 'SUCCESS: Assignment created successfully with ID: ' || o_assignment_id;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            o_status_msg := 'ERROR: ' || SQLERRM;
    END create_assignment;

    -- ------------------------------------------------------------------------
    -- UPDATE_ASSIGNMENT
    -- ------------------------------------------------------------------------
    PROCEDURE update_assignment(
        p_assignment_id      IN NUMBER,
        p_faculty_id         IN NUMBER,
        p_title              IN VARCHAR2,
        p_instructions       IN CLOB,
        p_max_points         IN NUMBER,
        p_deadline           IN TIMESTAMP WITH TIME ZONE,
        p_allowed_file_types IN VARCHAR2,
        p_max_file_size_mb   IN NUMBER,
        o_status_msg         OUT VARCHAR2
    ) IS
    BEGIN
        UPDATE assignments
        SET    title              = TRIM(p_title),
               instructions       = p_instructions,
               max_points         = p_max_points,
               deadline           = p_deadline,
               allowed_file_types = TRIM(p_allowed_file_types),
               max_file_size_mb   = p_max_file_size_mb
        WHERE  assignment_id = p_assignment_id
          AND  faculty_id    = p_faculty_id;

        IF SQL%ROWCOUNT > 0 THEN
            COMMIT;
            o_status_msg := 'SUCCESS: Assignment updated successfully.';
        ELSE
            o_status_msg := 'ERROR: Assignment not found or you are not authorized to edit it.';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            o_status_msg := 'ERROR: ' || SQLERRM;
    END update_assignment;

    -- ------------------------------------------------------------------------
    -- SET_ASSIGNMENT_STATUS
    -- ------------------------------------------------------------------------
    PROCEDURE set_assignment_status(
        p_assignment_id IN NUMBER,
        p_faculty_id    IN NUMBER,
        p_new_status    IN VARCHAR2,
        o_status_msg    OUT VARCHAR2
    ) IS
        v_status_upper VARCHAR2(20) := UPPER(TRIM(p_new_status));
    BEGIN
        IF v_status_upper NOT IN ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED') THEN
            o_status_msg := 'ERROR: Invalid status. Allowed: DRAFT, PUBLISHED, CLOSED, ARCHIVED.';
            RETURN;
        END IF;

        UPDATE assignments
        SET    status = v_status_upper
        WHERE  assignment_id = p_assignment_id
          AND  faculty_id    = p_faculty_id;

        IF SQL%ROWCOUNT > 0 THEN
            COMMIT;
            o_status_msg := 'SUCCESS: Status updated to ' || v_status_upper;
        ELSE
            o_status_msg := 'ERROR: Assignment not found or unauthorized.';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            o_status_msg := 'ERROR: ' || SQLERRM;
    END set_assignment_status;

    -- ------------------------------------------------------------------------
    -- ENROLL_STUDENT
    -- ------------------------------------------------------------------------
    PROCEDURE enroll_student(
        p_course_id  IN NUMBER,
        p_student_id IN NUMBER,
        o_status_msg OUT VARCHAR2
    ) IS
    BEGIN
        INSERT INTO course_enrollments (course_id, student_id, status)
        VALUES (p_course_id, p_student_id, 'ENROLLED');

        COMMIT;
        o_status_msg := 'SUCCESS: Student enrolled successfully.';
    EXCEPTION
        WHEN DUP_VAL_ON_INDEX THEN
            o_status_msg := 'INFO: Student is already enrolled in this course.';
        WHEN OTHERS THEN
            ROLLBACK;
            o_status_msg := 'ERROR: ' || SQLERRM;
    END enroll_student;

    -- ------------------------------------------------------------------------
    -- GET_FACULTY_ASSIGNMENTS
    -- ------------------------------------------------------------------------
    FUNCTION get_faculty_assignments(
        p_faculty_id IN NUMBER
    ) RETURN SYS_REFCURSOR IS
        v_cursor SYS_REFCURSOR;
    BEGIN
        OPEN v_cursor FOR
            SELECT a.assignment_id,
                   a.assignment_code,
                   a.title,
                   c.course_code,
                   c.course_name,
                   a.max_points,
                   a.deadline,
                   a.status,
                   a.created_at,
                   (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.assignment_id) AS total_submissions,
                   (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.assignment_id AND s.status = 'GRADED') AS graded_count
            FROM   assignments a
            JOIN   courses c ON a.course_id = c.course_id
            WHERE  a.faculty_id = p_faculty_id
            ORDER  BY a.deadline DESC;
        RETURN v_cursor;
    END get_faculty_assignments;

    -- ------------------------------------------------------------------------
    -- GET_STUDENT_ASSIGNMENTS
    -- ------------------------------------------------------------------------
    FUNCTION get_student_assignments(
        p_student_id IN NUMBER
    ) RETURN SYS_REFCURSOR IS
        v_cursor SYS_REFCURSOR;
    BEGIN
        OPEN v_cursor FOR
            SELECT a.assignment_id,
                   a.assignment_code,
                   a.title,
                   c.course_code,
                   c.course_name,
                   fp.full_name AS faculty_name,
                   a.max_points,
                   a.deadline,
                   a.allowed_file_types,
                   s.submission_id,
                   NVL(s.status, 'NOT_SUBMITTED') AS submission_status,
                   s.submitted_at,
                   s.marks_obtained,
                   s.faculty_feedback
            FROM   assignments a
            JOIN   courses c ON a.course_id = c.course_id
            JOIN   faculty_profiles fp ON a.faculty_id = fp.faculty_id
            JOIN   course_enrollments ce ON c.course_id = ce.course_id AND ce.student_id = p_student_id
            LEFT JOIN submissions s ON a.assignment_id = s.assignment_id AND s.student_id = p_student_id
            WHERE  a.status = 'PUBLISHED'
              AND  ce.status = 'ENROLLED'
            ORDER  BY a.deadline ASC;
        RETURN v_cursor;
    END get_student_assignments;

END pkg_assignment;
/

PROMPT Package PKG_ASSIGNMENT compiled successfully.
