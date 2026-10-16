-- ============================================================================
-- CLOUDCLASS DATABASE SYSTEM - COMPREHENSIVE TEST & VALIDATION HARNESS
-- Oracle PL/SQL Compatible
-- ============================================================================
-- Description: Interactive PL/SQL anonymous block demonstrating and verifying:
--              1. Successful student & faculty login
--              2. Failed login attempt counter & brute-force account lockout
--              3. Administrator account unlock
--              4. Assignment submission constraint enforcement
--              5. Max points trigger validation (rejecting over-grading)
--              6. Analytic view inspection
-- ============================================================================

SET SERVEROUTPUT ON SIZE UNLIMITED;

PROMPT ============================================================================
PROMPT TEST 1: TESTING VALID & INVALID LOGINS
PROMPT ============================================================================

DECLARE
    v_is_valid     CHAR(1);
    v_user_id      NUMBER;
    v_role         VARCHAR2(20);
    v_name         VARCHAR2(100);
    v_profile_id   NUMBER;
    v_message      VARCHAR2(500);
BEGIN
    DBMS_OUTPUT.PUT_LINE('--- 1.1 Testing Valid Faculty Login ---');
    pkg_auth.login(
        p_email        => 'alan.turing@cloudclass.edu',
        p_password     => 'Faculty@123',
        p_ip_address   => '192.168.1.50',
        p_user_agent   => 'Mozilla/5.0 (Windows NT 10.0)',
        o_is_valid     => v_is_valid,
        o_user_id      => v_user_id,
        o_role         => v_role,
        o_display_name => v_name,
        o_profile_id   => v_profile_id,
        o_message      => v_message
    );
    DBMS_OUTPUT.PUT_LINE('Status: ' || v_is_valid || ' | User ID: ' || v_user_id || ' | Role: ' || v_role || ' | Name: ' || v_name);
    DBMS_OUTPUT.PUT_LINE('Server Response: ' || v_message);

    DBMS_OUTPUT.PUT_LINE(CHR(10) || '--- 1.2 Testing Invalid Password (Attempt 1) ---');
    pkg_auth.login(
        p_email        => 'alan.turing@cloudclass.edu',
        p_password     => 'WrongPassword!',
        p_ip_address   => '192.168.1.50',
        p_user_agent   => 'Mozilla/5.0',
        o_is_valid     => v_is_valid,
        o_user_id      => v_user_id,
        o_role         => v_role,
        o_display_name => v_name,
        o_profile_id   => v_profile_id,
        o_message      => v_message
    );
    DBMS_OUTPUT.PUT_LINE('Server Response: ' || v_message);
END;
/

PROMPT ============================================================================
PROMPT TEST 2: TESTING ACCOUNT LOCKOUT & RECOVERY
PROMPT ============================================================================

DECLARE
    v_is_valid     CHAR(1);
    v_user_id      NUMBER;
    v_role         VARCHAR2(20);
    v_name         VARCHAR2(100);
    v_profile_id   NUMBER;
    v_message      VARCHAR2(500);
    v_test_uid     NUMBER;
