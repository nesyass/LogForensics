import {
  ChevronRight,
  FolderOpen,
  Network,
  Plus,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  SeverityChip,
} from '../components/ui'
import { useCases } from '../context/CaseContext'
import { api, errorMessage } from '../lib/api'
import { formatNumber } from '../lib/format'
import type { IpRow } from '../types'

type SortKey = 'total_events' | 'auth_failures' | 'http_4xx' | 'alert_count'

const SORT_LABEL: Record<SortKey, string> = {
  total_events: 'Event volume',
  auth_failures: 'Authentication failures',
  http_4xx: 'HTTP 4xx responses',
  alert_count: 'Detections',
}

export function IpsPage() {
  const {
    activeCase,
    loadingCase,
    loadingCases,
    openNewAnalysis,
  } = useCases()
  const navigate = useNavigate()

  const [rows, setRows] = useState<IpRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('total_events')

  const caseId = activeCase?.id ?? null

  useEffect(() => {
    if (!caseId) {
      setRows([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .ips(caseId)
      .then((payload) => {
        if (!cancelled) setRows(payload)
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = needle
      ? rows.filter((row) => row.source_ip.toLowerCase().includes(needle))
      : rows
    return [...matches].sort((a, b) => {
      const diff = b[sort] - a[sort]
      return diff !== 0 ? diff : a.source_ip.localeCompare(b.source_ip)
    })
  }, [rows, query, sort])

  if (loadingCases || (loadingCase && !activeCase)) {
    return (
      <div className="page">
        <LoadingBlock label="Aggregating source addresses…" />
      </div>
    )
  }

  if (!activeCase) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Evidence"
          title="IP addresses"
          description="Aggregate activity by source address and jump straight into the underlying events."
        />
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="No case open"
            description="Create an analysis to aggregate authentication and web activity by source address."
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

  const withAlerts = rows.filter((row) => row.alert_count > 0).length
  const totalFailures = rows.reduce((sum, row) => sum + row.auth_failures, 0)
  const total4xx = rows.reduce((sum, row) => sum + row.http_4xx, 0)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Evidence"
        title="IP addresses"
        description={`${formatNumber(rows.length)} distinct source addresses · ${formatNumber(
          withAlerts,
        )} linked to at least one detection. Select a row to inspect its events.`}
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/app/events')}
          >
            <Search /> Open event explorer
          </button>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">
            <Network /> Distinct sources
          </div>
          <div className="kpi-value">{formatNumber(rows.length)}</div>
          <div className="kpi-foot">Seen across authentication and web logs</div>
        </div>
        <div className="kpi kpi-accent">
          <div className="kpi-label">
            <ShieldAlert /> Sources with alerts
          </div>
          <div className="kpi-value">{formatNumber(withAlerts)}</div>
          <div className="kpi-foot">
            {formatNumber(rows.length - withAlerts)} without a detection
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Auth failures</div>
          <div className="kpi-value">{formatNumber(totalFailures)}</div>
          <div className="kpi-foot">Failed authentication events</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">HTTP 4xx</div>
          <div className="kpi-value">{formatNumber(total4xx)}</div>
          <div className="kpi-foot">Client error responses</div>
        </div>
      </div>

      <section className="card" aria-busy={loading}>
        <div className="toolbar">
          <input
            className="input search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by IP address…"
            aria-label="Filter by IP address"
          />
          <select
            className="select"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="Sort IP addresses"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                Sort: {SORT_LABEL[key]}
              </option>
            ))}
          </select>
          <div className="toolbar-meta">
            {loading
              ? 'Aggregating…'
              : `${filtered.length} of ${rows.length} sources`}
          </div>
        </div>

        {loading && rows.length === 0 ? (
          <div style={{ padding: 18 }}>
            {Array.from({ length: 6 }, (_, index) => (
              <div className="skeleton skeleton-line" key={index} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Network}
            title={rows.length === 0 ? 'No source addresses' : 'No matching addresses'}
            description={
              rows.length === 0
                ? 'This case contains no events with a parseable source IP.'
                : 'Try a different IP prefix or clear the filter.'
            }
            action={
              rows.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setQuery('')}
                >
                  Clear filter
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Source IP</th>
                  <th className="num">Events</th>
                  <th className="num">Auth fail</th>
                  <th className="num">Auth success</th>
                  <th className="num">HTTP req</th>
                  <th className="num">4xx</th>
                  <th className="num">5xx</th>
                  <th className="num">Alerts</th>
                  <th>Max severity</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
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
                      {row.auth_failures ? (
                        <span style={{ color: 'var(--danger)' }}>
                          {formatNumber(row.auth_failures)}
                        </span>
                      ) : (
                        formatNumber(row.auth_failures)
                      )}
                    </td>
                    <td className="num">{formatNumber(row.auth_successes)}</td>
                    <td className="num">{formatNumber(row.http_requests)}</td>
                    <td className="num">{formatNumber(row.http_4xx)}</td>
                    <td className="num">{formatNumber(row.http_5xx)}</td>
                    <td className="num">
                      {row.alert_count ? (
                        <span style={{ color: 'var(--accent-ink)', fontWeight: 650 }}>
                          {formatNumber(row.alert_count)}
                        </span>
                      ) : (
                        formatNumber(row.alert_count)
                      )}
                    </td>
                    <td>
                      <SeverityChip severity={row.max_severity} />
                    </td>
                    <td>
                      <ChevronRight
                        style={{ width: 14, height: 14, color: 'var(--ink-3)' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card-foot">
          <span>
            Aggregates include only events with an extracted source address.
          </span>
          <span>{formatNumber(rows.length)} sources</span>
        </div>
      </section>
    </div>
  )
}
