export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type ReviewStatus =
  | 'needs_review'
  | 'benign'
  | 'confirmed_suspicious'
  | 'false_positive'

export interface AnalysisSummary {
  total_files: number
  total_lines: number
  parsed_events: number
  parse_errors: number
  total_alerts: number
  severity_counts: Record<string, number>
  first_event: string | null
  last_event: string | null
  timezone_name: string
  year_assumption: number | null
}

export interface CaseFile {
  name: string
  size_bytes: number
  sha256: string
  encoding: string
  source_type: string | null
  total_lines: number
  parsed_lines: number
  error_lines: number
  detection_confidence: number | null
  note: string | null
}

export interface Alert {
  alert_id: string
  rule_id: string
  title: string
  severity: Severity
  status: ReviewStatus
  source_ip: string | null
  event_count: number
  first_seen: string | null
  last_seen: string | null
  reason: string
  evidence_event_ids: string[]
  metadata: Record<string, unknown>
}

export interface Incident {
  incident_id: string
  source_ip: string | null
  first_seen: string | null
  last_seen: string | null
  alert_ids: string[]
  event_ids: string[]
  reasons: string[]
  severity: Severity
}

export interface ParseError {
  source_file: string
  source_line: number
  raw_line: string
  reason: string
  parser: string
}

export interface DetectionSettings {
  failed_login_threshold: number
  failed_login_window_seconds: number
  success_after_failures_threshold: number
  success_after_failures_window_seconds: number
  multi_user_threshold: number
  multi_user_window_seconds: number
  http_error_threshold: number
  http_error_window_seconds: number
  sensitive_paths: string[]
  enabled_rules: string[]
}

export interface CaseSummary {
  id: string
  name: string
  source: 'sample' | 'upload'
  created_at: string
  timezone: string
  year: number | null
  parser: string
  summary: AnalysisSummary
}

export interface CaseDetail extends CaseSummary {
  settings: DetectionSettings | null
  files: CaseFile[]
  alerts: Alert[]
  incidents: Incident[]
  parse_errors: ParseError[]
}

export interface EventRow {
  event_id: string
  timestamp: string | null
  ts_utc: string | null
  event_category: string
  event_type: string
  source_ip: string | null
  username: string | null
  host: string | null
  http_method: string | null
  http_path: string | null
  http_status: number | null
  source_file: string
  source_line: number
}

export interface EventDetail extends EventRow {
  timestamp_precision: string
  timestamp_timezone_known: boolean
  timestamp_assumption: string | null
  source_type: string
  source_port: number | null
  destination_ip: string | null
  process: string | null
  user_agent: string | null
  pid: number | null
  message: string
  raw_message: string
  parse_status: string
}

export interface EventPage {
  items: EventRow[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface Facets {
  categories: string[]
  event_types: string[]
  source_files: string[]
  usernames: string[]
  source_ips: string[]
}

export interface TimelineBucket {
  start: string
  authentication: number
  web: number
  system: number
  unknown: number
  alert_evidence: number
  total: number
}

export interface TimelineData {
  buckets: TimelineBucket[]
  evidence_events: EventRow[]
  incidents: Incident[]
  first: string | null
  last: string | null
}

export interface IpRow {
  source_ip: string
  total_events: number
  auth_failures: number
  auth_successes: number
  http_requests: number
  http_4xx: number
  http_5xx: number
  alert_count: number
  alert_ids: string[]
  max_severity: Severity
}

export interface ExportItem {
  name: string
  size_bytes: number
  mime: string
}

export interface NewAnalysisOptions {
  name?: string
  year?: number | null
  timezone: string
  parser: string
  failed_login_threshold: number
  failed_login_window_seconds: number
  success_after_failures_threshold: number
  success_after_failures_window_seconds: number
  multi_user_threshold: number
  multi_user_window_seconds: number
  http_error_threshold: number
  http_error_window_seconds: number
  sensitive_paths: string
  enabled_rules: string[]
}
