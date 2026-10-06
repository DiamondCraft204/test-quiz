const express = require('express');
const db = require('../db');
const { authenticateUser } = require('../middleware/auth');
const { evaluateEssayAnswers } = require('../services/aiService');

const router = express.Router();

// ─── GET /api/quiz ─────────────────────────────────────────────────────────
// List all published quizzes accessible to current user (requires auth)
router.get('/', authenticateUser, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT q.id, q.title, q.description, q.num_questions, q.timer_minutes,
             q.difficulty, q.question_types, q.target_type, q.allowed_user_ids, q.created_at,
             COUNT(qs.id) AS question_count
      FROM quizzes q
      LEFT JOIN questions qs ON qs.quiz_id = q.id
      WHERE q.is_published = 1
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `);

    // Filter by audience: 'all' or specific user matches
    const userId = Number(req.user.id);
    const visibleQuizzes = result.rows.filter((q) => {
      const targetType = q.target_type || 'all';
      if (targetType === 'all') return true;
      if (targetType === 'specific') {
        let allowed = [];
        try {
          allowed = typeof q.allowed_user_ids === 'string' ? JSON.parse(q.allowed_user_ids) : (q.allowed_user_ids || []);
        } catch {
          allowed = [];
        }
        return Array.isArray(allowed) && allowed.map(Number).includes(userId);
      }
      return true;
    });

    return res.json({ success: true, data: visibleQuizzes });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/quiz/submissions/my ─────────────────────────────────────────
// List user's own submissions
router.get('/submissions/my', authenticateUser, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT s.id, s.quiz_id, s.score, s.total_questions, s.correct_count,
              s.time_taken, s.submitted_at, q.title AS quiz_title
       FROM submissions s
       JOIN quizzes q ON q.id = s.quiz_id
       WHERE s.user_id = $1
       ORDER BY s.submitted_at DESC`,
      [req.user.id]
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/quiz/submissions/:id ────────────────────────────────────────
// Get a specific submission (user must own it)
router.get('/submissions/:id', authenticateUser, async (req, res, next) => {
  try {
    const subRes = await db.query(
      `SELECT s.*, q.title AS quiz_title, q.essay_weight
       FROM submissions s
       JOIN quizzes q ON q.id = s.quiz_id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (subRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Submission tidak ditemukan.' });
    }

    const submission = subRes.rows[0];

    if (submission.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke submission ini.' });
    }

    // Fetch questions WITH answers (for result display)
    const qRes = await db.query(
      'SELECT id, type, text, options, correct_answer, explanation FROM questions WHERE quiz_id = $1 ORDER BY order_num ASC',
      [submission.quiz_id]
    );

    const questions = qRes.rows;
    let parsedAnswers = [];
    try {
      parsedAnswers = typeof submission.answers === 'string' ? JSON.parse(submission.answers) : submission.answers;
    } catch {
      parsedAnswers = [];
    }

    const questionMap = {};
    questions.forEach((q) => { questionMap[q.id] = q; });
    const quizEssayWeight = submission.essay_weight ? parseFloat(submission.essay_weight) : 2;
    const enrichedAnswers = parsedAnswers.map((a) => {
      const q = questionMap[a.questionId] || {};
      const isEssay = (a.questionType || q.type) === 'essay';
      let score = a.score;
      if (score === undefined || score === null) {
        score = a.isCorrect === true ? 100 : (a.isCorrect === false ? 0 : 0);
      }
      return {
        ...a,
        questionText: a.questionText || q.text || '',
        correctAnswer: a.correctAnswer || q.correct_answer || '',
        explanation: a.explanation || q.explanation || '',
        questionType: a.questionType || q.type || (isEssay ? 'essay' : 'pilihan_ganda'),
        weight: a.weight !== undefined ? a.weight : (isEssay ? quizEssayWeight : 1),
        score,
      };
    });

    return res.json({
      success: true,
      data: {
        submission: { ...submission, answers: enrichedAnswers },
        questions: questions.map((q) => {
          let opts = null;
          try {
            opts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null;
          } catch {
            opts = null;
          }
          return { ...q, options: opts };
        }),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/quiz/:id ─────────────────────────────────────────────────────
// Get quiz info + questions WITHOUT correct_answer and explanation (requires auth)
router.get('/:id', authenticateUser, async (req, res, next) => {
  try {
    const quizRes = await db.query(
      `SELECT id, title, description, num_questions, timer_minutes,
              difficulty, question_types, target_type, allowed_user_ids, essay_weight, is_published, created_at
       FROM quizzes
       WHERE id = $1 AND is_published = 1`,
      [req.params.id]
    );

    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan atau belum dipublikasikan.' });
    }

    const quiz = quizRes.rows[0];

    // Check audience permission
    const targetType = quiz.target_type || 'all';
    if (targetType === 'specific') {
      let allowed = [];
      try {
        allowed = typeof quiz.allowed_user_ids === 'string' ? JSON.parse(quiz.allowed_user_ids) : (quiz.allowed_user_ids || []);
      } catch {
        allowed = [];
      }
      const userId = Number(req.user.id);
      if (!Array.isArray(allowed) || !allowed.map(Number).includes(userId)) {
        return res.status(403).json({
          success: false,
          code: 'QUIZ_ACCESS_RESTRICTED',
          message: 'Tugas ini bersifat terbatas dan hanya dapat diakses oleh peserta tertentu yang telah ditentukan oleh admin.',
        });
      }
    }

    // Check if user has already submitted this quiz
    const existingSub = await db.query(
      'SELECT id FROM submissions WHERE quiz_id = $1 AND user_id = $2',
      [quiz.id, req.user.id]
    );
    const alreadySubmitted = existingSub.rows.length > 0;
    const submissionId = alreadySubmitted ? existingSub.rows[0].id : null;

    // Strip correct answers and explanations from questions
    const qRes = await db.query(
      `SELECT id, quiz_id, type, text, options, order_num
       FROM questions
       WHERE quiz_id = $1
       ORDER BY order_num ASC`,
      [quiz.id]
    );

    const parsedQuestions = qRes.rows.map((q) => {
      let opts = null;
      try {
        opts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null;
      } catch {
        opts = null;
      }
      return { ...q, options: opts };
    });

    let qTypes = [];
    try {
      qTypes = typeof quiz.question_types === 'string' ? JSON.parse(quiz.question_types) : quiz.question_types;
    } catch {
      qTypes = [];
    }

    return res.json({
      success: true,
      data: {
        quiz: { ...quiz, question_types: qTypes },
        questions: parsedQuestions,
        alreadySubmitted,
        submissionId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/quiz/:id/submit ─────────────────────────────────────────────
// Submit answers, auto-grade pilihan_ganda, benar_salah, evaluate essay, and apply anti-cheat penalty
router.post('/:id/submit', authenticateUser, async (req, res, next) => {
  try {
    const { answers, timeTaken, cheatViolations = 0 } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Field answers (array) wajib diisi.' });
    }

    const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1 AND is_published = 1', [req.params.id]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tugas tidak ditemukan atau belum dipublikasikan.' });
    }

    const quiz = quizRes.rows[0];

    // Check audience permission
    const targetType = quiz.target_type || 'all';
    if (targetType === 'specific') {
      let allowed = [];
      try {
        allowed = typeof quiz.allowed_user_ids === 'string' ? JSON.parse(quiz.allowed_user_ids) : (quiz.allowed_user_ids || []);
      } catch {
        allowed = [];
      }
      const userId = Number(req.user.id);
      if (!Array.isArray(allowed) || !allowed.map(Number).includes(userId)) {
        return res.status(403).json({
          success: false,
          code: 'QUIZ_ACCESS_RESTRICTED',
          message: 'Anda tidak memiliki hak akses untuk mengerjakan atau mengumpulkan tugas ini.',
        });
      }
    }

    // Single attempt enforcement: User cannot take the quiz twice
    const existingSub = await db.query(
      'SELECT id FROM submissions WHERE quiz_id = $1 AND user_id = $2',
      [quiz.id, req.user.id]
    );
    if (existingSub.rows.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_SUBMITTED',
        message: 'Anda sudah menyelesaikan tugas ini dan tidak dapat mengerjakan ulang (hanya 1x pengerjaan).',
        submissionId: existingSub.rows[0].id,
      });
    }

    // Fetch all questions WITH correct answers for grading
    const qRes = await db.query('SELECT * FROM questions WHERE quiz_id = $1', [quiz.id]);
    const questions = qRes.rows;
    const questionMap = {};
    questions.forEach((q) => { questionMap[q.id] = q; });

    // Collect essay questions for smart AI evaluation
    const essayItems = [];
    answers.forEach((a) => {
      const question = questionMap[a.questionId];
      if (question && question.type === 'essay') {
        essayItems.push({
          questionId: question.id,
          questionText: question.text,
          keyAnswer: question.correct_answer || '',
          userAnswer: (a.answer || '').trim(),
        });
      }
    });

    let essayEvaluations = {};
    if (essayItems.length > 0) {
      try {
        essayEvaluations = await evaluateEssayAnswers(essayItems);
      } catch (err) {
        console.error('Error saat evaluasi essay:', err.message);
      }
    }

    const essayWeight = quiz.essay_weight !== undefined && quiz.essay_weight !== null ? Math.max(0.1, parseFloat(quiz.essay_weight) || 1) : 2;
    let earnedWeightedPoints = 0;
    let totalMaxWeight = 0;
    let fullCorrectCount = 0;

    const gradedAnswers = answers.map((a) => {
      const question = questionMap[a.questionId];
      if (!question) {
        return { ...a, isCorrect: false, score: 0, correctAnswer: null, explanation: null, needsReview: false, weight: 1 };
      }

      const isEssay = question.type === 'essay';
      const weight = isEssay ? essayWeight : 1;
      totalMaxWeight += weight;

      if (isEssay) {
        const evalRes = essayEvaluations[question.id] || { score: 0, feedback: '', isCorrect: false };
        const score = Math.max(0, Math.min(100, Math.round(evalRes.score || 0)));
        earnedWeightedPoints += (score / 100) * weight;
        if (score >= 70) fullCorrectCount++;

        return {
          questionId: a.questionId,
          answer: a.answer,
          questionText: question.text,
          isCorrect: evalRes.isCorrect,
          score,
          feedback: evalRes.feedback,
          needsReview: false,
          correctAnswer: question.correct_answer,
          explanation: question.explanation,
          questionType: question.type,
          weight,
        };
      } else {
        const userAnswer = (a.answer || '').trim().toLowerCase();
        const correctAnswer = (question.correct_answer || '').trim().toLowerCase();
        const isCorrect = userAnswer === correctAnswer;
        if (isCorrect) {
          earnedWeightedPoints += 1 * weight;
          fullCorrectCount++;
        }

        return {
          questionId: a.questionId,
          answer: a.answer,
          questionText: question.text,
          isCorrect,
          score: isCorrect ? 100 : 0,
          needsReview: false,
          correctAnswer: question.correct_answer,
          explanation: question.explanation,
          questionType: question.type,
          weight,
        };
      }
    });

    const baseScore = totalMaxWeight > 0 ? (earnedWeightedPoints / totalMaxWeight) * 100 : 0;

    // Anti-cheat penalty: -5 points per violation
    const violationCount = Math.max(0, parseInt(cheatViolations, 10) || 0);
    const penaltyPoints = violationCount * 5;
    const finalScore = Math.max(0, Math.min(100, Math.round((baseScore - penaltyPoints) * 10) / 10));
    const totalQuestions = questions.length;

    const subInsert = await db.query(
      `INSERT INTO submissions (quiz_id, user_id, answers, score, total_questions, correct_count, time_taken, cheat_violations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        quiz.id,
        req.user.id,
        JSON.stringify(gradedAnswers),
        finalScore,
        totalQuestions,
        fullCorrectCount,
        timeTaken ? parseInt(timeTaken, 10) : null,
        violationCount,
      ]
    );

    const submission = subInsert.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Tugas berhasil dikumpulkan.',
      data: {
        submission: {
          ...submission,
          answers: gradedAnswers,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
