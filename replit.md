# CastMate Studio

A voice-first rehearsal app for actors. Paste your script, pick your role, start rehearsing with intelligent AI scene partners.

## Overview

CastMate Studio is a premium, mobile-first rehearsal application that provides:
- **Zero Setup**: Paste → Pick Role → Start rehearsing
- **Smart Cast**: Automatic voice assignment with natural prosody based on emotion and context
- **Natural Timing**: Voices adapt to scene tension, emotions, and stage directions
- **Private by Default**: All data stays local unless explicitly shared

## Project Structure

```
client/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── header.tsx       # App header with role chip and settings
│   │   ├── role-chip.tsx    # Role display/selection chip
│   │   ├── role-selector.tsx # Role selection screen
│   │   ├── reader-menu.tsx  # Font size, directions, jump menu
│   │   ├── script-import.tsx # Script paste/upload component
│   │   ├── settings-drawer.tsx # Bottom sheet with settings
│   │   ├── smart-cast-badge.tsx # Smart Cast indicator
│   │   ├── theme-toggle.tsx # Dark/light mode toggle
│   │   ├── three-line-reader.tsx # Core reading experience
│   │   ├── transport-bar.tsx # Back/Play/Next controls
│   │   └── ui/              # shadcn/ui components
│   ├── hooks/
│   │   └── use-session.ts   # Session state management hook
│   ├── lib/
│   │   ├── script-parser.ts # Script parsing and normalization
│   │   ├── theme-provider.tsx # Dark/light theme context
│   │   ├── tts-engine.ts    # Text-to-speech with prosody
│   │   ├── queryClient.ts   # React Query client
│   │   └── utils.ts         # Utility functions
│   ├── pages/
│   │   ├── home.tsx         # Import screen
│   │   └── rehearsal.tsx    # Main rehearsal screen
│   └── App.tsx              # Root component
├── index.html
└── index.css                # Design tokens and utilities

server/
├── routes.ts                # API endpoints
├── storage.ts               # Data persistence
└── index.ts                 # Server entry point

shared/
├── schema.ts                # TypeScript types and Zod schemas
└── user-schema.ts           # User schema (unused for now)
```

## Core Features

### Script Import
- Paste text or upload .txt files
- Automatic parsing of `CHARACTER: dialogue` format
- Stage directions detected in `[brackets]`
- Multi-scene detection

### Role Selection
- Auto-detect all roles from script
- Show line count per role
- User selects their role
- Smart Cast auto-assigns voices to other roles

### Three-Line Reader
- Previous line (dim)
- Current line (bold, highlighted if user's turn)
- Next line (ghost)
- Visual cue pulse when it's user's turn

### Transport Controls
- Back / Play-Pause / Next buttons
- Progress indicator
- Repeat current line
- Bookmark lines

### Voice Engine
- Web Speech API for TTS
- Emotion detection from text and stage directions
- SSML-like prosody (rate, pitch, volume, breaks)
- Voice presets: Natural, Deadpan, Theatrical

### Settings
- Ambient sound toggle (subtle room tone)
- Scene selection (for multi-scene scripts)
- Cast voice preset adjustment
- Font size (S/M/L)
- Toggle stage directions visibility
- Dark/light mode

## Design System

### Philosophy
Sophisticated, minimal design inspired by premium $10B companies (Stripe, Linear, Notion):
- **Clean typography** with clear hierarchy
- **High contrast** using foreground/background color scheme
- **Subtle interactions** - no jarring animations or playful effects
- **Professional aesthetic** - minimal, focused, purposeful

### Copy Guidelines
- No exclamation marks in UI copy
- Never use em-dashes (use periods or restructure sentences)
- Simple, direct wording without whimsy

### Colors
- **Primary accent**: foreground/background contrast (dark on light, light on dark)
- **Light Mode**: Background #FFFFFF, Foreground #0F172A
- **Dark Mode**: Background #0E1218, Foreground #E6EDF3
- **Status colors**: Green for success/completion, muted tones for secondary elements

### Typography
- Inter font family
- Weight contrast for hierarchy (semibold headings, medium body)
- Minimal text sizes (xs, sm, base)

### Motion
- 200ms ease-out transitions
- Subtle scale effects on press (0.98)
- No playful animations or bounces

## Data Storage

Currently uses localStorage for session persistence. All data stays on-device.

## Recent Changes

### January 2026 - ElevenLabs AI Voices & Bug Fixes
- **Professional AI Voices**: Upgraded from browser TTS to ElevenLabs AI voices
  - 9 voice types with smart character-aware assignment (gender, age, personality)
  - Emotion-aware voice settings (stability, similarity, style)
  - Backend proxy for secure API key handling
- **Critical Bug Fix**: Fixed race condition in role selection
  - Issue: `setUserRole()` state update was async, but `onSessionReady()` was called immediately after
  - Result: `userRoleId` was null on rehearsal page, causing AI to speak user's lines
  - Solution: Removed immediate `onSessionReady()` call; navigation now driven by existing useEffect that watches `session.userRoleId`

### January 2026 - Sophisticated Redesign (Phase 4)
- **Premium Minimal Design**: Complete UI overhaul for $10B company aesthetic
  - Removed playful mascot (Spot) from core flows
  - Replaced amber/orange gradients with foreground/background contrast
  - Simplified copy - no whimsical language
  - Clean typography, subtle borders, minimal shadows
- **Component Refinements**:
  - Home page: Clean hero with text-only headings, minimal feature indicators
  - Role selector: Dark cards when selected (bg-foreground text-background)
  - Transport bar: Minimal play button with simple progress ring
  - Three-line reader: User's line with dark background, clean styling
  - Settings drawer: Minimal toggles, clean organization
- **Technical Improvements**:
  - Proper Shadcn Button usage throughout for consistent hover/active states
  - All interactive elements have data-testid attributes
  - Streamlined component code

### January 2026 - Line Memorization & Progress (Phase 2-3)
- **Line Memorization Mode**: Four levels - Full, Partial, Cue, Memory
- **Progress Tracking**: Runs completed, lines rehearsed
- **Keyboard Shortcuts**: Space (play/pause), Arrow keys (navigate), R (repeat), Escape (stop)
- **PWA Ready**: Service worker, manifest, offline support

### Initial Build
- Complete MVP with script import, role selection, three-line reader, TTS playback, bookmarks, ambient sound, and dark mode
