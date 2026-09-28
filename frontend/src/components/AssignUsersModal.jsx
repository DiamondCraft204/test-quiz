import { useState, useEffect } from 'react'
import { adminApi } from '../api/axios'
import { Users, UserCheck, Globe, Search, Loader2, X, Save, AlertCircle } from 'lucide-react'

export default function AssignUsersModal({ quiz, onClose, onSuccess }) {
  const [targetType, setTargetType] = useState(() => quiz?.target_type || 'all')
  const [usersList, setUsersList] = useState([])
  const [selectedUserIds, setSelectedUserIds] = useState(() => {
    try {
      const raw = quiz?.allowed_user_ids
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return Array.isArray(parsed) ? parsed.map(Number) : []
    } catch {
      return []
    }
  })
  const [userSearch, setUserSearch] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true)
      try {
        const res = await adminApi.get('/admin/users')
        setUsersList(res.data.data || [])
      } catch (err) {
        setError('Gagal memuat daftar peserta dari database.')
      } finally {
        setLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [])

  const filteredUsers = usersList.filter(
    (u) =>
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

  const toggleUser = (id) => {
    const numId = Number(id)
    setSelectedUserIds((prev) =>
      prev.includes(numId) ? prev.filter((uid) => uid !== numId) : [...prev, numId]
    )
  }

  const handleSelectAll = () => {
    setSelectedUserIds(usersList.map((u) => Number(u.id)))
  }

  const handleDeselectAll = () => {
    setSelectedUserIds([])
  }

  const handleSave = async () => {
    setError('')
    if (targetType === 'specific' && selectedUserIds.length === 0) {
      setError('Pilih minimal 1 peserta untuk kuis bertipe khusus.')
      return
    }

    setSaving(true)
    try {
      const res = await adminApi.put(`/admin/quizzes/${quiz.id}/audience`, {
        targetType,
        allowedUserIds: selectedUserIds,
      })
      if (onSuccess) {
        onSuccess(res.data.data)
      }
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan sasaran peserta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Atur Sasaran Peserta Kuis
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md font-medium">
              {quiz?.title}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Audience Mode Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Tipe Akses Kuis
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setTargetType('all')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                  targetType === 'all'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="assignTargetType"
                  checked={targetType === 'all'}
                  onChange={() => setTargetType('all')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-gray-800">
                    <Globe className="w-3.5 h-3.5 text-emerald-600" />
                    Semua Peserta (Publik)
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Semua peserta terdaftar dapat mengakses dan mengerjakan kuis ini.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setTargetType('specific')}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                  targetType === 'specific'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="assignTargetType"
                  checked={targetType === 'specific'}
                  onChange={() => setTargetType('specific')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-gray-800">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    Hanya Peserta Tertentu
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Hanya akun user yang dipilih yang dapat melihat dan mengerjakan.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* User Checkbox Selection */}
          {targetType === 'specific' && (
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari peserta dari database..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 transition"
                  >
                    Pilih Semua
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="text-gray-600 hover:text-gray-800 font-semibold px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition"
                  >
                    Batal
                  </button>
                  <span className="font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-full text-[11px]">
                    {selectedUserIds.length} dipilih
                  </span>
                </div>
              </div>

              {loadingUsers ? (
                <div className="py-8 flex items-center justify-center gap-2 text-gray-500 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  Memuat data user dari database...
                </div>
              ) : usersList.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-500">
                  Belum ada peserta yang terdaftar di database.
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-500">
                  Tidak ditemukan peserta yang cocok dengan "{userSearch}".
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
                  {filteredUsers.map((u) => {
                    const isChecked = selectedUserIds.includes(Number(u.id))
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-indigo-50/50 transition ${
                          isChecked ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleUser(u.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                          {u.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-800 truncate">{u.name}</div>
                          <div className="text-gray-400 text-[11px] truncate">{u.email}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 text-xs font-semibold transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan Konfigurasi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
