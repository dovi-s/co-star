# Co-star Studio

A voice-first rehearsal app for actors. Paste your script, pick your role, start rehearsing with intelligent scene partners.

## Overview

Co-star Studio is a premium, mobile-first rehearsal application designed to provide actors with a zero-setup, intuitive rehearsal experience. Its core purpose is to enable actors to rehearse scripts effectively with intelligent scene partners, offering features like automatic voice assignment, natural timing that adapts to scene tension, and privacy by keeping all data local by default. The project aims to deliver a sophisticated, minimal, and professional tool for actors, simplifying the rehearsal process and enhancing performance preparation.

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
The design philosophy is sophisticated and minimal, leveraging Apple's Liquid Glass design language with translucent materials, concentric rounded shapes, and a content-first hierarchy. It employs clean monochromatic controls with selective color accents. The UI adheres to strict copy guidelines, avoiding "AI" in user-facing text and using simple, direct wording. A high-contrast color scheme (Light Mode: #FFFFFF/#0F172A, Dark Mode: #0E1218/#E6EDF3) with blue, bronze, and gold accents, and the Inter font family with weight contrast, defines the visual style. Motion is subtle, using 200ms ease-out transitions and minimal scale effects. The Liquid Glass system is implemented via CSS utility classes in `index.css`, with comprehensive accessibility features including WCAG AA contrast, 44px touch targets, semantic HTML, and dynamic page titles. Empty states are thoughtfully designed with themed icons and clear CTAs.

### Technical Implementations
The application handles script import from various formats (`.txt`, `.pdf`, images, camera photos) with AI-powered OCR for scanned documents. It features robust script parsing that detects characters, stage directions, and multi-scene layouts, including OCR artifact cleaning and strict character name validation. An AI post-processing step further refines parsed scripts. Key features include intelligent role selection with Smart Cast for AI voice assignment, a Three-Line Reader for guided rehearsal, and comprehensive transport controls. The voice engine utilizes ElevenLabs AI voices with emotion detection and customizable presets. Speech recognition is robust, handling single utterances with error recovery. Dialogue flow includes watchdog timers and natural pauses. Settings allow customization of ambient sound, voice presets, font size, and dark/light mode. Advanced features include a Performance Feedback System tracking accuracy, an Audition Mode for self-tapes (audio or video), a "LINE" voice command for hints, a Hands-Free Mode with Wake Lock, and a multi-level Line Memorization system. The application is PWA-optimized with `viewport-fit=cover` for safe area insets, `100dvh` viewport height on mobile (fixes iOS toolbar overlap), `overscroll-behavior: none` in standalone mode, and 16px minimum input font size to prevent iOS zoom. It supports keyboard shortcuts. Multiplayer Table Read functionality enables real-time remote rehearsals via WebSocket, including host controls and synchronized line progression. WebRTC integrates peer-to-peer video calls for table reads. Authentication supports custom email/password and Google Sign-In, with a secure forgot password flow. An Admin Dashboard provides access to analytics, user management, feedback, and error logs, protected by environment variables and server-side authentication.

### UX Improvements (Session 10)
- **Home Visual Hierarchy**: Personalized greeting for authenticated users; value props hidden when logged in; tighter spacing
- **Rehearsal Exit Controls**: Prominent exit button in hands-free overlay and camera mode; Escape key uses refs to avoid stale closures
- **TTS Feedback**: `ttsGenerating` state shows "Preparing line..." indicator during audio generation; transport bar thinking state animation
- **Script Preview**: Parse warnings and scene structure preview shown in role selector before rehearsal starts
- **Browser Navigation**: history.pushState/popstate support for back/forward navigation between views; isPopstateNav reset on no-op transitions
- **Settings Drawer Grouping**: Settings organized into Playback, Audio, and Script sections with labeled headers
- **TTS Pre-fetch**: Concurrent prefetching with 2-line lookahead; early prefetch trigger when current line starts
- **Script Complete Celebration**: Trophy icon and enhanced confetti for finishing all scenes of a multi-scene script
- **Side Menu Reorder**: Primacy/recency ordering with collapsible Explore section for info pages

### UX Polish Pass (Session 11)
- **Skeleton Loaders**: Library and History pages use skeleton card placeholders instead of spinners during loading
- **Dynamic Tier Badge**: Side menu shows "Pro" or "Free" based on actual subscriptionTier (was hardcoded "Pro")
- **Toast Consistency**: "Tell a Friend" clipboard copy uses toast instead of browser alert()
- **ThreeLineReader Accessibility**: Script lines have role="button", tabIndex, keyboard handlers (Enter/Space), and aria-labels with character name and truncated text; event bubbling prevented for nested controls
- **Camera Scanner Accessibility**: All icon-only buttons (Close, Flip camera, Take photo) have descriptive aria-labels
- **Focus Management**: After view transitions, focus resets to main content area with scroll-to-top
- **Touch Targets**: Practice toolbar buttons increased to 44px minimum per Apple HIG
- **Onboarding States**: Continue/Skip buttons disabled during save mutations with loading indicators
- **Production Cleanup**: Removed 28 console.log statements from rehearsal.tsx (kept console.error/warn for actual errors)
- **Transport Bar Accessibility**: SVG progress ring marked aria-hidden; line counter uses aria-live="polite"
- **Recent Scripts Accessibility**: Cards have aria-labels, keyboard event isolation on nested action buttons
- **Error Feedback**: Actor profile and onboarding save failures now show toast notifications

### Feature Specifications
- **Script Context Capture**: Action lines and scene descriptions are automatically linked to subsequent dialogue.
- **Scene Transition Cards**: Visual cues for scene changes with animated displays.
- **Context Peek Feature**: Allows users to view stage directions and preceding actions for a line.
- **Global Script Navigation**: A progress indicator shows position across the entire script, with automatic scene advancement.

### Marketing Pages
- **Who Is It For**: Details target audiences (Performers, Professionals, Specialized Training).
- **Subscription Pricing**: Displays Free and Pro tiers, with options for Education and Teams inquiries.

## External Dependencies

- **Web Speech API**: For Text-to-Speech functionalities.
- **ElevenLabs API**: For professional AI voices, via a secure backend proxy.
- **React Query**: For client-side data fetching and caching.
- **Zod**: For TypeScript type validation and schema definition.
- **localStorage**: For session persistence and on-device data storage.
- **Shadcn UI**: Provides UI components and styling.
- **Inter Font Family**: Primary application typeface.
- **JetBrains Mono**: Monospace font used for script import.
- **OpenAI Vision API (gpt-4o-mini)**: Used for OCR in PDF and image script parsing.
- **Resend**: For email delivery, specifically password reset emails.
- **PostgreSQL**: For database persistence, including session storage (via `connect-pg-simple`).
- **socket.io**: For real-time communication in multiplayer table reads.
- **WebRTC**: For peer-to-peer video and audio streaming.
- **Google Identity Services**: For Google Sign-In.