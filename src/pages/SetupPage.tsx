import { useState } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useToast } from '../components/ToastProvider'
import type { CompleteSetupInput } from '../services/posApi'

type SetupPageProps = {
  onComplete: (input: CompleteSetupInput) => Promise<void> | void
}

export function SetupPage({ onComplete }: SetupPageProps) {
  const [storeName, setStoreName] = useState('TOKO MAJU JAYA')
  const [storeAddress, setStoreAddress] = useState('Jl. Contoh No. 123, Bandung')
  const [storePhone, setStorePhone] = useState('08123456789')
  const [adminName, setAdminName] = useState('Admin Toko')
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [showPassword, setShowPassword] = useState(false)
  const { showToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await onComplete({ storeName, storeAddress, storePhone, adminName, username, password })
    } catch (setupError) {
      showToast(setupError instanceof Error ? setupError.message : 'Setup awal gagal.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-screen setup-screen">
      <Card className="setup-card">
        <div className="auth-copy">
          <span className="eyebrow">Setup awal</span>
          <h1>Siapkan toko dan akun admin pertama.</h1>
          <p>
            Flow ini akan menjadi tempat pembuatan database lokal, migrasi, data toko, dan akun admin saat backend Tauri + SQLite ditambahkan.
          </p>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Nama toko
            <input value={storeName} onChange={(event) => setStoreName(event.target.value)} />
          </label>
          <label>
            Alamat toko
            <textarea value={storeAddress} onChange={(event) => setStoreAddress(event.target.value)} rows={3} />
          </label>
          <label>
            Telepon toko
            <input value={storePhone} onChange={(event) => setStorePhone(event.target.value)} />
          </label>
          <label>
            Nama admin
            <input value={adminName} onChange={(event) => setAdminName(event.target.value)} />
          </label>
          <div className="two-columns">
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}>
                  <span>{showPassword ? 'Sembunyikan' : 'Lihat'}</span>
                </button>
              </div>
            </label>
          </div>
          <Button type="submit" size="lg" disabled={!storeName || !adminName || !username || password.length < 4 || isSubmitting}>
            {isSubmitting ? 'Menyimpan setup...' : 'Selesaikan setup'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
