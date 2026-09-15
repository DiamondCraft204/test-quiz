const express = require('express');
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
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file PDF, DOC, atau DOCX yang diizinkan.'));
    }
  },
});

// ─── GET /api/admin/quizzes ───────────────────────────────────────────────────
router.get('/quizzes', async (req, res, next) => {
  try {
    const quizzes = await db.prepare(`
      SELECT q.*, COUNT(qs.id) AS question_count
      FROM quizzes q
      LEFT JOIN questions qs ON qs.quiz_id = q.id
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `).all();

    return res.json({ success: true, data: quizzes });
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
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Judul kuis wajib diisi.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File materi wajib diunggah.' });
    }

    // Parse question types from JSON string
    let parsedTypes;
    try {
      parsedTypes = questionTypes ? JSON.parse(questionTypes) : ['pilihan_ganda', 'benar_salah', 'essay'];
    } catch {
      return res.status(400).json({ success: false, message: 'Format questionTypes tidak valid (harus JSON array).' });
    }

    // Extract text from uploaded file (memory only, file not saved to disk)
    let materialText;
    try {
      materialText = await parseFile(req.file.buffer, req.file.mimetype);
    } catch (err) {
      return res.status(422).json({ success: false, message: `Gagal membaca file: ${err.message}` });
    }

    if (!materialText || materialText.trim().length < 50) {
      return res.status(422).json({ success: false, message: 'Teks materi terlalu pendek atau tidak dapat dibaca.' });
    }

    // Generate questions automatically
    let questions;
    try {
      questions = await generateQuestions(materialText, {
        numQuestions: parseInt(numQuestions, 10),
        difficulty,
        questionTypes: parsedTypes,
      });
    } catch (err) {
      return res.status(502).json({ success: false, message: err.message });
    }

    // Save quiz to DB
    const quizStmt = db.prepare(`
      INSERT INTO quizzes (title, description, material_filename, material_text, num_questions, timer_minutes, difficulty, question_types)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const quizResult = await quizStmt.run(
      title,
      description || null,
      req.file.originalname,
      materialText,
      parseInt(numQuestions, 10),
      timerMinutes ? parseInt(timerMinutes, 10) : null,
      difficulty,
      JSON.stringify(parsedTypes)
    );

    const quizId = quizResult.lastInsertRowid;

    // Save all generated questions in a single atomic batch
    const insertQuestionSql = `
      INSERT INTO questions (quiz_id, type, text, options, correct_answer, explanation, order_num)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await db.batch(
      questions.map((q, idx) => ({
        sql: insertQuestionSql,
        args: [quizId, q.type, q.text, q.options, q.correct_answer, q.explanation, idx + 1],
      }))
    );

    const savedQuiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId);
    const savedQuestions = await db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_num').all(quizId);

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
    const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    const questions = await db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_num').all(quiz.id);

    return res.json({ success: true, data: { quiz, questions } });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/admin/quizzes/:id ───────────────────────────────────────────────
router.put('/quizzes/:id', async (req, res, next) => {
  try {
    const { title, description, timerMinutes, difficulty, numQuestions, questionTypes } = req.body;

    const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    const updatedTitle = title !== undefined ? title : quiz.title;
    const updatedDescription = description !== undefined ? description : quiz.description;
    const updatedTimer = timerMinutes !== undefined ? parseInt(timerMinutes, 10) || null : quiz.timer_minutes;
    const updatedDifficulty = difficulty !== undefined ? difficulty : quiz.difficulty;
    const updatedNumQ = numQuestions !== undefined ? parseInt(numQuestions, 10) : quiz.num_questions;
    const updatedTypes = questionTypes !== undefined ? questionTypes : quiz.question_types;

    await db.prepare(`
      UPDATE quizzes
      SET title = ?, description = ?, timer_minutes = ?, difficulty = ?, num_questions = ?, question_types = ?
      WHERE id = ?
    `).run(updatedTitle, updatedDescription, updatedTimer, updatedDifficulty, updatedNumQ, updatedTypes, req.params.id);

    const updated = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
    return res.json({ success: true, message: 'Kuis berhasil diperbarui.', data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/quizzes/:id ───────────────────────────────────────────
router.delete('/quizzes/:id', async (req, res, next) => {
  try {
    const quiz = await db.prepare('SELECT id FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    // ON DELETE CASCADE handles questions
    await db.prepare('DELETE FROM quizzes WHERE id = ?').run(req.params.id);

    return res.json({ success: true, message: 'Kuis berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/quizzes/:id/publish ─────────────────────────────────────
router.post('/quizzes/:id/publish', async (req, res, next) => {
  try {
    const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    const newStatus = quiz.is_published === 0 ? 1 : 0;
    await db.prepare('UPDATE quizzes SET is_published = ? WHERE id = ?').run(newStatus, req.params.id);

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
    const quiz = await db.prepare('SELECT id, title FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    const submissions = await db.prepare(`
      SELECT s.*, u.name AS user_name, u.email AS user_email
      FROM submissions s
      JOIN users u ON u.id = s.user_id
      WHERE s.quiz_id = ?
      ORDER BY s.submitted_at DESC
    `).all(req.params.id);

    return res.json({ success: true, data: { quiz, submissions } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/quizzes/:id/regenerate ──────────────────────────────────
router.post('/quizzes/:id/regenerate', async (req, res, next) => {
  try {
    const quiz = await db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    if (!quiz.material_text) {
      return res.status(422).json({ success: false, message: 'Tidak ada materi tersimpan untuk di-regenerasi.' });
    }

    let parsedTypes;
    try {
      parsedTypes = JSON.parse(quiz.question_types);
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

    // Delete existing questions and replace
    await db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(quiz.id);

    const insertQuestionSql = `
      INSERT INTO questions (quiz_id, type, text, options, correct_answer, explanation, order_num)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await db.batch(
      questions.map((q, idx) => ({
        sql: insertQuestionSql,
        args: [quiz.id, q.type, q.text, q.options, q.correct_answer, q.explanation, idx + 1],
      }))
    );

    const savedQuestions = await db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_num').all(quiz.id);

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

    const question = await db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Soal tidak ditemukan.' });
    }

    const updatedText = text !== undefined ? text : question.text;
    const updatedType = type !== undefined ? type : question.type;
    const updatedOptions = options !== undefined
      ? (typeof options === 'string' ? options : JSON.stringify(options))
      : question.options;
    const updatedAnswer = correct_answer !== undefined ? correct_answer : question.correct_answer;
    const updatedExplanation = explanation !== undefined ? explanation : question.explanation;
    const updatedOrder = order_num !== undefined ? parseInt(order_num, 10) : question.order_num;

    await db.prepare(`
      UPDATE questions
      SET type = ?, text = ?, options = ?, correct_answer = ?, explanation = ?, order_num = ?
      WHERE id = ?
    `).run(updatedType, updatedText, updatedOptions, updatedAnswer, updatedExplanation, updatedOrder, req.params.id);

    const updated = await db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    return res.json({ success: true, message: 'Soal berhasil diperbarui.', data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/questions/:id ─────────────────────────────────────────
router.delete('/questions/:id', async (req, res, next) => {
  try {
    const question = await db.prepare('SELECT id FROM questions WHERE id = ?').get(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Soal tidak ditemukan.' });
    }

    await db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
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

    const quiz = await db.prepare('SELECT id FROM quizzes WHERE id = ?').get(req.params.id);
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Kuis tidak ditemukan.' });
    }

    // Determine next order number
    const maxOrder = await db.prepare('SELECT MAX(order_num) AS max FROM questions WHERE quiz_id = ?').get(req.params.id);
    const orderNum = (maxOrder.max || 0) + 1;

    const serializedOptions = options
      ? (typeof options === 'string' ? options : JSON.stringify(options))
      : null;

    const result = await db.prepare(`
      INSERT INTO questions (quiz_id, type, text, options, correct_answer, explanation, order_num)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, type, text, serializedOptions, correct_answer || null, explanation || null, orderNum);

    const saved = await db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({ success: true, message: 'Soal berhasil ditambahkan.', data: saved });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
