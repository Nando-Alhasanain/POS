import { createContext, useCallback, useContext, useState } from 'react'
import { Toast, type ToastItem, type ToastType } from './Toast'

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
})

export function useToast() {
  return useContext(ToastContext)
}

let toastCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const closeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = `toast-${Date.now()}-${++toastCounter}`
    setToasts((current) => [...current.slice(-2), { id, message, type }])
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={closeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
