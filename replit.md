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
├── script-parser.ts         # Script parsing with pattern matching
├── ai-script-cleanup.ts     # AI post-processing for script validation
└── index.ts                 # Server entry point

shared/
├── schema.ts                # TypeScript types and Zod schemas
└── user-schema.ts           # User schema (unused for now)
```

## Core Features

### Script Import
- Paste text or upload .txt files
- Automatic parsing of `CHARACTER: dialogue` format
- Stage directions detected in `[brackets]` and `(parentheticals)`
- Multi-scene detection with scene descriptions
- Action lines preceding dialogue captured as context

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
- Scene transition card on scene entry
- Context peek button for lines with action/directions

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

### January 2026 - Robust PDF/OCR Script Parsing
- **OCR Artifact Cleaning**: Automatic cleanup of PDF extraction issues
  - Bullet characters (•••) converted to proper ellipsis
  - Tilde (~), pipe (|), backtick (`) artifacts cleaned
  - Production notes like "4 OMITTED" stripped from dialogue
- **Merged Line Detection**: Fixes PDF lines that run together
  - "HUDSONGood evening" → split into "HUDSON" + "Good evening"
  - Embedded action lines like "JOHN passes his documents" stripped
  - Character name + extension patterns (CONT'D) properly separated
- **Character Name Validation**: 150+ reserved words blocked
  - Articles/conjunctions: THE, A, AN, AND, OR, BUT, etc.
  - Time transitions: MINUTES LATER, HOURS LATER, NEXT DAY
  - Location words: BACKYARD, KITCHEN, HOSPITAL, STREET (50+)
  - Sound effects: SCREAMS, VROOM, CRASH, BANG, HOWLS
  - Camera terms: ANGLE, SHOT, CLOSE, POV, INTERCUT
  - Production terms: OMITTED, REVISED, DRAFT, PAGE
- **Context Validation**: Rejects dialogue fragments as stage directions
  - "Ben and he had a beard" patterns blocked
  - Only accepts real action: "He walks...", "The door opens..."
- **Dialogue Validation**: General heuristics for prose detection
  - Third-person patterns: "He looks", "She turns", "They walk"
  - "The [noun] [verb]" action descriptions rejected
  - Mixed ALL-CAPS text with sound effects filtered

### January 2026 - AI Smart Cleanup Feature
- **AI Post-Processing Validation**: After regex parsing, AI reviews first 80 parsed lines
  - Identifies and removes title page content, writer credits, cast lists
  - Filters out production notes, copyright notices, revision markers
  - Catches action descriptions mistakenly parsed as dialogue
  - Returns perfectly clean dialogue-only results
- **Graceful Degradation**: If AI is unavailable, returns original parsed result
- **Performance Optimized**: 15-second timeout, only processes first 80 lines for speed
- **Type Safe**: Immutable operations, proper cloning of roles/scenes

### January 2026 - Multi-Format Script Parser Improvements
- **Professional Screenplay Format Support**: Parser now handles industry-standard scripts
  - Strips scene numbers from left/right margins (e.g., "1A", "23", "42A")
  - Removes revision asterisks (*) commonly found in production scripts
  - Handles INSERT shots, OMITTED scenes, and ANGLE ON headings
- **Character Extension Detection Fix**: Proper handling of V.O., O.S., CONT'D suffixes
  - Caps ratio calculation now based on letters only (not punctuation)
  - Character names like "JORDAN (V.O.)" now detected correctly
- **Conservative Action Line Detection**: Reduced false positives that were filtering dialogue
  - Removed overly aggressive "A", "AN", "THE" sentence patterns
  - Better preservation of all dialogue lines
- **Stage Play Format Support**: Scripts without INT./EXT. headings now work
  - Parser starts on first valid "Character: dialogue" line
  - Mixed-case character names (e.g., "Simba:") automatically uppercased
- **Tested Formats**: Home Alone, Step Brothers, Wolf of Wall Street, Fast & Furious, Lion King

### January 2026 - Context & Scene Awareness Features
- **Script Context Capture**: Parser now captures action/stage directions preceding dialogue
  - Action lines between dialogues are attached as `context` field to the next dialogue
  - Scene descriptions captured from first action line after scene heading
  - `isActionLine()` detection filters third-person action patterns (He/She/They/The)
- **Scene Transition Cards**: When entering a new scene, displays a card with:
  - Scene name (e.g., "INT. HOTEL ROOM - ONE HOUR LATER")
  - Scene description when available (first action after heading)
  - Subtle fade-in/slide-in animation
- **Context Peek Feature**: Tap the "Action" button below dialogue to reveal:
  - Stage directions and action preceding the line
  - Expandable/collapsible display
  - Styled with Film icon and subtle design
- **Improved Parenthetical Detection**: Enhanced regex patterns for stage directions:
  - Catches "to himself", "singing", "off mic", "looks up" patterns
  - Detects emotion keywords more comprehensively
- **Global Script Navigation**: Progress indicator now shows position across entire script
  - `getTotalScriptLines()` and `getGlobalLineNumber()` functions
  - Automatic scene advancement at end of scene

### January 2026 - Performance Feedback System
- **Run Performance Tracking**: Tracks accuracy per line during rehearsal
  - Word match accuracy recorded for each user line
  - Tracks skipped lines (when user advances without speaking)
  - Calculates overall run statistics on completion
- **Enhanced Completion Modal**: 
  - Shows performance feedback based on accuracy (Perfect/Great/Good/Learning)
  - Displays accuracy percentage, perfect lines count
  - Color-coded feedback (gold for perfect, green for great, blue for good)
  - "Try Again" button for instant replay
- **Encouraging Feedback**:
  - "Flawless delivery" for 95%+ accuracy with no skips
  - "Strong run" for 80%+ accuracy
  - "Solid progress" for 60%+ accuracy
  - "Getting there" with actionable tips for lower scores
- **Script Import Font**: Monospace font (JetBrains Mono) for authentic screenplay feel

### January 2026 - Voice System Overhaul & Reliability Fixes
- **Neutral American Voices**: Replaced mixed-accent voices with 6 neutral American English voices
  - 3 male voices (Brian, Eric, Chris) + 3 female voices (Jessica, Sarah, Charlotte)
  - Voice assignment cache ensures consistent voices per character throughout session
  - Deterministic assignment based on character index (different characters get different voices)
- **Speech Recognition Improvements**: 
  - Switched to single-utterance mode for more reliable capture
  - 3-second silence timeout, 15-second max listen limit
  - LastTranscript recovery - if recognition ends without final, sends last captured text
  - Comprehensive error recovery - always advances on error
- **Dialogue Flow Robustness**:
  - Watchdog timer forces advancement if audio stalls
  - Safety timeout on user turns (20s max)
  - Always advances on TTS completion regardless of success/error
  - Brief 200ms pauses between lines for natural flow
- **API Additions**: POST /api/tts/reset to clear voice cache between sessions

### January 2026 - ElevenLabs AI Voices & Bug Fixes
- **Professional AI Voices**: Upgraded from browser TTS to ElevenLabs AI voices
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
