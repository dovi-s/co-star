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

### UX Audit Implementation (Session 12)
- **Error Boundary**: Global React ErrorBoundary wraps app in App.tsx with friendly fallback UI + retry button
- **Reduced Motion**: `@media (prefers-reduced-motion: reduce)` CSS rules disable/minimize animations
- **JSON-LD**: SoftwareApplication structured data in client/index.html
- **Undo Delete**: Script deletion uses 5-second undo toast instead of confirmation modal (recent-scripts.tsx)
- **Console Cleanup**: Removed all debug console.log from use-webrtc.ts and speech-recognition.ts
- **Ready Screen**: "Ready to rehearse" interstitial with role/scene/mode info + 3-second countdown before rehearsal starts
- **Tooltip Tour**: One-time 4-step tour for first-time users (stored in localStorage)
- **Resume Position**: Saves line/scene position on exit, offers "Resume" or "Start Fresh" on next load (localStorage keyed by script content hash)
- **Voice Preview**: Play sample buttons on voice preset picker (Natural/Deadpan/Theatrical) in role-chip.tsx
- **LINE Hint**: One-time tooltip after 8s pause on user's line: "Say LINE for a hint"
- **Camera Contrast**: Text shadow CSS classes for readability over bright video backgrounds
- **Completed Lines**: Checkmark icon on completed lines in three-line-reader timeline
- **Haptic Feedback**: `use-haptics.ts` hook with triggerHaptic() for tap/select/success/achievement/error patterns; wired into transport bar buttons, line completion, and run completion
- **Animated Accuracy**: Accuracy percentage counts up from 0 with ease-out animation on completion screen
- **Multiplayer Glow**: Ready participants get pulsing green glow animation in lobby
- **Role Selector Keyboard**: ARIA listbox pattern with arrow key navigation in role-selector.tsx
- **Offline Banner**: Top banner when navigator.onLine is false, auto-dismisses on reconnection
- **Screen Reader Progress**: Visually-hidden span announces "Line X of Y" in transport bar
- **Smarter Suggestions**: Context-aware "What's Next" on completion: next scene, slow pace, improve accuracy, challenge mode, switch role, retention test

### Comprehensive UX Refinement (Session 13)
- **Home Page Layout**: Consolidated value props into subtitle text; tightened spacing (heading pt-6, nudge compact); standardized px-4 padding; textarea hero glow enhanced; decorative gradient overlay removed
- **Role Selector Quick-Start**: Auto-selects last used role for returning users; "Resume as [Character]" button; mini script preview showing first 2-3 lines; tighter vertical spacing
- **Rehearsal Visual Hierarchy**: Current line font size bumped up, prev/next dimmed more aggressively (opacity 20%); practice toolbar auto-collapses behind gear icon; transport bar inactive controls lighter
- **Celebration Screen**: 800ms reveal delay for anticipation; accuracy number scaled to text-5xl hero; streak badge with flame icon; "What's next" as bordered cards; subtle Web Audio chime; enhanced multi-color confetti
- **Contrast & Accessibility**: All muted-foreground/60 bumped to muted-foreground for WCAG AA; visible focus rings with primary glow; 44px touch targets on touch devices only (not inline links)
- **Loading & Empty States**: Unified pattern (icon circle + heading + subtext + CTA) for Library, History, and Recent Scripts; staggered skeleton animations with varied widths
- **Side Menu Navigation**: Grouped into sections (Rehearse, Account, About, Support); active page highlighting with primary tint; marketing pages moved to footer
- **Typography & Spacing**: Body line-height 1.6; heading letter-spacing -0.015em; spacing utilities (gap-related 8px, gap-group 16px, gap-section 24px); not-found page uses semantic colors
- **Persistent Rehearsal Pill**: "Now Rehearsing" floating pill when navigating away from active session; one-tap return; truncated script name; slide-in animation
- **Micro-interaction Polish**: CTA press scale (0.97); glass surface desktop hover glow; hero section staggered entrance animation; smooth mascot mood transitions; theatrical theme toggle rotation
- **iOS PWA Ding Fix**: `pause()`/`softStart()` methods on SpeechRecognitionEngine; continuous mode on iOS PWA avoids repeated recognition.start() calls that trigger system chimes

### PWA & PLG Refinement (Session 14)
- **Smart PWA Install Prompt**: Custom `usePwaInstall` hook captures `beforeinstallprompt`; shows polished install card after first rehearsal; iOS Safari manual instructions; one-time display via localStorage
- **Theme Color Sync**: Dynamic `theme-color` meta tag updates on theme change; camera mode sets status bar to black; manifest aligned to light mode defaults; `display_override: ["standalone", "minimal-ui"]`
- **Activation-First Onboarding**: First script can be parsed/rehearsed without auth (PLG principle); auth required after first use; "Save your progress" nudge on completion screen for unauthenticated users
- **Upgrade Nudges at Natural Moments**: "Share Your Score" button on >85% accuracy (Web Share API); "Pro tip" card after 90%+ runs; empathetic daily limit copy; Crown badge shimmer on Pro-only features
- **Retention Loop**: Per-script run history in localStorage; accuracy trend comparison ("Up X% from last time"); streak badge on home page; throttled streak toast on exit (once per session)
- **Offline Rehearsal**: TTS engine falls back to browser voices when offline; active session cached in localStorage; subtle "Offline mode" indicator; neutral offline banner tone
- **Swipe-Back Gesture**: `useSwipeBack` hook with edge detection (50px threshold); visual pull indicator; standalone PWA only (no browser conflict); respects scrollable elements
- **Settings Progressive Disclosure**: Essentials (pace, volume, tap mode) shown by default; Advanced section collapsible; descriptions on every setting; "Reset to Defaults" button
- **Contextual Micro-Copy**: Warmer placeholder text, action-oriented CTAs, conversational error messages, rotating loading messages, friendlier empty states
- **Visual Rhythm**: `content-inset` utility (16px mobile, 24px tablet, 32px desktop); zone separators between content groups; removed redundant decorative elements

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