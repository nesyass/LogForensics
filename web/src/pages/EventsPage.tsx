import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Plus,
  ScrollText,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { EventDrawer } from '../components/EventDrawer'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'
import { useCases } from '../context/CaseContext'
import { api, errorMessage } from '../lib/api'
import { titleCase } from '../lib/format'
import { formatDateTime } from '../lib/format'
import { useDebounced } from '../lib/hooks'
import type { EventPage, Facets } from '../types'

function pageWindow(current: number, total: number): Array<number | '…'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  return [
    1,
    ...(start > 2 ? (['…'] as const) : []),
    ...Array.from({ length: end - start + 1 }, (_, index) => start + index),
    ...(end < total - 1 ? (['…'] as const) : []),
    total,
  ]
}

export function EventsPage() {
  const {
    activeCase,
    loadingCase,
    loadingCases,
    openNewAnalysis,
  } = useCases()
  const [params, setParams] = useSearchParams()

  const [search, setSearch] = useState(params.get('q') ?? '')
  const debouncedSearch = useDebounced(search, 250)
  const [category, setCategory] = useState(params.get('category') ?? '')
  const [eventType, setEventType] = useState(params.get('type') ?? '')
  const [sourceFile, setSourceFile] = useState(params.get('file') ?? '')
  const [ip, setIp] = useState(params.get('ip') ?? '')
  const [user, setUser] = useState(params.get('user') ?? '')
  const [sort, setSort] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<EventPage | null>(null)
  const [facets, setFacets] = useState<Facets | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const caseId = activeCase?.id ?? null
  const timezone = activeCase?.timezone ?? 'UTC'
  const pageSize = 50

  useEffect(() => {
    if (!caseId) {
      setFacets(null)
      return
    }
    let cancelled = false
    api
      .facets(caseId)
      .then((payload) => {
        if (!cancelled) setFacets(payload)
      })
      .catch(() => {
        if (!cancelled) setFacets(null)
      })
    return () => {
      cancelled = true
    }
  }, [caseId])

  useEffect(() => {
    if (!caseId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .events(caseId, {
        page,
        page_size: pageSize,
        search: debouncedSearch,
        category,
        event_type: eventType,
        source_file: sourceFile,
        ip,
        user,
        sort,
      })
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
  }, [
    caseId,
    page,
    debouncedSearch,
    category,
    eventType,
    sourceFile,
    ip,
    user,
    sort,
  ])

  function resetFilters() {
    setSearch('')
    setCategory('')
    setEventType('')
    setSourceFile('')
    setIp('')
    setUser('')
    setPage(1)
    setParams({})
  }

  const filterActive = Boolean(
    search || category || eventType || sourceFile || ip || user,
  )

  if (loadingCases || (loadingCase && !activeCase)) {
    return (
      <div className="page">
        <LoadingBlock label="Loading events…" />
      </div>
    )
  }

  if (!activeCase) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Investigation"
          title="Event explorer"
          description="Search and inspect every normalized event with its raw source line."
        />
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="No case open"
            description="Create an analysis first; then every event will be searchable here."
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

  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  return (
    <div className="page">
      <PageHeader
        eyebrow="Investigation"
        title="Event explorer"
        description="Filter normalized events, inspect provenance and open the exact raw log line behind each record."
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="card" aria-busy={loading}>
        <div className="toolbar">
          <input
            className="input search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search raw message, IP, user, host…"
            aria-label="Search events"
          />
          <select
            className="select"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value)
              setPage(1)
            }}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {facets?.categories.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={eventType}
            onChange={(event) => {
              setEventType(event.target.value)
              setPage(1)
            }}
            aria-label="Filter by event type"
          >
            <option value="">All event types</option>
            {facets?.event_types.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={sourceFile}
            onChange={(event) => {
              setSourceFile(event.target.value)
              setPage(1)
            }}
            aria-label="Filter by source file"
          >
            <option value="">All source files</option>
            {facets?.source_files.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value === 'asc' ? 'asc' : 'desc')
              setPage(1)
            }}
            aria-label="Sort order"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
          {filterActive ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetFilters}
            >
              <X /> Reset
            </button>
          ) : null}
          {ip ? (
            <span className="badge">
              IP: {ip}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setIp('')
                  setPage(1)
                  const next = new URLSearchParams(params)
                  next.delete('ip')
                  setParams(next)
                }}
                aria-label="Clear IP filter"
                style={{ display: 'inline-flex', padding: 0 }}
              >
                <X style={{ width: 11, height: 11 }} />
              </button>
            </span>
          ) : null}
          {user ? (
            <span className="badge">
              User: {user}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setUser('')
                  setPage(1)
                  const next = new URLSearchParams(params)
                  next.delete('user')
                  setParams(next)
                }}
                aria-label="Clear user filter"
                style={{ display: 'inline-flex', padding: 0 }}
              >
                <X style={{ width: 11, height: 11 }} />
              </button>
            </span>
          ) : null}
          <div className="toolbar-meta">
            {loading ? 'Searching…' : `${total.toLocaleString()} events`}
          </div>
        </div>

        {loading && !data ? (
          <div style={{ padding: 18 }}>
            {Array.from({ length: 8 }, (_, index) => (
              <div className="skeleton skeleton-line" key={index} />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No matching events"
            description="Try a broader search term or clear one of the filters."
            action={
              filterActive ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetFilters}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event</th>
                  <th>Category</th>
                  <th>Source IP</th>
                  <th>User</th>
                  <th className="hide-sm">Host</th>
                  <th className="hide-sm">HTTP</th>
                  <th className="hide-sm">Source</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((event) => (
                  <tr
                    key={event.event_id}
                    className="clickable"
                    onClick={() => setSelected(event.event_id)}
                  >
                    <td className="cell-mono nw">
                      {formatDateTime(event.timestamp, timezone)}
                    </td>
                    <td>
                      <span className="cell-main">
                        {titleCase(event.event_type)}
                      </span>
                      <span className="cell-sub">{event.event_id}</span>
                    </td>
                    <td>
                      <span className="badge">{titleCase(event.event_category)}</span>
                    </td>
                    <td className="cell-mono">{event.source_ip ?? '—'}</td>
                    <td>{event.username ?? '—'}</td>
                    <td className="hide-sm">{event.host ?? '—'}</td>
                    <td className="cell-mono hide-sm">
                      {event.http_method || event.http_path
                        ? `${event.http_method ?? ''} ${event.http_path ?? ''}${
                            event.http_status ? ` ${event.http_status}` : ''
                          }`
                        : '—'}
                    </td>
                    <td className="cell-mono hide-sm">
                      {event.source_file}:{event.source_line}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 ? (
          <div className="pager">
            <span>
              Page {data.page} of {pages} · {total.toLocaleString()} matching
              events
            </span>
            <div className="pager-buttons">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </button>
              {pageWindow(page, pages).map((entry, index) =>
                entry === '…' ? (
                  <span
                    key={`gap-${index}`}
                    style={{ padding: '0 4px', alignSelf: 'center' }}
                  >
                    …
                  </span>
                ) : (
                  <button
                    type="button"
                    key={entry}
                    className={`btn btn-secondary btn-sm ${entry === page ? 'active' : ''}`}
                    onClick={() => setPage(entry)}
                    aria-current={entry === page ? 'page' : undefined}
                  >
                    {entry}
                  </button>
                ),
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((current) => Math.min(pages, current + 1))}
                disabled={page >= pages}
                aria-label="Next page"
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <EventDrawer
        caseId={caseId}
        eventId={selected}
        timezone={timezone}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
