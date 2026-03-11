# Co-star Studio

## Overview
Co-star Studio is a premium, mobile-first rehearsal application designed for actors. Its primary purpose is to offer a zero-setup, intuitive rehearsal experience with intelligent scene partners, focusing on effective script rehearsal through features like automatic voice assignment and natural timing. The project aims to be a sophisticated, minimal, and professional tool, simplifying rehearsal and enhancing performance preparation for actors, professionals, and specialized training, offered with Free and Pro subscription tiers.

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
The application features a sophisticated, minimal design inspired by Apple's Liquid Glass, utilizing translucent materials, rounded shapes, and a content-first hierarchy. It employs clean monochromatic controls with selective color accents, a high-contrast color scheme (Light Mode: #FFFFFF/#0F172A, Dark Mode: #0E1218/#E6EDF3), and the Inter font family. Motion is subtle with 200ms ease-out transitions. Accessibility is a priority, adhering to WCAG AA contrast, 44px touch targets, semantic HTML, and dynamic page titles. Empty states are designed with themed icons and clear calls to action. The application is optimized as a PWA, ensuring a seamless mobile experience with `viewport-fit=cover`, `100dvh` for mobile, and `overscroll-behavior: none` in standalone mode.

### Technical Implementations
The application supports script import from various formats (e.g., `.txt`, `.pdf`, images) using AI-powered OCR and robust script parsing to detect characters, stage directions, and multi-scene layouts. The script parser handles plays, musicals, and screenplays, including period-format dialogue regex, stage direction continuation, cast list skip detection, and filtering of non-character patterns. It incorporates OCR variant merging (with a guard preventing merging of distinct valid short names like CFO/CEO), PDF column-merge detection, and play-style ALL CAPS section header detection for scene breaks. Features include intelligent role selection with Smart Cast for AI voice assignment, a Three-Line Reader for guided rehearsal, and comprehensive transport controls. The voice engine uses ElevenLabs AI voices with emotion detection and customizable presets. Speech recognition supports single utterances with error recovery and natural pauses. Settings allow customization of ambient sound, voice presets, font size, and dark/light mode. Advanced features include a Performance Feedback System, Audition Mode for self-tapes, a "LINE" voice command for hints, Hands-Free Mode with Wake Lock, and a multi-level Line Memorization system. Multiplayer Table Read functionality enables real-time remote rehearsals via WebSocket, including host controls and synchronized line progression, with WebRTC for peer-to-peer video calls. Authentication supports custom email/password and Google Sign-In. An Admin Dashboard provides analytics, user management, feedback, and error logs.

Key features:
- **Script Context Capture**: Links action lines and scene descriptions to subsequent dialogue.
- **Scene Transition Cards**: Visual cues for scene changes.
- **Context Peek Feature**: Allows viewing stage directions and preceding actions.
- **Global Script Navigation**: Progress indicator across the entire script with automatic scene advancement.

### Design & Growth System
The application utilizes a mascot ("Cue") with various moods, integrated into empty states and completion modals. "Pro" badges are displayed on locked menu items for free-tier users, with completion screens promoting subscription upgrades. Server-side middleware enforces Pro access for `/api/scripts` and `/api/performance` routes. The subscription page uses "guest pass" framing instead of "free trial." A share button appears after completed performances. UI elements maintain high contrast standards and employ a "pop-not-fade" hover pattern. Logged-out users are presented with a 3-step value proposition on the home page.

### Device Fingerprint Anti-Abuse System
A device fingerprinting system tracks script usage per device to prevent multi-account abuse. It ensures that creating a new free account on the same device inherits the device's existing usage count, applying the same 12-hour reset window as user-based usage.

### Cancel Retention Flow
When Pro users initiate cancellation, a multi-step retention sheet is presented, outlining lost Pro features, collecting feedback with an optional pause feature, and confirming cancellation. The cancellation button remains accessible throughout the process.

### Subscription Tier System
The system supports `free`, `pro`, `comp` (complimentary Pro), and `internal` (team) tiers. A `hasProAccess` function determines Pro access for server-side middleware and client-side checks. Stripe synchronization ensures that `comp` and `internal` users maintain their tier regardless of Stripe subscription status. Plan switching (monthly↔annual) is handled via a dedicated `/api/stripe/switch-plan` endpoint that uses Stripe's subscription update API with `proration_behavior: 'create_prorations'`, bypassing the billing portal for plan changes to avoid confusing double-charge proration issues. The subscription page shows the current plan interval and a "Switch to annual/monthly" button with an inline confirmation prompt.

### Admin-Stripe Sync & Audit System
Admin actions such as user deletion or tier changes are synchronized with Stripe to manage subscriptions and customer data. An `admin_settings` table stores configurable constants like `free_daily_limit` and `trial_days`. An `admin_audit_logs` table records all admin actions for accountability and tracking.

## External Dependencies
- **Web Speech API**: Text-to-Speech functionalities. PWA mic re-acquisition uses getUserMedia warmup, generation-guarded retries, startup heartbeat, and explicit audio element release after TTS playback.
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
- **Replit Object Storage**: Cloud recording storage via signed URLs.
- **Stripe**: Subscription management, customer creation, checkout, and webhooks.