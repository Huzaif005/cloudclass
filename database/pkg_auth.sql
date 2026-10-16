-- ============================================================================
-- CLOUDCLASS DATABASE SYSTEM - AUTHENTICATION & USER MANAGEMENT PACKAGE
-- Oracle PL/SQL Compatible
-- ============================================================================
-- Description: Handles secure user registration, salted SHA-256 password hashing,
--              login authentication with brute-force lockout protection (5 attempts),
--              login activity audit logging, and password changes.
-- ============================================================================

CREATE OR REPLACE PACKAGE pkg_auth AS
    -- Maximum failed login attempts allowed before account lock
    C_MAX_FAILED_ATTEMPTS CONSTANT NUMBER := 5;

    -- Cryptographic helper
    FUNCTION hash_password(
        p_password IN VARCHAR2,
        p_salt     IN VARCHAR2
    ) RETURN VARCHAR2;

    -- Register a new student account and profile
    PROCEDURE register_student(
        p_username     IN VARCHAR2,
        p_email        IN VARCHAR2,
        p_password     IN VARCHAR2,
        p_full_name    IN VARCHAR2,
        p_roll_number  IN VARCHAR2,
        p_department   IN VARCHAR2,
        p_semester     IN NUMBER DEFAULT 1,
        p_batch_year   IN VARCHAR2,
        p_phone        IN VARCHAR2 DEFAULT NULL,
        o_user_id      OUT NUMBER,
        o_student_id   OUT NUMBER,
        o_status_msg   OUT VARCHAR2
    );

    -- Register a new faculty account and profile
    PROCEDURE register_faculty(
        p_username      IN VARCHAR2,
        p_email         IN VARCHAR2,
        p_password      IN VARCHAR2,
        p_full_name     IN VARCHAR2,
        p_employee_code IN VARCHAR2,
        p_department    IN VARCHAR2,
        p_designation   IN VARCHAR2 DEFAULT 'Assistant Professor',
        p_phone         IN VARCHAR2 DEFAULT NULL,
        p_office_room   IN VARCHAR2 DEFAULT NULL,
        o_user_id       OUT NUMBER,
        o_faculty_id    OUT NUMBER,
        o_status_msg    OUT VARCHAR2
    );

    -- Authenticate login credentials and log session
    PROCEDURE login(
        p_email        IN VARCHAR2,
        p_password     IN VARCHAR2,
        p_ip_address   IN VARCHAR2 DEFAULT '127.0.0.1',
        p_user_agent   IN VARCHAR2 DEFAULT 'Web Client',
        o_is_valid     OUT CHAR, -- 'Y' or 'N'
        o_user_id      OUT NUMBER,
        o_role         OUT VARCHAR2,
        o_display_name OUT VARCHAR2,
        o_profile_id   OUT NUMBER, -- student_id or faculty_id
        o_message      OUT VARCHAR2
    );

    -- Unlock account (Admin only)
    PROCEDURE unlock_account(
        p_user_id   IN NUMBER,
        o_message   OUT VARCHAR2
    );

    -- Change password
    PROCEDURE change_password(
        p_user_id      IN NUMBER,
        p_old_password IN VARCHAR2,
        p_new_password IN VARCHAR2,
        o_success      OUT CHAR,
        o_message      OUT VARCHAR2
    );
END pkg_auth;
/

