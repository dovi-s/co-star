# Co-star Studio

## Overview
Co-star Studio is a premium, mobile-first rehearsal application for actors. It provides a zero-setup, intuitive rehearsal experience with intelligent scene partners. The core purpose is to enable effective script rehearsal with features like automatic voice assignment, natural timing, and local data privacy. The project aims to be a sophisticated, minimal, and professional tool for actors, simplifying rehearsal and enhancing performance preparation. It targets performers, professionals, and specialized training, offering Free and Pro subscription tiers.

## User Preferences
I prefer detailed explanations.
I want to be asked before making major changes.
I prefer to work iteratively.
I prefer to use simple language.
I like functional programming.
Do not make changes to the `server/` directory without explicit instruction.
Do not make changes to the `shared/` directory without explicit instruction.
Do not change the design system without prior discussion.

## System Architecture

### UI/UX Decisions
The design is sophisticated and minimal, inspired by Apple's Liquid Glass, featuring translucent materials, rounded shapes, and a content-first hierarchy. It uses clean monochromatic controls with selective color accents, a high-contrast color scheme (Light Mode: #FFFFFF/#0F172A, Dark Mode: #0E1218/#E6EDF3), and the Inter font family. Motion is subtle with 200ms ease-out transitions. Accessibility is prioritized with WCAG AA contrast, 44px touch targets, semantic HTML, and dynamic page titles. Empty states are designed with themed icons and clear CTAs. The application is optimized for PWA with `viewport-fit=cover`, `100dvh` for mobile, and `overscroll-behavior: none` in standalone mode.

