-- ============================================================================
-- CLOUDCLASS DATABASE SYSTEM - MASTER INSTALLATION SCRIPT
-- Oracle PL/SQL Compatible (Oracle 11g/12c/18c/19c/21c/23c & APEX/LiveSQL)
-- ============================================================================
-- Instructions: Run this script to deploy the full CloudClass database schema,
-- triggers, packages, views, and sample seed data in the proper dependency order.
-- ============================================================================

SET FEEDBACK ON;
SET ECHO OFF;
SET SERVEROUTPUT ON SIZE UNLIMITED;

PROMPT ============================================================================
PROMPT STEP 1: Deploying Schema Tables, Sequences, and Indexes...
PROMPT ============================================================================
@@schema.sql

PROMPT ============================================================================
PROMPT STEP 2: Compiling Business Logic Triggers...
PROMPT ============================================================================
@@triggers.sql

PROMPT ============================================================================
PROMPT STEP 3: Compiling Authentication & Security Package (PKG_AUTH)...
PROMPT ============================================================================
@@pkg_auth.sql

PROMPT ============================================================================
PROMPT STEP 4: Compiling Assignment Management Package (PKG_ASSIGNMENT)...
PROMPT ============================================================================
@@pkg_assignment.sql

PROMPT ============================================================================
PROMPT STEP 5: Compiling Submission & Grading Package (PKG_SUBMISSION)...
PROMPT ============================================================================
@@pkg_submission.sql

PROMPT ============================================================================
PROMPT STEP 6: Compiling Reporting & Analytics Views...
PROMPT ============================================================================
@@views.sql

PROMPT ============================================================================
PROMPT STEP 7: Populating Seed Data & Initial Accounts...
PROMPT ============================================================================
@@seed_data.sql

PROMPT ============================================================================
PROMPT CloudClass PL/SQL Database Installation Complete!
PROMPT Run @@test_execution.sql to verify functionality.
PROMPT ============================================================================
