import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { SEVERITY_LABEL } from '../lib/constants'
import type { Severity } from '../types'

export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span className="sev" data-severity={severity}>
      {SEVERITY_LABEL[severity] ?? severity}
    </span>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <div className="page-eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading case data…' }: { label?: string }) {
  return (
    <div className="page-loading" role="status">
      <svg
        className="spin"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 12a9 9 0 1 1-6.2-8.56" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="banner-error" role="alert">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
    </div>
  )
}
