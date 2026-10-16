/**
 * ============================================================================
 * CLOUDCLASS - DATABASE SERVICE & DATA REPOSITORY
 * ============================================================================
 * Aligned with the Oracle PL/SQL schema (database/schema.sql).
 * Provides atomic persistence, user authentication records, account lockouts,
 * courses, assignments, submissions, and audit logging.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const DB_PATH = path.join(__dirname, '..', '..', 'data_store.json');

// Default initial state conforming to the Oracle PL/SQL seed data
const initialSeed = {
  users: [
    {
      id: 1001,
      email: 'admin@cloudclass.edu',
      username: 'admin',
      passwordHash: bcrypt.hashSync('Admin@123', 8),
      role: 'admin',
      displayName: 'System Administrator',
      status: 'ACTIVE',
      failedAttempts: 0
    },
    {
      id: 1002,
      email: 'alan.turing@cloudclass.edu',
      username: 'alanturing',
      employeeCode: 'FAC-101',
      passwordHash: bcrypt.hashSync('faculty123', 8),
      role: 'faculty',
      displayName: 'Prof. Alan Turing (FAC-101)',
      status: 'ACTIVE',
      failedAttempts: 0
    },
    {
      id: 1003,
      email: 'student_102938@cloudclass.edu',
      username: '102938',
      studentId: '102938',
      passwordHash: bcrypt.hashSync('student123', 8),
      role: 'student',
      displayName: 'Huzaif Patel (ID: 102938)',
      status: 'ACTIVE',
      failedAttempts: 0
    }
  ],
  assignments: [
    {
      id: 'asg-1',
      title: 'Cloud Service Models & AWS Architecture',
      subject: 'Cloud Computing',
      code: 'CC-204',
      due: '15 Oct, 11:59 PM',
      deadline: '2026-10-15T23:59:00Z',
      date: '2026-10-15',
      status: 'pending',
      icon: '☁',
      tone: 'purple',
      type: 'PDF / DOCX',
      points: '10 marks',
      maxPoints: 10,
      instructions: 'Analyze IaaS vs PaaS vs Serverless on AWS. Design a multi-AZ VPC architecture with public and private subnets.',
      createdByName: 'Prof. Alan Turing'
    },
    {
      id: 'asg-2',
      title: 'Relational Normalization & SQL Queries',
      subject: 'Database Systems',
      code: 'DBMS-202',
      due: '16 Oct, 5:00 PM',
      deadline: '2026-10-16T17:00:00Z',
      date: '2026-10-16',
      status: 'pending',
      icon: '▤',
      tone: 'orange',
      type: 'PDF',
      points: '15 marks',
      maxPoints: 15,
      instructions: 'Normalize the given schema up to BCNF and write PL/SQL packages for transaction processing.',
      createdByName: 'Prof. Alan Turing'
    },
    {
      id: 'asg-3',
      title: 'Graph Traversal: BFS and DFS Algorithms',
      subject: 'Data Structures',
      code: 'DS-201',
      due: '17 Oct, 11:59 PM',
      deadline: '2026-10-17T23:59:00Z',
      date: '2026-10-17',
      status: 'submitted',
      icon: '⌘',
      tone: 'teal',
      type: 'PDF / DOCX',
      points: '10 marks',
      maxPoints: 10,
      instructions: 'Implement BFS and DFS using adjacency list representations with cycle detection.',
      createdByName: 'Prof. Alan Turing'
    }
  ],
  submissions: [],
  loginAuditLogs: []
};

class DatabaseService {
  constructor() {
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      logger.error('Error loading data_store.json, creating new database instance:', { error: err.message });
    }
    this.persist(initialSeed);
    return JSON.parse(JSON.stringify(initialSeed));
  }

  persist(dataToSave = this.data) {
    try {
      // Atomic write using a temp file to prevent corruption
      const tempPath = `${DB_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf8');
      fs.renameSync(tempPath, DB_PATH);
    } catch (err) {
      logger.error('Failed to write database persistence file:', { error: err.message });
    }
  }

  // --- USER & AUTHENTICATION METHODS ---
  findUserByIdentifier(identifier) {
    const clean = String(identifier).trim().toLowerCase();
    return this.data.users.find(u =>
      (u.studentId && u.studentId.toLowerCase() === clean) ||
      (u.employeeCode && u.employeeCode.toLowerCase() === clean) ||
      (u.email && u.email.toLowerCase() === clean) ||
      (u.username && u.username.toLowerCase() === clean)
    );
  }

  findUserById(id) {
    return this.data.users.find(u => u.id === Number(id));
  }

  createUser(userData) {
    const newUser = {
      id: Date.now(),
      status: 'ACTIVE',
      failedAttempts: 0,
      createdAt: new Date().toISOString(),
      ...userData
    };
    this.data.users.push(newUser);
    this.persist();
    return newUser;
  }

  updateUser(id, updates) {
    const idx = this.data.users.findIndex(u => u.id === Number(id));
    if (idx >= 0) {
      this.data.users[idx] = { ...this.data.users[idx], ...updates, updatedAt: new Date().toISOString() };
      this.persist();
      return this.data.users[idx];
    }
    return null;
  }

  recordLoginAttempt({ userId, identifier, status, reason, ip }) {
    const log = {
      id: Date.now(),
      userId,
      identifier,
      status, // 'SUCCESS', 'FAILED', 'LOCKED'
      reason,
      ip: ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    };
    this.data.loginAuditLogs.unshift(log);
    if (this.data.loginAuditLogs.length > 500) {
      this.data.loginAuditLogs.pop(); // Cap log size
    }
    this.persist();
  }

  // --- ASSIGNMENT METHODS ---
  getAssignments() {
    return this.data.assignments;
  }

  findAssignmentById(id) {
    return this.data.assignments.find(a => String(a.id) === String(id));
  }

  createAssignment(assignment) {
    this.data.assignments.unshift(assignment);
    this.persist();
    return assignment;
  }

  updateAssignment(id, updates) {
    const idx = this.data.assignments.findIndex(a => String(a.id) === String(id));
    if (idx >= 0) {
      this.data.assignments[idx] = { ...this.data.assignments[idx], ...updates };
      this.persist();
      return this.data.assignments[idx];
    }
    return null;
  }

  // --- SUBMISSION METHODS ---
  getSubmissions(filterFn) {
    if (filterFn) {
      return this.data.submissions.filter(filterFn);
    }
    return this.data.submissions;
  }

  findSubmissionById(id) {
    return this.data.submissions.find(s => String(s.id) === String(id));
  }

  saveSubmission(submission) {
    const existingIdx = this.data.submissions.findIndex(s =>
      String(s.assignmentId) === String(submission.assignmentId) &&
      (s.studentId === submission.studentId || (submission.userId && s.userId === submission.userId))
    );

    if (existingIdx >= 0) {
      this.data.submissions[existingIdx] = submission;
    } else {
      this.data.submissions.unshift(submission);
    }
    this.persist();
    return submission;
  }
}

module.exports = new DatabaseService();
