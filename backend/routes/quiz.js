const express = require('express');
const db = require('../db');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/quiz ─────────────────────────────────────────────────────────
// List all published quizzes (auth optional)
router.get('/', async (req, res, next) => {
  try {
    const quizzes = await db.prepare(`
      SELECT q.id, q.title, q.description, q.num_questions, q.timer_minutes,
             q.difficulty, q.question_types, q.created_at,
             COUNT(qs.id) AS question_count
      FROM quizzes q
      LEFT JOIN questions qs ON qs.quiz_id = q.id
      WHERE q.is_published = 1
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `).all();

    return res.json({ success: true, data: quizzes });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/quiz/submissions/my ─────────────────────────────────────────
// Must come BEFORE /:id to avoid "submissions" being caught as an id param
router.get('/submissions/my', authenticateUser, async (req, res, next) => {
  try {
    const submissions = await db.prepare(`
      SELECT s.id, s.quiz_id, s.score, s.total_questions, s.correct_count,
             s.time_taken, s.submitted_at, q.title AS quiz_title
      FROM submissions s
      JOIN quizzes q ON q.id = s.quiz_id
      WHERE s.user_id = ?
      ORDER BY s.submitted_at DESC
    `).all(req.user.id);

    return res.json({ success: true, data: submissions });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/quiz/submissions/:id ────────────────────────────────────────
// Get a specific submission (user must own it)
router.get('/submissions/:id', authenticateUser, async (req, res, next) => {
  try {
    const submission = await db.prepare(`
      SELECT s.*, q.title AS quiz_title
      FROM submissions s
      JOIN quizzes q ON q.id = s.quiz_id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission tidak ditemukan.' });
    }

    if (submission.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke submission ini.' });
    }

    // Fetch questions WITH answers (for result display)
    const questions = await db.prepare(
      'SELECT id, type, text, options, correct_answer, explanation FROM questions WHERE quiz_id = ? ORDER BY order_num'
    ).all(submission.quiz_id);

    const parsedAnswers = JSON.parse(submission.answers || '[]');

    // Enrich answers with questionText (in case stored answers don't have it)
    const questionMap = {};
    questions.forEach(q => { questionMap[q.id] = q; });
    const enrichedAnswers = parsedAnswers.map(a => ({
      ...a,
      questionText: a.questionText || questionMap[a.questionId]?.text || '',
      correctAnswer: a.correctAnswer || questionMap[a.questionId]?.correct_answer || '',
      explanation: a.explanation || questionMap[a.questionId]?.explanation || '',
    }));

    return res.json({
      success: true,
      data: {
        submission: { ...submission, answers: enrichedAnswers },
        questions: questions.map(q => ({ ...q, options: q.options ? JSON.parse(q.options) : null })),
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
    const quiz = await db.prepare(`
      SELECT id, title, description, num_questions, timer_minutes,
             difficulty, question_types, is_published, created_at
      FROM quizzes
      WHERE id = ? AND is_published = 1
    `).get(req.params.id);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan atau belum dipublikasikan.' });
    }

    // Strip correct answers and explanations from questions
    const questions = await db.prepare(`
      SELECT id, quiz_id, type, text, options, order_num
      FROM questions
      WHERE quiz_id = ?
      ORDER BY order_num
    `).all(quiz.id);

    // Parse options JSON for each question
    const parsedQuestions = questions.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
    }));

    return res.json({
      success: true,
      data: {
        quiz: { ...quiz, question_types: JSON.parse(quiz.question_types || '[]') },
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

    const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ? AND is_published = 1').get(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan atau belum dipublikasikan.' });
    }

    // Fetch all questions WITH correct answers for grading
    const questions = await db.prepare('SELECT * FROM questions WHERE quiz_id = ?').all(quiz.id);
    const questionMap = {};
    questions.forEach((q) => { questionMap[q.id] = q; });

    let correctCount = 0;
    let gradableCount = 0; // pilihan_ganda + benar_salah only

    const gradedAnswers = answers.map((a) => {
      const question = questionMap[a.questionId];
      if (!question) {
        return { ...a, isCorrect: false, correctAnswer: null, explanation: null, needsReview: false };
      }

      const isEssay = question.type === 'essay';
      let isCorrect = false;
      let needsReview = false;

      if (isEssay) {
        // Essay: defer to manual review
        needsReview = true;
        isCorrect = false;
      } else {
        // Auto-grade: normalize both sides for comparison
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

    // Score = (correct auto-graded) / (total auto-gradable questions) * 100
    // If there are no auto-gradable questions (all essay), score = 0 pending review
    const totalQuestions = questions.length;
    const score = gradableCount > 0 ? (correctCount / totalQuestions) * 100 : 0;

    // Save submission
    const stmt = db.prepare(`
      INSERT INTO submissions (quiz_id, user_id, answers, score, total_questions, correct_count, time_taken)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = await stmt.run(
      quiz.id,
      req.user.id,
      JSON.stringify(gradedAnswers),
      Math.round(score * 100) / 100,
      totalQuestions,
      correctCount,
      timeTaken ? parseInt(timeTaken, 10) : null
    );

    const submission = await db.prepare('SELECT * FROM submissions WHERE id = ?').get(result.lastInsertRowid);

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
