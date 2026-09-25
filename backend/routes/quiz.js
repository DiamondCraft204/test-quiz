const express = require('express');
const db = require('../db');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/quiz ─────────────────────────────────────────────────────────
// List all published quizzes (auth optional)
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT q.id, q.title, q.description, q.num_questions, q.timer_minutes,
             q.difficulty, q.question_types, q.created_at,
             COUNT(qs.id) AS question_count
      FROM quizzes q
      LEFT JOIN questions qs ON qs.quiz_id = q.id
      WHERE q.is_published = 1
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `);

    return res.json({ success: true, data: result.rows });
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
      `SELECT s.*, q.title AS quiz_title
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
    const enrichedAnswers = parsedAnswers.map((a) => ({
      ...a,
      questionText: a.questionText || questionMap[a.questionId]?.text || '',
      correctAnswer: a.correctAnswer || questionMap[a.questionId]?.correct_answer || '',
      explanation: a.explanation || questionMap[a.questionId]?.explanation || '',
    }));

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
              difficulty, question_types, is_published, created_at
       FROM quizzes
       WHERE id = $1 AND is_published = 1`,
      [req.params.id]
    );

    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan atau belum dipublikasikan.' });
    }

    const quiz = quizRes.rows[0];

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
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/quiz/:id/submit ─────────────────────────────────────────────
// Submit answers, auto-grade pilihan_ganda and benar_salah, defer essay
router.post('/:id/submit', authenticateUser, async (req, res, next) => {
  try {
    const { answers, timeTaken } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Field answers (array) wajib diisi.' });
    }

    const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1 AND is_published = 1', [req.params.id]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan atau belum dipublikasikan.' });
    }

    const quiz = quizRes.rows[0];

    // Fetch all questions WITH correct answers for grading
    const qRes = await db.query('SELECT * FROM questions WHERE quiz_id = $1', [quiz.id]);
    const questions = qRes.rows;
    const questionMap = {};
    questions.forEach((q) => { questionMap[q.id] = q; });

    let correctCount = 0;
    let gradableCount = 0;

    const gradedAnswers = answers.map((a) => {
      const question = questionMap[a.questionId];
      if (!question) {
        return { ...a, isCorrect: false, correctAnswer: null, explanation: null, needsReview: false };
      }

      const isEssay = question.type === 'essay';
      let isCorrect = false;
      let needsReview = false;

      if (isEssay) {
        needsReview = true;
        isCorrect = false;
      } else {
        const userAnswer = (a.answer || '').trim().toLowerCase();
        const correctAnswer = (question.correct_answer || '').trim().toLowerCase();
        isCorrect = userAnswer === correctAnswer;
        gradableCount++;
        if (isCorrect) correctCount++;
      }

      return {
        questionId: a.questionId,
        answer: a.answer,
        questionText: question.text,
        isCorrect: isEssay ? null : isCorrect,
        needsReview,
        correctAnswer: question.correct_answer,
        explanation: question.explanation,
        questionType: question.type,
      };
    });

    const totalQuestions = questions.length;
    const score = gradableCount > 0 ? (correctCount / totalQuestions) * 100 : 0;

    const subInsert = await db.query(
      `INSERT INTO submissions (quiz_id, user_id, answers, score, total_questions, correct_count, time_taken)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        quiz.id,
        req.user.id,
        JSON.stringify(gradedAnswers),
        Math.round(score * 100) / 100,
        totalQuestions,
        correctCount,
        timeTaken ? parseInt(timeTaken, 10) : null,
      ]
    );

    const submission = subInsert.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Kuis berhasil dikumpulkan.',
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