### Technical Implementations
The application supports script import from various formats (`.txt`, `.pdf`, images) using AI-powered OCR and robust script parsing to detect characters, stage directions, and multi-scene layouts. The script parser (`server/script-parser.ts` and `client/src/lib/script-parser.ts` — must stay in sync) handles plays (period-format like "CALLIE. dialogue"), musicals, and screenplays. It includes: period-format dialogue regex supporting dashes/quotes/numbers, stage direction continuation (parenthetical doesn't clear pending character), cast list skip detection, 100+ NOT_CHARACTER_PATTERNS for filtering false positives (action verbs, camera terms, locations, time expressions, etc.), OCR variant merging with tight ratio constraints, PDF column-merge detection, and play-style ALL CAPS section header detection for scene breaks. It includes intelligent role selection with Smart Cast for AI voice assignment, a Three-Line Reader for guided rehearsal, and comprehensive transport controls. The voice engine uses ElevenLabs AI voices with emotion detection and customizable presets. Speech recognition handles single utterances with error recovery and natural pauses. Settings allow customization of ambient sound, voice presets, font size, and dark/light mode. Advanced features include a Performance Feedback System, Audition Mode for self-tapes, a "LINE" voice command for hints, Hands-Free Mode with Wake Lock, and a multi-level Line Memorization system. Multiplayer Table Read functionality enables real-time remote rehearsals via WebSocket, including host controls and synchronized line progression, with WebRTC for peer-to-peer video calls. Authentication supports custom email/password and Google Sign-In. An Admin Dashboard provides analytics, user management, feedback, and error logs.
Key features include:
- **Script Context Capture**: Links action lines and scene descriptions to subsequent dialogue.
- **Scene Transition Cards**: Visual cues for scene changes.
- **Context Peek Feature**: Allows viewing stage directions and preceding actions.
- **Global Script Navigation**: Progress indicator across the entire script with automatic scene advancement.

### Device Fingerprint Anti-Abuse System
- A `device_usage` table tracks script usage per device fingerprint (UUID stored in localStorage + IndexedDB)
- Both `POST /api/script-usage/increment` and `GET /api/script-usage` check the higher of user vs device usage count
- Prevents multi-account abuse: creating a new free account on the same device inherits the device's existing usage count
- Client utility: `client/src/lib/device-fingerprint.ts` — exports `getDeviceFingerprint(): Promise<string>`
- Fingerprint is sent as `deviceFingerprint` in POST body or GET query param on all usage-related API calls
- Same 12-hour reset window applies to device usage as to user usage

### Cancel Retention Flow
- When Pro users click "Cancel plan" on the subscription page, a `CancelRetentionSheet` bottom sheet opens
- 3-step flow: (1) "What you'll lose" with Pro features shown as crossed-out, (2) feedback with optional reason/comment + pause option, (3) confirmation
- Cancel button is always enabled and visible — no dark patterns, no gating behind form inputs
- Pause uses Stripe `pause_collection` with `resumes_at` (1 month)
- Feedback saved to `cancel_feedback` table (reason, comment, outcome)
- Server endpoints: `POST /api/stripe/pause`, `POST /api/stripe/cancel-feedback`
- Component: `client/src/components/cancel-retention-sheet.tsx`

### Stripe Integration Note
- Stripe Sandbox connection is configured and working in development
- Stripe production connection was not set up by the user — subscription buttons may be disabled in deployed/production environment until the production Stripe connector is authorized
- If needed in the future, search for the Stripe connector and propose it to the user

### Design & Growth System
- **Mascot ("Cue")**: SVG character component (`client/src/components/mascot.tsx`) with 8 moods: idle, excited, encouraging, celebrating, thinking, waving, proud, cheering. Integrated into empty states, rehearsal ready screen, and completion modal.
- **Pro Visibility**: Free-tier users see "Pro" badges on locked menu items (Saved Scripts, Performance History, Hands-Free Mode). Completion screen shows clickable "Unlock unlimited rehearsals" card for all free users. Save Script button in recent scripts is hidden for free users.
- **Server-Side Pro Enforcement**: All `/api/scripts` and `/api/performance` routes use `requirePro` middleware (in `pro-routes.ts`). Free users get 403 if they call these APIs directly.
- **Guest Pass Framing**: Subscription page uses "guest pass" language (not "free trial") with a day-by-day trial itinerary. Consistent across subscription, compare, and onboarding pages.
- **Share-After-Rehearsal**: Share button appears for all completed performances (not gated by accuracy). Includes role name, accuracy, and app link.
- **Contrast Standards**: All `text-muted-foreground` usages maintain minimum `/70` opacity. Camera-mode white text uses minimum `/55`.
- **Hover Pattern**: Pop-not-fade — hover states always brighten/elevate, never dim. Uses `hover-elevate` utility and `invisible`/`visible` for reveal-on-hover.
- **Home Page "What Is This?"**: Logged-out users see 3-step value prop (Paste script → Pick role → Rehearse) with icons below the hero.

## External Dependencies
- **Web Speech API**: Text-to-Speech functionalities.
- **ElevenLabs API**: Professional AI voices.
- **React Query**: Client-side data fetching and caching.
- **Zod**: TypeScript type validation and schema definition.
- **localStorage**: Session persistence and on-device data storage.
- **Shadcn UI**: UI components and styling.
- **Inter Font Family**: Primary application typeface.
- **JetBrains Mono**: Monospace font.
- **OpenAI Vision API (gpt-4o-mini)**: OCR for PDF and image script parsing.
- **Resend**: Email delivery (password resets).
- **PostgreSQL**: Database persistence and session storage.
- **socket.io**: Real-time communication for multiplayer table reads.
- **WebRTC**: Peer-to-peer video and audio streaming.
- **Google Identity Services**: Google Sign-In.
- **Replit Object Storage**: Cloud recording storage via signed URLs (sidecar at `http://127.0.0.1:1106`).

### Cloud Recording Library (Pro Only)
- **Database**: `recordings` table with fields: id, userId, scriptName, storageKey, fileSize, durationSeconds, accuracy, mimeType, createdAt, plus optional FK refs to recent_scripts/saved_scripts/performance_runs.
- **Storage**: Replit Object Storage via signed URLs (PUT for upload, GET for streaming, DELETE for removal). Private directory path from `PRIVATE_OBJECT_DIR` env var. 2 GB per-user storage limit enforced server-side.
- **API Routes** (all Pro-gated in `server/replit_integrations/auth/pro-routes.ts`):
  - `GET /api/recordings` — list user's recordings with storage usage
  - `POST /api/recordings/upload` — multipart upload via multer, stores to Object Storage
  - `GET /api/recordings/:id/stream` — redirect to signed download URL
  - `DELETE /api/recordings/:id` — removes from storage and DB
- **Frontend**: "Save to Library" button in rehearsal stop dialog (Pro users). "My Rehearsals" unified page (`client/src/pages/my-rehearsals.tsx`) with tabs: Recordings, Scripts, Stats. Storage meter in header. Inline video playback, download, and delete with confirmation.
- **Recording Specs**: 2 Mbps video + 192 kbps audio (~16 MB/min). File size capped at 500 MB per upload.
- **Navigation**: Side menu consolidated from "Saved Scripts" + "Performance History" into single "My Rehearsals" item.

### Stripe Subscription Flow
- **Customer Creation**: Stripe customer created automatically on signup (email/password, Google OAuth) via `ensureStripeCustomer()` in `replitAuth.ts`. Existing users without Stripe customers get backfilled on login.
- **Free Tier**: Users are Stripe customers with no subscription. `subscriptionTier` defaults to `"free"` in the database.
- **Guest Pass (trial)**: First-time subscribers get a configurable free trial (admin setting `trial_days`, default 7) via `subscription_data.trial_period_days` in the Stripe Checkout session. Stripe collects payment info but doesn't charge until trial ends. Repeat subscribers (who've had any past subscription) don't get a trial.
- **Pro Upgrade**: Stripe Checkout (`POST /api/stripe/checkout`) creates a subscription. Webhook sync via `stripe-replit-sync` updates `stripe.subscriptions` table. The `/api/stripe/subscription` endpoint syncs subscription status to `users.subscriptionTier` on read.
- **Trial UI**: Subscription page shows "Guest pass active" with progress bar and days remaining when `isTrialing`. Success toast says "Your guest pass is active" instead of generic welcome.
- **Cancellation**: Users can cancel via Stripe Billing Portal. `cancel_at_period_end` flag preserves access until period ends. Retention sheet shown before portal redirect.
- **Key Files**: `server/routes.ts` (checkout + subscription sync), `server/replit_integrations/auth/replitAuth.ts` (customer creation), `client/src/pages/subscription.tsx` (pricing UI), `server/webhookHandlers.ts` (webhook processing).

