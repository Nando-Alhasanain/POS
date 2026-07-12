import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { DataTable } from '../components/DataTable'
import { Dropdown } from '../components/Dropdown'
import { Modal } from '../components/Modal'
import { useToast } from '../components/ToastProvider'
import { posApi, type SaveUserInput } from '../services/posApi'
import type { AppUser, UserAccount, UserRole } from '../types/pos'
import { formatDateTime } from '../utils/format'

type UsersPageProps = {
  currentUser: AppUser
}

type UserForm = Omit<SaveUserInput, 'currentUserId'>

const emptyForm: UserForm = {
  name: '',
  username: '',
  role: 'kasir',
  password: '',
  isActive: true,
}

export function UsersPage({ currentUser }: UsersPageProps) {
  const [userRows, setUserRows] = useState<UserAccount[]>([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [resetTarget, setResetTarget] = useState<UserAccount | undefined>(undefined)
  const [newPassword, setNewPassword] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    const nextUsers = await posApi.listUsers()
    setUserRows(nextUsers)
  }

  const filteredUsers = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    return userRows.filter((item) => {
      if (!normalized) return true
      return item.name.toLowerCase().includes(normalized)
        || item.username.toLowerCase().includes(normalized)
        || item.role.toLowerCase().includes(normalized)
    })
  }, [query, userRows])

  function resetForm() {
    setForm(emptyForm)
  }

  function openCreateForm() {
    resetForm()
    setIsFormOpen(true)
  }

  function openEditForm(user: UserAccount) {
    setForm({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      password: '',
      isActive: user.isActive,
    })
    setIsFormOpen(true)
  }

  function closeForm() {
    setIsFormOpen(false)
    resetForm()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const payload: SaveUserInput = {
        ...form,
        password: form.password?.trim() || undefined,
        currentUserId: currentUser.id,
      }
      await posApi.saveUser(payload)
      showToast(form.id ? 'Akun pengguna berhasil diperbarui.' : 'Akun pengguna berhasil dibuat.', 'success')
      closeForm()
      await loadData()
    } catch (saveError) {
      showToast(saveError instanceof Error ? saveError.message : 'Akun gagal disimpan.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function toggleUserActive(user: UserAccount) {
    const nextActive = !user.isActive
    const action = nextActive ? 'Aktifkan' : 'Nonaktifkan'
    if (!window.confirm(`${action} akun ${user.name}?`)) return

    try {
      await posApi.setUserActive({ id: user.id, isActive: nextActive, currentUserId: currentUser.id })
      showToast(`Akun ${user.name} berhasil ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`, 'success')
      await loadData()
    } catch (toggleError) {
      showToast(toggleError instanceof Error ? toggleError.message : 'Status akun gagal diubah.', 'error')
    }
  }

  function openResetPassword(user: UserAccount) {
    setResetTarget(user)
    setNewPassword('')
  }

  async function handleResetPassword(event: React.FormEvent) {
    event.preventDefault()
    if (!resetTarget) return

    setIsResettingPassword(true)
    try {
      await posApi.resetUserPassword({ id: resetTarget.id, password: newPassword })
      showToast(`Password ${resetTarget.name} berhasil direset.`, 'success')
      setResetTarget(undefined)
      setNewPassword('')
      await loadData()
    } catch (resetError) {
      showToast(resetError instanceof Error ? resetError.message : 'Password gagal direset.', 'error')
    } finally {
      setIsResettingPassword(false)
    }
  }

  const activeAdminCount = userRows.filter((item) => item.role === 'admin' && item.isActive).length

  return (
    <div className="page-stack">
      <Card>
        <div className="section-header">
          <div>
            <span className="eyebrow">Akun pengguna</span>
            <h2>Admin dan kasir</h2>
          </div>
          <Button type="button" onClick={openCreateForm}>
            Tambah akun
          </Button>
        </div>
        <div className="toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, username, atau role" />
        </div>
        <DataTable<UserAccount>
          data={filteredUsers}
          pagination
          pageSize={10}
          columns={[
            { key: 'name', header: 'Nama', render: (item) => <div className="cell-title"><strong>{item.name}</strong><span>{item.username}</span></div> },
            { key: 'role', header: 'Role', render: (item) => <span className={item.role === 'admin' ? 'status-pill ok' : 'status-pill'}>{item.role === 'admin' ? 'Admin' : 'Kasir'}</span> },
            { key: 'status', header: 'Status', render: (item) => <span className={item.isActive ? 'status-pill ok' : 'status-pill warn'}>{item.isActive ? 'Aktif' : 'Nonaktif'}</span> },
            { key: 'updated', header: 'Diupdate', render: (item) => formatDateTime(item.updatedAt) },
            {
              key: 'action',
              header: 'Aksi',
              align: 'right',
              render: (item) => (
                <div className="inline-actions">
                  <Button type="button" variant="secondary" size="sm" onClick={() => openEditForm(item)}>
                    Edit
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => openResetPassword(item)}>
                    Reset password
                  </Button>
                  <Button
                    type="button"
                    variant={item.isActive ? 'danger' : 'secondary'}
                    size="sm"
                    onClick={() => void toggleUserActive(item)}
                    disabled={item.id === currentUser.id || (item.role === 'admin' && item.isActive && activeAdminCount <= 1)}
                  >
                    {item.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal title={form.id ? 'Edit akun' : 'Tambah akun'} open={isFormOpen} onClose={closeForm}>
        <form className="form-grid dense-form" onSubmit={handleSubmit}>
          <div className="two-columns">
            <label>
              Nama
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label>
              Username
              <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} required />
            </label>
          </div>
          <div className="two-columns">
            <label>
              Role
              <Dropdown
                value={form.role}
                onValueChange={(value) => setForm((current) => ({ ...current, role: value as UserRole }))}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'kasir', label: 'Kasir' },
                ]}
              />
            </label>
            <label>
              Password {form.id ? '(kosongkan jika tidak diganti)' : ''}
              <input
                type="password"
                value={form.password ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                minLength={6}
                required={!form.id}
              />
            </label>
          </div>
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              disabled={form.id === currentUser.id}
            />
            <span>Akun aktif dan bisa login</span>
          </label>
          <div className="form-note">
            Admin terakhir tidak bisa dinonaktifkan atau diubah menjadi kasir. Akun yang sedang login tidak bisa menonaktifkan dirinya sendiri.
          </div>
          <div className="form-actions">
            <Button type="submit" disabled={isSubmitting || !form.name.trim() || !form.username.trim() || (!form.id && (form.password?.length ?? 0) < 6)}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan akun'}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Batal
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title={resetTarget ? `Reset password ${resetTarget.name}` : 'Reset password'} open={Boolean(resetTarget)} onClose={() => setResetTarget(undefined)}>
        {resetTarget ? (
          <form className="form-grid dense-form" onSubmit={handleResetPassword}>
            <div className="form-note">
              Password baru minimal 6 karakter. User akan memakai password baru saat login berikutnya.
            </div>
            <label>
              Password baru
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} required />
            </label>
            <div className="form-actions">
              <Button type="submit" variant="danger" disabled={isResettingPassword || newPassword.length < 6}>
                {isResettingPassword ? 'Mereset...' : 'Reset password'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setResetTarget(undefined)}>
                Batal
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}
