# 1jm - Full-stack Framework for Bun

A lightweight full-stack framework combining React (Vite) for the frontend and Hono for the backend. Built specifically for the Bun runtime with native Vercel deployment support.

## Why 1jm?

- **Bun-native** - Built from the ground up for Bun. Uses Bun.serve, Bun.build, and Bun's native fetch
- **Type-safe RPC** - Direct HTTP communication between client and server with full type inference
- **Minimal Abstraction** - React on the client, Hono on the server. No magic, just standard APIs
- **Vercel Integration** - Native Vercel Edge/Serverless output with automatic route analysis
- **Static Route Caching** - Experimental feature to auto-detect static endpoints and cache them at CDN edge
- **Fast Builds** - Bun.build for bundling, esbuild-powered Vite for development

## When to Use

- You want to use **Bun** as your server runtime
- Building a React app with Hono API routes
- Deploying to **Vercel** (Edge Functions or Serverless)
- Need type-safe client-to-server communication without GraphQL/tRPC overhead
- Want hot reload for both client and server

## Quick Start

```bash
# Create a new project (requires Bun)
bunx 1jm-cli
1jm create my-app

# Interactive setup will ask for:
# - Project Name
# - Database selection (Prisma available, Drizzle coming soon)
# - Styling options (Tailwind CSS, shadcn/ui)
# - Git initialization

cd my-app

# Development - starts both client (Vite) and server (Bun)
bun run dev

# Production build
bun run build

# To generate Vercel deployment artifacts
bun run build --vercel
```

## Features & Tech Stack

- **Frontend:** React 19.x with TypeScript, Vite
- **Backend:** Hono 4.x
- **Runtime:** Bun (primary), Node.js compatible
- **Styling Options:**
  - Tailwind CSS v4
  - shadcn/ui components
- **Database Support:**
  - ✅ **Prisma** (SQLite default, easily swappable)
  - 🚧 **Drizzle** (Coming Soon)

## Project Structure

```
my-app/
├── client/               # React frontend (Vite)
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       └── App.tsx
├── server/               # Hono backend
│   ├── db.ts             # Database client (if selected)
│   └── index.ts          # Exports Hono app
├── prisma/               # Prisma schema (if selected)
├── package.json
└── tsconfig.json
```

## Commands

| Command | Description |
|---------|-------------|
| `1jm create <name>` | Create new project (interactive if no name) |
| `1jm dev` | Start dev servers (client + server) |
| `1jm dev --client` | Client dev server only (port 3000) |
| `1jm dev --server` | Server dev server only (port 45828) |
| `1jm build` | Production build (outputs to `dist/`) |
| `1jm build --vercel` | Vercel build (outputs to `.vercel/output/`) |
| `1jm build --vercel --experimental-static` | Vercel build with static route caching |
| `1jm analyze` | Analyze routes for static/dynamic classification |
| `1jm start` | Start production server from `dist/` |

## Runtime Support

| Runtime | Support |
|---------|---------|
| **Bun** | Primary - full support |
| **Vercel Edge** | Native via `--vercel` |
| **Vercel Serverless** | Native via `--vercel` |
| Node.js | Compatible (server exports fetch) |

## License

MIT
