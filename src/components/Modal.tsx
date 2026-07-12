import type { ReactNode } from 'react'
import { Button } from './Button'

type ModalProps = {
  title: string
  children: ReactNode
  open: boolean
  onClose: () => void
  wide?: boolean
}

export function Modal({ title, children, open, onClose, wide }: ModalProps) {
  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className={wide ? 'modal-panel modal-panel-wide' : 'modal-panel'} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <Button type="button" variant="ghost" onClick={onClose}>
            Tutup
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
