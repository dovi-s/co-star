# Co-star Studio

A voice-first rehearsal app for actors. Paste your script, pick your role, start rehearsing with intelligent scene partners.

## Overview

Co-star Studio is a premium, mobile-first rehearsal application designed to provide actors with a zero-setup, intuitive rehearsal experience. Its core purpose is to enable actors to rehearse scripts effectively with intelligent scene partners, offering features like automatic voice assignment, natural timing that adapts to scene tension, and privacy by keeping all data local by default. The project aims to deliver a sophisticated, minimal, and professional tool for actors, simplifying the rehearsal process and enhancing performance preparation.

## Brand Naming Convention

- **Full name**: Co-star Studio (always use in UI, listings, press, ads)
- **Visual hierarchy**: "Co-star" lighter weight, "Studio" heavier/bolder
- **Spoken**: Always "Co-star Studio" (never just "Co-star")
- **In-app copy**: Use "your scene partner" when describing what the product does. Never use "AI" in user-facing text.
- **Domain**: co-star.app
- **Subscription tier**: Co-star Pro

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
The design philosophy is sophisticated and minimal, now using Apple's Liquid Glass design language. Translucent glass materials for navigation and controls, concentric rounded shapes, content-first hierarchy with minimal chrome. Clean monochromatic controls with selective color accents.
- **Copy Guidelines**: Simple, direct wording; no exclamation marks or em-dashes. Never use the word "AI" in any user-facing copy. Refer to the product as "co-star" or "your scene partner" instead. Internal code comments and logs are fine.
- **Color Scheme**: High contrast using foreground/background. Light Mode: Background #FFFFFF, Foreground #0F172A. Dark Mode: Background #0E1218, Foreground #E6EDF3. Blue primary (217/214/197 hue), bronze accent (28 hue), gold (47 hue). No purple/pink tones.
- **Typography**: Inter font family, weight contrast for hierarchy (semibold headings, medium body), minimal text sizes (xs, sm, base).
- **Motion**: 200ms ease-out transitions, subtle scale effects (0.98) on press, no playful animations.
- **Liquid Glass Design System**: CSS utility classes `glass-surface`, `glass-surface-heavy`, `glass-surface-clear`, `glass-tint-primary` in `index.css` with light/dark variants and `@supports` fallback for browsers without `backdrop-filter`. Applied to headers, transport bar, overlays (Dialog, Sheet, AlertDialog, DropdownMenu, Popover, Tooltip), script import textarea, role selector footer.
- **Border Radius**: Concentric system with xl (16px) for panels, lg (12px) for cards/overlays, md (8px) for buttons, sm (4px) for badges.
- **Overlay Dimming**: `bg-black/60` with `backdrop-blur-sm` for refined glass aesthetic on dialog/sheet/alert overlays.
- **Audition Mode UI**: When camera is active, UI becomes dark and translucent with glassmorphic styling (e.g., `bg-black/60` with `backdrop-blur-xl`).

