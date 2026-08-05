# Partender Social Command Center

Partender is a private, mobile-friendly operating dashboard for building a golf-industry brand around competitive play, tournament operations, and golf technology.

The first flagship workflow, **Played, Not Filmed**, turns verified round data and approved reference footage into an AI-assisted golf broadcast. The dashboard also manages brand positioning, content ideas, production status, publishing rhythm, account audit inputs, and reusable source videos.

## What is included

- Brand command center and launch plan
- Played, Not Filmed production studio
- Persistent content idea pipeline
- Mobile source-video intake and production library
- Original-quality MP4, MOV, M4V, WebM, MPEG, and 3GP uploads
- 8 MB multipart uploads with automatic retry and cancellation
- Private video playback with HTTP range support
- Footage categories and production notes
- Calendar, analytics framework, and Instagram audit packet

## Storage model

The repository contains application source only. Videos are never committed to GitHub.

- Cloudflare D1 stores content records, video metadata, upload state, and multipart part receipts.
- Cloudflare R2 stores original video bytes.
- The Sites access policy controls who can open the dashboard; the current deployment is owner-only.
- The upload API keeps object keys server-side and exposes only authenticated same-site playback URLs.

Large files are divided into 8 MB parts so each request remains small and recoverable on a mobile connection. Each part is recorded before the final R2 assembly. An interrupted upload does not appear as production-ready.

## Application structure

```text
app/page.tsx                    Main command-center UI
app/media-library.tsx           Mobile upload queue and source library
app/api/content/route.ts        Persistent content workflow
app/api/media/route.ts          Multipart upload, listing, and playback API
app/api/media/media-utils.ts    File validation, chunking, and range helpers
db/schema.ts                    D1 content and media schema
drizzle/                        Checked-in D1 migrations
worker/index.ts                 Cloudflare Worker entry point
```

## Local development

Requirements:

- Node.js 22.13 or newer
- npm

Install and run:

```bash
npm ci
npm run dev
```

The hosting manifest declares `DB` and `BUCKET` as the logical D1 and R2 bindings. The local Cloudflare runtime simulates both bindings.

## Verification

```bash
npm run lint
npm test
```

`npm test` runs the production build, validates the deployable Worker artifact, checks rendered dashboard navigation, and tests filename validation, video chunking, object keys, and byte-range behavior.

## Deployment and privacy

The application is configured for ChatGPT Sites. Keep the deployed Site private unless its footage and account data are intentionally cleared for a wider audience. Making the GitHub repository public does not make R2 videos public, but application access policy and storage bindings still need to be reviewed before any public launch.

Publishing to Instagram remains a manual approval step. Arccos data-use rights and course-imagery rights must be cleared separately before monetized distribution of the flagship format.
