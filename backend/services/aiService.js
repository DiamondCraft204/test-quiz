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

module.exports = { generateQuestions };
