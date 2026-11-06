import {
  AlertTriangle,
  ChevronRight,
  Download,
  FileWarning,
  Flame,
  FolderOpen,
  Plus,
  ScrollText,
  ShieldAlert,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { LoadingBlock, EmptyState, ErrorBanner, PageHeader, SeverityChip } from '../components/ui'
import { useCases } from '../context/CaseContext'
import { api, errorMessage } from '../lib/api'
import {
  CATEGORY_COLORS,
  PARSER_LABEL,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
} from '../lib/constants'
import {
  durationLabel,
  formatDate,
  formatDateTime,
  formatNumber,
  formatShortDate,
  formatTime,
  titleCase,
} from '../lib/format'
import type { IpRow, TimelineBucket, TimelineData } from '../types'

const CHART_WIDTH = 820
const CHART_HEIGHT = 168
const CHART_TOP = 10
const CHART_BOTTOM = 26

function ActivityChart({
  buckets,
  timezone,
  first,
  last,
}: {
  buckets: TimelineBucket[]
  timezone: string
  first: string | null
  last: string | null
}) {
  if (buckets.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 12, padding: '20px 0' }}>
        No timestamped events were found in this case.
      </p>
    )
  }

  const max = Math.max(...buckets.map((bucket) => bucket.total), 1)
  const height = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM
  const width = CHART_WIDTH
  const slot = width / buckets.length
  const barWidth = Math.max(2, slot - Math.max(1.5, slot * 0.28))
  const keys = ['authentication', 'web', 'system', 'unknown'] as const

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Event activity over time"
    >
      {[0, 0.5, 1].map((ratio) => (
        <line
          key={ratio}
          className="chart-grid"
          x1={0}
          x2={width}
          y1={CHART_TOP + height * ratio}
          y2={CHART_TOP + height * ratio}
        />
      ))}
      {buckets.map((bucket, index) => {
        const x = index * slot + (slot - barWidth) / 2
        let y = CHART_TOP + height
        return (
          <g className="bar-group" key={bucket.start}>
            <title>
              {formatDateTime(bucket.start, timezone)} · {bucket.total} events
              {bucket.alert_evidence
                ? ` · ${bucket.alert_evidence} evidence`
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
                y={y - 4}
                width={barWidth}
                height={2.5}
                rx={1}
                fill="var(--accent)"
              />
            ) : null}
          </g>
        )
      })}
      <text x={0} y={CHART_HEIGHT - 7} textAnchor="start">
        {first
          ? `${formatShortDate(first, timezone)} ${formatTime(first, timezone)}`
          : ''}
      </text>
      <text x={width} y={CHART_HEIGHT - 7} textAnchor="end">
        {last
          ? `${formatShortDate(last, timezone)} ${formatTime(last, timezone)}`
          : ''}
      </text>
    </svg>
  )
}

