import { useEffect, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import {
  BarChart3,
  Boxes,
  ClipboardList,
  History,
  Layers3,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Tags,
  Users,
} from 'lucide-react'
import type { AppUser, PageKey, StoreSettings, UserRole } from '../types/pos'
import logoKasir from '../../logo kasir.png'

const fallbackAppVersion = '0.1.1'

type MenuItem = {
  key: PageKey
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  roles: UserRole[]
}

const menuItems: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['admin', 'kasir'] },
  { key: 'sales', label: 'Transaksi', icon: ShoppingCart, roles: ['admin', 'kasir'] },
  { key: 'transactions', label: 'Riwayat Transaksi', icon: History, roles: ['admin', 'kasir'] },
  { key: 'products', label: 'Produk', icon: Package, roles: ['admin'] },
  { key: 'categories', label: 'Kategori', icon: Tags, roles: ['admin'] },
  { key: 'units', label: 'Satuan', icon: Layers3, roles: ['admin'] },
  { key: 'stock', label: 'Stok', icon: Boxes, roles: ['admin', 'kasir'] },
  { key: 'reports', label: 'Laporan', icon: ClipboardList, roles: ['admin'] },
  { key: 'users', label: 'Akun', icon: Users, roles: ['admin'] },
  { key: 'settings', label: 'Pengaturan', icon: Settings, roles: ['admin'] },
]

type AppShellProps = {
  currentPage: PageKey
  user: AppUser
  storeSettings: StoreSettings
  onNavigate: (page: PageKey) => void
  onLogout: () => void
  children: React.ReactNode
}

export function AppShell({ currentPage, user, onNavigate, onLogout, children }: AppShellProps) {
  const [appVersion, setAppVersion] = useState(fallbackAppVersion)
  const visibleItems = menuItems.filter((item) => item.roles.includes(user.role))
  const roleLabel = user.role === 'admin' ? 'Admin' : 'Kasir'
  const userInitial = user.name.trim().slice(0, 1).toUpperCase() || roleLabel.slice(0, 1)

  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion(fallbackAppVersion))
  }, [])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img className="brand-logo" src={logoKasir} alt="POS TOKO" />
          <div>
            <strong>POS TOKO</strong>
          </div>
        </div>

        <nav className="side-nav" aria-label="Menu utama">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={currentPage === item.key ? 'side-link active' : 'side-link'}
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
              >
                <span className="side-link-content">
                  <Icon size={18} strokeWidth={2.4} />
                  <span>{item.label}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-chip sidebar-profile">
            <div className="profile-avatar" aria-hidden="true">{userInitial}</div>
            <div className="profile-copy">
              <span>{roleLabel} aktif</span>
              <strong>{user.name}</strong>
            </div>
            <button type="button" className="profile-logout" onClick={onLogout} title="Logout" aria-label="Logout">
              <LogOut size={17} strokeWidth={2.5} />
            </button>
          </div>
          <div className="app-version" title={`Versi aplikasi ${appVersion}`}>Versi {appVersion}</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <h1>{visibleItems.find((item) => item.key === currentPage)?.label ?? 'POS TOKO'}</h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}
