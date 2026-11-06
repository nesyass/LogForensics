import {
  ArrowRight,
  Check,
  FileSearch,
  Fingerprint,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Brand } from '../components/Brand'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { RULES, SEVERITY_LABEL } from '../lib/constants'

const BARS = [
  18, 26, 22, 34, 28, 42, 38, 30, 46, 55, 48, 62, 58, 72, 64, 78, 70, 84, 76,
  66, 58, 50, 44, 36, 30, 24, 34, 28, 22, 18, 24, 20,
]

export function LandingPage() {
  const { user } = useAuth()
  const { mode, toggle } = useTheme()
  const enterPath = user ? '/app' : '/login'

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-inner">
          <Link to="/" aria-label="LogForensics home">
            <Brand />
          </Link>
          <nav className="landing-links" aria-label="Primary">
            <a href="#how-it-works">How it works</a>
            <a href="#rules">Detection rules</a>
            <a href="#privacy">Privacy</a>
          </nav>
          <div className="landing-nav-actions">
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
            {user ? (
              <Link className="btn btn-primary btn-sm" to="/app">
                Open workspace
              </Link>
            ) : (
              <>
                <Link className="btn btn-ghost btn-sm" to="/login">
                  Sign in
                </Link>
                <Link className="btn btn-primary btn-sm" to="/login">
                  Start analysis
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="landing-inner hero">
          <div className="hero-copy">
            <div className="eyebrow">Local-first log investigation</div>
            <h1>
              Turn raw logs into <em>defensible findings.</em>
            </h1>
            <p className="hero-lede">
              A focused workbench for Linux authentication and web access logs.
              Parse, detect and review evidence without sending a single byte to
              the cloud.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" to={enterPath}>
                {user ? 'Open workspace' : 'Start an analysis'}
                <ArrowRight />
              </Link>
              <a className="btn btn-secondary btn-lg" href="#rules">
                See the rules
              </a>
            </div>
            <div className="hero-meta">
              <span>
                <Check /> Runs entirely offline
              </span>
              <span>
                <Check /> Evidence-linked alerts
              </span>
              <span>
                <Check /> No API keys, no accounts
              </span>
            </div>
          </div>

          <div className="preview" aria-hidden="true">
            <div className="preview-bar">
              <span className="preview-dots">
                <i />
                <i />
                <i />
              </span>
              <span className="preview-title">case-a91f3c · overview</span>
            </div>
            <div className="preview-body">
              <div className="preview-side">
                <div className="preview-side-item active">
                  <i /> Overview
                </div>
                <div className="preview-side-item">
                  <i /> Events
                </div>
                <div className="preview-side-item">
                  <i /> Detections
                </div>
                <div className="preview-side-item">
                  <i /> Timeline
                </div>
                <div className="preview-side-item">
                  <i /> Sources
                </div>
                <div className="preview-side-item">
                  <i /> Exports
                </div>
              </div>
              <div className="preview-main">
                <div className="preview-kpis">
                  <div className="preview-kpi">
                    <b>51</b>
                    <span>Events</span>
                  </div>
                  <div className="preview-kpi">
                    <b>13</b>
                    <span>Detections</span>
                  </div>
                  <div className="preview-kpi">
                    <b>3</b>
                    <span>Incidents</span>
                  </div>
                </div>
                <div className="preview-chart">
                  {BARS.map((height, index) => (
                    <i
                      key={index}
                      className={index % 7 === 0 ? 'web' : index % 11 === 0 ? 'sys' : ''}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <div className="preview-rows">
                  <div className="preview-row high">
                    <i />
                    <span>Successful login after 12 failures</span>
                    <code>LF-002</code>
                  </div>
                  <div className="preview-row">
                    <i />
                    <span>Failed login burst · 203.0.113.50</span>
                    <code>LF-001</code>
                  </div>
                  <div className="preview-row low">
                    <i />
                    <span>Sensitive path request · /.env</span>
                    <code>LF-005</code>
                  </div>
                  <div className="preview-row">
                    <i />
                    <span>HTTP error spike · 198.51.100.24</span>
                    <code>LF-004</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-inner section" id="privacy">
          <div className="section-head">
            <h2>Built for evidence, not dashboards.</h2>
            <p>
              Every finding can be traced back to the exact file, line and raw
              message that produced it. Nothing is discarded silently.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature">
              <div className="feature-icon">
                <FileSearch />
              </div>
              <h3>Traceable by construction</h3>
              <p>
                Events keep their source file, line number and original raw
                message. Open any detection and inspect the evidence behind it.
              </p>
            </article>
            <article className="feature">
              <div className="feature-icon">
                <ShieldCheck />
              </div>
              <h3>Explainable detection</h3>
              <p>
                Five transparent rules cover failed logins, success after
                failures, spraying, HTTP error spikes and sensitive-path probes.
              </p>
            </article>
            <article className="feature">
              <div className="feature-icon">
                <Lock />
              </div>
              <h3>Local by default</h3>
              <p>
                Logs are processed on this machine and stored in a local SQLite
                case file. No cloud account, API key or telemetry is required.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-inner section" id="rules">
          <div className="section-head">
            <h2>Five rules you can defend.</h2>
            <p>
              Thresholds are configurable lab defaults, not hidden scoring. Each
              alert states the concrete counts and time window that triggered it.
            </p>
          </div>
          <div className="rule-grid">
            {RULES.map((rule) => (
              <article className="rule-card" key={rule.id}>
                <div className="rule-id">{rule.id}</div>
                <h3>{rule.name}</h3>
                <p>
                  {rule.description}{' '}
                  <span style={{ color: 'var(--ink-3)' }}>
                    Base severity: {SEVERITY_LABEL[rule.severity]}.
                  </span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-inner section" id="how-it-works">
          <div className="section-head">
            <h2>From upload to export.</h2>
            <p>
              A short, auditable path: ingest the files, normalise the records,
              run detection, then review and export the case.
            </p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-num">STEP 01</div>
              <h3>Ingest &amp; parse</h3>
              <p>
                Drop in .log, .txt or .csv files. The parser auto-detects Linux
                auth or web access formats and records encoding and hashes.
              </p>
            </div>
            <div className="step">
              <div className="step-num">STEP 02</div>
              <h3>Detect &amp; correlate</h3>
              <p>
                Normalised events run through LF-001–LF-005. Alerts sharing a
                source IP are grouped into incidents with their evidence.
              </p>
            </div>
            <div className="step">
              <div className="step-num">STEP 03</div>
              <h3>Review &amp; export</h3>
              <p>
                Triage alerts, inspect raw lines, then export JSON, CSV,
                Markdown or a complete ZIP bundle for the case record.
              </p>
            </div>
          </div>
        </section>

        <div className="landing-inner">
          <div className="cta-band">
            <div>
              <h2>Start with the sample dataset.</h2>
              <p>
                Explore a complete investigation with 51 events, 13 detections
                and three correlated incidents — no files required.
              </p>
            </div>
            <Link className="btn btn-primary btn-lg" to={enterPath}>
              {user ? 'Open workspace' : 'Sign in to start'}
              <ArrowRight />
            </Link>
          </div>
        </div>
      </main>

      <footer className="landing-inner landing-footer">
        <Brand subtitle="No cloud. No noise." />
        <span>
          <Fingerprint
            style={{ width: 13, height: 13, verticalAlign: -2, marginRight: 6 }}
          />
          Built for local-first investigation.
        </span>
        <nav aria-label="Footer">
          <a href="#how-it-works">How it works</a>
          <a href="#rules">Rules</a>
          <Link to="/login">Sign in</Link>
        </nav>
      </footer>
    </div>
  )
}
