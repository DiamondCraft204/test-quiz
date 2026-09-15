import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';

const QUESTION_TYPES = [
  { value: 'pilihan_ganda', label: 'Pilihan Ganda' },
  { value: 'benar_salah', label: 'Benar/Salah' },
  { value: 'essay', label: 'Essay' },
];

const defaultOptions = ['', '', '', ''];

const QuestionEditor = ({ question, onSave, onClose, quizId }) => {
  const [form, setForm] = useState({
    type: 'pilihan_ganda',
    question: '',
    options: [...defaultOptions],
    correct_answer: '',
    explanation: '',
    points: 1,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (question) {
      setForm({
        type: question.type || 'pilihan_ganda',
        question: question.question || '',
        options: question.options && question.options.length > 0 ? question.options : [...defaultOptions],
        correct_answer: question.correct_answer || '',
        explanation: question.explanation || '',
        points: question.points || 1,
      });
    }
  }, [question]);

  const validate = () => {
    if (!form.question.trim()) return 'Pertanyaan wajib diisi';
    if (form.type === 'pilihan_ganda') {
      const filled = form.options.filter(o => o.trim());
      if (filled.length < 2) return 'Minimal 2 opsi jawaban';
      if (!form.correct_answer.trim()) return 'Jawaban benar wajib dipilih';
    }
    if (form.type === 'benar_salah' && !form.correct_answer) return 'Jawaban benar wajib dipilih';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan pertanyaan');
    } finally {
      setLoading(false);
    }
  };

  const updateOption = (idx, value) => {
    const newOpts = [...form.options];
    newOpts[idx] = value;
    setForm(prev => ({ ...prev, options: newOpts }));
  };

  const addOption = () => {
    if (form.options.length < 6) {
      setForm(prev => ({ ...prev, options: [...prev.options, ''] }));
    }
  };

  const removeOption = (idx) => {
    const newOpts = form.options.filter((_, i) => i !== idx);
    setForm(prev => ({ ...prev, options: newOpts, correct_answer: prev.correct_answer === prev.options[idx] ? '' : prev.correct_answer }));
  };

  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {question ? 'Edit Pertanyaan' : 'Tambah Pertanyaan'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form id="question-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipe Soal</label>
              <div className="flex gap-2 flex-wrap">
                {QUESTION_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, type: t.value, correct_answer: '', options: [...defaultOptions] }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === t.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Pertanyaan</label>
              <textarea
                value={form.question}
                onChange={e => setForm(prev => ({ ...prev, question: e.target.value }))}
                rows={3}
                placeholder="Tulis pertanyaan di sini..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
              />
            </div>

            {/* Pilihan Ganda options */}
            {form.type === 'pilihan_ganda' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Opsi Jawaban</label>
                <div className="space-y-2">
                  {form.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="radio"
                          name="correct"
                          checked={form.correct_answer === opt && opt.trim() !== ''}
                          onChange={() => { if (opt.trim()) setForm(prev => ({ ...prev, correct_answer: opt })); }}
                          className="w-4 h-4 text-indigo-600"
                          title="Pilih sebagai jawaban benar"
                        />
                        <span className="w-6 h-6 flex-shrink-0 bg-indigo-100 text-indigo-700 text-xs font-bold rounded flex items-center justify-center">
                          {optionLabels[idx]}
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={e => updateOption(idx, e.target.value)}
                          placeholder={`Opsi ${optionLabels[idx]}`}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                      </div>
                      {form.options.length > 2 && (
                        <button type="button" onClick={() => removeOption(idx)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {form.options.length < 6 && (
                  <button type="button" onClick={addOption} className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Tambah opsi
                  </button>
                )}
                <p className="text-xs text-gray-400 mt-1">Klik radio button untuk menandai jawaban benar</p>
              </div>
            )}

            {/* Benar/Salah */}
            {form.type === 'benar_salah' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Jawaban Benar</label>
                <div className="flex gap-3">
                  {['Benar', 'Salah'].map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, correct_answer: opt }))}
                      className={`flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition-colors ${form.correct_answer === opt ? (opt === 'Benar' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Explanation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Penjelasan <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <textarea
                value={form.explanation}
                onChange={e => setForm(prev => ({ ...prev, explanation: e.target.value }))}
                rows={2}
                placeholder="Penjelasan jawaban yang ditampilkan setelah selesai kuis..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
              />
            </div>

            {/* Points */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Poin</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.points}
                onChange={e => setForm(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
                className="w-24 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors text-sm">
            Batal
          </button>
          <button
            form="question-form"
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
