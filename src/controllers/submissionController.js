/**
 * ============================================================================
 * CLOUDCLASS - SUBMISSION & GRADING CONTROLLER
 * ============================================================================
 * Handles binary uploads streaming to Amazon S3, automated deadline enforcement
 * (marking 'late'), marks validation against maximum points, and presigned downloads.
 * ============================================================================
 */

const path = require('path');
const db = require('../services/dbService');
const s3Service = require('../services/s3Service');
const logger = require('../utils/logger');

const submissionController = {
  /**
   * Get submissions filtered by role and optional assignmentId
   */
  async getAll(req, res, next) {
    try {
      const user = req.user;
      const { assignmentId } = req.query;

      let filterFn = null;

      if (user && user.role === 'student') {
        // Students can only see their own submissions
        filterFn = s => (
          (!assignmentId || String(s.assignmentId) === String(assignmentId)) &&
          (s.studentId === user.studentId || (user.userId && s.userId === user.userId))
        );
      } else if (assignmentId) {
        // Faculty / Admin filtered by assignment
        filterFn = s => String(s.assignmentId) === String(assignmentId);
      }

      const list = db.getSubmissions(filterFn);
      res.json(list);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Submit assignment: Stream file to AWS S3 & enforce deadline
   */
  async submit(req, res, next) {
    try {
      const user = req.user;
      const { assignmentId, note } = req.body;
      const file = req.file;

      if (!assignmentId) {
        return res.status(400).json({ error: 'Assignment ID is required.' });
      }

      if (!file) {
        return res.status(400).json({ error: 'Please choose a file to submit.' });
      }

      const assignment = db.findAssignmentById(assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: 'Assignment not found.' });
      }

      const safeStudentId = user ? (user.studentId || user.userId || 'guest') : 'student_demo';
      const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const s3Key = `submissions/${safeStudentId}/${Date.now()}_${cleanFileName}`;

      // Upload file directly to AWS S3 (or fallback to local disk)
      const uploadResult = await s3Service.uploadFile({
        buffer: file.buffer,
        key: s3Key,
        contentType: file.mimetype || 'application/octet-stream',
        metadata: {
          assignmentId: String(assignmentId),
          studentId: String(safeStudentId),
          originalName: cleanFileName
        }
      });

      // Automated deadline check (mirrors Oracle trigger trg_submissions_integrity)
      const isLate = assignment.deadline && new Date() > new Date(assignment.deadline);

      const submission = {
        id: 'sub-' + Date.now(),
        assignmentId: String(assignmentId),
        assignmentTitle: assignment.title,
        studentId: String(safeStudentId),
        studentName: user ? user.displayName : `Student ${safeStudentId}`,
        studentEmail: user ? user.email : 'student@cloudclass.edu',
        userId: user ? user.userId : null,
        fileName: file.originalname,
        fileSizeKB: Math.round(file.size / 1024),
        s3Key: uploadResult.s3Key,
        storageType: uploadResult.storageType,
        downloadURL: uploadResult.downloadUrl,
        note: note ? note.trim() : '',
        status: isLate ? 'late' : 'submitted',
        submittedAt: new Date().toISOString(),
        verified: true,
        detectedMime: file.detectedMime || file.mimetype,
        marksObtained: null,
        facultyFeedback: null
      };

      db.saveSubmission(submission);
      logger.info(`Assignment submission received: "${assignment.title}" by Student ${safeStudentId} (${submission.status})`);

      res.status(201).json({
        message: isLate ? 'Submitted to AWS (marked Late).' : 'Submitted successfully to AWS S3.',
        submission
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Grade a submission (Faculty only)
   */
  async grade(req, res, next) {
    try {
      const { id } = req.params;
      const { marks, feedback } = req.body;
      const user = req.user;

      if (marks === undefined || marks === null) {
        return res.status(400).json({ error: 'Marks are required.' });
      }

      const numMarks = Number(marks);
      if (isNaN(numMarks) || numMarks < 0) {
        return res.status(400).json({ error: 'Marks must be a non-negative number.' });
      }

      const sub = db.findSubmissionById(id);
      if (!sub) {
        return res.status(404).json({ error: 'Submission not found.' });
      }

      const assignment = db.findAssignmentById(sub.assignmentId);
      if (assignment && assignment.maxPoints && numMarks > assignment.maxPoints) {
        return res.status(400).json({
          error: `Marks obtained (${numMarks}) cannot exceed assignment maximum points (${assignment.maxPoints}).`
        });
      }

      sub.marksObtained = numMarks;
      sub.facultyFeedback = feedback ? feedback.trim() : '';
      sub.status = 'graded';
      sub.gradedAt = new Date().toISOString();
      sub.gradedBy = user ? user.displayName : 'Faculty Instructor';

      db.saveSubmission(sub);
      logger.info(`Submission graded: ID ${id} (${numMarks} marks) by ${sub.gradedBy}`);

      res.json({
        message: 'Submission graded successfully.',
        submission: sub
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * Download submitted file (redirects to S3 presigned URL or serves file)
   */
  async download(req, res, next) {
    try {
      const { key } = req.query;
      if (!key) {
        return res.status(400).send('Missing file key parameter.');
      }

      const downloadUrl = await s3Service.getDownloadUrl(key, 3600);
      if (downloadUrl) {
        if (downloadUrl.startsWith('http')) {
          return res.redirect(downloadUrl);
        }
        // Local path
        return res.download(path.join(__dirname, '..', '..', downloadUrl));
      }

      res.status(404).send('File not found in cloud storage.');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = submissionController;
