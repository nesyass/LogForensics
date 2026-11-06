import { Copy, FileText } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { api, errorMessage } from '../lib/api'
import { formatDateTime, titleCase } from '../lib/format'
import type { EventDetail } from '../types'
import { useToast } from '../context/ToastContext'
import { Drawer } from './Modal'
import { ErrorBanner, LoadingBlock } from './ui'

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="kv-row">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  )
}

export function EventDrawer({
  caseId,
  eventId,
  timezone,
  onClose,
  level = 1,
}: {
  caseId: string | null
  eventId: string | null
  timezone: string
  onClose: () => void
  level?: number
}) {
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!caseId || !eventId) {
      setEvent(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .event(caseId, eventId)
      .then((payload) => {
        if (!cancelled) setEvent(payload)
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
  }, [caseId, eventId])

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast('Raw log line copied to the clipboard.', 'success')
    } catch {
      toast('The clipboard is not available in this browser.', 'error')
    }
  }

  const open = Boolean(eventId)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      level={level}
      eyebrow={
        event ? (
          <div className="meta-grid">
            <span className="badge">{titleCase(event.event_category)}</span>
            <span className="badge">{event.event_id}</span>
          </div>
        ) : null
      }
      title={event ? titleCase(event.event_type) : 'Event detail'}
      subtitle={
        event ? formatDateTime(event.timestamp, timezone) : 'Loading evidence…'
      }
    >
      {loading && !event ? <LoadingBlock label="Loading event evidence…" /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {event ? (
        <>
          <section className="drawer-section">
            <h3>Normalized event</h3>
            <dl className="kv">
              <Row label="Event ID" value={<span className="mono">{event.event_id}</span>} />
              <Row
                label="Timestamp"
                value={
                  <span className="mono">
                    {formatDateTime(event.timestamp, timezone)}
                  </span>
                }
              />
              <Row label="Category" value={titleCase(event.event_category)} />
              <Row label="Type" value={titleCase(event.event_type)} />
              {event.host ? <Row label="Host" value={event.host} /> : null}
              {event.username ? <Row label="User" value={event.username} /> : null}
              {event.source_ip ? (
                <Row
                  label="Source"
                  value={
                    <span className="mono">
                      {event.source_ip}
                      {event.source_port ? `:${event.source_port}` : ''}
                    </span>
                  }
                />
              ) : null}
              {event.destination_ip ? (
                <Row
                  label="Destination"
                  value={<span className="mono">{event.destination_ip}</span>}
                />
              ) : null}
              {event.http_method || event.http_path ? (
                <Row
                  label="HTTP request"
                  value={
                    <span className="mono">
                      {[event.http_method, event.http_path]
                        .filter(Boolean)
                        .join(' ')}
                      {event.http_status ? ` → ${event.http_status}` : ''}
                    </span>
                  }
                />
              ) : null}
              {event.process || event.pid ? (
                <Row
                  label="Process"
                  value={
                    <span className="mono">
                      {event.process ?? '—'}
                      {event.pid ? ` (${event.pid})` : ''}
                    </span>
                  }
                />
              ) : null}
              {event.user_agent ? <Row label="User agent" value={event.user_agent} /> : null}
            </dl>
          </section>

          <section className="drawer-section">
            <h3>Parsing provenance</h3>
            <dl className="kv">
              <Row label="Parser" value={event.source_type} />
              <Row label="Precision" value={event.timestamp_precision} />
              <Row
                label="Timezone known"
                value={event.timestamp_timezone_known ? 'Yes' : 'No — assumption applied'}
              />
              <Row label="Parse status" value={titleCase(event.parse_status)} />
              {event.timestamp_assumption ? (
                <Row label="Assumption" value={event.timestamp_assumption} />
              ) : null}
            </dl>
          </section>

          <section className="drawer-section">
            <h3>Raw source line</h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 10, color: 'var(--ink-3)' }}
              >
                <FileText
                  style={{ width: 12, height: 12, verticalAlign: -1, marginRight: 5 }}
                />
                {event.source_file}:{event.source_line}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => copy(event.raw_message)}
              >
                <Copy /> Copy
              </button>
            </div>
            <pre className="raw-box">{event.raw_message}</pre>
          </section>

          {event.message && event.message !== event.raw_message ? (
            <section className="drawer-section">
              <h3>Normalized message</h3>
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.65,
                  color: 'var(--ink-2)',
                }}
              >
                {event.message}
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </Drawer>
  )
}
