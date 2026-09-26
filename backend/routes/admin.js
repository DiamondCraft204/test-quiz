const express = require('express');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { parseFile } = require('../services/fileParser');
const { generateQuestions } = require('../services/aiService');

const router = express.Router();

// All admin routes require admin authentication
router.use(authenticateAdmin);

// ─── Multer: memory storage, accept PDF/DOC/DOCX only ────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = ['.pdf', '.doc', '.docx'];
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ];
    if (allowedExts.includes(ext) || allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file PDF, DOC, atau DOCX yang diizinkan.'));
    }
  },
});

// ─── GET /api/admin/quizzes ───────────────────────────────────────────────────
router.get('/quizzes', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT q.*, COUNT(qs.id)::int AS question_count
      FROM quizzes q
      LEFT JOIN questions qs ON qs.quiz_id = q.id
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `);

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/quizzes ──────────────────────────────────────────────────
router.post('/quizzes', upload.single('material'), async (req, res, next) => {
  try {
    const {
      title,
      description,
      numQuestions = 30,
      timerMinutes,
      difficulty = 'sedang',
      questionTypes,
      typeCounts,
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Judul kuis wajib diisi.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File materi wajib diunggah.' });
    }

    let parsedTypeCounts = null;
    if (typeCounts) {
      try {
        parsedTypeCounts = typeof typeCounts === 'string' ? JSON.parse(typeCounts) : typeCounts;
      } catch {
        parsedTypeCounts = null;
      }
    }

    let parsedTypes;
    try {
      parsedTypes = questionTypes ? (typeof questionTypes === 'string' ? JSON.parse(questionTypes) : questionTypes) : ['pilihan_ganda', 'benar_salah', 'essay'];
    } catch {
      return res.status(400).json({ success: false, message: 'Format questionTypes tidak valid (harus JSON array).' });
    }

    let totalTarget = 0;
    const activeTypes = [];
    if (parsedTypeCounts && typeof parsedTypeCounts === 'object') {
      for (const [t, c] of Object.entries(parsedTypeCounts)) {
        const count = parseInt(c, 10) || 0;
        if (count > 0) {
          totalTarget += count;
          activeTypes.push(t);
        }
      }
    }

    const finalNumQuestions = totalTarget > 0 ? totalTarget : Math.max(1, parseInt(numQuestions, 10) || 30);
    const finalTypes = activeTypes.length > 0 ? activeTypes : parsedTypes;

    // Extract text from uploaded file
    let materialText;
    try {
      materialText = await parseFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (err) {
      return res.status(422).json({ success: false, message: `Gagal membaca file: ${err.message}` });
    }

    if (!materialText || materialText.trim().length < 30) {
      return res.status(422).json({ success: false, message: 'Teks materi terlalu pendek atau tidak dapat dibaca dari file ini.' });
    }

    // Generate questions via AI
    let questions;
    try {
      questions = await generateQuestions(materialText, {
        numQuestions: finalNumQuestions,
        difficulty,
        questionTypes: finalTypes,
        typeCounts: parsedTypeCounts,
      });
    } catch (err) {
      return res.status(502).json({ success: false, message: err.message });
    }

    // Save quiz to PostgreSQL
    const quizResult = await db.query(
      `INSERT INTO quizzes 
        (title, description, material_filename, material_text, num_questions, timer_minutes, difficulty, question_types)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        title,
        description || null,
        req.file.originalname,
        materialText,
        questions.length || finalNumQuestions,
        timerMinutes ? parseInt(timerMinutes, 10) : null,
        difficulty,
        JSON.stringify(finalTypes),
      ]
    );

    const savedQuiz = quizResult.rows[0];
    const quizId = savedQuiz.id;

    // Save questions to PostgreSQL
    const savedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qRes = await db.query(
        `INSERT INTO questions 
          (quiz_id, type, text, options, correct_answer, explanation, order_num)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [quizId, q.type, q.text, q.options, q.correct_answer, q.explanation, i + 1]
      );
      savedQuestions.push(qRes.rows[0]);
    }

    return res.status(201).json({
      success: true,
      message: `Kuis berhasil dibuat dengan ${savedQuestions.length} soal.`,
      data: { quiz: savedQuiz, questions: savedQuestions },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/quizzes/:id ───────────────────────────────────────────────
router.get('/quizzes/:id', async (req, res, next) => {
  try {
    const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    const quiz = quizRes.rows[0];
    const questionsRes = await db.query(
      'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY order_num ASC',
      [quiz.id]
    );

    return res.json({ success: true, data: { quiz, questions: questionsRes.rows } });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/admin/quizzes/:id ───────────────────────────────────────────────
router.put('/quizzes/:id', async (req, res, next) => {
  try {
    const { title, description, timerMinutes, difficulty, numQuestions, questionTypes } = req.body;

    const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    const quiz = quizRes.rows[0];
    const updatedTitle = title !== undefined ? title : quiz.title;
    const updatedDescription = description !== undefined ? description : quiz.description;
    const updatedTimer = timerMinutes !== undefined ? parseInt(timerMinutes, 10) || null : quiz.timer_minutes;
    const updatedDifficulty = difficulty !== undefined ? difficulty : quiz.difficulty;
    const updatedNumQ = numQuestions !== undefined ? parseInt(numQuestions, 10) : quiz.num_questions;
    const updatedTypes = questionTypes !== undefined ? (typeof questionTypes === 'string' ? questionTypes : JSON.stringify(questionTypes)) : quiz.question_types;

    const updatedRes = await db.query(
      `UPDATE quizzes
       SET title = $1, description = $2, timer_minutes = $3, difficulty = $4, num_questions = $5, question_types = $6
       WHERE id = $7
       RETURNING *`,
      [updatedTitle, updatedDescription, updatedTimer, updatedDifficulty, updatedNumQ, updatedTypes, req.params.id]
    );

    return res.json({ success: true, message: 'Kuis berhasil diperbarui.', data: updatedRes.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/quizzes/:id ───────────────────────────────────────────
router.delete('/quizzes/:id', async (req, res, next) => {
  try {
    const quizRes = await db.query('SELECT id FROM quizzes WHERE id = $1', [req.params.id]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    // ON DELETE CASCADE automatically deletes questions and submissions
    await db.query('DELETE FROM quizzes WHERE id = $1', [req.params.id]);

    return res.json({ success: true, message: 'Kuis berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/quizzes/:id/publish ─────────────────────────────────────
router.post('/quizzes/:id/publish', async (req, res, next) => {
  try {
    const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    const quiz = quizRes.rows[0];
    const newStatus = quiz.is_published === 0 ? 1 : 0;

    await db.query('UPDATE quizzes SET is_published = $1 WHERE id = $2', [newStatus, req.params.id]);

    const statusLabel = newStatus === 1 ? 'dipublikasikan' : 'disembunyikan';
    return res.json({
      success: true,
      message: `Kuis berhasil ${statusLabel}.`,
      data: { is_published: newStatus },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/quizzes/:id/results ──────────────────────────────────────
router.get('/quizzes/:id/results', async (req, res, next) => {
  try {
    const quizRes = await db.query('SELECT id, title FROM quizzes WHERE id = $1', [req.params.id]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    const submissionsRes = await db.query(
      `SELECT s.*, u.name AS user_name, u.email AS user_email
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       WHERE s.quiz_id = $1
       ORDER BY s.submitted_at DESC`,
      [req.params.id]
    );

    // Fetch questions to enrich submission answers if needed
    const qRes = await db.query(
      'SELECT id, type, text, correct_answer, explanation FROM questions WHERE quiz_id = $1 ORDER BY order_num ASC',
      [req.params.id]
    );
    const questionMap = {};
    qRes.rows.forEach((q) => { questionMap[q.id] = q; });

    const enrichedSubmissions = submissionsRes.rows.map((sub) => {
      let parsedAnswers = [];
      try {
        parsedAnswers = typeof sub.answers === 'string' ? JSON.parse(sub.answers) : (sub.answers || []);
      } catch {
        parsedAnswers = [];
      }

      const answersWithDetails = (parsedAnswers || []).map((a) => {
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
          score,
        };
      });

      return {
        ...sub,
        answers: answersWithDetails,
      };
    });

    return res.json({
      success: true,
      data: { quiz: quizRes.rows[0], submissions: enrichedSubmissions },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/quizzes/:id/regenerate ──────────────────────────────────
router.post('/quizzes/:id/regenerate', async (req, res, next) => {
  try {
    const quizRes = await db.query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    const quiz = quizRes.rows[0];
    if (!quiz.material_text) {
      return res.status(422).json({ success: false, message: 'Tidak ada materi tersimpan untuk di-regenerasi.' });
    }

    let parsedTypes;
    try {
      parsedTypes = typeof quiz.question_types === 'string' ? JSON.parse(quiz.question_types) : quiz.question_types;
    } catch {
      parsedTypes = ['pilihan_ganda', 'benar_salah', 'essay'];
    }

    let questions;
    try {
      questions = await generateQuestions(quiz.material_text, {
        numQuestions: quiz.num_questions,
        difficulty: quiz.difficulty,
        questionTypes: parsedTypes,
      });
    } catch (err) {
      return res.status(502).json({ success: false, message: err.message });
    }

    // Delete existing questions
    await db.query('DELETE FROM questions WHERE quiz_id = $1', [quiz.id]);

    const savedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qRes = await db.query(
        `INSERT INTO questions 
          (quiz_id, type, text, options, correct_answer, explanation, order_num)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [quiz.id, q.type, q.text, q.options, q.correct_answer, q.explanation, i + 1]
      );
      savedQuestions.push(qRes.rows[0]);
    }

    return res.json({
      success: true,
      message: `Soal berhasil di-regenerasi. Total ${savedQuestions.length} soal baru.`,
      data: savedQuestions,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/admin/questions/:id ─────────────────────────────────────────────
router.put('/questions/:id', async (req, res, next) => {
  try {
    const { text, type, options, correct_answer, explanation, order_num } = req.body;

    const qRes = await db.query('SELECT * FROM questions WHERE id = $1', [req.params.id]);
    if (qRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Soal tidak ditemukan.' });
    }

    const question = qRes.rows[0];
    const updatedText = text !== undefined ? text : question.text;
    const updatedType = type !== undefined ? type : question.type;
    const updatedOptions = options !== undefined
      ? (typeof options === 'string' ? options : JSON.stringify(options))
      : question.options;
    const updatedAnswer = correct_answer !== undefined ? correct_answer : question.correct_answer;
    const updatedExplanation = explanation !== undefined ? explanation : question.explanation;
    const updatedOrder = order_num !== undefined ? parseInt(order_num, 10) : question.order_num;

    const updatedRes = await db.query(
      `UPDATE questions
       SET type = $1, text = $2, options = $3, correct_answer = $4, explanation = $5, order_num = $6
       WHERE id = $7
       RETURNING *`,
      [updatedType, updatedText, updatedOptions, updatedAnswer, updatedExplanation, updatedOrder, req.params.id]
    );

    return res.json({ success: true, message: 'Soal berhasil diperbarui.', data: updatedRes.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/questions/:id ─────────────────────────────────────────
router.delete('/questions/:id', async (req, res, next) => {
  try {
    const qRes = await db.query('SELECT id FROM questions WHERE id = $1', [req.params.id]);
    if (qRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Soal tidak ditemukan.' });
    }

    await db.query('DELETE FROM questions WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Soal berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/quizzes/:id/questions ────────────────────────────────────
router.post('/quizzes/:id/questions', async (req, res, next) => {
  try {
    const { text, type, options, correct_answer, explanation } = req.body;

    if (!text || !type) {
      return res.status(400).json({ success: false, message: 'Field text dan type wajib diisi.' });
    }

    const quizRes = await db.query('SELECT id FROM quizzes WHERE id = $1', [req.params.id]);
    if (quizRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    const maxOrderRes = await db.query('SELECT COALESCE(MAX(order_num), 0) AS max FROM questions WHERE quiz_id = $1', [req.params.id]);
    const nextOrder = parseInt(maxOrderRes.rows[0].max, 10) + 1;

    const serializedOptions = options
      ? (typeof options === 'string' ? options : JSON.stringify(options))
      : null;

    const result = await db.query(
      `INSERT INTO questions (quiz_id, type, text, options, correct_answer, explanation, order_num)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.params.id, type, text, serializedOptions, correct_answer || null, explanation || null, nextOrder]
    );

    return res.status(201).json({ success: true, message: 'Soal berhasil ditambahkan.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
