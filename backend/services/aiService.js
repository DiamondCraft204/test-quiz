const { GoogleGenAI } = require('@google/genai');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate quiz questions from material text using Gemini AI.
 *
 * @param {string} materialText - The source material to base questions on.
 * @param {{ numQuestions: number, difficulty: string, questionTypes: string[] }} config
 * @returns {Promise<Array>} Array of question objects
 */
const generateQuestions = async (materialText, config) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API Key belum dikonfigurasi. Tambahkan GEMINI_API_KEY di file .env');
  }

  const {
    numQuestions = 30,
    difficulty = 'sedang',
    questionTypes = ['pilihan_ganda', 'benar_salah', 'essay'],
  } = config;

  const targetCount = Math.max(1, parseInt(numQuestions, 10) || 30);
  const typesList = Array.isArray(questionTypes) && questionTypes.length > 0
    ? questionTypes
    : ['pilihan_ganda', 'benar_salah', 'essay'];

  // Limit material text to 60,000 chars to prevent prompt bloat while retaining plenty of context
  const cleanMaterial = materialText.length > 60000
    ? materialText.substring(0, 60000) + '\n\n[Materi diringkas karena panjang]'
    : materialText;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `Kamu adalah pembuat soal ujian profesional yang ahli. Buatkan tepat ${targetCount} butir soal kuis dalam Bahasa Indonesia berdasarkan materi berikut.

Pengaturan:
- Jumlah soal yang HARUS dibuat: tepat ${targetCount} soal.
- Tingkat kesulitan: ${difficulty}
- Tipe soal yang digunakan: ${typesList.join(', ')}

Ketentuan format setiap tipe:
1. "pilihan_ganda": options harus array berisi 4 opsi string ["A. ...", "B. ...", "C. ...", "D. ..."], correct_answer harus huruf "A", "B", "C", atau "D", explanation penjelasan singkat.
2. "benar_salah": options harus ["Benar", "Salah"], correct_answer harus "Benar" atau "Salah", explanation penjelasan singkat.
3. "essay": options bernilai null, correct_answer adalah kunci poin-poin jawaban yang diharapkan, explanation bernilai null.

Wajib berikan output HANYA array JSON murni tanpa pembungkus teks lain.
Contoh:
[
  {
    "type": "pilihan_ganda",
    "text": "Pertanyaan?",
    "options": ["A. Opsi 1", "B. Opsi 2", "C. Opsi 3", "D. Opsi 4"],
    "correct_answer": "A",
    "explanation": "Penjelasan"
  }
]

Materi:
${cleanMaterial}`;

  // Valid active models in 2026
  const modelsToTry = [
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-flash-lite-latest',
  ];

  let responseText = null;
  let lastError = null;

  for (const modelName of modelsToTry) {
    // Retry up to 2 times per model if encountering 503 (high demand) or 429
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[AI] Mencoba model ${modelName} (percobaan ke-${attempt})...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (response && response.text) {
          responseText = response.text;
          console.log(`[AI] Sukses menggunakan model ${modelName}`);
          break;
        }
      } catch (err) {
        lastError = err;
        const msg = err.message || '';
        console.warn(`[AI] ${modelName} percobaan ${attempt} gagal: ${msg.slice(0, 100)}`);

        // If high demand (503) or rate limit (429), wait 2 seconds before retry
        if (msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE')) {
          await sleep(2000);
        } else {
          // If 404 or other permanent error, break to next model immediately
          break;
        }
      }
    }

    if (responseText) break;
  }

  if (!responseText) {
    console.error('Semua model Gemini gagal:', lastError);
    throw new Error(`Gagal memanggil layanan AI: ${lastError?.message || 'Server AI sedang sibuk. Silakan coba beberapa saat lagi.'}`);
  }

  let cleaned = responseText.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Extract JSON array if surrounded by any extra text
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }

  let questions;
  try {
    questions = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('Failed to parse AI response as JSON:', cleaned.substring(0, 400));
    throw new Error('Gagal memproses format soal dari AI. Format data tidak sesuai.');
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Respons AI tidak menghasilkan daftar pertanyaan yang valid.');
  }

  // Validate and sanitize each question
  const validated = questions.map((q, idx) => {
    if (!q.text) {
      throw new Error(`Soal ke-${idx + 1} tidak memiliki teks pertanyaan.`);
    }

    const type = ['pilihan_ganda', 'benar_salah', 'essay'].includes(q.type)
      ? q.type
      : 'pilihan_ganda';

    return {
      type,
      text: q.text,
      options: q.options ? (typeof q.options === 'string' ? q.options : JSON.stringify(q.options)) : null,
      correct_answer: q.correct_answer ? String(q.correct_answer) : null,
      explanation: q.explanation ? String(q.explanation) : null,
    };
  });

  return validated;
};

/**
 * Evaluasi jawaban essay siswa menggunakan Gemini AI atau algoritma cerdas fallback.
 * Memberikan nilai sempurna jika sesuai, dan nilai proporsional jika mendekati.
 *
 * @param {Array<{ questionId: number, questionText: string, keyAnswer: string, userAnswer: string }>} essayItems
 * @returns {Promise<Record<number, { score: number, feedback: string, isCorrect: boolean | string }>>}
 */
