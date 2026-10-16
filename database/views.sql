-- ============================================================================
-- CLOUDCLASS DATABASE SYSTEM - REPORTING & ANALYTIC VIEWS
-- Oracle PL/SQL Compatible
-- ============================================================================
-- Description: Ready-to-query relational views for Faculty Dashboards,
--              Student Gradebooks, Pending Submissions Alerts, and Security Audits.
-- ============================================================================

-- ============================================================================
-- 1. VIEW: Faculty Assignment Analytics Dashboard
-- Shows assignment performance metrics: enrolled count, submission count,
-- graded count, pending review count, and score stats (Avg, Min, Max).
-- ============================================================================
CREATE OR REPLACE VIEW vw_faculty_assignment_dashboard AS
SELECT a.assignment_id,
       a.assignment_code,
       a.title AS assignment_title,
       c.course_code,
       c.course_name,
       fp.faculty_id,
       fp.full_name AS faculty_name,
       a.max_points,
       a.deadline,
       a.status AS assignment_status,
       (SELECT COUNT(*) 
        FROM course_enrollments ce 
        WHERE ce.course_id = a.course_id AND ce.status = 'ENROLLED') AS enrolled_students,
       COUNT(s.submission_id) AS total_submissions_received,
       SUM(CASE WHEN s.status = 'GRADED' THEN 1 ELSE 0 END) AS graded_count,
       SUM(CASE WHEN s.status IN ('SUBMITTED', 'LATE', 'RESUBMITTED') THEN 1 ELSE 0 END) AS pending_grading_count,
       SUM(CASE WHEN s.status = 'LATE' THEN 1 ELSE 0 END) AS late_submissions_count,
       ROUND(AVG(s.marks_obtained), 2) AS average_score,
       MIN(s.marks_obtained) AS lowest_score,
       MAX(s.marks_obtained) AS highest_score
FROM   assignments a
JOIN   courses c ON a.course_id = c.course_id
JOIN   faculty_profiles fp ON a.faculty_id = fp.faculty_id
LEFT JOIN submissions s ON a.assignment_id = s.assignment_id
GROUP  BY a.assignment_id, a.assignment_code, a.title, c.course_code, c.course_name,
          fp.faculty_id, fp.full_name, a.max_points, a.deadline, a.status;

-- ============================================================================
-- 2. VIEW: Student Gradebook and Submission Status Portal
-- Consolidated view for student assignment tracking, deadlines, and grades.
-- ============================================================================
CREATE OR REPLACE VIEW vw_student_gradebook_portal AS
SELECT sp.student_id,
       sp.roll_number,
       sp.full_name AS student_name,
       u.email AS student_email,
       c.course_code,
       c.course_name,
       fp.full_name AS faculty_name,
       a.assignment_id,
       a.assignment_code,
       a.title AS assignment_title,
       a.deadline,
       a.max_points,
       NVL(s.status, 'NOT_SUBMITTED') AS submission_status,
       s.submitted_at,
       s.file_name,
       s.marks_obtained,
       CASE 
           WHEN s.marks_obtained IS NOT NULL THEN
               ROUND((s.marks_obtained / a.max_points) * 100, 2)
           ELSE NULL 
       END AS percentage,
       CASE 
           WHEN s.marks_obtained IS NULL THEN 'Pending'
           WHEN (s.marks_obtained / a.max_points) >= 0.90 THEN 'A+'
           WHEN (s.marks_obtained / a.max_points) >= 0.80 THEN 'A'
           WHEN (s.marks_obtained / a.max_points) >= 0.70 THEN 'B'
           WHEN (s.marks_obtained / a.max_points) >= 0.60 THEN 'C'
           WHEN (s.marks_obtained / a.max_points) >= 0.50 THEN 'D'
           ELSE 'F'
       END AS letter_grade,
       s.faculty_feedback
FROM   student_profiles sp
JOIN   users u ON sp.user_id = u.user_id
JOIN   course_enrollments ce ON sp.student_id = ce.student_id AND ce.status = 'ENROLLED'
JOIN   courses c ON ce.course_id = c.course_id
JOIN   assignments a ON c.course_id = a.course_id AND a.status = 'PUBLISHED'
JOIN   faculty_profiles fp ON a.faculty_id = fp.faculty_id
LEFT JOIN submissions s ON a.assignment_id = s.assignment_id AND sp.student_id = s.student_id;

-- ============================================================================
-- 3. VIEW: Pending Grading Alert Queue
-- Actionable list for faculty of submissions that are turned in and waiting for marks.
-- ============================================================================
CREATE OR REPLACE VIEW vw_pending_submissions_alert AS
SELECT s.submission_id,
       a.assignment_id,
       a.assignment_code,
       a.title AS assignment_title,
       c.course_code,
       c.course_name,
       fp.faculty_id,
       fp.full_name AS faculty_name,
       sp.roll_number,
       sp.full_name AS student_name,
       s.submitted_at,
       s.status AS submission_status,
       s.file_name,
       s.storage_path,
       s.student_note,
       ROUND( (SYSDATE - CAST(s.submitted_at AS DATE)) * 24, 1 ) AS hours_pending
FROM   submissions s
JOIN   assignments a ON s.assignment_id = a.assignment_id
JOIN   courses c ON a.course_id = c.course_id
JOIN   faculty_profiles fp ON a.faculty_id = fp.faculty_id
JOIN   student_profiles sp ON s.student_id = sp.student_id
WHERE  s.status IN ('SUBMITTED', 'LATE', 'RESUBMITTED')
ORDER  BY s.submitted_at ASC;

-- ============================================================================
-- 4. VIEW: Security & Login Activity Audit Trail
-- Tracks failed authentications, locked accounts, and unauthorized access attempts.
-- ============================================================================
CREATE OR REPLACE VIEW vw_login_security_audit AS
SELECT l.log_id,
       l.attempt_timestamp,
       l.attempted_email,
       l.login_status,
       l.failure_reason,
       l.ip_address,
       l.user_agent,
       u.user_id,
       u.username,
       u.role,
       u.status AS current_account_status,
       u.failed_attempts
FROM   login_logs l
LEFT JOIN users u ON l.user_id = u.user_id OR LOWER(l.attempted_email) = u.email
ORDER  BY l.attempt_timestamp DESC;

PROMPT Database views created successfully.
