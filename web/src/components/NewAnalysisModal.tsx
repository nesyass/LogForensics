import {
  AlertTriangle,
  FileText,
  FlaskConical,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { useCases } from '../context/CaseContext'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/api'
import { DEFAULT_OPTIONS, FALLBACK_TIMEZONES, PARSER_LABEL, RULES } from '../lib/constants'
import { formatBytes } from '../lib/format'
import type { NewAnalysisOptions } from '../types'
import { Modal } from './Modal'

type NumericOptionKey =
  | 'failed_login_threshold'
  | 'failed_login_window_seconds'
  | 'success_after_failures_threshold'
  | 'success_after_failures_window_seconds'
  | 'multi_user_threshold'
  | 'multi_user_window_seconds'
  | 'http_error_threshold'
  | 'http_error_window_seconds'

const THRESHOLD_FIELDS: Array<{
  key: NumericOptionKey
  label: string
  help: string
}> = [
  {
    key: 'failed_login_threshold',
    label: 'Failed login threshold',
    help: 'Failures before LF-001 fires.',
  },
  {
    key: 'failed_login_window_seconds',
    label: 'Failure window (s)',
    help: 'Time window for LF-001.',
  },
  {
    key: 'success_after_failures_threshold',
    label: 'Success after failures',
    help: 'Failures before LF-002 fires.',
  },
  {
    key: 'success_after_failures_window_seconds',
    label: 'Success window (s)',
    help: 'Lookback window for LF-002.',
  },
  {
    key: 'multi_user_threshold',
    label: 'Distinct users',
    help: 'Usernames targeted before LF-003 fires.',
  },
  {
    key: 'multi_user_window_seconds',
    label: 'Spray window (s)',
    help: 'Time window for LF-003.',
  },
  {
    key: 'http_error_threshold',
    label: 'HTTP error threshold',
    help: '4xx/5xx responses before LF-004 fires.',
  },
  {
    key: 'http_error_window_seconds',
    label: 'HTTP window (s)',
    help: 'Time window for LF-004.',
  },
]

export function NewAnalysisModal() {
  const {
    isNewAnalysisOpen,
    closeNewAnalysis,
    createSample,
    uploadCase,
  } = useCases()
  const { toast } = useToast()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<'sample' | 'upload'>('sample')
  const [files, setFiles] = useState<File[]>([])
  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [options, setOptions] = useState<NewAnalysisOptions>({
    ...DEFAULT_OPTIONS,
    year: null,
    enabled_rules: [...DEFAULT_OPTIONS.enabled_rules],
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!isNewAnalysisOpen) return
    setTab('sample')
    setFiles([])
    setName('')
    setYear('')
    setOptions({
      ...DEFAULT_OPTIONS,
      year: null,
      enabled_rules: [...DEFAULT_OPTIONS.enabled_rules],
    })
    setSubmitting(false)
    setError(null)
    setDragging(false)
  }, [isNewAnalysisOpen])

  function setOption<K extends keyof NewAnalysisOptions>(
    key: K,
    value: NewAnalysisOptions[K],
  ) {
    setOptions((current) => ({ ...current, [key]: value }))
  }

  function addFiles(incoming: File[]) {
    const accepted = incoming.filter((file) =>
      /\.(log|txt|csv)$/i.test(file.name),
    )
    if (accepted.length !== incoming.length) {
      toast('Only .log, .txt and .csv files are supported.', 'error')
    }
    setFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}`))
      const next = [...current]
      accepted.forEach((file) => {
        const key = `${file.name}:${file.size}`
        if (!seen.has(key)) {
          seen.add(key)
          next.push(file)
        }
      })
      return next
    })
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  async function submit() {
    setError(null)
    if (year.trim()) {
      const parsed = Number(year)
      if (!Number.isInteger(parsed) || parsed < 1970 || parsed > 2100) {
        setError('Year must be a whole number between 1970 and 2100.')
        return
      }
    }
    if (tab === 'upload' && files.length === 0) {
      setError('Choose at least one log file to analyse.')
      return
    }

    const payload: NewAnalysisOptions = {
      ...options,
      name: name.trim() || undefined,
      year: year.trim() ? Number(year) : null,
      enabled_rules: options.enabled_rules,
    }

    setSubmitting(true)
    try {
      const detail =
        tab === 'sample'
          ? await createSample(payload)
          : await uploadCase(files, payload, name)
      toast(
        `Case “${detail.name}” created with ${detail.summary.parsed_events} events.`,
        'success',
      )
      closeNewAnalysis()
      navigate('/app')
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={isNewAnalysisOpen}
      onClose={submitting ? () => undefined : closeNewAnalysis}
      title="New analysis"
      description="Run the local pipeline on the bundled sample or on your own log files. Nothing leaves this machine."
      footer={
        <>
          <span className="foot-note">
            All parsing, detection and storage happens locally.
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={closeNewAnalysis}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="spin" /> : <FlaskConical />}
            {submitting
              ? 'Analysing…'
              : tab === 'sample'
                ? 'Run sample analysis'
                : `Analyse ${files.length || 0} file${files.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="segmented" role="tablist" aria-label="Analysis source">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sample'}
          className={`segment ${tab === 'sample' ? 'active' : ''}`}
          onClick={() => setTab('sample')}
        >
          <FlaskConical /> Sample dataset
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upload'}
          className={`segment ${tab === 'upload' ? 'active' : ''}`}
          onClick={() => setTab('upload')}
        >
          <UploadCloud /> Upload logs
        </button>
      </div>

      {error ? (
        <div className="auth-error" style={{ marginBottom: 16 }}>
          <AlertTriangle />
          <span>{error}</span>
        </div>
      ) : null}

      {tab === 'sample' ? (
        <div className="note" style={{ marginBottom: 18 }}>
          <FlaskConical />
          <span>
            The bundled dataset contains <b>3 synthetic log files</b> with{' '}
            <b>51 events</b>, <b>13 detections</b> and <b>3 correlated incidents</b>.
            It exercises every rule, including a successful login after repeated
            failures.
          </span>
        </div>
      ) : (
        <div style={{ marginBottom: 18 }}>
          <div
            className={`dropzone ${dragging ? 'dragging' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                inputRef.current?.click()
              }
            }}
          >
            <UploadCloud />
            <b>Drop log files here, or click to browse</b>
            <span>.log, .txt or .csv · up to 10 MB per file</span>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".log,.txt,.csv"
              hidden
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []))
                event.target.value = ''
              }}
            />
          </div>
          {files.length > 0 ? (
            <div className="file-list">
              {files.map((file) => (
                <div className="file-row" key={`${file.name}:${file.size}`}>
                  <FileText />
                  <span>{file.name}</span>
                  <span className="mono" style={{ color: 'var(--ink-3)' }}>
                    {formatBytes(file.size)}
                  </span>
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((item) => item !== file),
                      )
                    }
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="analysis-name">
            Case name
          </label>
          <input
            id="analysis-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              tab === 'sample' ? 'Synthetic sample dataset' : 'Auto from file name'
            }
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="analysis-parser">
            Log format
          </label>
          <select
            id="analysis-parser"
            className="select"
            value={options.parser}
            onChange={(event) => setOption('parser', event.target.value)}
          >
            {Object.entries(PARSER_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="analysis-timezone">
            Timezone
          </label>
          <input
            id="analysis-timezone"
            className="input"
            list="lf-timezones"
            value={options.timezone}
            onChange={(event) => setOption('timezone', event.target.value)}
            placeholder="Asia/Jakarta"
          />
          <datalist id="lf-timezones">
            {FALLBACK_TIMEZONES.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label className="label" htmlFor="analysis-year">
            Year fallback <span className="muted">(optional)</span>
          </label>
          <input
            id="analysis-year"
            className="input"
            inputMode="numeric"
            value={year}
            onChange={(event) => setYear(event.target.value.replace(/[^\d]/g, ''))}
            placeholder="Auto from log or current year"
          />
        </div>
      </div>

      <details className="advanced">
        <summary>
          <FlaskConical /> Detection settings
        </summary>
        <div className="advanced-grid">
          {THRESHOLD_FIELDS.map((field) => (
            <div className="field" key={field.key}>
              <label className="label" htmlFor={`lf-${field.key}`}>
                {field.label}
              </label>
              <input
                id={`lf-${field.key}`}
                className="input"
                inputMode="numeric"
                value={String(options[field.key] ?? '')}
                onChange={(event) => {
                  const value = Number(event.target.value.replace(/[^\d]/g, ''))
                  setOption(field.key, value)
                }}
              />
              <span className="help">{field.help}</span>
            </div>
          ))}
          <div className="field span-2">
            <label className="label" htmlFor="lf-sensitive-paths">
              Sensitive paths
            </label>
            <input
              id="lf-sensitive-paths"
              className="input"
              value={options.sensitive_paths}
              onChange={(event) => setOption('sensitive_paths', event.target.value)}
            />
            <span className="help">Comma-separated paths used by LF-005.</span>
          </div>
          <div className="field span-2">
            <span className="label">Enabled rules</span>
            <div className="rule-checks">
              {RULES.map((rule) => {
                const checked = options.enabled_rules.includes(rule.id)
                return (
                  <label
                    key={rule.id}
                    className={`rule-check ${checked ? 'on' : ''}`}
                    title={rule.name}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setOption(
                          'enabled_rules',
                          checked
                            ? options.enabled_rules.filter((id) => id !== rule.id)
                            : [...options.enabled_rules, rule.id],
                        )
                      }
                    />
                    {rule.id}
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      </details>

      {submitting ? (
        <div className="progress-line" role="progressbar" aria-label="Analysing logs">
          <i />
        </div>
      ) : null}
    </Modal>
  )
}
