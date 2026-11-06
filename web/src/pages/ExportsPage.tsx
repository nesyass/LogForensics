import {
  Archive,
  Braces,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'
import { useCases } from '../context/CaseContext'
import { api, errorMessage } from '../lib/api'
import { formatBytes, formatNumber } from '../lib/format'
import type { ExportItem } from '../types'

function artifactIcon(name: string) {
  if (name.endsWith('.zip')) return FileArchive
  if (name.endsWith('.json')) return Braces
  if (name.endsWith('.csv')) return FileSpreadsheet
  return FileText
}

function artifactLabel(name: string): string {
  if (name === 'events.json' || name === 'events.csv')
    return 'Every normalized event with provenance'
  if (name === 'alerts.json' || name === 'alerts.csv')
    return 'All detections with rationale and evidence IDs'
  if (name === 'timeline.csv')
    return 'Timestamped events plus alert-evidence flags'
  if (name === 'investigation-summary.md')
    return 'Review-ready Markdown summary'
  if (name === 'file_manifest.json')
    return 'Source file inventory with SHA-256 hashes'
  return 'Case artifact'
}

export function ExportsPage() {
  const {
    activeCase,
    loadingCase,
    loadingCases,
    openNewAnalysis,
  } = useCases()
  const navigate = useNavigate()

  const [exports, setExports] = useState<ExportItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const caseId = activeCase?.id ?? null

  useEffect(() => {
    if (!caseId) {
      setExports([])
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .exports(caseId)
      .then((payload) => {
        if (!cancelled) setExports(payload)
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
        <LoadingBlock label="Preparing exports…" />
      </div>
    )
  }

  if (!activeCase) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Case record"
          title="Exports"
          description="Download portable JSON, CSV, Markdown or a complete ZIP bundle for the case."
        />
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="No case open"
            description="Create an analysis to generate case exports."
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

  const totalBytes = exports.reduce((sum, item) => sum + item.size_bytes, 0)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Case record"
        title="Exports"
        description={`Portable artifacts for “${activeCase.name}”. Files are generated locally from the stored case and downloaded directly from this machine.`}
        actions={
          <a
            className="btn btn-accent"
            href={api.exportUrl(activeCase.id, 'logforensics-export.zip')}
            download="logforensics-export.zip"
          >
            <Archive /> Download ZIP bundle
          </a>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      <div className="grid-main">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Case bundle</div>
                <div className="card-sub">
                  One archive containing every artifact below
                </div>
              </div>
              <span className="badge">.zip</span>
            </div>
            <div className="card-body">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  className="export-icon"
                  style={{ width: 46, height: 46, borderRadius: 11 }}
                >
                  <Archive style={{ width: 22, height: 22 }} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    logforensics-export.zip
                  </div>
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                    {formatNumber(exports.length)} files ·{' '}
                    {formatBytes(totalBytes)} uncompressed · generated on demand
                  </div>
                </div>
                <a
                  className="btn btn-primary"
                  href={api.exportUrl(activeCase.id, 'logforensics-export.zip')}
                  download="logforensics-export.zip"
                >
                  <Download /> Download bundle
                </a>
              </div>
              <div className="note" style={{ marginTop: 16 }}>
                <ShieldCheck />
                <span>
                  The bundle is assembled from this case in memory. No file is
                  uploaded, and the download is served by the local API.
                </span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Artifacts</div>
                <div className="card-sub">
                  Download individual files for review or further processing
                </div>
              </div>
              <span className="badge">
                {exports.length} file{exports.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="card-body">
              {loading && exports.length === 0 ? (
                <div className="export-grid">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div
                      className="skeleton skeleton-card"
                      style={{ height: 66 }}
                      key={index}
                    />
                  ))}
                </div>
              ) : exports.length === 0 ? (
                <EmptyState
                  icon={Download}
                  title="No artifacts available"
                  description="The server could not build exports for this case."
                />
              ) : (
                <div className="export-grid">
                  {exports.map((item) => {
                    const Icon = artifactIcon(item.name)
                    return (
                      <div className="export-item" key={item.name}>
                        <span className="export-icon">
                          <Icon />
                        </span>
                        <div className="export-text">
                          <b title={item.name}>{item.name}</b>
                          <span>
                            {artifactLabel(item.name)} · {formatBytes(item.size_bytes)}
                          </span>
                        </div>
                        <a
                          className="btn btn-secondary btn-sm"
                          href={api.exportUrl(activeCase.id, item.name)}
                          download={item.name}
                          aria-label={`Download ${item.name}`}
                        >
                          <Download />
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="card-foot">
              <span>
                Generated {formatNumber(exports.length)} artifacts from{' '}
                {formatNumber(activeCase.summary.parsed_events)} events and{' '}
                {formatNumber(activeCase.summary.total_alerts)} detections.
              </span>
              <button
                type="button"
                className="link"
                onClick={() => navigate('/app/sources')}
              >
                Source hashes
              </button>
            </div>
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">What is included</div>
                <div className="card-sub">Contents of the case bundle</div>
              </div>
            </div>
            <div className="card-body">
              <div className="integrity-list">
                <div className="integrity-row">
                  <span>events.json / .csv</span>
                  <b>Normalized events + raw lines</b>
                </div>
                <div className="integrity-row">
                  <span>alerts.json / .csv</span>
                  <b>Findings, rationale, evidence IDs</b>
                </div>
                <div className="integrity-row">
                  <span>timeline.csv</span>
                  <b>Chronology with evidence flags</b>
                </div>
                <div className="integrity-row">
                  <span>investigation-summary.md</span>
                  <b>Human-readable summary</b>
                </div>
                <div className="integrity-row">
                  <span>file_manifest.json</span>
                  <b>Files, sizes and SHA-256</b>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Before you share</div>
              </div>
            </div>
            <div className="card-body">
              <div className="note">
                <FileText />
                <span>
                  <b>Treat exports as sensitive.</b> Raw log lines may contain
                  usernames, internal addresses, user agents and request paths.
                  Review the bundle before sending it outside your environment.
                </span>
              </div>
              <div className="note" style={{ marginTop: 10 }}>
                <Braces />
                <span>
                  Review statuses are stored in the local case database. The
                  exported alert status reflects the value at generation time.
                </span>
              </div>
              <p
                className="muted"
                style={{ fontSize: 11.5, lineHeight: 1.6, marginTop: 12 }}
              >
                Detection output is a lead, not proof of compromise. Exports
                include the limitations section so the reasoning can be reviewed
                independently.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
