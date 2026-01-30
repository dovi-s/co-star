# CastMate Studio

A voice-first rehearsal app for actors. Paste your script, pick your role, start rehearsing with intelligent AI scene partners.

## Overview

CastMate Studio is a premium, mobile-first rehearsal application designed to provide actors with a zero-setup, intuitive rehearsal experience. Its core purpose is to enable actors to rehearse scripts effectively with intelligent AI scene partners, offering features like automatic voice assignment, natural timing that adapts to scene tension, and privacy by keeping all data local by default. The project aims to deliver a sophisticated, minimal, and professional tool for actors, simplifying the rehearsal process and enhancing performance preparation.

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
The design philosophy is sophisticated and minimal, inspired by premium companies like Stripe, Linear, and Notion. It emphasizes clean typography, high contrast, and subtle interactions with no jarring animations. The aesthetic is professional, focused, and purposeful.
- **Copy Guidelines**: Simple, direct wording; no exclamation marks or em-dashes.
- **Color Scheme**: High contrast using foreground/background. Light Mode: Background #FFFFFF, Foreground #0F172A. Dark Mode: Background #0E1218, Foreground #E6EDF3. Status colors are green for success, muted tones for secondary elements.
- **Typography**: Inter font family, weight contrast for hierarchy (semibold headings, medium body), minimal text sizes (xs, sm, base).
- **Motion**: 200ms ease-out transitions, subtle scale effects (0.98) on press, no playful animations.
- **Audition Mode UI**: When camera is active, UI becomes dark and translucent with glassmorphic styling (e.g., `bg-black/60` with `backdrop-blur-xl`).

### Technical Implementations
- **Script Import**: Supports pasting text or uploading `.txt` files. Automatically parses `CHARACTER: dialogue` format, `[brackets]` and `(parentheticals)` for stage directions, and multi-scene scripts with descriptions. Action lines preceding dialogue are captured as context.
- **Role Selection**: Auto-detects all roles with line counts, allows user to select their role, and uses Smart Cast for AI voice assignment to other roles.
- **Three-Line Reader**: Displays previous (dim), current (bold, highlighted if user's turn), and next (ghost) lines. Includes visual cues for user's turn, scene transition cards, and a context peek button for action/directions.
- **Transport Controls**: Provides Back, Play-Pause, Next buttons, progress indicator, repeat current line, and bookmarking.
- **Voice Engine**: Utilizes ElevenLabs AI voices with emotion detection from text and stage directions. Supports SSML-like prosody (rate, pitch, volume, breaks) and voice presets (Natural, Deadpan, Theatrical). Six neutral American English voices are used, deterministically assigned.
- **Speech Recognition**: Uses single-utterance mode with a 3-second silence timeout and 15-second max listen limit. Includes last transcript recovery and comprehensive error handling.
- **Dialogue Flow Robustness**: Watchdog timer for audio stalls, safety timeout on user turns (20s max), brief 200ms pauses between lines for natural flow.
- **Settings**: Ambient sound toggle, scene selection, cast voice preset adjustment, font size (S/M/L), stage directions visibility toggle, dark/light mode.
- **Script Parsing**: Robust parsing with OCR artifact cleaning, merged line detection, and strict character name validation (blocking over 150 reserved words). Supports professional screenplay and stage play formats, including handling character extensions (V.O., O.S., CONT'D), possessive character names (GEORGE'S VOICE ON MACHINE), and context capture for action lines. Preprocessing patterns use literal spaces `[ ]` instead of `\s` to avoid incorrectly matching across line breaks.
- **AI Post-Processing**: An AI reviews the first 80 parsed lines to remove title page content, production notes, and other non-dialogue elements, ensuring clean dialogue-only results. It offers graceful degradation if the AI is unavailable.
- **Performance Feedback System**: Tracks word match accuracy and skipped lines during rehearsal runs. Provides an enhanced completion modal with performance feedback (Perfect, Great, Good, Learning), accuracy percentage, and color-coded results.
- **Audition Mode**: Integrates front-facing camera for self-tape creation using `MediaRecorder` to capture canvas stream + microphone audio.
- **Line Memorization**: Offers four levels: Full, Partial, Cue, Memory.
- **Progress Tracking**: Tracks runs completed and lines rehearsed.
- **Keyboard Shortcuts**: Space (play/pause), Arrow keys (navigate), R (repeat), Escape (stop).
- **PWA Ready**: Includes service worker, manifest, and offline support.
- **Multiplayer Table Read**: Real-time remote rehearsals with multiple actors via WebSocket (socket.io). Includes room creation with 6-character codes, role selection, ready states, host controls (start/pause/resume/navigation), and synchronized line progression. Server validates all events with Zod schemas and enforces authorization (host or current speaker for line advancement).
- **WebRTC Video Calls**: Peer-to-peer video and audio streaming during table reads using WebRTC. Features include mute/unmute audio, enable/disable video, current speaker highlighting, and a compact video strip during rehearsals. Server acts as signaling relay for ICE candidates and SDP offer/answer exchange.

### Feature Specifications
- **Script Context Capture**: Action lines between dialogues and scene descriptions are attached to the next dialogue.
- **Scene Transition Cards**: Display scene name and description on scene entry with subtle animation.
- **Context Peek Feature**: Allows users to reveal stage directions and action preceding a line.
- **Global Script Navigation**: Progress indicator shows position across the entire script, with automatic scene advancement.

## External Dependencies

- **Web Speech API**: Used for Text-to-Speech (TTS) for some functionalities.
- **ElevenLabs API**: Utilized for professional AI voices, with a backend proxy for secure key handling.
- **React Query**: Used for client-side data fetching and caching.
- **Zod**: Used for TypeScript type validation and schema definition.
- **localStorage**: Used for session persistence and on-device data storage.
- **Shadcn UI**: Provides UI components and styling.
- **Inter Font Family**: Primary typeface for the application.
- **JetBrains Mono**: Monospace font used for script import for an authentic screenplay feel.