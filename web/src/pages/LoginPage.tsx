import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { Brand } from '../components/Brand'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { errorMessage } from '../lib/api'

export function LoginPage() {
  const { user, login } = useAuth()
  const { mode, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from ?? '/app'

  const [username, setUsername] = useState('analyst')
  const [password, setPassword] = useState('logforensics')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to={from} replace />

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link to="/" aria-label="LogForensics home">
          <Brand subtitle="Local log intelligence" />
        </Link>
        <div className="auth-quote">
          <code>Local-first DFIR</code>
          <h2>Evidence stays on this machine.</h2>
          <p>
            Your logs are parsed, analysed and stored locally. The workspace is
            gated so case data is only visible to the analyst at this machine.
          </p>
          <div className="auth-points">
            <div className="auth-point">
              <Check /> Source line and raw message kept for every event
            </div>
            <div className="auth-point">
              <Check /> Explainable rules with concrete thresholds
            </div>
            <div className="auth-point">
              <Check /> No cloud account, API key or telemetry
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(246,244,239,.4)' }}>
          LogForensics · local workspace
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-panel-top">
          <Link className="btn btn-ghost btn-sm" to="/">
            Back to site
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

        <div className="auth-mobile-brand">
          <Brand />
        </div>

        <div className="auth-card">
          <h1>Sign in</h1>
          <p>Access the local investigation workspace.</p>

          <form className="auth-form" onSubmit={onSubmit}>
            {error ? (
              <div className="auth-error" role="alert">
                <AlertTriangle />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="field">
              <label className="label" htmlFor="login-username">
                Username
              </label>
              <input
                id="login-username"
                className="input"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="login-password">
                Password
              </label>
              <div className="input-affix">
                <input
                  id="login-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={submitting}
              style={{ marginTop: 4, width: '100%' }}
            >
              {submitting ? <Loader2 className="spin" /> : null}
              {submitting ? 'Signing in…' : 'Enter workspace'}
              {!submitting ? <ArrowRight /> : null}
            </button>
          </form>

          <div className="demo-note">
            <b>Demo credentials</b>
            <br />
            Username <code>analyst</code> · Password <code>logforensics</code>
            <br />
            Override with <code>LOGFORENSICS_USERNAME</code> and{' '}
            <code>LOGFORENSICS_PASSWORD</code> before starting the server.
          </div>

          <div className="auth-back">
            <Link to="/">← Back to the public site</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
