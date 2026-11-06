import { Filter, FolderOpen, Plus, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { AlertDrawer } from '../components/AlertDrawer'
import { EventDrawer } from '../components/EventDrawer'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  SeverityChip,
} from '../components/ui'
import { useCases } from '../context/CaseContext'
import { useToast } from '../context/ToastContext'
import { api, errorMessage } from '../lib/api'
import {
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  STATUS_LABEL,
  STATUS_ORDER,
} from '../lib/constants'
import { durationLabel, formatShortDate, formatTime } from '../lib/format'
import type { Alert, ReviewStatus, Severity } from '../types'

export function AlertsPage() {
  const {
    activeCase,
    loadingCase,
    loadingCases,
    openNewAnalysis,
    applyAlertUpdate,
  } = useCases()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState<Severity | ''>('')
  const [status, setStatus] = useState<ReviewStatus | ''>('')
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    params.get('alert'),
  )
  const [eventId, setEventId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setAlerts(activeCase?.alerts ?? [])
  }, [activeCase])

  if (loadingCases || (loadingCase && !activeCase)) {
    return (
      <div className="page">
        <LoadingBlock label="Loading detections…" />
      </div>
    )
  }

  if (!activeCase) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Triage"
          title="Detections"
          description="Review explainable rule hits and the evidence that triggered them."
        />
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="No case open"
            description="Create an analysis to generate detections from Linux auth and web access logs."
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

  const needle = query.trim().toLowerCase()
  const filtered = alerts.filter((alert) => {
    if (severity && alert.severity !== severity) return false
    if (status && alert.status !== status) return false
    if (!needle) return true
    return `${alert.title} ${alert.rule_id} ${alert.reason} ${alert.source_ip ?? ''}`
      .toLowerCase()
      .includes(needle)
  })

  const selected = alerts.find((alert) => alert.alert_id === selectedId) ?? null
  const needsReview = alerts.filter(
    (alert) => alert.status === 'needs_review',
  ).length

  function openAlert(alert: Alert) {
    setSelectedId(alert.alert_id)
    const next = new URLSearchParams(params)
    next.set('alert', alert.alert_id)
    setParams(next, { replace: true })
  }

  function closeDrawer() {
    setSelectedId(null)
    const next = new URLSearchParams(params)
    next.delete('alert')
    setParams(next, { replace: true })
  }

  async function changeStatus(alert: Alert, nextStatus: ReviewStatus) {
    setUpdatingId(alert.alert_id)
    setError(null)
    try {
      const updated = await api.updateAlert(
        activeCase!.id,
        alert.alert_id,
        nextStatus,
      )
      setAlerts((current) =>
        current.map((item) =>
          item.alert_id === updated.alert_id ? updated : item,
        ),
      )
      applyAlertUpdate(updated)
      toast(`Alert marked “${STATUS_LABEL[nextStatus]}”.`, 'success')
    } catch (err) {
      setError(errorMessage(err))
      toast('Could not save the review status.', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Triage"
        title="Detections"
        description={`${alerts.length} rule hits · ${needsReview} still need review. Open a detection to read the rationale and inspect its evidence.`}
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="card">
        <div className="toolbar">
          <input
            className="input search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search detection, rule or source IP…"
            aria-label="Search detections"
          />
          <select
            className="select"
            value={severity}
            onChange={(event) =>
              setSeverity(event.target.value as Severity | '')
            }
            aria-label="Filter by severity"
          >
            <option value="">All severities</option>
            {SEVERITY_ORDER.map((value) => (
              <option key={value} value={value}>
                {SEVERITY_LABEL[value]}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ReviewStatus | '')
            }
            aria-label="Filter by review status"
          >
            <option value="">All statuses</option>
            {STATUS_ORDER.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
          <div className="toolbar-meta">
            <Filter style={{ width: 12, height: 12 }} />
            {filtered.length} of {alerts.length} shown
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title={alerts.length === 0 ? 'No detections' : 'No matching detections'}
            description={
              alerts.length === 0
                ? 'The rules did not fire on this dataset. Review the sources and thresholds before concluding the activity is benign.'
                : 'Adjust the severity, status or search filter to see more detections.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Detection</th>
                  <th>Source</th>
                  <th className="hide-sm">Evidence</th>
                  <th className="hide-sm">Window</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((alert) => (
                  <tr
                    key={alert.alert_id}
                    className="clickable"
                    onClick={() => openAlert(alert)}
                  >
                    <td>
                      <SeverityChip severity={alert.severity} />
                    </td>
                    <td>
                      <span className="cell-main">{alert.title}</span>
                      <span className="cell-sub">
                        <span className="mono">{alert.rule_id}</span> ·{' '}
                        {alert.alert_id}
                      </span>
                    </td>
                    <td className="cell-mono">{alert.source_ip ?? 'Multiple'}</td>
                    <td className="hide-sm">
                      {alert.event_count} event
                      {alert.event_count === 1 ? '' : 's'}
                    </td>
                    <td className="hide-sm cell-mono">
                      {formatShortDate(alert.first_seen, activeCase.timezone)}{' '}
                      {formatTime(alert.first_seen, activeCase.timezone)} ·{' '}
                      {durationLabel(alert.first_seen, alert.last_seen)}
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <select
                        className="select status-select"
                        value={alert.status}
                        data-status={alert.status}
                        disabled={updatingId === alert.alert_id}
                        onChange={(event) =>
                          void changeStatus(
                            alert,
                            event.target.value as ReviewStatus,
                          )
                        }
                        aria-label={`Review status for ${alert.title}`}
                      >
                        {STATUS_ORDER.map((value) => (
                          <option key={value} value={value}>
                            {STATUS_LABEL[value]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card-foot">
          <span>
            Detection is a signal, not proof. Confirm an alert against its source
            evidence.
          </span>
          <button
            type="button"
            className="link"
            onClick={() => navigate('/app/timeline')}
          >
            Open timeline
          </button>
        </div>
      </section>

      <AlertDrawer
        caseId={activeCase.id}
        alert={selected}
        timezone={activeCase.timezone}
        onClose={closeDrawer}
        onOpenEvent={(id) => setEventId(id)}
        onStatusChange={(next) => {
          if (selected) void changeStatus(selected, next)
        }}
        updating={updatingId === selected?.alert_id}
      />

      <EventDrawer
        caseId={activeCase.id}
        eventId={eventId}
        timezone={activeCase.timezone}
        onClose={() => setEventId(null)}
        level={2}
      />
    </div>
  )
}