export function OverviewPage() {
  const {
    activeCase,
    loadingCase,
    loadingCases,
    openNewAnalysis,
  } = useCases()
  const navigate = useNavigate()
  const [timeline, setTimeline] = useState<TimelineData | null>(null)
  const [ips, setIps] = useState<IpRow[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  const caseId = activeCase?.id ?? null

  useEffect(() => {
    if (!caseId) {
      setTimeline(null)
      setIps([])
      return
    }
    let cancelled = false
    setDataLoading(true)
    setDataError(null)
    Promise.all([api.timeline(caseId, 48), api.ips(caseId)])
      .then(([timelinePayload, ipPayload]) => {
        if (cancelled) return
        setTimeline(timelinePayload)
        setIps(ipPayload)
      })
      .catch((err) => {
        if (!cancelled) setDataError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [caseId])

  if (loadingCases || (loadingCase && !activeCase)) {
    return (
      <div className="page">
        <LoadingBlock label="Loading investigation…" />
      </div>
    )
  }

  if (!activeCase) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Workspace"
          title="No investigation open"
          description="Create a case from the bundled sample or upload Linux auth and web access logs. Everything stays local."
        />
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="Start your first analysis"
            description="The sample dataset is the fastest way to explore the workflow: 3 files, 51 events, 13 detections and 3 correlated incidents."
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

  const { summary, alerts, incidents, files } = activeCase
  const highCount =
    (summary.severity_counts.high ?? 0) +
    (summary.severity_counts.critical ?? 0)
  const needsReview = alerts.filter(
    (alert) => alert.status === 'needs_review',
  ).length
  const totalAlerts = summary.total_alerts || alerts.length
  const recent = alerts.slice(0, 5)
  const topIps = ips.slice(0, 5)
  const severityRows = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: summary.severity_counts[severity] ?? 0,
  })).filter((row) => row.count > 0)
  const chartBuckets = timeline?.buckets ?? []

  return (
    <div className="page">
      <PageHeader
        eyebrow="Case overview"
        title={activeCase.name}
        description={`Created ${formatDate(activeCase.created_at)} · ${summary.total_files} sources · ${activeCase.timezone} · ${
          PARSER_LABEL[activeCase.parser] ?? activeCase.parser
        }`}
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/app/exports')}
          >
            <Download /> Export case
          </button>
        }
      />

      {dataError ? <ErrorBanner message={dataError} /> : null}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">
            <ScrollText /> Parsed events
          </div>
          <div className="kpi-value">{formatNumber(summary.parsed_events)}</div>
          <div className="kpi-foot">
            from <strong>{formatNumber(summary.total_lines)}</strong> source lines
          </div>
        </div>
        <div className="kpi kpi-accent">
          <div className="kpi-label">
            <ShieldAlert /> Detections
          </div>
          <div className="kpi-value">{formatNumber(totalAlerts)}</div>
          <div className="kpi-foot">
            <strong>{needsReview}</strong> awaiting review
          </div>
        </div>
        <div className="kpi kpi-danger">
          <div className="kpi-label">
            <Flame /> High priority
          </div>
          <div className="kpi-value">{formatNumber(highCount)}</div>
          <div className="kpi-foot">
            {incidents.length} correlated incident
            {incidents.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <FileWarning /> Parse errors
          </div>
          <div className="kpi-value">{formatNumber(summary.parse_errors)}</div>
          <div className="kpi-foot">
            {summary.parse_errors
              ? 'Review unparsed lines in Sources'
              : 'No source lines were discarded'}
          </div>
        </div>
      </div>

      <div className="grid-main">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Activity over time</div>
                <div className="card-sub">
                  {formatDateTime(summary.first_event, activeCase.timezone)} →{' '}
                  {formatDateTime(summary.last_event, activeCase.timezone)} ·{' '}
                  {durationLabel(summary.first_event, summary.last_event)}
                </div>
              </div>
              <div className="chart-legend">
                <span className="legend-item">
                  <i style={{ background: 'var(--cat-auth)' }} /> Auth
                </span>
                <span className="legend-item">
                  <i style={{ background: 'var(--cat-web)' }} /> Web
                </span>
                <span className="legend-item">
                  <i style={{ background: 'var(--cat-system)' }} /> System
                </span>
                <span className="legend-item">
                  <i style={{ background: 'var(--accent)' }} /> Evidence
                </span>
              </div>
            </div>
            <div className="card-body" style={{ paddingTop: 10 }}>
              {dataLoading && !timeline ? (
                <div className="skeleton" style={{ height: 168 }} />
              ) : (
                <ActivityChart
                  buckets={chartBuckets}
                  timezone={activeCase.timezone}
                  first={timeline?.first ?? summary.first_event}
                  last={timeline?.last ?? summary.last_event}
                />
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Recent detections</div>
                <div className="card-sub">
                  {needsReview} of {totalAlerts} still need analyst review
                </div>
              </div>
              <button
                type="button"
                className="link"
                onClick={() => navigate('/app/alerts')}
              >
                View all
              </button>
            </div>
            {recent.length === 0 ? (
              <div className="empty" style={{ padding: '30px 20px' }}>
                <p>No detections fired on this dataset.</p>
              </div>
            ) : (
              <div className="mini-list">
                {recent.map((alert) => (
                  <button
                    key={alert.alert_id}
                    type="button"
                    className="mini-item"
                    onClick={() =>
                      navigate(`/app/alerts?alert=${encodeURIComponent(alert.alert_id)}`)
                    }
                  >
                    <SeverityChip severity={alert.severity} />
                    <span className="mini-item-main">
                      <b>{alert.title}</b>
                      <span>
                        {alert.rule_id} · {alert.source_ip ?? 'Multiple sources'} ·{' '}
                        {alert.event_count} evidence events
                      </span>
                    </span>
                    <span className="mini-item-side">
                      <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>
                        {formatShortDate(alert.first_seen, activeCase.timezone)}{' '}
                        {formatTime(alert.first_seen, activeCase.timezone)}
                      </span>
                      <ChevronRight />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Top source addresses</div>
                <div className="card-sub">
                  Ranked by event volume across all sources
                </div>
              </div>
              <button
                type="button"
                className="link"
                onClick={() => navigate('/app/ips')}
              >
                All IPs
              </button>
            </div>
            {topIps.length === 0 ? (
              <div className="empty" style={{ padding: '30px 20px' }}>
                <p>No source addresses were recorded.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Source IP</th>
                      <th style={{ textAlign: 'right' }}>Events</th>
                      <th style={{ textAlign: 'right' }}>Auth fail</th>
                      <th style={{ textAlign: 'right' }}>HTTP 4xx</th>
                      <th style={{ textAlign: 'right' }}>Alerts</th>
                      <th>Max severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topIps.map((row) => (
                      <tr
                        key={row.source_ip}
                        className="clickable"
                        onClick={() =>
                          navigate(
                            `/app/events?ip=${encodeURIComponent(row.source_ip)}`,
                          )
                        }
                      >
                        <td className="cell-mono">{row.source_ip}</td>
                        <td className="num">{formatNumber(row.total_events)}</td>
                        <td className="num">
                          {formatNumber(row.auth_failures)}
                        </td>
                        <td className="num">{formatNumber(row.http_4xx)}</td>
                        <td className="num">{formatNumber(row.alert_count)}</td>
                        <td>
                          <SeverityChip severity={row.max_severity} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Severity mix</div>
                <div className="card-sub">Base severity from the matching rule</div>
              </div>
            </div>
            <div className="card-body">
              {severityRows.length === 0 ? (
                <p className="muted" style={{ fontSize: 12 }}>
                  No detections recorded.
                </p>
              ) : (
                <div className="breakdown">
                  <div className="breakdown-bar">
                    {severityRows.map((row) => (
                      <i
                        key={row.severity}
                        style={{
                          width: `${(row.count / totalAlerts) * 100}%`,
                          background:
                            row.severity === 'critical' || row.severity === 'high'
                              ? 'var(--accent)'
                              : row.severity === 'medium'
                                ? 'var(--warn)'
                                : row.severity === 'low'
                                  ? 'var(--good)'
                                  : 'var(--ink-3)',
                        }}
                      />
                    ))}
                  </div>
                  <div className="breakdown-legend">
                    {severityRows.map((row) => (
                      <div className="legend-row" key={row.severity}>
                        <i
                          style={{
                            background:
                              row.severity === 'critical' || row.severity === 'high'
                                ? 'var(--accent)'
                                : row.severity === 'medium'
                                  ? 'var(--warn)'
                                  : row.severity === 'low'
                                    ? 'var(--good)'
                                    : 'var(--ink-3)',
                          }}
                        />
                        <span>{SEVERITY_LABEL[row.severity]}</span>
                        <b>{row.count}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Correlated incidents</div>
                <div className="card-sub">
                  Alerts grouped by shared source address
                </div>
              </div>
            </div>
            {incidents.length === 0 ? (
              <div className="empty" style={{ padding: '30px 20px' }}>
                <p>No cross-alert correlations for this case.</p>
              </div>
            ) : (
              <div className="incident-list">
                {incidents.slice(0, 4).map((incident) => (
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
                      <span>
                        {durationLabel(incident.first_seen, incident.last_seen)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {incidents.length > 0 ? (
              <div className="card-foot">
                <span>Correlation is a review aid, not a verdict.</span>
                <button
                  type="button"
                  className="link"
                  onClick={() => navigate('/app/timeline')}
                >
                  Open timeline
                </button>
              </div>
            ) : null}
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Case integrity</div>
                <div className="card-sub">Provenance recorded at ingestion</div>
              </div>
            </div>
            <div className="card-body">
              <div className="integrity-list">
                <div className="integrity-row">
                  <span>Source</span>
                  <b>{titleCase(activeCase.source)}</b>
                </div>
                <div className="integrity-row">
                  <span>Parser</span>
                  <b>{PARSER_LABEL[activeCase.parser] ?? activeCase.parser}</b>
                </div>
                <div className="integrity-row">
                  <span>Timezone</span>
                  <b>{activeCase.timezone}</b>
                </div>
                <div className="integrity-row">
                  <span>Year assumption</span>
                  <b>{activeCase.year ?? summary.year_assumption ?? '—'}</b>
                </div>
                <div className="integrity-row">
                  <span>Files</span>
                  <b>{summary.total_files}</b>
                </div>
                <div className="integrity-row">
                  <span>First event</span>
                  <b>{formatDateTime(summary.first_event, activeCase.timezone)}</b>
                </div>
                <div className="integrity-row">
                  <span>Last event</span>
                  <b>{formatDateTime(summary.last_event, activeCase.timezone)}</b>
                </div>
              </div>
              {files[0] ? (
                <div style={{ marginTop: 14 }}>
                  <div className="label" style={{ marginBottom: 5 }}>
                    SHA-256 · {files[0].name}
                  </div>
                  <div className="hash">{files[0].sha256}</div>
                </div>
              ) : null}
            </div>
            <div className="card-foot">
              <span>
                {summary.parse_errors === 0
                  ? 'All source lines accounted for.'
                  : `${summary.parse_errors} lines need review.`}
              </span>
              <button
                type="button"
                className="link"
                onClick={() => navigate('/app/sources')}
              >
                Sources
              </button>
            </div>
          </section>

          {alerts.some((alert) => alert.status !== 'needs_review') ? (
            <div className="note">
              <AlertTriangle />
              <span>
                <b>Review state is stored locally.</b> Statuses survive restarts
                but are not part of the exported evidence bundle.
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
