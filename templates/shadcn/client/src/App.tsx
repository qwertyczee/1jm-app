import { useEffect, useState } from 'react';
import { 
  Zap, 
  Wrench, 
  Rocket, 
  RefreshCw, 
  Github, 
  Server, 
  Activity, 
  Send 
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent, 
  CardDescription,
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between mx-auto px-4 md:px-8">
          <div className="mr-4 flex">
            <a className="mr-6 flex items-center space-x-2 font-bold text-lg tracking-tight" href="/">
              <span>{info?.name || '{{NAME}}'}</span>
            </a>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <nav className="flex items-center space-x-1 text-sm font-medium">
              <Button variant="ghost" asChild>
                <a href="#features">Features</a>
              </Button>
              <Button variant="ghost" asChild>
                <a href="#docs">Docs</a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a href="https://github.com/qwertyczee/1jm-app" target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4" />
                  <span className="sr-only">GitHub</span>
                </a>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
          <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center mx-auto px-4">
            <Badge variant="secondary" className="rounded-full px-4 py-1">
              Powered by Hono + React
            </Badge>
            <h1 className="font-heading text-3xl font-extrabold sm:text-5xl md:text-6xl lg:text-7xl">
              Build Faster with <span className="text-primary">{'{NAME}'}</span>
            </h1>
            <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
              A modern, lightweight web application template ready for production.
              Fast, simple, and scalable.
            </p>
            <div className="flex gap-4">
              <Button size="lg">Get Started</Button>
              <Button variant="outline" size="lg">Learn More</Button>
            </div>
          </div>
        </section>

        <Separator />

        {/* Features Section */}
        <section id="features" className="container space-y-6 py-8 md:py-12 lg:py-24 mx-auto px-4">
          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
            <Card className="border-border bg-card">
              <CardHeader>
                <Zap className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>Lightning Fast</CardTitle>
                <CardDescription>
                  Built on Hono for optimal performance and minimal overhead.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader>
                <Wrench className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>Developer Experience</CardTitle>
                <CardDescription>
                  Hot reload, TypeScript support, and clean project structure.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader>
                <Rocket className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>Production Ready</CardTitle>
                <CardDescription>
                  Deploy anywhere with Vercel, Bun, or any Node.js host.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* API Playground Section */}
        <section id="docs" className="container py-8 md:py-12 lg:py-24 mx-auto px-4 max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">API Playground</h2>
            <p className="mt-4 text-lg text-muted-foreground">Test the APIs directly from this page</p>
          </div>

          <div className="grid gap-6">
            {/* Info Endpoint */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">GET</Badge>
                  <code className="text-sm font-mono font-bold">/api/info</code>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchInfo} title="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Returns app metadata and version info</p>
                <div className="rounded-md bg-muted p-4">
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-4 w-4 animate-pulse" /> Loading...
                    </div>
                  ) : info ? (
                    <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(info, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-sm text-muted-foreground">No data</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Health Endpoint */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">GET</Badge>
                  <code className="text-sm font-mono font-bold">/api/health</code>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchHealth} title="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Health check endpoint for monitoring</p>
                <div className="rounded-md bg-muted p-4">
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-4 w-4 animate-pulse" /> Loading...
                    </div>
                  ) : health ? (
                    <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(health, null, 2)}
                    </pre>
                  ) : (
                    <span className="text-sm text-muted-foreground">No data</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Echo Endpoint */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <Badge className="font-mono">POST</Badge>
                  <code className="text-sm font-mono font-bold">/api/echo</code>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Send data and get it echoed back</p>
                <div className="flex gap-2 mb-4">
                  <Input 
                    type="text" 
                    value={echoInput} 
                    onChange={(e) => setEchoInput(e.target.value)}
                    placeholder='{"message": "..."}'
                    className="font-mono"
                  />
                  <Button onClick={sendEcho} disabled={echoLoading} className="min-w-[100px]">
                    {echoLoading ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {echoLoading ? 'Sending' : 'Send'}
                  </Button>
                </div>
                
                {echoResponse && (
                  <div className="rounded-md bg-muted p-4 border border-primary/20">
                    <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap text-primary">
                      {JSON.stringify(echoResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/40">
        <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0 mx-auto px-4">
          <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
            <Server className="h-5 w-5" />
            <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
              {info?.name || '{{NAME}}'} v{info?.version || '1.0.0'} — Built with Hono + React
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}