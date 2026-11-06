import {
  ChartNoAxesColumn,
  Download,
  Files,
  FolderOpen,
  Globe2,
  LayoutDashboard,
  LogOut,
  Moon,
  Network,
  Plus,
  ScrollText,
  Search,
  ShieldAlert,
  Sun,
} from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useCases } from '../context/CaseContext'
import { useTheme } from '../context/ThemeContext'
import { formatNumber } from '../lib/format'

interface PaletteItem {
  id: string
  label: string
  group: string
  keywords: string
  icon: typeof LayoutDashboard
  run: () => void
}

export function CommandPalette({
  open,
  onClose,
  onNewAnalysis,
}: {
  open: boolean
  onClose: () => void
  onNewAnalysis: () => void
}) {
  const navigate = useNavigate()
  const { mode, toggle } = useTheme()
  const { logout } = useAuth()
  const { cases, selectCase } = useCases()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
  }, [open])

  const items = useMemo<PaletteItem[]>(() => {
    const go = (path: string) => () => {
      navigate(path)
      onClose()
    }
    const navigation: PaletteItem[] = [
      {
        id: 'nav-overview',
        label: 'Overview',
        group: 'Navigate',
        keywords: 'home dashboard summary',
        icon: LayoutDashboard,
        run: go('/app'),
      },
      {
        id: 'nav-events',
        label: 'Event explorer',
        group: 'Navigate',
        keywords: 'logs search table',
        icon: ScrollText,
        run: go('/app/events'),
      },
      {
        id: 'nav-alerts',
        label: 'Detections',
        group: 'Navigate',
        keywords: 'alerts findings rules',
        icon: ShieldAlert,
        run: go('/app/alerts'),
      },
      {
        id: 'nav-timeline',
        label: 'Timeline',
        group: 'Navigate',
        keywords: 'chart incidents activity',
        icon: ChartNoAxesColumn,
        run: go('/app/timeline'),
      },
      {
        id: 'nav-sources',
        label: 'Sources & integrity',
        group: 'Navigate',
        keywords: 'files hashes parse errors',
        icon: Files,
        run: go('/app/sources'),
      },
      {
        id: 'nav-ips',
        label: 'IP addresses',
        group: 'Navigate',
        keywords: 'network sources actors',
        icon: Network,
        run: go('/app/ips'),
      },
      {
        id: 'nav-exports',
        label: 'Exports',
        group: 'Navigate',
        keywords: 'download csv json markdown zip report',
        icon: Download,
        run: go('/app/exports'),
      },
    ]
    const actions: PaletteItem[] = [
      {
        id: 'act-new',
        label: 'New analysis',
        group: 'Actions',
        keywords: 'create case upload sample',
        icon: Plus,
        run: () => {
          onNewAnalysis()
          onClose()
        },
      },
      {
        id: 'act-theme',
        label: mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        group: 'Actions',
        keywords: 'appearance colour color dark light',
        icon: mode === 'dark' ? Sun : Moon,
        run: () => {
          toggle()
          onClose()
        },
      },
      {
        id: 'act-landing',
        label: 'Open public site',
        group: 'Actions',
        keywords: 'home marketing landing about',
        icon: Globe2,
        run: go('/'),
      },
      {
        id: 'act-signout',
        label: 'Sign out',
        group: 'Actions',
        keywords: 'logout leave session',
        icon: LogOut,
        run: () => {
          void logout().then(() => navigate('/'))
          onClose()
        },
      },
    ]
    const caseItems: PaletteItem[] = cases.map((item) => ({
      id: `case-${item.id}`,
      label: item.name,
      group: 'Cases',
      keywords: `${item.id} ${item.parser} ${item.timezone}`,
      icon: FolderOpen,
      run: () => {
        selectCase(item.id)
        navigate('/app')
        onClose()
      },
    }))
    return [...navigation, ...actions, ...caseItems]
  }, [cases, mode, navigate, onClose, onNewAnalysis, selectCase, toggle, logout])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) =>
      `${item.label} ${item.group} ${item.keywords}`
        .toLowerCase()
        .includes(needle),
    )
  }, [items, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const element = document.getElementById(`palette-item-${active}`)
    element?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => Math.min(current + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      filtered[active]?.run()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  if (!open) return null

  let lastGroup = ''
  let runningIndex = -1

  return (
    <div
      className="palette-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input-row">
          <Search />
          <input
            className="palette-input"
            placeholder="Search pages, actions and cases…"
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Command search"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="palette-list">
          {filtered.length === 0 ? (
            <div className="palette-empty">No commands match “{query}”.</div>
          ) : (
            filtered.map((item) => {
              runningIndex += 1
              const index = runningIndex
              const showGroup = item.group !== lastGroup
              lastGroup = item.group
              const Icon = item.icon
              return (
                <div key={item.id}>
                  {showGroup ? <div className="palette-group">{item.group}</div> : null}
                  <button
                    type="button"
                    id={`palette-item-${index}`}
                    className={`palette-item ${index === active ? 'active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={item.run}
                  >
                    <Icon />
                    <span>{item.label}</span>
                    {item.group === 'Cases' ? (
                      <span className="kbd" style={{ background: 'transparent' }}>
                        {formatNumber(
                          cases.find(
                            (entry) => `case-${entry.id}` === item.id,
                          )?.summary.parsed_events,
                        )}
                      </span>
                    ) : null}
                  </button>
                </div>
              )
            })
          )}
        </div>
        <div className="palette-foot">
          <span>
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigate
          </span>
          <span>
            <span className="kbd">↵</span> run
          </span>
          <span style={{ marginLeft: 'auto' }}>
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
}
