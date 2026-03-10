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
The application supports script import from various formats (`.txt`, `.pdf`, images) using AI-powered OCR and robust script parsing to detect characters, stage directions, and multi-scene layouts. It includes intelligent role selection with Smart Cast for AI voice assignment, a Three-Line Reader for guided rehearsal, and comprehensive transport controls. The voice engine uses ElevenLabs AI voices with emotion detection and customizable presets. Speech recognition handles single utterances with error recovery and natural pauses. Settings allow customization of ambient sound, voice presets, font size, and dark/light mode. Advanced features include a Performance Feedback System, Audition Mode for self-tapes, a "LINE" voice command for hints, Hands-Free Mode with Wake Lock, and a multi-level Line Memorization system. Multiplayer Table Read functionality enables real-time remote rehearsals via WebSocket, including host controls and synchronized line progression, with WebRTC for peer-to-peer video calls. Authentication supports custom email/password and Google Sign-In. An Admin Dashboard provides analytics, user management, feedback, and error logs.
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