-- ============================================================================
-- CLOUDCLASS DATABASE SYSTEM - SAMPLE SEED DATA
-- Oracle PL/SQL Compatible
-- ============================================================================
-- Description: Populates initial sample records:
--              - 1 Admin User
--              - 2 Faculty Members (Dr. Alan Turing, Dr. Grace Hopper)
--              - 3 Students (John Doe, Jane Smith, Alex Patel)
--              - 3 Courses (DBMS, Operating Systems, Cloud Computing)
--              - Course Enrollments
--              - Faculty Assignments
--              - Student Submissions (on-time, late, graded, pending)
-- ============================================================================

SET SERVEROUTPUT ON;

DECLARE
    v_admin_uid     NUMBER;
    v_fac1_uid      NUMBER;
    v_fac1_id       NUMBER;
    v_fac2_uid      NUMBER;
    v_fac2_id       NUMBER;
    
    v_stud1_uid     NUMBER;
    v_stud1_id      NUMBER;
    v_stud2_uid     NUMBER;
    v_stud2_id      NUMBER;
    v_stud3_uid     NUMBER;
    v_stud3_id      NUMBER;
    
    v_course1_id    NUMBER;
    v_course2_id    NUMBER;
    v_course3_id    NUMBER;
    
    v_asg1_id       NUMBER;
    v_asg2_id       NUMBER;
    v_asg3_id       NUMBER;
    
    v_sub1_id       NUMBER;
    v_sub2_id       NUMBER;
    v_sub3_id       NUMBER;
    
    v_sub_status    VARCHAR2(25);
    v_msg           VARCHAR2(500);
    v_salt          VARCHAR2(64);
