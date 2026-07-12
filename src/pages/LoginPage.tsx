import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { useToast } from '../components/ToastProvider'
import { posApi } from '../services/posApi'
import type { AppUser } from '../types/pos'
import logoKasir from '../../logo kasir.png'

type LoginPageProps = {
  onLogin: (user: AppUser) => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { showToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const user = await posApi.login({ username, password })
      onLogin(user)
    } catch (loginError) {
      showToast(loginError instanceof Error ? loginError.message : 'Username atau password tidak valid.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-screen">
      <Card className="login-card">
        <div className="auth-copy login-hero">
          <div className="login-hero-brand">
            <img src={logoKasir} alt="POS TOKO" />
            <div>
              <span>POS TOKO</span>
              <strong>Offline POS Desktop</strong>
            </div>
          </div>

          <div className="login-hero-copy">
            <span className="eyebrow">Akses toko</span>
            <h1>Masuk dan mulai transaksi.</h1>
            <p>Gunakan akun admin atau kasir untuk mengakses POS TOKO.</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Masukkan username" autoFocus autoComplete="username" />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}>
                {showPassword ? <EyeOff size={18} strokeWidth={2.4} /> : <Eye size={18} strokeWidth={2.4} />}
                <span>{showPassword ? 'Sembunyikan' : 'Lihat'}</span>
              </button>
            </div>
          </label>
          <Button type="submit" size="lg" disabled={isSubmitting || !username.trim() || !password}>
            {isSubmitting ? 'Memeriksa login...' : 'Masuk aplikasi'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
