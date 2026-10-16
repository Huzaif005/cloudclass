/**
 * ============================================================================
 * CLOUDCLASS - ASSIGNMENT CONTROLLER
 * ============================================================================
 * Handles assignment creation by faculty, retrieval with status computation,
 * and updates.
 * ============================================================================
 */

const db = require('../services/dbService');
const logger = require('../utils/logger');

const assignmentController = {
  /**
   * Get all assignments with computed metrics and user-specific status
   */
  async getAll(req, res, next) {
    try {
      const user = req.user;
      const assignments = db.getAssignments();
      const submissions = db.getSubmissions();

      const result = assignments.map(a => {
        const subList = submissions.filter(s => String(s.assignmentId) === String(a.id));
        let status = 'pending';

        if (user && (user.role === 'faculty' || user.role === 'admin')) {
          status = subList.length > 0 ? 'submitted' : 'pending';
        } else if (user && user.role === 'student') {
          const mySub = subList.find(s => s.studentId === user.studentId || (user.userId && s.userId === user.userId));
          status = mySub ? mySub.status : 'pending';
        }

        return {
          ...a,
          status: a.status || status,
          submissionCount: subList.length
        };
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Get a single assignment by ID
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const assignment = db.findAssignmentById(id);

      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found.' });
      }

      res.json(assignment);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Create an assignment (Faculty only)
   */
  async create(req, res, next) {
    try {
      const user = req.user;
      const { title, subject, instructions, deadline, code, points } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Assignment title is required.' });
      }

      if (!deadline) {
        return res.status(400).json({ error: 'Assignment deadline is required.' });
      }

      const dateObj = new Date(deadline);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid deadline date format.' });
      }

      const newAssignment = {
        id: 'asg-' + Date.now(),
        title: title.trim(),
        subject: subject || 'General',
        code: code || (subject ? subject.slice(0, 2).toUpperCase() : 'CC') + '-' + Math.floor(100 + Math.random() * 900),
        due: dateObj.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
        deadline: dateObj.toISOString(),
        date: dateObj.toISOString().slice(0, 10),
        status: 'pending',
        icon: ({ 'Cloud Computing': '☁', 'Database Systems': '▤', 'Data Structures': '⌘', 'Artificial Intelligence': '✳', 'Data Science': '⌁' })[subject] || '▤',
        tone: ({ 'Cloud Computing': 'purple', 'Database Systems': 'orange', 'Data Structures': 'teal', 'Artificial Intelligence': 'blue', 'Data Science': 'pink' })[subject] || 'purple',
        type: 'PDF / DOCX',
        points: points || '10 marks',
        maxPoints: parseInt(points, 10) || 10,
        instructions: instructions ? instructions.trim() : '',
        createdByName: user ? user.displayName : 'Faculty Instructor',
        createdAt: new Date().toISOString()
      };

      db.createAssignment(newAssignment);
      logger.info(`Assignment created: "${newAssignment.title}" by ${newAssignment.createdByName}`);

      res.status(201).json({
        message: 'Assignment published successfully to AWS CloudClass.',
        assignment: newAssignment
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Update an existing assignment (Faculty only)
   */
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existing = db.findAssignmentById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Assignment not found.' });
      }

      const updated = db.updateAssignment(id, updates);
      res.json({
        message: 'Assignment updated successfully.',
        assignment: updated
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = assignmentController;