BEGIN
    DBMS_OUTPUT.PUT_LINE('--- Seeding CloudClass Database ---');

    -- 1. Create System Administrator
    v_salt := LOWER(RAWTOHEX(SYS_GUID()));
    INSERT INTO users (
        username, email, password_hash, password_salt, role, status
    ) VALUES (
        'admin', 'admin@cloudclass.edu',
        pkg_auth.hash_password('Admin@123', v_salt),
        v_salt, 'ADMIN', 'ACTIVE'
    ) RETURNING user_id INTO v_admin_uid;
    DBMS_OUTPUT.PUT_LINE('Admin created with User ID: ' || v_admin_uid);

    -- 2. Register Faculty 1: Dr. Alan Turing
    pkg_auth.register_faculty(
        p_username      => 'alanturing',
        p_email         => 'alan.turing@cloudclass.edu',
        p_password      => 'Faculty@123',
        p_full_name     => 'Dr. Alan Turing',
        p_employee_code => 'FAC-CS-001',
        p_department    => 'Computer Science & Engineering',
        p_designation   => 'Professor & HOD',
        p_phone         => '+1-555-0101',
        p_office_room   => 'CS-Building 301',
        o_user_id       => v_fac1_uid,
        o_faculty_id    => v_fac1_id,
        o_status_msg    => v_msg
    );
    DBMS_OUTPUT.PUT_LINE(v_msg || ' (Faculty ID: ' || v_fac1_id || ')');

    -- 3. Register Faculty 2: Dr. Grace Hopper
    pkg_auth.register_faculty(
        p_username      => 'gracehopper',
        p_email         => 'grace.hopper@cloudclass.edu',
        p_password      => 'Faculty@123',
        p_full_name     => 'Dr. Grace Hopper',
        p_employee_code => 'FAC-IT-002',
        p_department    => 'Information Technology',
        p_designation   => 'Associate Professor',
        p_phone         => '+1-555-0102',
        p_office_room   => 'IT-Tower 204',
        o_user_id       => v_fac2_uid,
        o_faculty_id    => v_fac2_id,
        o_status_msg    => v_msg
    );
    DBMS_OUTPUT.PUT_LINE(v_msg || ' (Faculty ID: ' || v_fac2_id || ')');

    -- 4. Register Students
    -- Student 1: John Doe
    pkg_auth.register_student(
        p_username     => 'johndoe',
        p_email        => 'john.doe@cloudclass.edu',
        p_password     => 'Student@123',
        p_full_name    => 'John Doe',
        p_roll_number  => '24CS101',
        p_department   => 'Computer Science & Engineering',
        p_semester     => 4,
        p_batch_year   => '2024-2028',
        p_phone        => '+1-555-0201',
        o_user_id      => v_stud1_uid,
        o_student_id   => v_stud1_id,
        o_status_msg   => v_msg
    );
    DBMS_OUTPUT.PUT_LINE(v_msg || ' (Student 1 ID: ' || v_stud1_id || ')');

    -- Student 2: Jane Smith
    pkg_auth.register_student(
        p_username     => 'janesmith',
        p_email        => 'jane.smith@cloudclass.edu',
        p_password     => 'Student@123',
        p_full_name    => 'Jane Smith',
        p_roll_number  => '24CS102',
        p_department   => 'Computer Science & Engineering',
        p_semester     => 4,
        p_batch_year   => '2024-2028',
        p_phone        => '+1-555-0202',
        o_user_id      => v_stud2_uid,
        o_student_id   => v_stud2_id,
        o_status_msg   => v_msg
    );
    DBMS_OUTPUT.PUT_LINE(v_msg || ' (Student 2 ID: ' || v_stud2_id || ')');

    -- Student 3: Alex Patel
    pkg_auth.register_student(
        p_username     => 'alexpatel',
        p_email        => 'alex.patel@cloudclass.edu',
        p_password     => 'Student@123',
        p_full_name    => 'Alex Patel',
        p_roll_number  => '24IT201',
        p_department   => 'Information Technology',
        p_semester     => 4,
        p_batch_year   => '2024-2028',
        p_phone        => '+1-555-0203',
        o_user_id      => v_stud3_uid,
        o_student_id   => v_stud3_id,
        o_status_msg   => v_msg
    );
    DBMS_OUTPUT.PUT_LINE(v_msg || ' (Student 3 ID: ' || v_stud3_id || ')');

    -- 5. Create Courses
    INSERT INTO courses (
        course_code, course_name, department, credits, faculty_id, semester, academic_year
    ) VALUES (
        'CS301', 'Database Management Systems & PL/SQL', 'Computer Science & Engineering',
        4, v_fac1_id, 4, '2025-2026'
    ) RETURNING course_id INTO v_course1_id;

    INSERT INTO courses (
        course_code, course_name, department, credits, faculty_id, semester, academic_year
    ) VALUES (
        'CS302', 'Operating Systems & Concurrency', 'Computer Science & Engineering',
        4, v_fac1_id, 4, '2025-2026'
    ) RETURNING course_id INTO v_course2_id;

    INSERT INTO courses (
        course_code, course_name, department, credits, faculty_id, semester, academic_year
    ) VALUES (
        'IT305', 'Cloud Infrastructure & Distributed Systems', 'Information Technology',
        3, v_fac2_id, 4, '2025-2026'
    ) RETURNING course_id INTO v_course3_id;

    DBMS_OUTPUT.PUT_LINE('Courses created: CS301, CS302, IT305');

    -- 6. Enroll Students in Courses
    pkg_assignment.enroll_student(v_course1_id, v_stud1_id, v_msg); -- John -> CS301
    pkg_assignment.enroll_student(v_course2_id, v_stud1_id, v_msg); -- John -> CS302
    pkg_assignment.enroll_student(v_course1_id, v_stud2_id, v_msg); -- Jane -> CS301
    pkg_assignment.enroll_student(v_course3_id, v_stud2_id, v_msg); -- Jane -> IT305
    pkg_assignment.enroll_student(v_course3_id, v_stud3_id, v_msg); -- Alex -> IT305
    DBMS_OUTPUT.PUT_LINE('Course enrollments registered.');

    -- 7. Create Assignments Given by Faculty
    -- Assignment 1 (Dr. Alan Turing - CS301)
    pkg_assignment.create_assignment(
        p_course_id          => v_course1_id,
        p_faculty_id         => v_fac1_id,
        p_title              => 'Assignment 1: Relational Schema & 3NF/BCNF Normalization',
        p_instructions       => 'Analyze the hospital management system case study. Formulate the relational schema, identify functional dependencies, and normalize tables up to BCNF with step-by-step proofs.',
        p_max_points         => 100.00,
        p_deadline           => SYSTIMESTAMP + INTERVAL '7' DAY,
        p_assignment_code    => 'DBMS-ASG-01',
        p_allowed_file_types => '.pdf,.zip',
        p_max_file_size_mb   => 15,
        o_assignment_id      => v_asg1_id,
        o_status_msg         => v_msg
    );
    DBMS_OUTPUT.PUT_LINE('Created Assignment 1: ' || v_asg1_id);

    -- Assignment 2 (Dr. Alan Turing - CS301)
    pkg_assignment.create_assignment(
        p_course_id          => v_course1_id,
        p_faculty_id         => v_fac1_id,
        p_title              => 'Assignment 2: PL/SQL Packages, Cursors & Compound Triggers',
        p_instructions       => 'Implement an automated banking audit subsystem using Oracle PL/SQL. Include package specifications, autonomous transactions for audit logging, and bulk collection with FORALL.',
        p_max_points         => 50.00,
        p_deadline           => SYSTIMESTAMP + INTERVAL '14' DAY,
        p_assignment_code    => 'DBMS-ASG-02',
        p_allowed_file_types => '.sql,.pdf,.zip',
        p_max_file_size_mb   => 10,
        o_assignment_id      => v_asg2_id,
        o_status_msg         => v_msg
    );
    DBMS_OUTPUT.PUT_LINE('Created Assignment 2: ' || v_asg2_id);

    -- Assignment 3 (Dr. Grace Hopper - IT305)
    pkg_assignment.create_assignment(
        p_course_id          => v_course3_id,
        p_faculty_id         => v_fac2_id,
        p_title              => 'Lab 1: Docker Containerization & Kubernetes Deployment',
        p_instructions       => 'Build Docker multi-stage images for a React+Node service. Write Kubernetes deployment manifests, service definitions, and test ingress routing locally with Minikube.',
        p_max_points         => 100.00,
        p_deadline           => SYSTIMESTAMP + INTERVAL '5' DAY,
        p_assignment_code    => 'CLOUD-LAB-01',
        p_allowed_file_types => '.pdf,.zip,.yaml',
        p_max_file_size_mb   => 20,
        o_assignment_id      => v_asg3_id,
        o_status_msg         => v_msg
    );
    DBMS_OUTPUT.PUT_LINE('Created Assignment 3: ' || v_asg3_id);

    -- 8. Submissions
    -- John Doe submits Assignment 1 (On Time)
    pkg_submission.submit_assignment(
        p_assignment_id     => v_asg1_id,
        p_student_id        => v_stud1_id,
        p_file_name         => 'JohnDoe_24CS101_DBMS_ASG1.pdf',
        p_storage_path      => 'submissions/' || v_stud1_uid || '/JohnDoe_24CS101_DBMS_ASG1.pdf',
        p_file_size_kb      => 2450,
        p_student_note      => 'Submitted with complete dependency matrix and schema diagrams.',
        o_submission_id     => v_sub1_id,
        o_submission_status => v_sub_status,
        o_status_msg        => v_msg
    );
    DBMS_OUTPUT.PUT_LINE('Student 1 Submission: ' || v_sub_status || ' (ID: ' || v_sub1_id || ')');

    -- Faculty Grades John Doe's submission
    pkg_submission.grade_submission(
        p_submission_id  => v_sub1_id,
        p_faculty_id     => v_fac1_id,
        p_marks_obtained => 96.50,
        p_feedback       => 'Outstanding work. Lossless decomposition proof is mathematically rigorous and schemas are in 3NF.',
        o_status_msg     => v_msg
    );
    DBMS_OUTPUT.PUT_LINE('Grading John: ' || v_msg);

    -- Jane Smith submits Assignment 1 (On Time, Pending Grading)
    pkg_submission.submit_assignment(
        p_assignment_id     => v_asg1_id,
        p_student_id        => v_stud2_id,
        p_file_name         => 'JaneSmith_24CS102_DBMS_ASG1.pdf',
        p_storage_path      => 'submissions/' || v_stud2_uid || '/JaneSmith_24CS102_DBMS_ASG1.pdf',
        p_file_size_kb      => 1890,
        p_student_note      => 'Included ER diagram in Appendix A.',
        o_submission_id     => v_sub2_id,
        o_submission_status => v_sub_status,
        o_status_msg        => v_msg
    );
    DBMS_OUTPUT.PUT_LINE('Student 2 Submission: ' || v_sub_status || ' (ID: ' || v_sub2_id || ')');

    -- Alex Patel submits Assignment 3 (IT305)
    pkg_submission.submit_assignment(
        p_assignment_id     => v_asg3_id,
        p_student_id        => v_stud3_id,
        p_file_name         => 'AlexPatel_24IT201_CloudLab1.zip',
        p_storage_path      => 'submissions/' || v_stud3_uid || '/AlexPatel_24IT201_CloudLab1.zip',
        p_file_size_kb      => 5420,
        p_student_note      => 'Dockerfiles and k8s YAML manifests tested.',
        o_submission_id     => v_sub3_id,
        o_submission_status => v_sub_status,
        o_status_msg        => v_msg
    );
    DBMS_OUTPUT.PUT_LINE('Student 3 Submission: ' || v_sub_status || ' (ID: ' || v_sub3_id || ')');

    -- Faculty Grades Alex Patel's submission
    pkg_submission.grade_submission(
        p_submission_id  => v_sub3_id,
        p_faculty_id     => v_fac2_id,
        p_marks_obtained => 88.00,
        p_feedback       => 'Good Kubernetes deployment manifests. Suggest adding liveness and readiness probes.',
        o_status_msg     => v_msg
    );
    DBMS_OUTPUT.PUT_LINE('Grading Alex: ' || v_msg);

    COMMIT;
    DBMS_OUTPUT.PUT_LINE('--- Seeding Completed Successfully! ---');
END;
/