### Technical Implementations
- **Script Import**: Supports pasting text, uploading `.txt`, `.pdf`, and image files, or snapping a photo of a script page with device camera. Automatically parses `CHARACTER: dialogue` format, `[brackets]` and `(parentheticals)` for stage directions, and multi-scene scripts with descriptions. Action lines preceding dialogue are captured as context. Scanned/image-based PDFs are handled via AI-powered OCR: pages are converted to images with `pdftoppm` (200 DPI), then sent to OpenAI Vision API (gpt-4o-mini) in batches of 4 for text extraction. The two-step flow detects scanned PDFs (422 response with `needsOcr: true`) and routes to `/api/ocr-pdf-to-session`. Image files (photos) are sent directly to OpenAI Vision for text extraction via `/api/parse-file-to-session`.
- **Role Selection**: Auto-detects all roles with line counts, allows user to select their role, and uses Smart Cast for AI voice assignment to other roles.
- **Three-Line Reader**: Displays previous (dim), current (bold, highlighted if user's turn), and next (ghost) lines. Includes visual cues for user's turn, scene transition cards, and a context peek button for action/directions.
- **Transport Controls**: Provides Back, Play-Pause, Next buttons, progress indicator, repeat current line, and bookmarking.
- **Voice Engine**: Utilizes ElevenLabs AI voices with emotion detection from text and stage directions. Supports SSML-like prosody (rate, pitch, volume, breaks), voice presets (Natural, Deadpan, Theatrical), and adjustable reader volume (0-100%, persisted to localStorage). Six neutral American English voices are used, deterministically assigned.
- **Speech Recognition**: Uses single-utterance mode with a 3-second silence timeout and 15-second max listen limit. Includes last transcript recovery and comprehensive error handling.
- **Dialogue Flow Robustness**: Watchdog timer for audio stalls, safety timeout on user turns (20s max), brief 200ms pauses between lines for natural flow.
- **Settings**: Ambient sound toggle, reader volume control, scene selection, cast voice preset adjustment, font size (S/M/L), stage directions visibility toggle, dark/light mode.
- **Script Parsing**: Robust parsing with OCR artifact cleaning, merged line detection, and strict character name validation (blocking over 150 reserved words). Supports professional screenplay and stage play formats, including handling character extensions (V.O., O.S., CONT'D), possessive character names (GEORGE'S VOICE ON MACHINE), titled character names (DET. COLE, MRS. WINSLEY), and context capture for action lines. Preprocessing patterns use literal spaces `[ ]` instead of `\s` to avoid incorrectly matching across line breaks. Stage play format uses `NAME. Dialogue` (period instead of colon) and correctly handles dialogue starting with "I'm" or other first-person pronouns. Cast list detection requires 5+ dots to avoid false matches on dialogue ellipsis.
- **AI Post-Processing**: An AI reviews the first 80 parsed lines to remove title page content, production notes, and other non-dialogue elements, ensuring clean dialogue-only results. It offers graceful degradation if the AI is unavailable.
- **Performance Feedback System**: Tracks word match accuracy and skipped lines during rehearsal runs. Provides an enhanced completion modal with performance feedback (Perfect, Great, Good, Learning), accuracy percentage, and color-coded results.
- **Audition Mode**: Integrates front-facing camera for self-tape creation using `MediaRecorder` to capture canvas stream + microphone audio. Recording captures only camera feed + watermark (no script text overlay). When camera is off, recording produces audio-only files (mic + reader voice) for practice sessions.
- **LINE Voice Command**: Theater tradition - user says "line" during their turn to get the full current line whispered at 30% volume via browser TTS. Tracks hint usage in performance stats.
- **Hands-Free Mode**: Accessible from Settings drawer (Car icon). Full-screen dark overlay showing current speaker/listening state, progress bar, mic icon, play/pause button, and restart button. Acquires Wake Lock to keep screen on. Auto-enables mic and starts playback on entry. Auto-restarts scene after 3-second pause on completion. Play/pause bypasses countdown for immediate control. Exit via X button.
- **Line Memorization**: Offers four levels: Full, Partial, Cue, Memory.
- **Progress Tracking**: Tracks runs completed and lines rehearsed.
- **Keyboard Shortcuts**: Space (play/pause), Arrow keys (navigate), R (repeat), Escape (stop).
- **PWA Ready**: Includes service worker, manifest, and offline support.
- **Multiplayer Table Read**: Real-time remote rehearsals with multiple actors via WebSocket (socket.io). Includes room creation with 6-character codes, role selection, ready states, host controls (start/pause/resume/navigation), and synchronized line progression. Server validates all events with Zod schemas and enforces authorization (host or current speaker for line advancement).
- **WebRTC Video Calls**: Peer-to-peer video and audio streaming during table reads using WebRTC. Features include mute/unmute audio, enable/disable video, current speaker highlighting, and a compact video strip during rehearsals. Server acts as signaling relay for ICE candidates and SDP offer/answer exchange.
- **Authentication**: Custom email/password auth with session-based storage (express-session + connect-pg-simple). Supports Google Sign-In via Google Identity Services (ID token verification with google-auth-library). Users table has `google_id` and `auth_provider` columns. Google accounts are linked by email if a matching account exists.
- **Forgot Password Flow**: Users request a reset link via email (Resend integration). Tokens are hashed (SHA-256) and stored in `password_reset_tokens` table with 1-hour expiry. Reset link uses `?reset-token=` query param which routes to the auth page's reset form. Backend never reveals whether an email exists (anti-enumeration).
- **Resend Email Integration**: Uses Replit connectors for API key management (`server/replit_integrations/email/resend.ts`). `getUncachableResendClient()` fetches fresh credentials each call. Used for password reset emails.

### Feature Specifications
- **Script Context Capture**: Action lines between dialogues and scene descriptions are attached to the next dialogue.
- **Scene Transition Cards**: Display scene name and description on scene entry with subtle animation.
- **Context Peek Feature**: Allows users to reveal stage directions and action preceding a line.
- **Global Script Navigation**: Progress indicator shows position across the entire script, with automatic scene advancement.

### Admin Dashboard
- **Access Control**: Protected by `ADMIN_USER_IDS` environment variable (comma-separated user IDs). All admin API routes enforce server-side auth.
- **Database Tables**: `analytics_events` (user interactions), `feedback_messages` (feedback/bug reports), `error_logs` (client-side errors) in `shared/models/auth.ts`.
- **API Endpoints**: `/api/track` (pageviews), `/api/track-event` (feature events), `/api/track-error` (client errors), `/api/feedback` (feedback submissions), plus 8 admin GET/PATCH/POST endpoints under `/api/admin/*`.
- **Client-Side Analytics**: Batched event tracking in `client/src/hooks/use-analytics.ts` (flushes every 5s or 20 events max, also on beforeunload/visibilitychange). Automatic error capture via `window.onerror` and `unhandledrejection`. Tracking integrated into side-menu navigation, rehearsal playback, hands-free mode, script import, and multiplayer/table-read features.
- **Dashboard Tabs**: Overview, Users (with individual detail views), Traffic, Usage, Features, Revenue/Stripe, Feedback Inbox, Errors, Integrations (placeholders for PostHog, GA4, Sentry, Mixpanel, Intercom).
- **Feedback Inbox**: Body validation with size limits (subject 200 chars, message 10K chars, attachments 50K chars). Status management (new/read/resolved/archived).
- **Error Management**: Bulk resolution, status tracking, and grouping by message.

## External Dependencies

- **Web Speech API**: Used for Text-to-Speech (TTS) for some functionalities.
- **ElevenLabs API**: Utilized for professional AI voices, with a backend proxy for secure key handling.
- **React Query**: Used for client-side data fetching and caching.
- **Zod**: Used for TypeScript type validation and schema definition.
- **localStorage**: Used for session persistence and on-device data storage.
- **Shadcn UI**: Provides UI components and styling.
- **Inter Font Family**: Primary typeface for the application.
- **JetBrains Mono**: Monospace font used for script import for an authentic screenplay feel.