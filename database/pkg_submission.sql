-- ============================================================================
-- CLOUDCLASS DATABASE SYSTEM - SUBMISSION & GRADING PACKAGE
-- Oracle PL/SQL Compatible
-- ============================================================================
-- Description: Manages student submissions, file type/size validation, resubmissions,
--              faculty grading and feedback, submission rejection, and gradebook queries.
-- ============================================================================

CREATE OR REPLACE PACKAGE pkg_submission AS
    -- Submit work for an assignment
    PROCEDURE submit_assignment(
        p_assignment_id  IN NUMBER,
        p_student_id     IN NUMBER,
        p_file_name      IN VARCHAR2,
        p_storage_path   IN VARCHAR2,
        p_file_size_kb   IN NUMBER,
        p_student_note   IN VARCHAR2 DEFAULT NULL,
        o_submission_id  OUT NUMBER,
        o_submission_status OUT VARCHAR2,
        o_status_msg     OUT VARCHAR2
    );

    -- Grade a student's submission (Faculty only)
    PROCEDURE grade_submission(
        p_submission_id  IN NUMBER,
        p_faculty_id     IN NUMBER,
        p_marks_obtained IN NUMBER,
        p_feedback       IN CLOB,
        o_status_msg     OUT VARCHAR2
    );

    -- Reject a corrupted or invalid submission to request resubmission
    PROCEDURE reject_submission(
        p_submission_id   IN NUMBER,
        p_faculty_id      IN NUMBER,
        p_rejection_reason IN VARCHAR2,
        o_status_msg      OUT VARCHAR2
    );

    -- Retrieve all student submissions for a specific assignment (for Faculty)
    FUNCTION get_assignment_submissions(
        p_assignment_id IN NUMBER,
        p_faculty_id    IN NUMBER
    ) RETURN SYS_REFCURSOR;

    -- Retrieve complete gradebook and feedback for a student
    FUNCTION get_student_gradebook(
        p_student_id IN NUMBER
    ) RETURN SYS_REFCURSOR;
END pkg_submission;
/

