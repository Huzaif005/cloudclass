-- ============================================================================
-- CLOUDCLASS DATABASE SYSTEM - BUSINESS LOGIC TRIGGERS
-- Oracle PL/SQL Compatible
-- ============================================================================
-- Description: Automated timestamp maintenance, deadline violation checks
--              (auto 'LATE' tagging), grade validation against assignment max,
--              and submission history audit trail.
-- ============================================================================

-- ============================================================================
-- 1. TRIGGER: Auto-update timestamp on USERS table
-- ============================================================================
CREATE OR REPLACE TRIGGER trg_users_update_ts
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

-- ============================================================================
-- 2. TRIGGER: Auto-update timestamp on ASSIGNMENTS table
-- ============================================================================
CREATE OR REPLACE TRIGGER trg_assignments_update_ts
BEFORE UPDATE ON assignments
FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

-- ============================================================================
-- 3. TRIGGER: Auto-detect Late Submissions and Validate Max Points
-- Compares submission timestamp against assignment deadline and enforces
-- that marks awarded do not exceed max_points.
-- ============================================================================
CREATE OR REPLACE TRIGGER trg_submissions_integrity
BEFORE INSERT OR UPDATE OF submitted_at, marks_obtained, status ON submissions
FOR EACH ROW
DECLARE
    v_deadline   TIMESTAMP WITH TIME ZONE;
    v_max_points NUMBER(5, 2);
    v_assign_status VARCHAR2(20);
BEGIN
    -- Retrieve assignment deadline, max points, and status
    SELECT deadline, max_points, status
    INTO   v_deadline, v_max_points, v_assign_status
    FROM   assignments
    WHERE  assignment_id = :NEW.assignment_id;

    -- Prevent submission to closed or archived assignments
    IF INSERTING AND v_assign_status NOT IN ('PUBLISHED') THEN
        RAISE_APPLICATION_ERROR(-20001, 'Submissions are not permitted for an assignment with status: ' || v_assign_status);
    END IF;

    -- Automatically tag as 'LATE' if submitted after the deadline
    IF (:NEW.status IN ('SUBMITTED', 'PENDING')) AND (:NEW.submitted_at > v_deadline) THEN
        :NEW.status := 'LATE';
    END IF;

    -- Validate marks obtained
    IF :NEW.marks_obtained IS NOT NULL THEN
        IF :NEW.marks_obtained < 0 THEN
            RAISE_APPLICATION_ERROR(-20002, 'Marks obtained cannot be negative.');
        END IF;
        IF :NEW.marks_obtained > v_max_points THEN
            RAISE_APPLICATION_ERROR(-20003, 'Marks obtained (' || :NEW.marks_obtained || 
                                           ') cannot exceed maximum allowed points (' || v_max_points || ').');
        END IF;
    END IF;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20004, 'Associated assignment ID ' || :NEW.assignment_id || ' does not exist.');
END;
/

-- ============================================================================
-- 4. TRIGGER: Automated Submission Audit History
-- Captures state transitions, resubmissions, and grades into SUBMISSION_HISTORY
-- ============================================================================
CREATE OR REPLACE TRIGGER trg_submissions_history_audit
AFTER INSERT OR UPDATE ON submissions
FOR EACH ROW
DECLARE
    v_action_type VARCHAR2(30);
    v_user_id     NUMBER(10);
    v_remarks     VARCHAR2(500);
BEGIN
    IF INSERTING THEN
        -- Find student's user_id
        SELECT user_id INTO v_user_id
        FROM student_profiles
        WHERE student_id = :NEW.student_id;

        v_action_type := CASE WHEN :NEW.status = 'LATE' THEN 'SUBMITTED_LATE' ELSE 'INITIAL_SUBMISSION' END;
        v_remarks := 'Assignment submitted with file: ' || :NEW.file_name;

        INSERT INTO submission_history (
            submission_id, action_type, previous_marks, new_marks,
            performed_by_user, action_timestamp, remarks
        ) VALUES (
            :NEW.submission_id, v_action_type, NULL, :NEW.marks_obtained,
            v_user_id, SYSTIMESTAMP, v_remarks
        );

    ELSIF UPDATING THEN
        -- Check if grade or status changed
        IF (:OLD.marks_obtained IS NULL AND :NEW.marks_obtained IS NOT NULL) OR
           (:OLD.marks_obtained != :NEW.marks_obtained) OR
           (:OLD.status != :NEW.status) THEN

            -- Performed by faculty (or student if resubmitting)
            IF :NEW.graded_by IS NOT NULL THEN
                SELECT user_id INTO v_user_id
                FROM faculty_profiles
                WHERE faculty_id = :NEW.graded_by;
            ELSE
                SELECT user_id INTO v_user_id
                FROM student_profiles
                WHERE student_id = :NEW.student_id;
            END IF;

            v_action_type := CASE 
                WHEN :OLD.marks_obtained IS NULL AND :NEW.marks_obtained IS NOT NULL THEN 'GRADED'
                WHEN :OLD.marks_obtained != :NEW.marks_obtained THEN 'REGRADED'
                WHEN :NEW.status = 'REJECTED' THEN 'REJECTED'
                WHEN :NEW.status = 'RESUBMITTED' THEN 'RESUBMITTED'
                ELSE 'STATUS_CHANGE_TO_' || :NEW.status
            END;

            v_remarks := 'Status changed from ' || :OLD.status || ' to ' || :NEW.status ||
                         '. Marks: ' || NVL(TO_CHAR(:OLD.marks_obtained), 'None') || ' -> ' || NVL(TO_CHAR(:NEW.marks_obtained), 'None');

            INSERT INTO submission_history (
                submission_id, action_type, previous_marks, new_marks,
                performed_by_user, action_timestamp, remarks
            ) VALUES (
                :NEW.submission_id, v_action_type, :OLD.marks_obtained, :NEW.marks_obtained,
                v_user_id, SYSTIMESTAMP, v_remarks
            );
        END IF;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Allow submission to proceed even if non-critical audit log encounters an edge case
        NULL;
END;
/

PROMPT Triggers compiled successfully.
