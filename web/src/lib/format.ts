const numberFormat = new Intl.NumberFormat('en-US')

export function formatNumber(value: number | null | undefined): string {
  return numberFormat.format(value ?? 0)
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  )
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function dateFormat(
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      ...options,
      timeZone: timeZone || undefined,
    })
  } catch {
    return new Intl.DateTimeFormat('en-GB', options)
  }
}

export function formatDateTime(
  value: string | null | undefined,
  timeZone?: string,
): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const parts = dateFormat(timeZone, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const day = get('day')
  const month = get('month')
  const year = get('year')
  const hour = get('hour')
  const minute = get('minute')
  const second = get('second')
  return `${day} ${month} ${year}, ${hour}:${minute}:${second}`
}

export function formatTime(
  value: string | null | undefined,
  timeZone?: string,
): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return dateFormat(timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatDate(
  value: string | null | undefined,
  timeZone?: string,
): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return dateFormat(timeZone, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatShortDate(
  value: string | null | undefined,
  timeZone?: string,
): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return dateFormat(timeZone, {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

export function durationLabel(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  if (!from || !to) return '—'
  const start = new Date(from).getTime()
  const end = new Date(to).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—'
  const seconds = Math.round((end - start) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return 'Unknown'
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function truncate(value: string, max = 120): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

export function shortId(value: string): string {
  return value.replace(/^case-/, '').slice(0, 8)
}

export function percent(value: number, total: number): number {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

export function initials(value: string): string {
  const parts = value.trim().split(/\s+/)
  if (parts.length === 0) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function fileName(value: string): string {
  return value.split(/[\\/]/).pop() || value
}
