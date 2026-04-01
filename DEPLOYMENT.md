# Deployment

## Local dev

1. Copy `.env.example` to `.env`.
2. Fill in the required secrets.
3. Run:

```bash
npm install
npm run dev
```

## Supabase

1. Create a Supabase project.
2. Set `DATABASE_URL` to the direct Postgres connection string.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Create the storage bucket named by `SUPABASE_STORAGE_BUCKET` or keep the default `app`.
5. Run:

```bash
npm run db:push
```

## Stripe

1. Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`.
2. Add a webhook endpoint:

`https://your-domain.com/api/stripe/webhook`

3. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Vercel

1. Import the GitHub repo into Vercel.
2. Add all variables from `.env.example` in the Vercel project settings.
3. Deploy.

## Important note about multiplayer

The multiplayer/websocket feature is disabled in the Vercel serverless entrypoint.
Local/dev and traditional Node hosting still support it, but Vercel serverless does not support persistent websocket connections the same way.

If you want multiplayer in production, host the websocket server separately or move that feature to a websocket-capable service.
