import { useEffect, useState } from 'react';
import { 
  Zap, 
  Wrench, 
  Rocket, 
  RefreshCw, 
  Github, 
  Activity, 
  Send 
} from 'lucide-react';

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
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-[#0a0a0f]/90 backdrop-blur-md px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="text-xl font-bold tracking-tight text-white">
            {info?.name || '{{NAME}}'}
          </div>
          <div className="flex gap-8">
            <a href="#features" className="text-sm font-medium text-muted transition-colors hover:text-white">Features</a>
            <a href="#docs" className="text-sm font-medium text-muted transition-colors hover:text-white">Docs</a>
            <a 
              href="https://github.com/qwertyczee/1jm-app" 
              className="text-muted transition-colors hover:text-white"
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Github className="h-5 w-5" />
            </a>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 md:px-8">
        {/* Hero Section */}
        <section className="py-20 text-center md:py-32">
          <div className="mb-6 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-indigo-300">
            Powered by Hono + React
          </div>
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
            Build Faster with <span className="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">{'{NAME}'}</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted md:text-xl">
            A modern, lightweight web application template ready for production.
            Fast, simple, and scalable.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button className="rounded-lg bg-gradient-to-br from-primary to-secondary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-primary/40">
              Get Started
            </button>
            <button className="rounded-lg border border-zinc-700 bg-transparent px-8 py-3.5 text-base font-medium text-foreground transition-all hover:bg-white/5">
              Learn More
            </button>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="group rounded-xl border border-border bg-card p-8 transition-all hover:-translate-y-1 hover:border-zinc-700">
              <div className="mb-4 text-3xl">
                <Zap className="h-10 w-10 text-primary" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">Lightning Fast</h3>
              <p className="text-muted">Built on Hono for optimal performance and minimal overhead.</p>
            </div>
            
            {/* Feature 2 */}
            <div className="group rounded-xl border border-border bg-card p-8 transition-all hover:-translate-y-1 hover:border-zinc-700">
              <div className="mb-4 text-3xl">
                <Wrench className="h-10 w-10 text-primary" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">Developer Experience</h3>
              <p className="text-muted">Hot reload, TypeScript support, and clean project structure.</p>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-xl border border-border bg-card p-8 transition-all hover:-translate-y-1 hover:border-zinc-700">
              <div className="mb-4 text-3xl">
                <Rocket className="h-10 w-10 text-primary" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">Production Ready</h3>
              <p className="text-muted">Deploy anywhere with Vercel, Bun, or any Node.js host.</p>
            </div>
          </div>
        </section>

        {/* API Section */}
        <section id="docs" className="py-16">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-3xl font-bold text-white md:text-4xl">API Playground</h2>
            <p className="text-muted">Test the APIs directly from this page</p>
          </div>

          <div className="space-y-6">
            {/* Info Card */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-4">
                <span className="rounded bg-primary px-3 py-1 font-mono text-xs font-bold text-white">GET</span>
                <code className="flex-1 font-mono text-base text-white">/api/info</code>
                <button 
                  onClick={fetchInfo} 
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-muted transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-4 text-sm text-muted">Returns app metadata and version info</p>
              
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Activity className="h-4 w-4 animate-pulse" /> Loading...
                </div>
              ) : info ? (
                <pre className="overflow-auto rounded-lg border border-zinc-700 bg-[#0a0a0f] p-4 font-mono text-sm text-indigo-300">
                  {JSON.stringify(info, null, 2)}
                </pre>
              ) : null}
            </div>

            {/* Health Card */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-4">
                <span className="rounded bg-primary px-3 py-1 font-mono text-xs font-bold text-white">GET</span>
                <code className="flex-1 font-mono text-base text-white">/api/health</code>
                <button 
                  onClick={fetchHealth} 
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-muted transition-all hover:border-primary hover:bg-primary/10 hover:text-primary"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <p className="mb-4 text-sm text-muted">Health check endpoint for monitoring</p>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Activity className="h-4 w-4 animate-pulse" /> Loading...
                </div>
              ) : health ? (
                <pre className="overflow-auto rounded-lg border border-zinc-700 bg-[#0a0a0f] p-4 font-mono text-sm text-indigo-300">
                  {JSON.stringify(health, null, 2)}
                </pre>
              ) : null}
            </div>

            {/* Echo Card */}
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center gap-4">
                <span className="rounded bg-success px-3 py-1 font-mono text-xs font-bold text-white">POST</span>
                <code className="flex-1 font-mono text-base text-white">/api/echo</code>
              </div>
              <p className="mb-4 text-sm text-muted">Send data and get it echoed back</p>
              
              <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  className="flex-1 rounded-lg border border-zinc-700 bg-[#0a0a0f] px-4 py-3 font-mono text-sm text-foreground placeholder-zinc-600 outline-none transition-colors focus:border-primary"
                  value={echoInput}
                  onChange={(e) => setEchoInput(e.target.value)}
                  placeholder='{"message": "..."}'
                />
                <button 
                  onClick={sendEcho} 
                  disabled={echoLoading}
                  className="flex items-center justify-center gap-2 rounded-lg bg-success px-6 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-600 hover:-translate-y-[1px] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {echoLoading ? 'Sending...' : (
                    <>
                      Send <Send className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
              
              {echoResponse && (
                <pre className="overflow-auto rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 font-mono text-sm text-emerald-400">
                  {JSON.stringify(echoResponse, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-8 border-t border-border py-8 text-center">
        <p className="text-sm text-zinc-500">
          {info?.name || '{{NAME}}'} v{info?.version || '1.0.0'} — Built with Hono + React
        </p>
      </footer>
    </div>
  );
}