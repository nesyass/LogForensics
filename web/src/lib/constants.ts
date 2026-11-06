import type { ReviewStatus, Severity } from '../types'

export interface RuleInfo {
  id: string
  name: string
  description: string
  severity: Severity
  category: 'Authentication' | 'Web'
}

export const RULES: RuleInfo[] = [
  {
    id: 'LF-001',
    name: 'Failed Login Burst',
    description:
      'Multiple failed authentication events from one source IP inside a short window.',
    severity: 'medium',
    category: 'Authentication',
  },
  {
    id: 'LF-002',
    name: 'Success After Failures',
    description:
      'A successful login from an IP that already produced repeated failures.',
    severity: 'high',
    category: 'Authentication',
  },
  {
    id: 'LF-003',
    name: 'Multi-User Login Attempts',
    description:
      'One source IP targets many distinct usernames, consistent with spraying.',
    severity: 'medium',
    category: 'Authentication',
  },
  {
    id: 'LF-004',
    name: 'HTTP Error Spike',
    description:
      'A high number of 4xx or 5xx responses from a single source IP.',
    severity: 'medium',
    category: 'Web',
  },
  {
    id: 'LF-005',
    name: 'Sensitive Path Request',
    description:
      'Requests to sensitive paths such as .env, /admin or /wp-admin.',
    severity: 'medium',
    category: 'Web',
  },
]

export const RULE_BY_ID = Object.fromEntries(RULES.map((rule) => [rule.id, rule]))

export const SEVERITY_ORDER: Severity[] = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
]

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
}

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  needs_review: 'Needs review',
  benign: 'Benign',
  confirmed_suspicious: 'Confirmed suspicious',
  false_positive: 'False positive',
}

export const STATUS_ORDER: ReviewStatus[] = [
  'needs_review',
  'confirmed_suspicious',
  'benign',
  'false_positive',
]

export const PARSER_LABEL: Record<string, string> = {
  auto: 'Auto-detect',
  linux_auth: 'Linux auth log',
  web_access: 'Apache / Nginx access log',
}

export const CATEGORY_COLORS: Record<string, string> = {
  authentication: 'var(--cat-auth)',
  web: 'var(--cat-web)',
  system: 'var(--cat-system)',
  unknown: 'var(--cat-unknown)',
}

export const FALLBACK_TIMEZONES = [
  'Asia/Jakarta',
  'UTC',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
]

export const DEFAULT_OPTIONS = {
  timezone: 'Asia/Jakarta',
  parser: 'auto',
  failed_login_threshold: 10,
  failed_login_window_seconds: 120,
  success_after_failures_threshold: 5,
  success_after_failures_window_seconds: 600,
  multi_user_threshold: 5,
  multi_user_window_seconds: 300,
  http_error_threshold: 10,
  http_error_window_seconds: 60,
  sensitive_paths: '.env, admin, wp-admin, phpmyadmin, backup, config',
  enabled_rules: RULES.map((rule) => rule.id),
}
