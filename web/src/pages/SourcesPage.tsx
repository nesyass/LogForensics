import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Files,
  Fingerprint,
  FolderOpen,
  Hash,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from '../components/ui'
import { useCases } from '../context/CaseContext'
import { PARSER_LABEL, RULES } from '../lib/constants'
import { formatBytes, formatNumber, titleCase } from '../lib/format'
import type { CaseFile } from '../types'

function SourceTypeCell({ file }: { file: CaseFile }) {
  const label = file.source_type
    ? PARSER_LABEL[file.source_type] ?? titleCase(file.source_type)
    : 'Unknown format'
  const confidence =
    file.detection_confidence === null
      ? null
      : Math.round(file.detection_confidence * 100)
  return (
    <>
      <span className="cell-main" style={{ fontSize: 12 }}>
        {label}
      </span>
      <span className="cell-sub">
        {confidence === null
          ? file.encoding
          : `${confidence}% detection confidence · ${file.encoding}`}
      </span>
    </>
  )
}

function SettingsRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="kv-row">
      <dt>{label}</dt>
      <dd className="mono" style={{ fontSize: 11 }}>
        {value}
      </dd>
    </div>
  )
}

export function SourcesPage() {
  const {
    activeCase,
    loadingCase,
    loadingCases,
    openNewAnalysis,
  } = useCases()
  const navigate = useNavigate()

  if (loadingCases || (loadingCase && !activeCase)) {
    return (
      <div className="page">
        <LoadingBlock label="Loading source evidence…" />
      </div>
    )
  }

  if (!activeCase) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Evidence"
          title="Sources & integrity"
          description="Every ingested file, its hash and the parser decisions made during analysis."
        />
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="No case open"
            description="Create an analysis to see source files, parser confidence and parse errors here."
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

  const { files, parse_errors: parseErrors, settings, summary } = activeCase
  const enabledRules = settings?.enabled_rules ?? RULES.map((rule) => rule.id)
  const totalErrors = parseErrors.length

  return (
    <div className="page">
      <PageHeader
        eyebrow="Evidence"
        title="Sources & integrity"
        description={`${files.length} input file${
          files.length === 1 ? '' : 's'
        } · ${formatNumber(summary.total_lines)} lines read · ${formatNumber(
          summary.parsed_events,
        )} parsed events · ${formatNumber(totalErrors)} parse error${
          totalErrors === 1 ? '' : 's'
        }.`}
      />

      {!summary.total_files ? (
        <ErrorBanner message="This case has no recorded source files." />
      ) : null}

      <div className="grid-main">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Ingested files</div>
                <div className="card-sub">
                  SHA-256 is computed locally from the uploaded bytes
                </div>
              </div>
              <span className="badge">
                <Files style={{ width: 11, height: 11 }} />
                {files.length} file{files.length === 1 ? '' : 's'}
              </span>
            </div>
            {files.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No files recorded"
                description="This case has no stored source file metadata."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Detected type</th>
                      <th className="num">Lines</th>
                      <th className="num">Parsed</th>
                      <th className="num">Errors</th>
                      <th className="num">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr key={file.name}>
                        <td>
                          <span className="cell-main">{file.name}</span>
                          <span
                            className="cell-sub mono"
                            title={file.sha256}
                            style={{ maxWidth: 280 }}
                          >
                            <Hash
                              style={{
                                width: 10,
                                height: 10,
                                verticalAlign: -1,
                                marginRight: 4,
                              }}
                            />
                            {file.sha256.slice(0, 24)}…
                          </span>
                        </td>
                        <td>
                          <SourceTypeCell file={file} />
                        </td>
                        <td className="num">{formatNumber(file.total_lines)}</td>
                        <td className="num">{formatNumber(file.parsed_lines)}</td>
                        <td className="num">
                          {file.error_lines ? (
                            <span style={{ color: 'var(--danger)' }}>
                              {formatNumber(file.error_lines)}
                            </span>
                          ) : (
                            formatNumber(file.error_lines)
                          )}
                        </td>
                        <td className="num">{formatBytes(file.size_bytes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="card-foot">
              <span>
                Hashes support traceability, but are not a chain of custody.
              </span>
              <button
                type="button"
                className="link"
                onClick={() => navigate('/app/exports')}
              >
                Export manifest
              </button>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Parse errors</div>
                <div className="card-sub">
                  Lines the parser could not normalize, kept verbatim
                </div>
              </div>
              <span
                className="badge"
                style={
                  totalErrors
                    ? {
                        color: 'var(--danger)',
                        borderColor:
                          'color-mix(in srgb, var(--danger) 32%, transparent)',
                        background: 'var(--danger-soft)',
                      }
                    : undefined
                }
              >
                {totalErrors ? <AlertTriangle /> : <CheckCircle2 />}
                {formatNumber(totalErrors)}
              </span>
            </div>
            {totalErrors === 0 ? (
              <div
                className="empty"
                style={{ padding: '34px 24px', gap: 6 }}
              >
                <div className="empty-icon" style={{ marginBottom: 2 }}>
                  <ShieldCheck />
                </div>
                <h3>No parse errors</h3>
                <p>
                  Every source line in this case was either parsed into an event
                  or accounted for by the parser.
                </p>
              </div>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th>Parser</th>
                        <th>Reason</th>
                        <th>Raw line</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseErrors.slice(0, 200).map((error, index) => (
                        <tr key={`${error.source_file}:${error.source_line}:${index}`}>
                          <td className="cell-mono nw">
                            {error.source_file}:{error.source_line}
                          </td>
                          <td>
                            <span className="badge">{error.parser}</span>
                          </td>
                          <td>
                            <span className="cell-main" style={{ fontWeight: 550 }}>
                              {error.reason}
                            </span>
                          </td>
                          <td>
                            <span
                              className="cell-sub mono"
                              style={{ maxWidth: 340 }}
                              title={error.raw_line}
                            >
                              {error.raw_line || '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalErrors > 200 ? (
                  <div className="card-foot">
                    <span>
                      Showing the first 200 of {formatNumber(totalErrors)} errors.
                      The full set is included in the JSON export.
                    </span>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Detection settings</div>
                <div className="card-sub">
                  Thresholds used for this case at analysis time
                </div>
              </div>
            </div>
            <div className="card-body">
              {settings ? (
                <dl className="kv">
                  <SettingsRow
                    label="LF-001 failures"
                    value={`≥ ${settings.failed_login_threshold} / ${
                      settings.failed_login_window_seconds
                    }s`}
                  />
                  <SettingsRow
                    label="LF-002 lookback"
                    value={`≥ ${settings.success_after_failures_threshold} / ${
                      settings.success_after_failures_window_seconds
                    }s`}
                  />
                  <SettingsRow
                    label="LF-003 users"
                    value={`≥ ${settings.multi_user_threshold} / ${
                      settings.multi_user_window_seconds
                    }s`}
                  />
                  <SettingsRow
                    label="LF-004 errors"
                    value={`≥ ${settings.http_error_threshold} / ${
                      settings.http_error_window_seconds
                    }s`}
                  />
                  <SettingsRow
                    label="LF-005 paths"
                    value={
                      settings.sensitive_paths.length
                        ? settings.sensitive_paths.join(', ')
                        : 'None configured'
                    }
                  />
                </dl>
              ) : (
                <p className="muted" style={{ fontSize: 12 }}>
                  Threshold settings were not stored for this case.
                </p>
              )}
              <div style={{ marginTop: 16 }}>
                <div className="label" style={{ marginBottom: 8 }}>
                  Enabled rules
                </div>
                <div className="meta-grid">
                  {RULES.map((rule) => {
                    const on = enabledRules.includes(rule.id)
                    return (
                      <span
                        key={rule.id}
                        className="badge"
                        style={
                          on
                            ? {
                                color: 'var(--accent-ink)',
                                background: 'var(--accent-soft)',
                                borderColor: 'var(--accent-line)',
                              }
                            : { opacity: 0.5 }
                        }
                        title={rule.name}
                      >
                        {rule.id}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-head-text">
                <div className="card-title">Provenance</div>
                <div className="card-sub">
                  What was preserved from the original evidence
                </div>
              </div>
            </div>
            <div className="card-body">
              <div className="integrity-list">
                <div className="integrity-row">
                  <span>Case source</span>
                  <b>{titleCase(activeCase.source)}</b>
                </div>
                <div className="integrity-row">
                  <span>Parser mode</span>
                  <b>{PARSER_LABEL[activeCase.parser] ?? activeCase.parser}</b>
                </div>
                <div className="integrity-row">
                  <span>Analysis timezone</span>
                  <b>{activeCase.timezone}</b>
                </div>
                <div className="integrity-row">
                  <span>Year assumption</span>
                  <b>{activeCase.year ?? summary.year_assumption ?? '—'}</b>
                </div>
                <div className="integrity-row">
                  <span>Raw line retention</span>
                  <b>Every source line</b>
                </div>
              </div>
              <div className="note" style={{ marginTop: 16 }}>
                <Fingerprint />
                <span>
                  Raw messages, file names and line numbers are stored for every
                  parsed event. Nothing is rewritten or normalised in place.
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
