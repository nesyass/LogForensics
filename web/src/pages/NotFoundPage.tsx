import { ArrowLeft, ArrowRight, Compass, Moon, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Brand } from '../components/Brand'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export function NotFoundPage() {
  const { user } = useAuth()
  const { mode, toggle } = useTheme()

  return (
    <div className="notfound">
      <div className="notfound-top">
        <Link to="/" aria-label="LogForensics home">
          <Brand />
        </Link>
        <button
          type="button"
          className="btn-icon"
          onClick={toggle}
          aria-label={
            mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
          }
        >
          {mode === 'dark' ? <Sun /> : <Moon />}
        </button>
      </div>

      <main className="notfound-card">
        <div className="notfound-code">404</div>
        <div className="eyebrow" style={{ justifyContent: 'center' }}>
          <Compass style={{ width: 13, height: 13 }} />
          Off the evidence trail
        </div>
        <h1>This page is not part of the case.</h1>
        <p>
          The link may be mistyped, or the page may have moved. The workspace and
          the public site are still available.
        </p>
        <div className="notfound-actions">
          <Link className="btn btn-primary" to={user ? '/app' : '/'}>
            {user ? <ArrowLeft /> : null}
            {user ? 'Back to workspace' : 'Back to the public site'}
          </Link>
          {!user ? (
            <Link className="btn btn-secondary" to="/login">
              Sign in <ArrowRight />
            </Link>
          ) : (
            <Link className="btn btn-secondary" to="/">
              Public site <ArrowRight />
            </Link>
          )}
        </div>
      </main>

      <footer className="notfound-foot">
        <span>LogForensics · local-first log investigation</span>
        <span className="mono">HTTP 404</span>
      </footer>
    </div>
  )
}
