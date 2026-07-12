import { useEffect, useState } from 'react'
import { CheckCircle, X, XCircle } from 'lucide-react'

export type ToastType = 'success' | 'error'

export type ToastItem = {
  id: string
  message: string
  type: ToastType
}

type ToastProps = {
  toast: ToastItem
  onClose: (id: string) => void
}

export function Toast({ toast, onClose }: ToastProps) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true)
    }, 4600)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (leaving) {
      const timer = setTimeout(() => {
        onClose(toast.id)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [leaving, onClose, toast.id])

  return (
    <div
      className={`toast-item ${toast.type} ${leaving ? 'toast-leaving' : ''}`}
      role="alert"
    >
      <span className="toast-icon">
        {toast.type === 'success' ? <CheckCircle size={18} strokeWidth={2.5} /> : <XCircle size={18} strokeWidth={2.5} />}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={() => setLeaving(true)} aria-label="Tutup">
        <X size={15} strokeWidth={2.5} />
      </button>
    </div>
  )
}