CREATE OR REPLACE PACKAGE BODY pkg_auth AS

    -- ------------------------------------------------------------------------
    -- HASH_PASSWORD: Generates salted SHA-256 hash using Oracle STANDARD_HASH
    -- ------------------------------------------------------------------------
    FUNCTION hash_password(
        p_password IN VARCHAR2,
        p_salt     IN VARCHAR2
    ) RETURN VARCHAR2 IS
    BEGIN
        -- STANDARD_HASH is built-in to Oracle 12c+ and requires no special DBA grants
        RETURN LOWER(RAWTOHEX(STANDARD_HASH(p_salt || p_password || p_salt, 'SHA256')));
    END hash_password;

    -- ------------------------------------------------------------------------
    -- REGISTER_STUDENT
    -- ------------------------------------------------------------------------
    PROCEDURE register_student(
        p_username     IN VARCHAR2,
        p_email        IN VARCHAR2,
        p_password     IN VARCHAR2,
        p_full_name    IN VARCHAR2,
        p_roll_number  IN VARCHAR2,
        p_department   IN VARCHAR2,
        p_semester     IN NUMBER DEFAULT 1,
        p_batch_year   IN VARCHAR2,
        p_phone        IN VARCHAR2 DEFAULT NULL,
        o_user_id      OUT NUMBER,
        o_student_id   OUT NUMBER,
        o_status_msg   OUT VARCHAR2
    ) IS
        v_salt VARCHAR2(64);
        v_hash VARCHAR2(128);
    BEGIN
        -- Basic password length validation
        IF LENGTH(p_password) < 6 THEN
            o_status_msg := 'ERROR: Password must be at least 6 characters long.';
            RETURN;
        END IF;

        -- Generate unique cryptographic salt
        v_salt := LOWER(RAWTOHEX(SYS_GUID()));
        v_hash := hash_password(p_password, v_salt);

        -- Insert into USERS
        INSERT INTO users (
            username, email, password_hash, password_salt, role, status
        ) VALUES (
            LOWER(TRIM(p_username)), LOWER(TRIM(p_email)), v_hash, v_salt, 'STUDENT', 'ACTIVE'
        ) RETURNING user_id INTO o_user_id;

        -- Insert into STUDENT_PROFILES
        INSERT INTO student_profiles (
            user_id, roll_number, full_name, department, semester, batch_year, phone_number
        ) VALUES (
            o_user_id, UPPER(TRIM(p_roll_number)), TRIM(p_full_name), TRIM(p_department),
            p_semester, TRIM(p_batch_year), TRIM(p_phone)
        ) RETURNING student_id INTO o_student_id;

        COMMIT;
        o_status_msg := 'SUCCESS: Student registered successfully.';
    EXCEPTION
        WHEN DUP_VAL_ON_INDEX THEN
            ROLLBACK;
            o_status_msg := 'ERROR: Username, Email, or Roll Number already exists.';
        WHEN OTHERS THEN
            ROLLBACK;
            o_status_msg := 'ERROR: ' || SQLERRM;
    END register_student;

    -- ------------------------------------------------------------------------
    -- REGISTER_FACULTY
    -- ------------------------------------------------------------------------
    PROCEDURE register_faculty(
        p_username      IN VARCHAR2,
        p_email         IN VARCHAR2,
        p_password      IN VARCHAR2,
        p_full_name     IN VARCHAR2,
        p_employee_code IN VARCHAR2,
        p_department    IN VARCHAR2,
        p_designation   IN VARCHAR2 DEFAULT 'Assistant Professor',
        p_phone         IN VARCHAR2 DEFAULT NULL,
        p_office_room   IN VARCHAR2 DEFAULT NULL,
        o_user_id       OUT NUMBER,
        o_faculty_id    OUT NUMBER,
        o_status_msg    OUT VARCHAR2
    ) IS
        v_salt VARCHAR2(64);
        v_hash VARCHAR2(128);
    BEGIN
        IF LENGTH(p_password) < 6 THEN
            o_status_msg := 'ERROR: Password must be at least 6 characters long.';
            RETURN;
        END IF;

        v_salt := LOWER(RAWTOHEX(SYS_GUID()));
        v_hash := hash_password(p_password, v_salt);

        -- Insert into USERS
        INSERT INTO users (
            username, email, password_hash, password_salt, role, status
        ) VALUES (
            LOWER(TRIM(p_username)), LOWER(TRIM(p_email)), v_hash, v_salt, 'FACULTY', 'ACTIVE'
        ) RETURNING user_id INTO o_user_id;

        -- Insert into FACULTY_PROFILES
        INSERT INTO faculty_profiles (
            user_id, employee_code, full_name, department, designation, phone_number, office_room
        ) VALUES (
            o_user_id, UPPER(TRIM(p_employee_code)), TRIM(p_full_name), TRIM(p_department),
            TRIM(p_designation), TRIM(p_phone), TRIM(p_office_room)
        ) RETURNING faculty_id INTO o_faculty_id;

        COMMIT;
        o_status_msg := 'SUCCESS: Faculty member registered successfully.';
    EXCEPTION
        WHEN DUP_VAL_ON_INDEX THEN
            ROLLBACK;
            o_status_msg := 'ERROR: Username, Email, or Employee Code already exists.';
        WHEN OTHERS THEN
            ROLLBACK;
            o_status_msg := 'ERROR: ' || SQLERRM;
    END register_faculty;

    -- ------------------------------------------------------------------------
    -- LOGIN: Verifies credentials, records log, updates lockout state
    -- ------------------------------------------------------------------------
    PROCEDURE login(
        p_email        IN VARCHAR2,
        p_password     IN VARCHAR2,
        p_ip_address   IN VARCHAR2 DEFAULT '127.0.0.1',
        p_user_agent   IN VARCHAR2 DEFAULT 'Web Client',
        o_is_valid     OUT CHAR,
        o_user_id      OUT NUMBER,
        o_role         OUT VARCHAR2,
        o_display_name OUT VARCHAR2,
        o_profile_id   OUT NUMBER,
        o_message      OUT VARCHAR2
    ) IS
        v_user_id         users.user_id%TYPE;
        v_password_hash   users.password_hash%TYPE;
        v_password_salt   users.password_salt%TYPE;
        v_role            users.role%TYPE;
        v_status          users.status%TYPE;
        v_failed_attempts users.failed_attempts%TYPE;
        v_computed_hash   VARCHAR2(128);
    BEGIN
        o_is_valid     := 'N';
        o_user_id      := NULL;
        o_role         := NULL;
        o_display_name := NULL;
        o_profile_id   := NULL;

        -- 1. Find user by email
        BEGIN
            SELECT user_id, password_hash, password_salt, role, status, failed_attempts
            INTO   v_user_id, v_password_hash, v_password_salt, v_role, v_status, v_failed_attempts
            FROM   users
            WHERE  email = LOWER(TRIM(p_email));
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                -- Log failed attempt for unknown user
                INSERT INTO login_logs (attempted_email, ip_address, user_agent, login_status, failure_reason)
                VALUES (LOWER(TRIM(p_email)), p_ip_address, p_user_agent, 'FAILED', 'USER_NOT_FOUND');
                COMMIT;
                o_message := 'Invalid email or password.';
                RETURN;
        END;

        -- 2. Check if account is locked or suspended
        IF v_status = 'LOCKED' THEN
            INSERT INTO login_logs (user_id, attempted_email, ip_address, user_agent, login_status, failure_reason)
            VALUES (v_user_id, LOWER(TRIM(p_email)), p_ip_address, p_user_agent, 'LOCKED', 'ACCOUNT_LOCKED');
            COMMIT;
            o_message := 'Account is locked due to multiple failed login attempts. Please contact admin.';
            RETURN;
        ELSIF v_status = 'SUSPENDED' THEN
            INSERT INTO login_logs (user_id, attempted_email, ip_address, user_agent, login_status, failure_reason)
            VALUES (v_user_id, LOWER(TRIM(p_email)), p_ip_address, p_user_agent, 'FAILED', 'ACCOUNT_SUSPENDED');
            COMMIT;
            o_message := 'Account has been suspended. Please contact administrator.';
            RETURN;
        END IF;

        -- 3. Verify password hash
        v_computed_hash := hash_password(p_password, v_password_salt);

        IF v_computed_hash = v_password_hash THEN
            -- SUCCESSFUL LOGIN: Reset failed attempts, update last login timestamp
            UPDATE users
            SET    failed_attempts = 0,
                   last_login_at   = SYSTIMESTAMP
            WHERE  user_id = v_user_id;

            -- Log success
            INSERT INTO login_logs (user_id, attempted_email, ip_address, user_agent, login_status)
            VALUES (v_user_id, LOWER(TRIM(p_email)), p_ip_address, p_user_agent, 'SUCCESS');

            -- Fetch display name and profile ID
            IF v_role = 'STUDENT' THEN
                SELECT student_id, full_name INTO o_profile_id, o_display_name
                FROM   student_profiles WHERE user_id = v_user_id;
            ELSIF v_role = 'FACULTY' THEN
                SELECT faculty_id, full_name INTO o_profile_id, o_display_name
                FROM   faculty_profiles WHERE user_id = v_user_id;
            ELSE
                o_display_name := 'System Administrator';
                o_profile_id := v_user_id;
            END IF;

            o_is_valid := 'Y';
            o_user_id  := v_user_id;
            o_role     := v_role;
            o_message  := 'Login successful.';
            COMMIT;
        ELSE
            -- FAILED LOGIN: Increment failed attempts
            v_failed_attempts := v_failed_attempts + 1;

            IF v_failed_attempts >= C_MAX_FAILED_ATTEMPTS THEN
                -- Lock account
                UPDATE users
                SET    failed_attempts = v_failed_attempts,
                       status = 'LOCKED'
                WHERE  user_id = v_user_id;

                INSERT INTO login_logs (user_id, attempted_email, ip_address, user_agent, login_status, failure_reason)
                VALUES (v_user_id, LOWER(TRIM(p_email)), p_ip_address, p_user_agent, 'LOCKED', 'MAX_ATTEMPTS_EXCEEDED');
                o_message := 'Invalid credentials. Account has now been LOCKED due to ' || C_MAX_FAILED_ATTEMPTS || ' failed attempts.';
            ELSE
                UPDATE users
                SET    failed_attempts = v_failed_attempts
                WHERE  user_id = v_user_id;

                INSERT INTO login_logs (user_id, attempted_email, ip_address, user_agent, login_status, failure_reason)
                VALUES (v_user_id, LOWER(TRIM(p_email)), p_ip_address, p_user_agent, 'FAILED', 'INCORRECT_PASSWORD');
                o_message := 'Invalid email or password. Attempt ' || v_failed_attempts || ' of ' || C_MAX_FAILED_ATTEMPTS || '.';
            END IF;
            COMMIT;
        END IF;
    END login;

    -- ------------------------------------------------------------------------
    -- UNLOCK_ACCOUNT
    -- ------------------------------------------------------------------------
    PROCEDURE unlock_account(
        p_user_id IN NUMBER,
        o_message OUT VARCHAR2
    ) IS
    BEGIN
        UPDATE users
        SET    status = 'ACTIVE',
               failed_attempts = 0
        WHERE  user_id = p_user_id;

        IF SQL%ROWCOUNT > 0 THEN
            COMMIT;
            o_message := 'SUCCESS: User account unlocked.';
        ELSE
            o_message := 'ERROR: User not found.';
        END IF;
    END unlock_account;

    -- ------------------------------------------------------------------------
    -- CHANGE_PASSWORD
    -- ------------------------------------------------------------------------
    PROCEDURE change_password(
        p_user_id      IN NUMBER,
        p_old_password IN VARCHAR2,
        p_new_password IN VARCHAR2,
        o_success      OUT CHAR,
        o_message      OUT VARCHAR2
    ) IS
        v_current_hash users.password_hash%TYPE;
        v_current_salt users.password_salt%TYPE;
        v_new_salt     VARCHAR2(64);
        v_new_hash     VARCHAR2(128);
    BEGIN
        o_success := 'N';

        IF LENGTH(p_new_password) < 6 THEN
            o_message := 'ERROR: New password must be at least 6 characters.';
            RETURN;
        END IF;

        SELECT password_hash, password_salt
        INTO   v_current_hash, v_current_salt
        FROM   users
        WHERE  user_id = p_user_id;

        IF hash_password(p_old_password, v_current_salt) != v_current_hash THEN
            o_message := 'ERROR: Existing password does not match.';
            RETURN;
        END IF;

        v_new_salt := LOWER(RAWTOHEX(SYS_GUID()));
        v_new_hash := hash_password(p_new_password, v_new_salt);

        UPDATE users
        SET    password_hash = v_new_hash,
               password_salt = v_new_salt,
               last_password_change = SYSTIMESTAMP
        WHERE  user_id = p_user_id;

        COMMIT;
        o_success := 'Y';
        o_message := 'SUCCESS: Password updated successfully.';
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            o_message := 'ERROR: User ID not found.';
        WHEN OTHERS THEN
            ROLLBACK;
            o_message := 'ERROR: ' || SQLERRM;
    END change_password;

END pkg_auth;
/

PROMPT Package PKG_AUTH compiled successfully.
