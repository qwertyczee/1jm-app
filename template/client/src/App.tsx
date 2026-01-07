import React, { useEffect, useState } from 'react';

interface AppInfo {
  name: string;
  version: string;
  framework: string;
  timestamp: number;
}

interface HealthStatus {
  status: string;
  uptime: number;
}

interface EchoResponse {
  echoed: unknown;
}

export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [echoInput, setEchoInput] = useState('Hello, Hono!');
  const [echoResponse, setEchoResponse] = useState<EchoResponse | null>(null);
  const [echoLoading, setEchoLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchInfo = () => {
    fetch('/api/info')
      .then(r => r.json())
      .then(setInfo)
      .catch(err => console.error(err));
  };

  const fetchHealth = () => {
    fetch('/api/health')
      .then(r => r.json())
      .then(setHealth)
      .catch(err => console.error(err));
  };

  const sendEcho = async () => {
    setEchoLoading(true);
    try {
      const res = await fetch('/api/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: echoInput }),
      });
      const data = await res.json();
      setEchoResponse(data);
    } catch (err) {
      console.error(err);
    } finally {
      setEchoLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchInfo(), fetchHealth()])
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <nav className="nav">
        <div className="nav-brand">{info?.name || '{{NAME}}'}</div>
        <div className="nav-links">
          <a href="#features" className="nav-link">Features</a>
          <a href="#docs" className="nav-link">Docs</a>
          <a href="https://github.com/qwertyczee/1jm-app" className="nav-link" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </nav>

      <main className="main">
        <section className="hero">
          <div className="hero-badge">Powered by Hono + React</div>
          <h1 className="hero-title">
            Build Faster with <span className="accent">{'{NAME}'}</span>
          </h1>
          <p className="hero-subtitle">
            A modern, lightweight web application template ready for production.
            Fast, simple, and scalable.
          </p>
          <div className="hero-buttons">
            <button className="btn-primary">Get Started</button>
            <button className="btn-secondary">Learn More</button>
          </div>
        </section>

        <section className="features" id="features">
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3 className="feature-title">Lightning Fast</h3>
            <p className="feature-text">Built on Hono for optimal performance and minimal overhead.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔧</div>
            <h3 className="feature-title">Developer Experience</h3>
            <p className="feature-text">Hot reload, TypeScript support, and clean project structure.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🚀</div>
            <h3 className="feature-title">Production Ready</h3>
            <p className="feature-text">Deploy anywhere with Vercel, Bun, or any Node.js host.</p>
          </div>
        </section>

        <section className="api-section" id="docs">
          <h2 className="section-title">API Playground</h2>
          <p className="section-subtitle">Test the APIs directly from this page</p>

          <div className="api-card">
            <div className="api-header">
              <span className="method-badge">GET</span>
              <code className="endpoint">/api/info</code>
              <button className="refresh-btn" onClick={fetchInfo} title="Refresh">↻</button>
            </div>
            <p className="api-desc">Returns app metadata and version info</p>
            {loading ? (
              <div className="loading">Loading...</div>
            ) : info ? (
              <pre className="code-block">{JSON.stringify(info, null, 2)}</pre>
            ) : null}
          </div>

          <div className="api-card">
            <div className="api-header">
              <span className="method-badge">GET</span>
              <code className="endpoint">/api/health</code>
              <button className="refresh-btn" onClick={fetchHealth} title="Refresh">↻</button>
            </div>
            <p className="api-desc">Health check endpoint for monitoring</p>
            {loading ? (
              <div className="loading">Loading...</div>
            ) : health ? (
              <pre className="code-block">{JSON.stringify(health, null, 2)}</pre>
            ) : null}
          </div>

          <div className="api-card">
            <div className="api-header">
              <span className="method-badge post">POST</span>
              <code className="endpoint">/api/echo</code>
            </div>
            <p className="api-desc">Send data and get it echoed back</p>
            <div className="echo-input-group">
              <input
                type="text"
                className="echo-input"
                value={echoInput}
                onChange={(e) => setEchoInput(e.target.value)}
                placeholder='{"message": "..."}'
              />
              <button className="send-btn" onClick={sendEcho} disabled={echoLoading}>
                {echoLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
            {echoResponse && (
              <pre className="code-block success">{JSON.stringify(echoResponse, null, 2)}</pre>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <p className="footer-text">
          {info?.name || '{{NAME}}'} v{info?.version || '1.0.0'} — Built with Hono + React
        </p>
      </footer>
    </div>
  );
}