BEGIN
    -- Look up Jane Smith's User ID
    SELECT user_id INTO v_test_uid FROM users WHERE email = 'jane.smith@cloudclass.edu';

    DBMS_OUTPUT.PUT_LINE('--- 2.1 Simulating 5 Consecutive Failed Logins for Jane Smith ---');
    FOR i IN 1..5 LOOP
        pkg_auth.login(
            p_email        => 'jane.smith@cloudclass.edu',
            p_password     => 'BadPassword' || i,
            p_ip_address   => '203.0.113.10',
            p_user_agent   => 'Unknown Client',
            o_is_valid     => v_is_valid,
            o_user_id      => v_user_id,
            o_role         => v_role,
            o_display_name => v_name,
            o_profile_id   => v_profile_id,
            o_message      => v_message
        );
        DBMS_OUTPUT.PUT_LINE('Attempt ' || i || ': ' || v_message);
    END LOOP;

    DBMS_OUTPUT.PUT_LINE(CHR(10) || '--- 2.2 Attempting Login on Locked Account ---');
    pkg_auth.login(
        p_email        => 'jane.smith@cloudclass.edu',
        p_password     => 'Student@123', -- Even with correct password!
        p_ip_address   => '203.0.113.10',
        o_is_valid     => v_is_valid,
        o_user_id      => v_user_id,
        o_role         => v_role,
        o_display_name => v_name,
        o_profile_id   => v_profile_id,
        o_message      => v_message
    );
    DBMS_OUTPUT.PUT_LINE('Login Status: ' || v_is_valid || ' | Message: ' || v_message);

    DBMS_OUTPUT.PUT_LINE(CHR(10) || '--- 2.3 Admin Unlocks Jane Smith Account ---');
    pkg_auth.unlock_account(v_test_uid, v_message);
    DBMS_OUTPUT.PUT_LINE(v_message);

    DBMS_OUTPUT.PUT_LINE(CHR(10) || '--- 2.4 Login Post-Unlock ---');
    pkg_auth.login(
        p_email        => 'jane.smith@cloudclass.edu',
        p_password     => 'Student@123',
        p_ip_address   => '203.0.113.10',
        o_is_valid     => v_is_valid,
        o_user_id      => v_user_id,
        o_role         => v_role,
        o_display_name => v_name,
        o_profile_id   => v_profile_id,
        o_message      => v_message
    );
    DBMS_OUTPUT.PUT_LINE('Login Status: ' || v_is_valid || ' | User: ' || v_name || ' | Role: ' || v_role);
END;
/

PROMPT ============================================================================
PROMPT TEST 3: TESTING GRADING CONSTRAINT TRIGGER (MARKS > MAX POINTS)
PROMPT ============================================================================

DECLARE
    v_sub_id      NUMBER;
    v_fac_id      NUMBER;
    v_status_msg  VARCHAR2(500);
BEGIN
    -- Find Dr. Alan Turing's faculty ID and Jane Smith's submission
    SELECT faculty_id INTO v_fac_id FROM faculty_profiles WHERE employee_code = 'FAC-CS-001';
    
    SELECT s.submission_id INTO v_sub_id
    FROM submissions s
    JOIN student_profiles sp ON s.student_id = sp.student_id
    WHERE sp.roll_number = '24CS102';

    DBMS_OUTPUT.PUT_LINE('--- 3.1 Attempting to award 150 points on a 100-point assignment ---');
    pkg_submission.grade_submission(
        p_submission_id  => v_sub_id,
        p_faculty_id     => v_fac_id,
        p_marks_obtained => 150.00,
        p_feedback       => 'Impossible score test',
        o_status_msg     => v_status_msg
    );
    DBMS_OUTPUT.PUT_LINE('Trigger validation result: ' || v_status_msg);

    DBMS_OUTPUT.PUT_LINE(CHR(10) || '--- 3.2 Awarding legitimate points (91.00 / 100.00) ---');
    pkg_submission.grade_submission(
        p_submission_id  => v_sub_id,
        p_faculty_id     => v_fac_id,
        p_marks_obtained => 91.00,
        p_feedback       => 'Well structured answers and clean normalized relational diagrams.',
        o_status_msg     => v_status_msg
    );
    DBMS_OUTPUT.PUT_LINE('Result: ' || v_status_msg);
END;
/

PROMPT ============================================================================
PROMPT TEST 4: QUERYING ANALYTIC REPORT VIEWS
PROMPT ============================================================================

PROMPT --- 4.1 Faculty Assignment Dashboard Summary ---
SELECT course_code,
       assignment_code,
       faculty_name,
       enrolled_students,
       total_submissions_received,
       graded_count,
       pending_grading_count,
       average_score
FROM   vw_faculty_assignment_dashboard;

PROMPT --- 4.2 Student Gradebook View ---
SELECT roll_number,
       student_name,
       course_code,
       assignment_code,
       submission_status,
       marks_obtained,
       max_points,
       percentage,
       letter_grade
FROM   vw_student_gradebook_portal;

PROMPT --- 4.3 Recent Security Log Entries ---
SELECT log_id,
       TO_CHAR(attempt_timestamp, 'YYYY-MM-DD HH24:MI:SS') AS log_time,
       attempted_email,
       login_status,
       failure_reason,
       ip_address
FROM   vw_login_security_audit
FETCH FIRST 6 ROWS ONLY;
