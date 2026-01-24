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

### Colors
- **Light Mode**: Paper #F7F4EE, Ink #0F172A, Brand #1A73E8, Accent #B08763
- **Dark Mode**: Paper #0E1218, Ink #E6EDF3, Brand #59A4FF

### Typography
- Inter font family
- Weight contrast for hierarchy

### Motion
- 120ms ease-out transitions
- No jarring animations

## Data Storage

Currently uses localStorage for session persistence. All data stays on-device.

## Recent Changes

### January 2026 - Spot Mascot & Brand Identity (Phase 3)
- **Spot the Mascot**: Lovable golden theatrical spotlight character (Duolingo-style)
  - A warm, friendly spotlight with expressive eyes and smile
  - Multiple moods: happy, excited, encouraging, thinking, celebrating, waving, listening, proud
  - Appears throughout app: home page, role selector, rehearsal header, celebration modal
  - Distinctive amber/orange/gold color palette
- **Brand Logo**: Amber gradient icon featuring Spot's face
  - Warm, approachable, memorable identity
  - "Your Scene Partner Awaits" tagline
  - "Spot says:" personalized messaging
- **Gamification System**: Progress tracking features
  - Daily streak tracking with flame icon
  - Daily goal progress bar (default 50 lines)
  - Line and run count tracking
  - Stats persistence in localStorage
- **PWA Ready**: Service worker, manifest, offline support, home screen installation

### January 2026 - Major UX/UI Overhaul (Phase 2)
- **Actor-Focused Copy**: Warm, encouraging language throughout ("Your Private Stage", "Step Into Character")
- **Line Memorization Mode**: Four levels - Full (see all), Partial (half hidden), Cue (first words), Memory (no help)
- **Progress Tracking**: Tracks runs completed and lines rehearsed with celebration modal on scene completion
- **Keyboard Shortcuts**: Space (play/pause), Arrow keys (navigate), R (repeat), Escape (stop)
- **Theatrical Animations**: Spotlight effect, curtain transitions, heartbeat animations, success pulses
- **Celebration Moments**: Mascot animation and stats display when completing a scene run

### January 2026 - Major UX/UI Overhaul (Phase 1)
- **Premium Animations**: Added comprehensive animation system with fade-in, slide, scale, float effects
- **Home Page Redesign**: New hero section with floating icon, feature pills, cleaner layout
- **Role Selection Overhaul**: Card-based layout with progress bars, lead badges, AI indicators
- **Three-Line Reader**: Enhanced with gradient backgrounds, speaking wave indicators, "Your turn" prompts
- **Transport Bar**: Circular progress ring around play button, refined controls with keyboard hints
- **Settings Drawer**: Polished drawer with rounded corners, better organization, preset picker
- **Theme Toggle**: Animated icon rotation between sun/moon
- **Demo Script**: Built-in emotional sample scene for quick testing
- **Visual Polish**: Consistent rounded corners (rounded-xl/2xl), shadows, glass effects
- **Micro-interactions**: Hover lift effects, glow pulses, smooth state transitions

### Initial Build
- Complete MVP with script import, role selection, three-line reader, TTS playback, bookmarks, ambient sound, and dark mode
