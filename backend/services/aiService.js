const { GoogleGenAI } = require('@google/genai');

/**
 * Generate quiz questions from material text using Gemini.
 *
 * @param {string} materialText - The source material to base questions on.
 * @param {{ numQuestions: number, difficulty: string, questionTypes: string[] }} config
 * @returns {Promise<Array>} Array of question objects
 */
const generateQuestions = async (materialText, config) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API Key belum dikonfigurasi. Tambahkan GEMINI_API_KEY di file .env');
  }

  const { numQuestions = 30, difficulty = 'sedang', questionTypes = ['pilihan_ganda', 'benar_salah', 'essay'] } = config;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `Kamu adalah pembuat soal kuis profesional yang ahli. Berdasarkan materi yang diberikan, buatkan ${numQuestions} soal kuis dalam Bahasa Indonesia.

Konfigurasi:
- Jumlah soal: ${numQuestions}
- Tingkat kesulitan: ${difficulty}
- Tipe soal yang harus dibuat: ${questionTypes.join(', ')}

Buat soal dengan distribusi merata untuk setiap tipe soal yang diminta.

IMPORTANT: Kembalikan HANYA JSON array yang valid, tanpa markdown code blocks, tanpa teks tambahan apapun.

Format JSON:
[
  {
    "type": "pilihan_ganda",
    "text": "Teks pertanyaan",
    "options": ["A. Opsi 1", "B. Opsi 2", "C. Opsi 3", "D. Opsi 4"],
    "correct_answer": "A",
    "explanation": "Penjelasan mengapa A benar"
  },
  {
    "type": "benar_salah",
    "text": "Pernyataan yang harus dinilai benar atau salah",
    "options": ["Benar", "Salah"],
    "correct_answer": "Benar",
    "explanation": "Penjelasan"
  },
  {
    "type": "essay",
    "text": "Pertanyaan essay yang membutuhkan jawaban panjang",
    "options": null,
    "correct_answer": "Kunci jawaban atau poin-poin yang harus ada dalam jawaban",
    "explanation": null
  }
]

Materi:
${materialText}`;

  let responseText;
const modelsToTry = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      responseText = response.text;
      if (responseText) break;
    } catch (err) {
      console.warn(`Model ${modelName} gagal, mencoba model berikutnya...`, err.message);
      lastError = err;
    }
  }

  if (!responseText) {
    console.error('Semua model Gemini gagal:', lastError);
    throw new Error(`Gagal memanggil Gemini API: ${lastError?.message || 'Tidak ada respon'}`);
  }

  let cleaned = responseText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }

  let questions;
  try {
    questions = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('Failed to parse Gemini response as JSON:', cleaned.substring(0, 500));
    throw new Error('Gagal memparse respons dari sistem. Format JSON tidak valid.');
  }

  if (!Array.isArray(questions)) {
    throw new Error('Respons dari sistem bukan array pertanyaan yang valid.');
  }

  // Validate and sanitize each question
  const validated = questions.map((q, idx) => {
    if (!q.type || !q.text) {
      throw new Error(`Soal ke-${idx + 1} tidak memiliki field type atau text.`);
    }
    return {
      type: q.type,
      text: q.text,
      options: q.options ? JSON.stringify(q.options) : null,
      correct_answer: q.correct_answer || null,
      explanation: q.explanation || null,
    };
  });

  return validated;
};

module.exports = { generateQuestions };