CREATE OR REPLACE PACKAGE BODY pkg_submission AS

    -- ------------------------------------------------------------------------
    -- SUBMIT_ASSIGNMENT
    -- ------------------------------------------------------------------------
    PROCEDURE submit_assignment(
        p_assignment_id  IN NUMBER,
        p_student_id     IN NUMBER,
        p_file_name      IN VARCHAR2,
        p_storage_path   IN VARCHAR2,
        p_file_size_kb   IN NUMBER,
        p_student_note   IN VARCHAR2 DEFAULT NULL,
        o_submission_id  OUT NUMBER,
        o_submission_status OUT VARCHAR2,
        o_status_msg     OUT VARCHAR2
    ) IS
        v_course_id          assignments.course_id%TYPE;
        v_deadline           assignments.deadline%TYPE;
        v_assign_status      assignments.status%TYPE;
        v_allowed_types      assignments.allowed_file_types%TYPE;
        v_max_size_mb        assignments.max_file_size_mb%TYPE;
        v_is_enrolled        NUMBER;
        v_existing_sub_id    NUMBER;
        v_existing_attempt   NUMBER;
        v_file_ext           VARCHAR2(20);
        v_calc_status        VARCHAR2(25);
    BEGIN
        o_submission_id := NULL;
        o_submission_status := NULL;

        -- 1. Check assignment details
        BEGIN
            SELECT course_id, deadline, status, allowed_file_types, max_file_size_mb
            INTO   v_course_id, v_deadline, v_assign_status, v_allowed_types, v_max_size_mb
            FROM   assignments
            WHERE  assignment_id = p_assignment_id;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                o_status_msg := 'ERROR: Assignment ID ' || p_assignment_id || ' does not exist.';
                RETURN;
        END;

        -- 2. Verify assignment is published
        IF v_assign_status != 'PUBLISHED' THEN
            o_status_msg := 'ERROR: This assignment is ' || v_assign_status || ' and not accepting submissions.';
            RETURN;
        END IF;

        -- 3. Verify student enrollment in the course
        SELECT COUNT(*)
        INTO   v_is_enrolled
        FROM   course_enrollments
        WHERE  course_id = v_course_id
          AND  student_id = p_student_id
          AND  status = 'ENROLLED';

        IF v_is_enrolled = 0 THEN
            o_status_msg := 'ERROR: Student is not actively enrolled in this course.';
            RETURN;
        END IF;

        -- 4. Check file size
        IF p_file_size_kb > (v_max_size_mb * 1024) THEN
            o_status_msg := 'ERROR: File size exceeds the allowed limit of ' || v_max_size_mb || ' MB.';
            RETURN;
        END IF;

        -- 5. Check file extension if allowed_file_types specified
        IF v_allowed_types IS NOT NULL THEN
            v_file_ext := LOWER(SUBSTR(p_file_name, INSTR(p_file_name, '.', -1)));
            IF INSTR(LOWER(v_allowed_types), v_file_ext) = 0 THEN
                o_status_msg := 'ERROR: File extension ' || v_file_ext || ' is not permitted. Allowed: ' || v_allowed_types;
                RETURN;
            END IF;
        END IF;

        -- 6. Determine initial status (on-time vs late)
        IF SYSTIMESTAMP > v_deadline THEN
            v_calc_status := 'LATE';
        ELSE
            v_calc_status := 'SUBMITTED';
        END IF;

        -- 7. Check if student already submitted
        BEGIN
            SELECT submission_id, attempt_number
            INTO   v_existing_sub_id, v_existing_attempt
            FROM   submissions
            WHERE  assignment_id = p_assignment_id
              AND  student_id = p_student_id;

            -- Update existing submission with new file and increment attempt
            UPDATE submissions
            SET    file_name      = p_file_name,
                   storage_path   = p_storage_path,
                   file_size_kb   = p_file_size_kb,
                   student_note   = p_student_note,
                   submitted_at   = SYSTIMESTAMP,
                   status         = CASE WHEN SYSTIMESTAMP > v_deadline THEN 'LATE' ELSE 'RESUBMITTED' END,
                   attempt_number = v_existing_attempt + 1,
                   marks_obtained = NULL, -- Reset previous grade for regrading
                   graded_by      = NULL,
                   graded_at      = NULL
            WHERE  submission_id  = v_existing_sub_id;

            o_submission_id := v_existing_sub_id;
            o_submission_status := CASE WHEN SYSTIMESTAMP > v_deadline THEN 'LATE' ELSE 'RESUBMITTED' END;
            COMMIT;
            o_status_msg := 'SUCCESS: Resubmission completed (Attempt ' || (v_existing_attempt + 1) || ').';
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                -- New submission
                INSERT INTO submissions (
                    assignment_id, student_id, submitted_at, file_name, storage_path,
                    file_size_kb, student_note, status, attempt_number
                ) VALUES (
                    p_assignment_id, p_student_id, SYSTIMESTAMP, p_file_name, p_storage_path,
                    p_file_size_kb, p_student_note, v_calc_status, 1
                ) RETURNING submission_id, status INTO o_submission_id, o_submission_status;

                COMMIT;
                o_status_msg := 'SUCCESS: Assignment submitted successfully with status: ' || o_submission_status;
        END;

    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            o_status_msg := 'ERROR: ' || SQLERRM;
    END submit_assignment;

    -- ------------------------------------------------------------------------
    -- GRADE_SUBMISSION
    -- ------------------------------------------------------------------------
    PROCEDURE grade_submission(
        p_submission_id  IN NUMBER,
        p_faculty_id     IN NUMBER,
        p_marks_obtained IN NUMBER,
        p_feedback       IN CLOB,
        o_status_msg     OUT VARCHAR2
    ) IS
        v_assignment_id NUMBER;
        v_max_points    NUMBER(5, 2);
        v_faculty_auth  NUMBER;
    BEGIN
        -- 1. Retrieve assignment info
        SELECT s.assignment_id, a.max_points
        INTO   v_assignment_id, v_max_points
        FROM   submissions s
        JOIN   assignments a ON s.assignment_id = a.assignment_id
        WHERE  s.submission_id = p_submission_id;

        -- 2. Verify faculty authority over the assignment
        SELECT COUNT(*)
        INTO   v_faculty_auth
        FROM   assignments
        WHERE  assignment_id = v_assignment_id
          AND  faculty_id    = p_faculty_id;

        IF v_faculty_auth = 0 THEN
            o_status_msg := 'ERROR: You are not authorized to grade submissions for this assignment.';
            RETURN;
        END IF;

        -- 3. Marks validation (also enforced by trigger)
        IF p_marks_obtained < 0 OR p_marks_obtained > v_max_points THEN
            o_status_msg := 'ERROR: Marks awarded (' || p_marks_obtained || ') must be between 0 and ' || v_max_points || '.';
            RETURN;
        END IF;

        -- 4. Apply grade
        UPDATE submissions
        SET    marks_obtained   = p_marks_obtained,
               faculty_feedback = p_feedback,
               graded_by        = p_faculty_id,
               graded_at        = SYSTIMESTAMP,
               status           = 'GRADED',
               is_verified      = 'Y'
        WHERE  submission_id    = p_submission_id;

        COMMIT;
        o_status_msg := 'SUCCESS: Submission graded with ' || p_marks_obtained || '/' || v_max_points || ' points.';
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            o_status_msg := 'ERROR: Submission ID ' || p_submission_id || ' not found.';
        WHEN OTHERS THEN
            ROLLBACK;
            o_status_msg := 'ERROR: ' || SQLERRM;
    END grade_submission;

    -- ------------------------------------------------------------------------
    -- REJECT_SUBMISSION
    -- ------------------------------------------------------------------------
    PROCEDURE reject_submission(
        p_submission_id    IN NUMBER,
        p_faculty_id       IN NUMBER,
        p_rejection_reason IN VARCHAR2,
        o_status_msg       OUT VARCHAR2
    ) IS
    BEGIN
        UPDATE submissions
        SET    status           = 'REJECTED',
               rejection_reason = TRIM(p_rejection_reason),
               graded_by        = p_faculty_id,
               graded_at        = SYSTIMESTAMP
        WHERE  submission_id = p_submission_id
          AND  assignment_id IN (
              SELECT assignment_id FROM assignments WHERE faculty_id = p_faculty_id
          );

        IF SQL%ROWCOUNT > 0 THEN
            COMMIT;
            o_status_msg := 'SUCCESS: Submission has been rejected with reason: ' || p_rejection_reason;
        ELSE
            o_status_msg := 'ERROR: Submission not found or unauthorized faculty.';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            o_status_msg := 'ERROR: ' || SQLERRM;
    END reject_submission;

    -- ------------------------------------------------------------------------
    -- GET_ASSIGNMENT_SUBMISSIONS (Faculty View)
    -- ------------------------------------------------------------------------
    FUNCTION get_assignment_submissions(
        p_assignment_id IN NUMBER,
        p_faculty_id    IN NUMBER
    ) RETURN SYS_REFCURSOR IS
        v_cursor SYS_REFCURSOR;
    BEGIN
        OPEN v_cursor FOR
            SELECT s.submission_id,
                   sp.student_id,
                   sp.roll_number,
                   sp.full_name AS student_name,
                   u.email AS student_email,
                   s.file_name,
                   s.storage_path,
                   s.file_size_kb,
                   s.submitted_at,
                   s.status,
                   s.attempt_number,
                   s.marks_obtained,
                   a.max_points,
                   s.faculty_feedback,
                   s.graded_at
            FROM   submissions s
            JOIN   student_profiles sp ON s.student_id = sp.student_id
            JOIN   users u ON sp.user_id = u.user_id
            JOIN   assignments a ON s.assignment_id = a.assignment_id
            WHERE  s.assignment_id = p_assignment_id
              AND  a.faculty_id    = p_faculty_id
            ORDER  BY s.submitted_at DESC;
        RETURN v_cursor;
    END get_assignment_submissions;

    -- ------------------------------------------------------------------------
    -- GET_STUDENT_GRADEBOOK
    -- ------------------------------------------------------------------------
    FUNCTION get_student_gradebook(
        p_student_id IN NUMBER
    ) RETURN SYS_REFCURSOR IS
        v_cursor SYS_REFCURSOR;
    BEGIN
        OPEN v_cursor FOR
            SELECT c.course_code,
                   c.course_name,
                   a.assignment_code,
                   a.title AS assignment_title,
                   a.deadline,
                   s.submission_id,
                   s.submitted_at,
                   s.status,
                   s.marks_obtained,
                   a.max_points,
                   ROUND((s.marks_obtained / a.max_points) * 100, 2) AS percentage,
                   s.faculty_feedback,
                   fp.full_name AS graded_by_faculty
            FROM   assignments a
            JOIN   courses c ON a.course_id = c.course_id
            JOIN   course_enrollments ce ON c.course_id = ce.course_id AND ce.student_id = p_student_id
            LEFT JOIN submissions s ON a.assignment_id = s.assignment_id AND s.student_id = p_student_id
            LEFT JOIN faculty_profiles fp ON s.graded_by = fp.faculty_id
            WHERE  ce.status = 'ENROLLED'
            ORDER  BY c.course_code, a.deadline DESC;
        RETURN v_cursor;
    END get_student_gradebook;

END pkg_submission;
/

PROMPT Package PKG_SUBMISSION compiled successfully.
