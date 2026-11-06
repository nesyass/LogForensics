import type {
  Alert,
  CaseDetail,
  CaseSummary,
  EventDetail,
  EventPage,
  ExportItem,
  Facets,
  IpRow,
  NewAnalysisOptions,
  TimelineData,
} from '../types'

const BASE = '/api'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function readDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const detail = (payload as { detail?: unknown }).detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          const loc = Array.isArray((item as { loc?: unknown }).loc)
            ? ((item as { loc: unknown[] }).loc.join('.'))
            : ''
          return `${loc ? `${loc}: ` : ''}${String((item as { msg: unknown }).msg)}`
        }
        return String(item)
      })
      .join('; ')
  }
  return null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      credentials: 'same-origin',
      ...init,
    })
  } catch {
    throw new ApiError(
      0,
      'The local server did not respond. Make sure the LogForensics API is running.',
    )
  }

  if (response.status === 401) {
    window.dispatchEvent(new Event('lf:unauthorized'))
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`
    try {
      const payload = await response.json()
      message = readDetail(payload) ?? message
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const api = {
  login: (username: string, password: string) =>
    request<{ user: string }>('/auth/login', json({ username, password })),

  me: () => request<{ user: string }>('/auth/me'),

  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  listCases: () => request<CaseSummary[]>('/cases'),

  getCase: (caseId: string) => request<CaseDetail>(`/cases/${caseId}`),

  deleteCase: (caseId: string) =>
    request<{ ok: boolean }>(`/cases/${caseId}`, { method: 'DELETE' }),

  createSampleCase: (options: NewAnalysisOptions) =>
    request<CaseDetail>('/cases/sample', json(options)),

  createCase: (files: File[], options: NewAnalysisOptions, name: string) => {
    const form = new FormData()
    files.forEach((file) => form.append('files', file))
    form.append('options', JSON.stringify(options))
    if (name.trim()) form.append('name', name.trim())
    return request<CaseDetail>('/cases', { method: 'POST', body: form })
  },

  events: (
    caseId: string,
    params: Record<string, string | number | undefined>,
  ) => request<EventPage>(`/cases/${caseId}/events${query(params)}`),

  event: (caseId: string, eventId: string) =>
    request<EventDetail>(`/cases/${caseId}/events/${eventId}`),

  facets: (caseId: string) => request<Facets>(`/cases/${caseId}/facets`),

  timeline: (caseId: string, buckets = 72) =>
    request<TimelineData>(`/cases/${caseId}/timeline${query({ buckets })}`),

  ips: (caseId: string) => request<IpRow[]>(`/cases/${caseId}/ips`),

  updateAlert: (caseId: string, alertId: string, status: string) =>
    request<Alert>(`/cases/${caseId}/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),

  exports: (caseId: string) =>
    request<ExportItem[]>(`/cases/${caseId}/exports`),

  exportUrl: (caseId: string, name: string) =>
    `${BASE}/cases/${caseId}/exports/${encodeURIComponent(name)}`,
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
