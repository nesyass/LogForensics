import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useToast } from '../context/ToastContext'
import { api, errorMessage } from '../lib/api'
import { RULE_BY_ID, STATUS_LABEL, STATUS_ORDER } from '../lib/constants'
import { formatDateTime, titleCase } from '../lib/format'
import type { Alert, EventDetail, ReviewStatus } from '../types'
import { Drawer } from './Modal'
import { ErrorBanner, SeverityChip } from './ui'

function metaValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function AlertDrawer({
  caseId,
  alert,
  timezone,
  onClose,
  onOpenEvent,
  onStatusChange,
  updating = false,
  level = 1,
}: {
  caseId: string | null
  alert: Alert | null
  timezone: string
  onClose: () => void
  onOpenEvent: (eventId: string) => void
  onStatusChange: (status: ReviewStatus) => void
  updating?: boolean
  level?: number
}) {
  const [evidence, setEvidence] = useState<EventDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!caseId || !alert) {
      setEvidence([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all(alert.evidence_event_ids.map((id) => api.event(caseId, id)))
      .then((items) => {
        if (cancelled) return
        items.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''))
        setEvidence(items)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [caseId, alert])

  async function copyReason() {
    if (!alert) return
    try {
      await navigator.clipboard.writeText(alert.reason)
      toast('Alert rationale copied.', 'success')
    } catch {
      toast('The clipboard is not available in this browser.', 'error')
    }
  }

  const rule = alert ? RULE_BY_ID[alert.rule_id] : undefined

  return (
    <Drawer
      open={Boolean(alert)}
      onClose={onClose}
      level={level}
      eyebrow={
        alert ? (
          <div className="meta-grid">
            <SeverityChip severity={alert.severity} />
            <span className="badge rule">{alert.rule_id}</span>
          </div>
        ) : null
      }
      title={alert?.title ?? 'Detection detail'}
      subtitle={
        alert
          ? `${alert.source_ip ?? 'Multiple sources'} · ${alert.event_count} evidence events`
          : undefined
      }
    >
      {alert ? (
        <>
          <section className="drawer-section">
            <h3>Review</h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <select
                className="select status-select"
                value={alert.status}
                disabled={updating}
                data-status={alert.status}
                onChange={(event) =>
                  onStatusChange(event.target.value as ReviewStatus)
                }
                aria-label="Alert review status"
              >
                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
              <span className="muted" style={{ fontSize: 11.5 }}>
                Status is stored locally with the case.
              </span>
            </div>
          </section>

          <section className="drawer-section">
            <h3>Why this fired</h3>
            <div className="reason-box">{alert.reason}</div>
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={copyReason}
              >
                Copy rationale
              </button>
            </div>
          </section>

          <section className="drawer-section">
            <h3>Detection window</h3>
            <dl className="kv">
              <div className="kv-row">
                <dt>Rule</dt>
                <dd>
                  <span className="mono">{alert.rule_id}</span> ·{' '}
                  {rule?.name ?? 'Custom detection'}
                </dd>
              </div>
              <div className="kv-row">
                <dt>First seen</dt>
                <dd className="mono">
                  {formatDateTime(alert.first_seen, timezone)}
                </dd>
              </div>
              <div className="kv-row">
                <dt>Last seen</dt>
                <dd className="mono">
                  {formatDateTime(alert.last_seen, timezone)}
                </dd>
              </div>
              <div className="kv-row">
                <dt>Source IP</dt>
                <dd className="mono">{alert.source_ip ?? 'Multiple sources'}</dd>
              </div>
              <div className="kv-row">
                <dt>Evidence events</dt>
                <dd>{alert.event_count}</dd>
              </div>
              {Object.entries(alert.metadata).map(([key, value]) => (
                <div className="kv-row" key={key}>
                  <dt>{titleCase(key)}</dt>
                  <dd className="mono" style={{ fontSize: 10.5 }}>
                    {metaValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="drawer-section">
            <h3>Evidence events</h3>
            {error ? <ErrorBanner message={error} /> : null}
            {loading ? (
              <p className="muted" style={{ fontSize: 12 }}>
                Loading evidence…
              </p>
            ) : null}
            {!loading && !error ? (
              <div className="evidence-list">
                {evidence.map((event) => (
                  <button
                    type="button"
                    className="evidence-item"
                    key={event.event_id}
                    onClick={() => onOpenEvent(event.event_id)}
                  >
                    <span className="mono">
                      {formatDateTime(event.timestamp, timezone).slice(-8)}
                    </span>
                    <span>{titleCase(event.event_type)}</span>
                    <span
                      className="mono"
                      style={{ flex: 'none', color: 'var(--ink-3)' }}
                    >
                      {event.source_file}:{event.source_line}
                    </span>
                    <ChevronRight />
                  </button>
                ))}
                {evidence.length === 0 ? (
                  <div style={{ padding: 12, fontSize: 12 }} className="muted">
                    No evidence events were returned.
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </Drawer>
  )
}