### Data Persistence & Profile Sync
- **Profile Photos**: Compressed to 256px max, JPEG quality 0.7. Saved to DB via PATCH `/api/auth/profile` with retry on failure. Server rejects photos >200KB. localStorage caches photos <100KB only; larger photos load from server on each session. Query cache (`["/api/auth/user"]`) invalidated after successful save.
- **Recent Scripts**: Authenticated users persist to `recent_scripts` table. On first login, any localStorage scripts are synced to server (only cleared from localStorage if all syncs succeed). Server errors fall back to localStorage save. Unauthenticated users use localStorage only.
- **Library/Recordings/Performance**: Query cache invalidated after saves — `/api/scripts` after library save, `/api/recordings` after upload, `/api/performance` after run completion. All invalidations gated behind `res.ok`.
- **Rehearsal Layout**: Outer wrapper uses `h-[100dvh] overflow-hidden` with header/footer as `shrink-0` and main content as `flex-1 min-h-0 overflow-y-auto`. Footer (transport controls) always visible at viewport bottom regardless of line length.

### Subscription Tier System
- **Tiers**: `free`, `pro`, `comp` (complimentary Pro), `internal` (team). Defined in `shared/models/auth.ts` as `ALL_TIERS` and `SubscriptionTier` type.
- **Pro Access Check**: `hasProAccess(tier)` from `shared/models/auth.ts` — returns true for `pro`, `comp`, `internal`. Used server-side in `requirePro` middleware and all pro-gated routes.
- **Client-Side**: All pro gates use inline `["pro", "comp", "internal"].includes(tier)` check (no shared import to avoid server module pulls). Covers: save script, hands-free mode, recording watermark, Pro badge visibility, settings drawer, multiplayer watermark.
- **Stripe Sync**: `/api/stripe/subscription` does NOT downgrade comp/internal users even if they have no Stripe subscription.
- **Admin**: Admin dashboard supports all 4 tiers with color-coded badges. Admin create-user auto-creates Stripe customer and accepts tier param.

### Stripe Webhook Sync
- **Handler**: `server/webhookHandlers.ts` — processes webhook payloads after `stripe-replit-sync` library verifies them. Parses raw JSON (no separate signature verification needed since sync library already validated).
- **Events Handled**: `customer.subscription.deleted` / `customer.subscription.updated` (canceled/unpaid/incomplete_expired → downgrade pro to free), `customer.deleted` (clear Stripe IDs, downgrade if pro).
- **Safety**: Only downgrades `pro` tier users — never touches `comp` or `internal` tiers.

### Admin-Stripe Sync & Audit System
- **User Deletion → Stripe Cleanup**: When an admin deletes a user, the system first cancels any active Stripe subscription (prorated) and deletes the Stripe customer before removing local data.
- **Tier Change → Stripe Sync**: When an admin downgrades a Pro user to Free, the system cancels their Stripe subscription (prorated) and clears the subscription ID. This prevents orphaned billing.
- **Admin Settings Table** (`admin_settings`): Key-value store for configurable constants. Current settings: `free_daily_limit` (default 3), `trial_days` (default 7). Routes: `GET /api/admin/settings`, `POST /api/admin/settings`.
- **Admin Audit Log** (`admin_audit_logs`): Records all admin actions with admin user ID, action type, target user, details JSON, and timestamp. Covers: `change_tier`, `reset_usage`, `grant_usage`, `block_user`, `unblock_user`, `delete_user`, `update_setting`. Route: `GET /api/admin/audit-log`.