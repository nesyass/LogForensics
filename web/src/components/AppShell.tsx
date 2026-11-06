import {
  ChartNoAxesColumn,
  ChevronDown,
  ChevronRight,
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
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useCases } from '../context/CaseContext'
import { useTheme } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { errorMessage } from '../lib/api'
import { formatNumber, initials, shortId } from '../lib/format'
import { useClickOutside } from '../lib/hooks'
import { Brand } from './Brand'
import { CommandPalette } from './CommandPalette'
import { ConfirmDialog } from './Modal'
import { NewAnalysisModal } from './NewAnalysisModal'
import { ErrorBanner } from './ui'

const PAGE_LABELS: Record<string, string> = {
  '/app': 'Overview',
  '/app/events': 'Event explorer',
  '/app/alerts': 'Detections',
  '/app/timeline': 'Timeline',
  '/app/sources': 'Sources & integrity',
  '/app/ips': 'IP addresses',
  '/app/exports': 'Exports',
}

export function AppShell() {
  const { user, logout } = useAuth()
  const {
    cases,
    activeCase,
    activeId,
    selectCase,
    loadingCase,
    error,
    openNewAnalysis,
    deleteCase,
  } = useCases()
  const { mode, toggle } = useTheme()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [caseMenuOpen, setCaseMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const caseMenuRef = useClickOutside<HTMLDivElement>(caseMenuOpen, () =>
    setCaseMenuOpen(false),
  )
  const userMenuRef = useClickOutside<HTMLDivElement>(userMenuOpen, () =>
    setUserMenuOpen(false),
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    setCaseMenuOpen(false)
  }, [location.pathname])

  const pageLabel = PAGE_LABELS[location.pathname] ?? 'Investigation'
  const needsReview =
    activeCase?.alerts.filter((alert) => alert.status === 'needs_review').length ?? 0
  const eventCount = activeCase?.summary.parsed_events ?? 0
  const incidentCount = activeCase?.incidents.length ?? 0
  const fileCount = activeCase?.files.length ?? 0

  async function signOut() {
    await logout()
    navigate('/')
  }

  async function handleDelete() {
    if (!activeCase) return
    setDeleting(true)
    try {
      const name = activeCase.name
      await deleteCase(activeCase.id)
      setConfirmDelete(false)
      navigate('/app')
      toast(`Case “${name}” deleted.`, 'success')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const navGroups = [
    {
      label: 'Investigate',
      items: [
        {
          to: '/app',
          label: 'Overview',
          icon: LayoutDashboard,
          count: null,
          end: true,
        },
        {
          to: '/app/events',
          label: 'Event explorer',
          icon: ScrollText,
          count: eventCount,
          end: false,
        },
        {
          to: '/app/alerts',
          label: 'Detections',
          icon: ShieldAlert,
          count: needsReview,
          end: false,
        },
        {
          to: '/app/timeline',
          label: 'Timeline',
          icon: ChartNoAxesColumn,
          count: incidentCount,
          end: false,
        },
      ],
    },
    {
      label: 'Evidence',
      items: [
        {
          to: '/app/sources',
          label: 'Sources',
          icon: Files,
          count: fileCount,
          end: false,
        },
        {
          to: '/app/ips',
          label: 'IP addresses',
          icon: Network,
          count: null,
          end: false,
        },
        {
          to: '/app/exports',
          label: 'Exports',
          icon: Download,
          count: null,
          end: false,
        },
      ],
    },
  ]

  return (
    <>
      <div className="shell">
        <aside className="rail">
          <div className="rail-head">
            <Link to="/app" aria-label="LogForensics workspace">
              <Brand />
            </Link>
            <button
              type="button"
              className="btn-icon rail-add"
              onClick={openNewAnalysis}
              aria-label="New analysis"
            >
              <Plus />
            </button>
          </div>

          <div className="rail-case" ref={caseMenuRef}>
            <button
              type="button"
              className="case-switch"
              onClick={() => setCaseMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={caseMenuOpen}
            >
              <span className="case-switch-mark">
                <FolderOpen />
              </span>
              <span className="case-switch-text">
                <b>{activeCase?.name ?? 'No case open'}</b>
                <span>
                  {activeCase
                    ? `case ${shortId(activeCase.id)} · ${activeCase.timezone}`
                    : 'Create an analysis to begin'}
                </span>
              </span>
              <ChevronDown />
            </button>
            {caseMenuOpen ? (
              <div className="case-menu" role="menu">
                <div className="case-menu-label">Open cases</div>
                {cases.length === 0 ? (
                  <div className="case-menu-item" style={{ cursor: 'default' }}>
                    No cases yet
                  </div>
                ) : (
                  cases.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`case-menu-item ${item.id === activeId ? 'active' : ''}`}
                      onClick={() => {
                        selectCase(item.id)
                        setCaseMenuOpen(false)
                        navigate('/app')
                      }}
                    >
                      <FolderOpen
                        style={{ width: 13, height: 13, flex: 'none' }}
                      />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </span>
                      <span className="mono">{shortId(item.id)}</span>
                    </button>
                  ))
                )}
                <div className="case-menu-foot">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setCaseMenuOpen(false)
                      openNewAnalysis()
                    }}
                  >
                    <Plus /> New
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setCaseMenuOpen(false)
                      setConfirmDelete(true)
                    }}
                    disabled={!activeCase}
                  >
                    <Trash2 /> Delete
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rail-new">
            <button
              type="button"
              className="btn btn-primary"
              onClick={openNewAnalysis}
            >
              <Plus /> New analysis
            </button>
          </div>

          <nav className="rail-nav" aria-label="Workspace">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="rail-label">{group.label}</div>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `nav-item ${isActive ? 'active' : ''}`
                      }
                    >
                      <span className="nav-icon">
                        <Icon />
                      </span>
                      <span className="nav-label">{item.label}</span>
                      {item.count ? (
                        <span className="nav-count">
                          {formatNumber(item.count)}
                        </span>
                      ) : null}
                    </NavLink>
                  )
                })}
              </div>
            ))}
          </nav>

          <div className="rail-foot">
            <div className="rail-user">
              <span className="avatar">{initials(user ?? 'Analyst')}</span>
              <div className="rail-user-text">
                <b>{user}</b>
                <span>Local analyst</span>
              </div>
            </div>
            <div className="rail-foot-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={toggle}
              >
                {mode === 'dark' ? <Sun /> : <Moon />}
                {mode === 'dark' ? 'Light' : 'Dark'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void signOut()}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut />
              </button>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="crumb">
              <FolderOpen />
              <b>{activeCase?.name ?? 'No case open'}</b>
              <ChevronRight />
              <span>{pageLabel}</span>
            </div>
            <div className="topbar-actions">
              <button
                type="button"
                className="search-trigger"
                onClick={() => setPaletteOpen(true)}
              >
                <Search />
                <span className="search-label">Search or jump…</span>
                <span className="kbd">Ctrl K</span>
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={toggle}
                aria-label={
                  mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
                }
                title="Toggle theme"
              >
                {mode === 'dark' ? <Sun /> : <Moon />}
              </button>
              <span className="topbar-divider" />
              <div ref={userMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setUserMenuOpen((current) => !current)}
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  aria-label="Account menu"
                >
                  <span className="avatar" style={{ width: 26, height: 26 }}>
                    {initials(user ?? 'Analyst')}
                  </span>
                </button>
                {userMenuOpen ? (
                  <div className="menu" role="menu">
                    <div style={{ padding: '7px 9px 9px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{user}</div>
                      <div
                        className="muted"
                        style={{ fontSize: 10.5, marginTop: 1 }}
                      >
                        Local session
                      </div>
                    </div>
                    <div className="menu-sep" />
                    <button type="button" className="menu-item" onClick={toggle}>
                      {mode === 'dark' ? <Sun /> : <Moon />}
                      {mode === 'dark' ? 'Light theme' : 'Dark theme'}
                    </button>
                    <button
                      type="button"
                      className="menu-item"
                      onClick={() => {
                        setUserMenuOpen(false)
                        navigate('/')
                      }}
                    >
                      <Globe2 /> Public site
                    </button>
                    <div className="menu-sep" />
                    <button
                      type="button"
                      className="menu-item danger"
                      onClick={() => {
                        setUserMenuOpen(false)
                        void signOut()
                      }}
                    >
                      <LogOut /> Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {loadingCase ? <span className="topbar-loading" /> : null}
          </header>

          {error ? (
            <div style={{ padding: '16px 32px 0' }}>
              <ErrorBanner message={error} />
            </div>
          ) : null}

          <Outlet />
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNewAnalysis={openNewAnalysis}
      />
      <NewAnalysisModal />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
        title="Delete this case?"
        description={`“${activeCase?.name ?? 'This case'}” and all of its stored events, detections and review statuses will be removed from the local database. Exported files are not affected.`}
        confirmLabel="Delete case"
        busy={deleting}
        danger
      />
    </>
  )
}
