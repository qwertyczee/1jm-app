# 1jm - Full-stack Framework

A lightweight full-stack framework wrapping React and Hono for building full-stack apps.

## Structure

```
bin/cli.ts     # CLI entry point
src/
 ├── index.ts   # Package exports (create, build, dev, start)
 ├── create.ts  # Create new projects from template
 ├── build.ts   # Build for production or Vercel
 ├── dev.ts     # Development server
 ├── start.ts   # Start production server
 └── template/  # Template files copied on create
     ├── package.json
     ├── tsconfig.json
     ├── .gitignore
     ├── client/
     │   ├── index.html
     │   └── src/
     │       ├── main.tsx
     │       └── App.tsx
     └── server/
         └── index.ts
```

## Usage

### Create a new project

```bash
# Using 1jm CLI directly
bun run ./bin/cli.ts create my-app

# Or install 1jm globally
bun install -g 1jm
1jm create my-app
```

### Development

```bash
cd my-app
bun run dev              # Start both client and server dev servers
bun run dev --client     # Start only client dev server
bun run dev --server     # Start only server dev server
```

### Build

```bash
# Production build (outputs to dist/)
bun run build            # Runs: 1jm build

# Vercel deployment build (outputs to .vercel/output/)
bun run build --vercel   # Runs: 1jm build --vercel
```

### Start Production Server

```bash
bun run start            # Runs: 1jm start
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `1jm create <name>` | Create a new project from template |
| `1jm build` | Build for production (outputs to `dist/`) |
| `1jm build --vercel` | Build for Vercel deployment |
| `1jm dev` | Start development servers (client + server) |
| `1jm dev --client` | Start only client dev server |
| `1jm dev --server` | Start only server dev server |
| `1jm start` | Start production server |

## Package as Framework

The `1jm` package can be used as a dev dependency:

```json
{
  "devDependencies": {
    "1jm": "latest"
  },
  "scripts": {
    "dev": "1jm dev",
    "build": "1jm build",
    "build:vercel": "1jm build --vercel",
    "start": "1jm start"
  }
}
```

This allows the framework to be used both as a CLI and imported programmatically.
