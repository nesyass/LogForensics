import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

import { useBodyLock, useEscape } from '../lib/hooks'

function depth(level: number) {
  return level > 1 ? { overlay: 70, panel: 71 } : { overlay: 60, panel: 61 }
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  level = 1,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md'
  level?: number
}) {
  useEscape(open, onClose)
  useBodyLock(open)
  if (!open) return null
  const z = depth(level)

  return createPortal(
    <>
      <div
        className="overlay"
        style={{ zIndex: z.overlay }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`modal ${size === 'sm' ? 'modal-sm' : ''}`}
        style={{ zIndex: z.panel }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div className="modal-head-text">
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </>,
    document.body,
  )
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  children,
  level = 1,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  eyebrow?: ReactNode
  children: ReactNode
  level?: number
}) {
  useEscape(open, onClose)
  useBodyLock(open)
  if (!open) return null
  const z = depth(level)

  return createPortal(
    <>
      <div
        className="overlay"
        style={{ zIndex: z.overlay }}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="drawer"
        style={{ zIndex: z.panel }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="drawer-head">
          <div className="drawer-head-text">
            {eyebrow}
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close inspector"
          >
            <X />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  busy = false,
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  busy?: boolean
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65 }}>
        {description}
      </p>
    </Modal>
  )
}
