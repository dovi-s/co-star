# Co-star

Co-star is a rehearsal app for actors built with React, Vite, Express, PostgreSQL/Drizzle, Stripe, Supabase Storage, OpenAI, ElevenLabs, and Resend.

This repo has already been migrated off the Replit-specific runtime pieces and is set up for local development plus Vercel deployment.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Express + TypeScript
- Database: PostgreSQL + Drizzle ORM
- File storage: Supabase Storage
- Payments: Stripe
- Email: Resend
- AI: OpenAI
- Voice: ElevenLabs

## Local development

1. Copy [`.env.example`](./.env.example) to `.env`
2. Fill in the required environment variables
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

5. Typecheck and build when needed:

```bash
npm run check
npm run build
```

## Environment variables

The full template lives in [`.env.example`](./.env.example).

Core values you will need:

- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `GOOGLE_CLIENT_ID`

## Deployment

Deployment notes are in [DEPLOYMENT.md](./DEPLOYMENT.md).

The repo includes:

- [vercel.json](./vercel.json) for Vercel routing
- [api/index.ts](./api/index.ts) as the Vercel serverless entrypoint
- [server/app.ts](./server/app.ts) so the Express app can run in both local server and serverless modes

## Important production note

Multiplayer/websocket support is not enabled in the Vercel serverless entrypoint.

Local development and traditional Node hosting still support multiplayer, but if you want websocket-based multiplayer in production you should host that part separately on a websocket-capable service.

## Migration status

The main Replit-specific integrations have been replaced:

- Stripe connector -> direct Stripe SDK + webhook secret
- Resend connector -> direct Resend SDK
- Replit AI proxy -> direct OpenAI SDK
- Replit object storage sidecar -> Supabase Storage-backed upload/download flow
- Replit Vite plugins -> standard Vite config

## GitHub

Primary repo:

- `https://github.com/dovi-s/co-star`
