import { useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { AppShell } from '../components/AppShell'
import { CategoriesPage } from '../pages/CategoriesPage'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { ProductsPage } from '../pages/ProductsPage'
import { ReportsPage } from '../pages/ReportsPage'
import { SalesPage } from '../pages/SalesPage'
import { SettingsPage } from '../pages/SettingsPage'
import { SetupPage } from '../pages/SetupPage'
import { StockPage } from '../pages/StockPage'
import { TransactionsPage } from '../pages/TransactionsPage'
import { UnitsPage } from '../pages/UnitsPage'
import { UsersPage } from '../pages/UsersPage'
import { posApi, type CompleteSetupInput } from '../services/posApi'
import type { AppUser, PageKey, Sale, StoreSettings } from '../types/pos'

const defaultStoreSettings: StoreSettings = {
  storeName: 'POS TOKO',
  storeAddress: '',
  storePhone: '',
  receiptFooter: 'Terima kasih',
  receiptPaperSize: '80mm',
  currency: 'IDR',
  printerName: '',
  receiptLogoPath: '',
}

const SESSION_USER_KEY = 'pos-toko-session-user'

function readStoredSessionUser(): AppUser | null {
  try {
    const raw = window.localStorage.getItem(SESSION_USER_KEY)
    return raw ? JSON.parse(raw) as AppUser : null
  } catch {
    return null
  }
}

function saveSessionUser(user: AppUser) {
  window.localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user))
}

function clearSessionUser() {
  window.localStorage.removeItem(SESSION_USER_KEY)
}

function App() {
  const [hasSetup, setHasSetup] = useState<boolean | null>(null)
  const [isSessionChecking, setIsSessionChecking] = useState(true)
  const [user, setUser] = useState<AppUser | null>(null)
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard')
  const [sales, setSales] = useState<Sale[]>([])
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(defaultStoreSettings)

  useEffect(() => {
    let isMounted = true

    async function boot() {
      try {
        const status = await posApi.getSetupStatus()
        if (!isMounted) return
        setHasSetup(status.isSetupComplete)

        if (!status.isSetupComplete) {
          setIsSessionChecking(false)
          return
        }

        const storedUser = readStoredSessionUser()
        if (!storedUser?.id) {
          setIsSessionChecking(false)
          return
        }

        try {
          const sessionUser = await posApi.getUserSession(storedUser.id)
          if (!isMounted) return
          setUser(sessionUser)
          saveSessionUser(sessionUser)
        } catch {
          clearSessionUser()
        } finally {
          if (isMounted) setIsSessionChecking(false)
        }
      } catch {
        if (isMounted) {
          setHasSetup(false)
          setIsSessionChecking(false)
        }
      }
    }

    void boot()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!user) return

    let isMounted = true
    posApi
      .listSales()
      .then(async (nextSales) => {
        const nextSettings = await posApi.getStoreSettings()
        if (isMounted) {
          setSales(nextSales)
          setStoreSettings({ ...defaultStoreSettings, ...nextSettings })
        }
      })
      .catch(() => {
        if (isMounted) {
          setSales([])
          setStoreSettings(defaultStoreSettings)
        }
      })

    return () => {
      isMounted = false
    }
  }, [user])

  useEffect(() => {
    if (!user) return

    const updateTimeout = setTimeout(() => {
      check().then((update) => {
        if (!update) return
        if (window.confirm(`Versi baru tersedia: ${update.version}.\n\nIngin download dan install sekarang? App akan restart otomatis.`)) {
          update.downloadAndInstall().then(() => {
            // App will restart automatically after install
          }).catch(() => {
            // silently fail - offline or download error
          })
        }
      }).catch(() => {
        // silently fail - offline or server unreachable
      })
    }, 2000)

    return () => clearTimeout(updateTimeout)
  }, [user])

  async function handleCompleteSetup(input: CompleteSetupInput) {
    const admin = await posApi.completeInitialSetup(input)
    saveSessionUser(admin)
    setUser(admin)
    setHasSetup(true)
    setCurrentPage('dashboard')
  }

  function handleLogin(nextUser: AppUser) {
    saveSessionUser(nextUser)
    setUser(nextUser)
    setCurrentPage('dashboard')
  }

  function handleLogout() {
    clearSessionUser()
    setUser(null)
    setCurrentPage('dashboard')
  }

  if (hasSetup === null || (hasSetup && isSessionChecking && !user)) {
    return (
      <div className="auth-screen">
        <div className="boot-card">{hasSetup ? 'Memeriksa sesi login...' : 'Menyiapkan database lokal POS TOKO...'}</div>
      </div>
    )
  }

  if (!hasSetup) {
    return <SetupPage onComplete={handleCompleteSetup} />
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />
  }

  const activeUser = user

  function handleNavigate(page: PageKey) {
    if (activeUser.role === 'kasir' && ['products', 'categories', 'units', 'reports', 'users', 'settings'].includes(page)) {
      setCurrentPage('dashboard')
      return
    }
    setCurrentPage(page)
  }

  function handleCompleteSale(sale: Sale) {
    setSales((current) => [sale, ...current])
  }

  function handleOperationalDataReset() {
    setSales([])
    setCurrentPage('dashboard')
  }

  function renderPage() {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage user={activeUser} sales={sales} onNavigate={handleNavigate} />
      case 'sales':
        return <SalesPage user={activeUser} latestSale={sales[0]} onCompleteSale={handleCompleteSale} />
      case 'transactions':
        return <TransactionsPage user={activeUser} />
      case 'products':
        return <ProductsPage />
      case 'categories':
        return <CategoriesPage />
      case 'units':
        return <UnitsPage />
      case 'stock':
        return <StockPage user={activeUser} />
      case 'reports':
        return <ReportsPage sales={sales} />
      case 'users':
        return <UsersPage currentUser={activeUser} />
      case 'settings':
        return <SettingsPage onOperationalDataReset={handleOperationalDataReset} />
      default:
        return <DashboardPage user={activeUser} sales={sales} onNavigate={handleNavigate} />
    }
  }

  return (
    <AppShell
      currentPage={currentPage}
      user={activeUser}
      storeSettings={storeSettings}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      {renderPage()}
    </AppShell>
  )
}

export default App
