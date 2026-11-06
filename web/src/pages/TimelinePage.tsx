import {
  ChartNoAxesColumn,
  ChevronRight,
  FolderOpen,
  Info,
  Plus,
  ScrollText,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { EventDrawer } from '../components/EventDrawer'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  SeverityChip,
} from '../components/ui'
import { useCases } from '../context/CaseContext'
import { api, errorMessage } from '../lib/api'
import { CATEGORY_COLORS } from '../lib/constants'
import {
  durationLabel,
  formatDateTime,
  formatShortDate,
  formatTime,
  titleCase,
} from '../lib/format'
import type { TimelineBucket, TimelineData } from '../types'

const W = 960
const H = 300
const TOP = 16
const BOTTOM = 34

function TimelineChart({
  buckets,
  timezone,
}: {
  buckets: TimelineBucket[]
  timezone: string
}) {
  if (buckets.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 12, padding: '28px 0' }}>
        No timestamped events are available for a timeline.
      </p>
    )
  }

  const max = Math.max(...buckets.map((bucket) => bucket.total), 1)
  const height = H - TOP - BOTTOM
  const slot = W / buckets.length
  const barWidth = Math.max(2, slot - Math.max(1.5, slot * 0.24))
  const keys = ['authentication', 'web', 'system', 'unknown'] as const
  const tickIndices = [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
    Math.min(buckets.length - 1, Math.round(ratio * (buckets.length - 1))),
  )

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Stacked event timeline with alert evidence markers"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
        <line
          key={ratio}
          className="chart-grid"
          x1={0}
          x2={W}
          y1={TOP + height * ratio}
          y2={TOP + height * ratio}
        />
      ))}
      <text x={0} y={10} textAnchor="start">
        max {max} events / bucket
      </text>
      {buckets.map((bucket, index) => {
        const x = index * slot + (slot - barWidth) / 2
        let y = TOP + height
        return (
          <g className="bar-group" key={bucket.start}>
            <title>
              {formatDateTime(bucket.start, timezone)} · {bucket.total} events
              {bucket.alert_evidence
                ? ` · ${bucket.alert_evidence} alert evidence`
                : ''}
            </title>
            {keys.map((key) => {
              const value = bucket[key]
              if (!value) return null
              const barHeight = (value / max) * height
              y -= barHeight
              return (
                <rect
                  key={key}
                  className="bar-seg"
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(1, barHeight)}
                  fill={CATEGORY_COLORS[key]}
                />
              )
            })}
            {bucket.alert_evidence > 0 ? (
              <rect
                x={x}
                y={y - 5}
                width={barWidth}
                height={3}
                rx={1.5}
                fill="var(--accent)"
              />
            ) : null}
          </g>
        )
      })}
      {tickIndices.map((index, position) => {
        const bucket = buckets[index]
        if (!bucket) return null
        const anchor =
          position === 0 ? 'start' : position === tickIndices.length - 1 ? 'end' : 'middle'
        return (
          <text
            key={`${bucket.start}-${position}`}
            x={index * slot + slot / 2}
            y={H - 10}
            textAnchor={anchor}
          >
            {formatShortDate(bucket.start, timezone)}{' '}
            {formatTime(bucket.start, timezone)}
          </text>
        )
      })}
    </svg>
  )
}