const evaluateEssayAnswers = async (essayItems) => {
  const results = {};
  if (!essayItems || essayItems.length === 0) return results;

  // Fallback similarity evaluator jika AI sedang sibuk / offline
  const fallbackEvaluate = (item) => {
    const userText = (item.userAnswer || '').trim().toLowerCase();
    const keyText = (item.keyAnswer || '').trim().toLowerCase();

    if (!userText) {
      return { score: 0, feedback: 'Tidak ada jawaban yang diberikan.', isCorrect: false };
    }

    if (userText === keyText) {
      return { score: 100, feedback: 'Jawaban sempurna dan persis sesuai kunci jawaban.', isCorrect: true };
    }

    const stopWords = new Set([
      'dan', 'atau', 'yang', 'di', 'ke', 'dari', 'pada', 'dalam', 'untuk',
      'dengan', 'adalah', 'yaitu', 'merupakan', 'sebagai', 'oleh', 'ini',
      'itu', 'karena', 'bisa', 'dapat', 'akan', 'telah', 'sudah', 'secara'
    ]);

    const getKeywords = (text) => {
      return text
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length > 2 && !stopWords.has(w));
    };

    const keyWords = getKeywords(keyText);
    const userWords = new Set(getKeywords(userText));

    if (keyWords.length === 0) {
      return userText.length > 5
        ? { score: 85, feedback: 'Jawaban mendekati kunci jawaban.', isCorrect: true }
        : { score: 30, feedback: 'Jawaban terlalu singkat.', isCorrect: false };
    }

    let matchCount = 0;
    keyWords.forEach(kw => {
      if (userWords.has(kw) || userText.includes(kw)) {
        matchCount++;
      }
    });

    const matchRatio = matchCount / keyWords.length;

    let score = 0;
    let feedback = '';
    let isCorrect = false;

    if (matchRatio >= 0.75) {
      score = 100;
      feedback = 'Jawaban menjawab inti konsep secara tepat dan lengkap (Nilai Penuh)!';
      isCorrect = true;
    } else if (matchRatio >= 0.5) {
      score = Math.round(70 + (matchRatio - 0.5) * 80); // 70 - 90
      score = Math.min(90, Math.max(70, score));
      feedback = 'Jawaban mendekati kunci jawaban dan memuat poin-poin utama.';
      isCorrect = true;
    } else if (matchRatio >= 0.2) {
      score = Math.round(10 + (matchRatio - 0.2) * 200); // 10 - 70
      score = Math.min(70, Math.max(10, score));
      feedback = 'Jawaban masih kurang lengkap dan hanya menyinggung sebagian kecil poin inti.';
      isCorrect = 'partial';
    } else if (userText.length > 0) {
      score = Math.min(10, Math.max(1, Math.round(userText.length / 5))); // 1 - 10
      feedback = 'Jawaban diisi apa adanya atau sangat minim.';
      isCorrect = false;
    } else {
      score = 0;
      feedback = 'Jawaban kosong.';
      isCorrect = false;
    }

    return { score, feedback, isCorrect };
  };

  if (!process.env.GEMINI_API_KEY) {
    essayItems.forEach(item => {
      results[item.questionId] = fallbackEvaluate(item);
    });
    return results;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Kamu adalah guru / penguji ujian yang adil dan teliti. Nilailah jawaban essay siswa berikut berdasarkan pertanyaan dan kunci jawaban/poin penting.

ATURAN SKALA PENILAIAN WAJIB DIIKUTI:
1. "score" (angka integer 0 - 100):
   * 100 (Nilai Penuh): Jika siswa menjawab INTI dari jawaban dengan benar dan sesuai.
   * 70 - 90 (Mendekati): Jika jawaban siswa MENDEKATI kunci jawaban dan memuat sebagian besar konsep penting.
   * 10 - 70 (Kurang): Jika jawaban siswa KURANG lengkap, hanya menyebutkan sedikit konsep yang benar.
   * 1 - 10 (Apa Adanya): Jika siswa HANYA MENGISI APA ADANYA, sangat minim, atau asal isi.
   * 0 (Kosong/Ngawur): Jika jawaban kosong atau sama sekali tidak relevan.
2. "feedback": Penjelasan singkat 1-2 kalimat dalam Bahasa Indonesia yang ramah mengenai alasan penilaian.
3. "isCorrect": true (jika score >= 70), "partial" (jika score antara 10 - 69), false (jika score < 10).

Daftar soal dan jawaban siswa yang harus dinilai:
${JSON.stringify(essayItems.map(item => ({
  questionId: item.questionId,
  pertanyaan: item.questionText,
  kunci_jawaban: item.keyAnswer,
  jawaban_siswa: item.userAnswer || '(kosong)'
})), null, 2)}

KEMBALIKAN HANYA ARRAY JSON VALID tanpa markdown codeblock atau teks lainnya:
[
  {
    "questionId": 123,
    "score": 85,
    "feedback": "Penjelasan...",
    "isCorrect": true
  }
]`;

    const modelsToTry = [
      'gemini-flash-latest',
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-flash-lite-latest',
    ];

    let aiResult = null;
    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
        if (response && response.text) {
          const cleaned = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
          aiResult = JSON.parse(cleaned);
          break;
        }
      } catch (err) {
        console.warn(`[AI Essay Evaluation] Model ${modelName} error:`, err.message);
      }
    }

    if (Array.isArray(aiResult)) {
      aiResult.forEach(res => {
        if (res && res.questionId) {
          const score = Math.max(0, Math.min(100, Math.round(res.score || 0)));
          results[res.questionId] = {
            score,
            feedback: res.feedback || (score >= 70 ? 'Jawaban baik.' : 'Jawaban perlu ditingkatkan.'),
            isCorrect: res.isCorrect !== undefined ? res.isCorrect : (score >= 70 ? true : score >= 40 ? 'partial' : false)
          };
        }
      });
    }
  } catch (err) {
    console.error('Error saat evaluasi essay via Gemini:', err);
  }

  // Ensure all essay items have a result
  essayItems.forEach(item => {
    if (!results[item.questionId]) {
      results[item.questionId] = fallbackEvaluate(item);
    }
  });

  return results;
};

module.exports = { generateQuestions, evaluateEssayAnswers };