export function TimelinePage() {
  const {
    activeCase,
    loadingCase,
    loadingCases,
    openNewAnalysis,
  } = useCases()
  const navigate = useNavigate()
  const [data, setData] = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)

  const caseId = activeCase?.id ?? null
  const timezone = activeCase?.timezone ?? 'UTC'

  useEffect(() => {
    if (!caseId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .timeline(caseId, 72)
      .then((payload) => {
        if (!cancelled) setData(payload)
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
  }, [caseId])

  if (loadingCases || (loadingCase && !activeCase)) {
    return (
      <div className="page">
        <LoadingBlock label="Building timeline…" />
      </div>
    )
  }

  if (!activeCase) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Investigation"
          title="Timeline"
          description="See event volume, alert evidence and correlated incidents on one axis."
        />
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="No case open"
            description="Create an analysis to build a timeline from parsed events."
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={openNewAnalysis}
              >
                <Plus /> New analysis
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const evidence = data?.evidence_events ?? []
  const incidents = data?.incidents ?? []
  const buckets = data?.buckets ?? []
  const peak = buckets.reduce(
    (best, bucket) => (bucket.total > best.total ? bucket : best),
    buckets[0] ?? { total: 0, start: '' },
  )

  return (
    <div className="page">
      <PageHeader
        eyebrow="Investigation"
        title="Timeline"
        description={`Event activity from ${formatDateTime(
          data?.first ?? activeCase.summary.first_event,
          timezone,
        )} to ${formatDateTime(
          data?.last ?? activeCase.summary.last_event,
          timezone,
        )}.`}
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/app/events')}
          >
            <ScrollText /> Event explorer
          </button>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div className="card-head-text">
            <div className="card-title">Activity chart</div>
            <div className="card-sub">
              {buckets.length} buckets · peak{' '}
              {peak.total ? `${peak.total} events` : 'no events'}
              {peak.start
                ? ` at ${formatTime(peak.start, timezone)}`
                : ''}{' '}
              · {durationLabel(data?.first, data?.last)}
            </div>
          </div>
          <div className="chart-legend">
            <span className="legend-item">
              <i style={{ background: 'var(--cat-auth)' }} /> Authentication
            </span>
            <span className="legend-item">
              <i style={{ background: 'var(--cat-web)' }} /> Web
            </span>
            <span className="legend-item">
              <i style={{ background: 'var(--cat-system)' }} /> System
            </span>
            <span className="legend-item">
              <i style={{ background: 'var(--accent)' }} /> Alert evidence
            </span>
          </div>
        </div>
        <div className="chart-card">
          {loading && !data ? (
            <div className="skeleton" style={{ height: H }} />
          ) : (
            <TimelineChart buckets={buckets} timezone={timezone} />
          )}
        </div>
        <div className="card-foot">
          <span>
            <Info
              style={{ width: 12, height: 12, verticalAlign: -2, marginRight: 5 }}
            />
            Bars are event volume; accent ticks mark buckets containing alert
            evidence.
          </span>
          <span>{evidence.length} evidence events</span>
        </div>
      </section>

      <div className="grid-main">
        <section className="card">
          <div className="card-head">
            <div className="card-head-text">
              <div className="card-title">Evidence events</div>
              <div className="card-sub">
                Events referenced by at least one detection, in time order
              </div>
            </div>
            <span className="badge">{evidence.length}</span>
          </div>
          {loading && !data ? (
            <div style={{ padding: 18 }}>
              {Array.from({ length: 6 }, (_, index) => (
                <div className="skeleton skeleton-line" key={index} />
              ))}
            </div>
          ) : evidence.length === 0 ? (
            <EmptyState
              icon={ChartNoAxesColumn}
              title="No alert evidence"
              description="No detection referenced an event in this case, so there is nothing to pin on the timeline."
            />
          ) : (
            <div
              className="timeline-rows"
              style={{ maxHeight: 520, overflowY: 'auto' }}
            >
              {evidence.map((event) => (
                <button
                  type="button"
                  className="timeline-row"
                  key={event.event_id}
                  onClick={() => setSelectedEvent(event.event_id)}
                >
                  <span className="mono">
                    {formatTime(event.timestamp, timezone)}
                  </span>
                  <i
                    style={{
                      background:
                        CATEGORY_COLORS[event.event_category] ??
                        'var(--cat-unknown)',
                    }}
                  />
                  <span
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <b style={{ fontWeight: 650 }}>
                      {titleCase(event.event_type)}
                    </b>
                    <span className="muted">
                      {' '}
                      · {event.source_ip ?? event.username ?? event.host ?? '—'}
                    </span>
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 9.5, color: 'var(--ink-3)' }}
                  >
                    {event.source_file}:{event.source_line}
                  </span>
                  <ChevronRight
                    style={{ width: 13, height: 13, color: 'var(--ink-3)' }}
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-head-text">
              <div className="card-title">Correlated incidents</div>
              <div className="card-sub">
                Alerts grouped by shared source address
              </div>
            </div>
            <span className="badge">{incidents.length}</span>
          </div>
          {incidents.length === 0 ? (
            <EmptyState
              icon={ChartNoAxesColumn}
              title="No correlations"
              description="No two alerts shared a source address in this case."
            />
          ) : (
            <div className="incident-list">
              {incidents.map((incident) => (
                <div className="incident" key={incident.incident_id}>
                  <div className="incident-head">
                    <SeverityChip severity={incident.severity} />
                    <span className="incident-ip">
                      {incident.source_ip ?? 'Unknown source'}
                    </span>
                    <span className="mono">{incident.incident_id}</span>
                  </div>
                  <p>{incident.reasons[0] ?? 'Related alerts from this source.'}</p>
                  <div className="incident-meta">
                    <span>{incident.alert_ids.length} alerts</span>
                    <span>{incident.event_ids.length} events</span>
                    <span>{durationLabel(incident.first_seen, incident.last_seen)}</span>
                  </div>
                  <div style={{ marginTop: 9 }}>
                    <button
                      type="button"
                      className="link"
                      onClick={() =>
                        navigate(
                          `/app/events?ip=${encodeURIComponent(incident.source_ip ?? '')}`,
                        )
                      }
                    >
                      Inspect source events
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="card-foot">
            <span>Correlation follows shared IPs, not causality.</span>
          </div>
        </section>
      </div>

      <EventDrawer
        caseId={caseId}
        eventId={selectedEvent}
        timezone={timezone}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}
