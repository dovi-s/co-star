import type { EmotionStyle, ProsodyParams, VoicePreset } from "@shared/schema";

// Strip emphasis markers from text for TTS (we don't want to read them literally)
// Removes _underscores_ and *asterisks* but keeps the text inside
export function stripEmphasisMarkers(text: string): string {
  return text
    .replace(/_([^_]+)_/g, '$1')  // Remove _underscores_
    .replace(/\*([^*]+)\*/g, '$1'); // Remove *asterisks*
}

const emotionToProsody: Record<EmotionStyle, Partial<ProsodyParams>> = {
  neutral: { rate: 1, pitch: 0, volume: 0.9 },
  happy: { rate: 1.02, pitch: 0.08, volume: 0.9 },
  sad: { rate: 0.95, pitch: -0.1, volume: 0.85 },
  angry: { rate: 1.02, pitch: 0.08, volume: 0.92 },
  sarcastic: { rate: 0.97, pitch: -0.05, volume: 0.88 },
  fearful: { rate: 1.02, pitch: 0.05, volume: 0.88 },
  excited: { rate: 1.03, pitch: 0.08, volume: 0.92 },
  whisper: { rate: 0.92, pitch: -0.08, volume: 0.65 },
  urgent: { rate: 1.04, pitch: 0.06, volume: 0.92 },
};

const presetModifiers: Record<VoicePreset, Partial<ProsodyParams>> = {
  natural: { rate: 1, pitch: 0, volume: 0.9 },
  deadpan: { rate: 0.95, pitch: -0.12, volume: 0.85 },
  theatrical: { rate: 1.03, pitch: 0.08, volume: 0.95 },
};

export function calculateProsody(
  emotion: EmotionStyle = "neutral",
  preset: VoicePreset = "natural"
): ProsodyParams {
  const emotionParams = emotionToProsody[emotion];
  const presetMods = presetModifiers[preset];

  return {
    rate: (emotionParams.rate ?? 1) * (presetMods.rate ?? 1),
    pitch: (emotionParams.pitch ?? 0) + (presetMods.pitch ?? 0),
    volume: (emotionParams.volume ?? 1) * (presetMods.volume ?? 1),
    breakMs: calculateBreak(emotion),
  };
}

function calculateBreak(emotion: EmotionStyle): number {
  switch (emotion) {
    case "whisper":
    case "sad":
      return 400;
    case "urgent":
    case "angry":
      return 150;
    case "excited":
      return 200;
    default:
      return 300;
  }
}

export function detectEmotion(text: string, direction?: string): EmotionStyle {
  const dir = (direction || "").toLowerCase();
  const txt = text.toLowerCase();

  if (/whisper|whispering|quietly|softly|under.?breath|hushed|murmur/i.test(dir)) return "whisper";
  if (/excited|thrilled|ecstatic|elated|enthusiastic|giddy|emphatic/i.test(dir)) return "excited";
  if (/angry|furious|rage|snapping|explosive|livid/i.test(dir)) return "angry";
  if (/yelling|shouting/i.test(dir) && !/excited|happy|laughing|warm/i.test(dir)) return "angry";
  if (/yelling|shouting/i.test(dir)) return "excited";
  if (/urgent|desperate|panicked|frantic|alarmed|hurried|incredulous/i.test(dir)) return "urgent";
  if (/scared|terrified|frightened|fearful|trembling|shaking/i.test(dir)) return "fearful";
  if (/happy|laughing|joyful|smiling|cheerful|beaming|delighted/i.test(dir)) return "happy";
  if (/sad|crying|tearful|grief|mourning|broken|devastated|sobbing/i.test(dir)) return "sad";
  if (/sarcastic|dry|ironic|mocking|sardonic|wry/i.test(dir)) return "sarcastic";

  if (/calm|calming|gentle|warm|tender|reassur|comfort|sooth/i.test(dir)) return "neutral";
  if (/cold|stern|firm|sharp|bitter|dismissive|flat/i.test(dir)) return "neutral";
  if (/hesitant|nervous|awkward|uncertain|tentative|reluctant/i.test(dir)) return "neutral";

  if (/\b(stop|shut up|get out|how dare)\b/i.test(txt) && /!{2,}/.test(text)) return "angry";
  if (/\?{3,}/.test(text)) return "urgent";

  return "neutral";
}

export interface ConversationalTiming {
  aiToAiPauseMs: number;
  aiToUserPauseMs: number;
  userToAiPauseMs: number;
}

export function getConversationalTiming(
  currentEmotion: EmotionStyle,
  previousLineText?: string,
  previousEmotion?: EmotionStyle,
): ConversationalTiming {
  const emotionPauseBase: Record<EmotionStyle, number> = {
    angry: 200,
    urgent: 180,
    excited: 250,
    happy: 300,
    neutral: 400,
    sarcastic: 450,
    fearful: 350,
    sad: 650,
    whisper: 700,
  };

  let aiToAiBase = emotionPauseBase[currentEmotion] ?? 400;

  if (previousLineText) {
    const trimmed = previousLineText.trim();
    if (/\?$/.test(trimmed) || /\?["']?$/.test(trimmed)) {
      aiToAiBase = Math.round(aiToAiBase * 0.6);
    } else if (/!$/.test(trimmed) || /!["']?$/.test(trimmed)) {
      aiToAiBase = Math.round(aiToAiBase * 0.75);
    } else if (/[.…]$/.test(trimmed) || /\.{3}/.test(trimmed)) {
      aiToAiBase = Math.round(aiToAiBase * 1.2);
    }
  }

  if (previousEmotion && previousEmotion !== currentEmotion) {
    const weight = {
      angry: 3, urgent: 3, excited: 2, happy: 1,
      neutral: 0, sarcastic: 1, fearful: 2, sad: 3, whisper: 3,
    };
    const shift = Math.abs((weight[previousEmotion] ?? 0) - (weight[currentEmotion] ?? 0));
    if (shift >= 2) {
      aiToAiBase = Math.round(aiToAiBase * 1.15);
    }
  }

  aiToAiBase = Math.max(150, Math.min(900, aiToAiBase));

  const userToAiBase = Math.round(aiToAiBase * 0.35);
  const aiToUserBase = Math.round(aiToAiBase * 0.02);

  return {
    aiToAiPauseMs: aiToAiBase,
    aiToUserPauseMs: aiToUserBase,
    userToAiPauseMs: Math.max(40, Math.min(350, userToAiBase)),
  };
}

export function addBreathingPauses(text: string): string {
  let result = text;

  result = result.replace(/([,;])\s+/g, (_, punct) => `${punct}  `);

  result = result.replace(/(—|–)\s*/g, '— ');

  return result;
}

export type SpeakResult = "success" | "error" | "unavailable";

interface SpeakOptions {
  characterName?: string;
  characterIndex?: number;
  emotion?: EmotionStyle;
  preset?: VoicePreset;
  direction?: string;
  playbackSpeed?: number; // 0.5 to 1.5
  previousText?: string;
  nextText?: string;
  onStart?: (duration: number, wordCount: number) => void;
}

interface PrefetchedAudio {
  blob: Blob;
  url: string;
  key: string;
  timestamp: number;
}

class TTSEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private onEndCallback: ((result: SpeakResult) => void) | null = null;
  private isReady = false;
  private hasSpokenOnce = false;
  private currentAudio: HTMLAudioElement | null = null;
  private persistentAudio: HTMLAudioElement | null = null;
  private useElevenLabs = true;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private callbackFired = false;
  private fetchController: AbortController | null = null;
  private speakGeneration = 0;
  private browserTTSPollTimer: ReturnType<typeof setInterval> | null = null;
  private audioUnlocked = false;
  private pendingCanPlayListener: (() => void) | null = null;
  private pendingCanPlayTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentBlobUrl: string | null = null;
  
  private prefetchCache: Map<string, PrefetchedAudio> = new Map();
  private prefetchControllers: Map<string, AbortController> = new Map();
  private prefetchInFlight: Set<string> = new Set();
  
  private audioContext: AudioContext | null = null;
  private ttsDestination: MediaStreamAudioDestinationNode | null = null;
  private currentMediaSource: MediaElementAudioSourceNode | null = null;
  private persistentMediaSource: MediaElementAudioSourceNode | null = null;
  private _masterVolume: number = 1;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("costar-reader-volume");
        if (saved !== null) this._masterVolume = Math.max(0, Math.min(1, parseFloat(saved)));
      } catch {}
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => {
          this.loadVoices();
          this.isReady = true;
        };
      }
      
      setTimeout(() => {
        this.loadVoices();
        this.isReady = true;
      }, 100);
    }
    
    if (typeof window !== "undefined") {
      this.persistentAudio = new Audio();
      this.persistentAudio.preload = "auto";
    }
  }

  private loadVoices() {
    if (this.synth) {
      this.voices = this.synth.getVoices();
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    this.loadVoices();
    return this.voices;
  }

  get available(): boolean {
    return this.synth !== null || this.useElevenLabs;
  }

  get ready(): boolean {
    return this.isReady || this.useElevenLabs;
  }

  get masterVolume(): number {
    return this._masterVolume;
  }

  setMasterVolume(vol: number): void {
    this._masterVolume = Math.max(0, Math.min(1, vol));
    try { localStorage.setItem("costar-reader-volume", String(this._masterVolume)); } catch {}
    if (this.currentAudio) {
      this.currentAudio.volume = this._masterVolume;
    }
  }

  // Initialize audio context for WebRTC streaming (must be called after user interaction)
  initAudioContext(): void {
    if (this.audioContext) return;
    
    try {
      this.audioContext = new AudioContext();
      this.ttsDestination = this.audioContext.createMediaStreamDestination();
      console.log("[TTS] Audio context initialized for WebRTC streaming");
    } catch (e) {
      console.error("[TTS] Failed to create audio context:", e);
    }
  }

  unlockAudio(): void {
    try {
      if (!this.persistentAudio) {
        this.persistentAudio = new Audio();
        this.persistentAudio.preload = "auto";
      }
      
      const audio = this.persistentAudio;
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      
      if (!this.audioUnlocked) {
        audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        audio.volume = 0.01;
        audio.load();
        
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.then(() => {
            audio.pause();
            audio.volume = 1;
            audio.currentTime = 0;
            this.audioUnlocked = true;
            console.log("[TTS] Persistent audio element unlocked");
          }).catch(() => {
            console.log("[TTS] Audio unlock failed (expected if not in gesture)");
          });
        }
      }

      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume();
      }
    } catch (e) {
      console.log("[TTS] Audio unlock error:", e);
    }
  }

  // Get the TTS audio stream for mixing with WebRTC
  // Returns a MediaStream containing TTS audio that can be mixed with mic
  getTTSAudioStream(): MediaStream | null {
    if (!this.ttsDestination) {
      this.initAudioContext();
    }
    return this.ttsDestination?.stream || null;
  }

  private cleanupCanPlayListener() {
    if (this.pendingCanPlayListener && this.persistentAudio) {
      this.persistentAudio.removeEventListener('canplay', this.pendingCanPlayListener);
      this.pendingCanPlayListener = null;
    }
    if (this.pendingCanPlayTimeout) {
      clearTimeout(this.pendingCanPlayTimeout);
      this.pendingCanPlayTimeout = null;
    }
  }

  private clearWatchdog() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private startWatchdog(text: string, onEnd?: (result: SpeakResult) => void): void {
    this.clearWatchdog();
    this.callbackFired = false;
    
    // Estimate max duration: ~150ms per character + 5 second buffer
    const estimatedDuration = Math.max(10000, text.length * 150 + 5000);
    
    this.watchdogTimer = setTimeout(() => {
      if (!this.callbackFired) {
        console.log("[TTS] Watchdog triggered - audio likely stuck");
        this.stop();
        onEnd?.("success"); // Treat as success to advance dialogue
      }
    }, estimatedDuration);
  }

  private fireCallback(result: SpeakResult, onEnd?: (result: SpeakResult) => void) {
    if (!this.callbackFired) {
      this.callbackFired = true;
      this.clearWatchdog();
      onEnd?.(result);
    }
  }

  private makePrefetchKey(text: string, options: SpeakOptions): string {
    const cleanText = stripEmphasisMarkers(text);
    return `${cleanText}::${options.characterName || ""}::${options.characterIndex || 0}::${options.emotion || "neutral"}`;
  }

  prefetch(text: string, options: SpeakOptions): void {
    if (!this.useElevenLabs || !text) return;
    
    const key = this.makePrefetchKey(text, options);
    
    if (this.prefetchCache.has(key)) {
      return;
    }
    if (this.prefetchInFlight.has(key)) {
      return;
    }
    
    const controller = new AbortController();
    this.prefetchControllers.set(key, controller);
    this.prefetchInFlight.add(key);
    
    const cleanText = stripEmphasisMarkers(text);
    console.log("[TTS Prefetch] Starting for:", options.characterName, cleanText.substring(0, 40));
    
    const timeout = setTimeout(() => controller.abort(), 12000);
    
    fetch("/api/tts/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: cleanText,
        characterName: options.characterName || "Character",
        characterIndex: options.characterIndex || 0,
        emotion: options.emotion || "neutral",
        preset: options.preset || "natural",
        direction: options.direction || "",
        playbackSpeed: options.playbackSpeed ?? 1.0,
        previousText: options.previousText || "",
        nextText: options.nextText || "",
      }),
      signal: controller.signal,
    })
    .then(res => {
      clearTimeout(timeout);
      if (!res.ok) throw new Error("Prefetch failed");
      return res.blob();
    })
    .then(blob => {
      if (blob.size === 0) return;
      const url = URL.createObjectURL(blob);
      
      const staleKeys: string[] = [];
      this.prefetchCache.forEach((cached, oldKey) => {
        if (Date.now() - cached.timestamp > 120000) {
          URL.revokeObjectURL(cached.url);
          staleKeys.push(oldKey);
        }
      });
      staleKeys.forEach(k => this.prefetchCache.delete(k));
      
      this.prefetchCache.set(key, { blob, url, key, timestamp: Date.now() });
      console.log("[TTS Prefetch] Cached:", options.characterName, `(${Math.round(blob.size / 1024)}KB)`);
    })
    .catch(e => {
      if (e.name !== "AbortError") {
        console.log("[TTS Prefetch] Failed:", e.message);
      }
    })
    .finally(() => {
      clearTimeout(timeout);
      this.prefetchInFlight.delete(key);
      this.prefetchControllers.delete(key);
    });
  }

  clearPrefetchCache(): void {
    this.prefetchCache.forEach(cached => URL.revokeObjectURL(cached.url));
    this.prefetchCache.clear();
    this.prefetchControllers.forEach(controller => controller.abort());
    this.prefetchControllers.clear();
    this.prefetchInFlight.clear();
  }

  private consumePrefetched(text: string, options: SpeakOptions): PrefetchedAudio | null {
    const key = this.makePrefetchKey(text, options);
    const cached = this.prefetchCache.get(key);
    if (cached) {
      this.prefetchCache.delete(key);
      console.log("[TTS] Using prefetched audio for:", options.characterName);
      return cached;
    }
    return null;
  }

  async speakWithElevenLabs(
    text: string,
    options: SpeakOptions,
    onEnd?: (result: SpeakResult) => void
  ): Promise<boolean> {
    try {
      const cleanText = stripEmphasisMarkers(text);
      const myGeneration = this.speakGeneration;
      
      const prefetched = this.consumePrefetched(text, options);
      let audioBlob: Blob;
      let audioUrl: string;
      
      if (prefetched) {
        audioBlob = prefetched.blob;
        audioUrl = prefetched.url;
        console.log("[TTS] Instant play from prefetch cache");
      } else {
        console.log("[TTS] Fetching audio for:", options.characterName);
        
        if (this.fetchController) {
          this.fetchController.abort();
        }
        
        const controller = new AbortController();
        this.fetchController = controller;
        const fetchTimeout = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch("/api/tts/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanText,
            characterName: options.characterName || "Character",
            characterIndex: options.characterIndex || 0,
            emotion: options.emotion || "neutral",
            preset: options.preset || "natural",
            direction: options.direction || "",
            playbackSpeed: options.playbackSpeed ?? 1.0,
            previousText: options.previousText || "",
            nextText: options.nextText || "",
          }),
          signal: controller.signal,
        });
        
        clearTimeout(fetchTimeout);
        
        if (myGeneration !== this.speakGeneration) {
          console.log("[TTS] Generation changed during fetch, discarding response");
          return false;
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          console.log("[TTS] API error:", error);
          if (error.fallback) {
            return false;
          }
          throw new Error(error.error || "TTS request failed");
        }

        audioBlob = await response.blob();
        if (audioBlob.size === 0) {
          console.log("[TTS] Empty audio blob");
          this.fireCallback("error", onEnd);
          return false;
        }
        
        if (myGeneration !== this.speakGeneration) {
          console.log("[TTS] Generation changed during blob load, discarding");
          return false;
        }
        
        audioUrl = URL.createObjectURL(audioBlob);
      }
      
      const audio = this.persistentAudio || new Audio();
      if (!this.persistentAudio) {
        this.persistentAudio = audio;
      }
      audio.preload = "auto";
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      this.currentAudio = audio;
      
      const targetSpeed = options.playbackSpeed ?? 1.0;
      console.log("[TTS] Target playback speed:", targetSpeed);

      this.startWatchdog(text, onEnd);

      this.cleanupCanPlayListener();
      
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
      }
      this.currentBlobUrl = audioUrl;

      return new Promise((resolve) => {
        let hasEnded = false;
        
        const cleanup = () => {
          if (!hasEnded) {
            hasEnded = true;
            audio.onended = null;
            audio.onerror = null;
            audio.onstalled = null;
            audio.onabort = null;
            audio.oncanplaythrough = null;
            this.cleanupCanPlayListener();
          }
        };

        audio.onended = () => {
          console.log("[TTS] Audio finished");
          cleanup();
          if (this.currentBlobUrl === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            this.currentBlobUrl = null;
          }
          this.currentAudio = null;
          this.fireCallback("success", onEnd);
          resolve(true);
        };

        audio.onerror = () => {
          console.log("[TTS] Audio playback error");
          cleanup();
          if (this.currentBlobUrl === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            this.currentBlobUrl = null;
          }
          this.currentAudio = null;
          this.fireCallback("error", onEnd);
          resolve(false);
        };
        
        audio.onstalled = () => {
          console.log("[TTS] Audio stalled");
        };
        
        audio.onabort = () => {
          console.log("[TTS] Audio abort (expected when changing source)");
        };
        
        audio.oncanplaythrough = () => {
          audio.playbackRate = targetSpeed;
        };

        audio.src = audioUrl;
        audio.volume = this._masterVolume;
        audio.load();
        
        const connectWebRTC = () => {
          if (this.audioContext && this.ttsDestination) {
            try {
              if (!this.persistentMediaSource) {
                this.persistentMediaSource = this.audioContext.createMediaElementSource(audio);
                console.log("[TTS] Created MediaElementSource for WebRTC");
              }
              this.persistentMediaSource.connect(this.audioContext.destination);
              this.persistentMediaSource.connect(this.ttsDestination);
              this.currentMediaSource = this.persistentMediaSource;
              console.log("[TTS] Audio routed through AudioContext for WebRTC");
            } catch (e) {
              console.log("[TTS] AudioContext routing skipped:", (e as Error).message);
            }
          }
        };
        
        const attemptPlay = (retries: number) => {
          if (myGeneration !== this.speakGeneration) {
            console.log("[TTS] Generation changed during retry, aborting");
            cleanup();
            resolve(false);
            return;
          }
          
          if (this.audioContext?.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
          }
          
          audio.play().then(() => {
            if (myGeneration !== this.speakGeneration) {
              audio.pause();
              cleanup();
              resolve(false);
              return;
            }
            audio.playbackRate = targetSpeed;
            connectWebRTC();
            
            const duration = audio.duration || text.length * 0.08;
            const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
            console.log("[TTS] Playing audio, duration:", duration, "words:", wordCount);
            options?.onStart?.(duration, wordCount);
          }).catch((e) => {
            console.log("[TTS] Play failed (attempt " + (3 - retries) + "):", e.message);
            if (retries > 0 && myGeneration === this.speakGeneration) {
              setTimeout(() => attemptPlay(retries - 1), 200);
            } else {
              console.log("[TTS] All play attempts failed, falling back");
              cleanup();
              this.fireCallback("error", onEnd);
              resolve(false);
            }
          });
        };
        
        const startPlayback = () => {
          if (myGeneration !== this.speakGeneration) {
            resolve(false);
            return;
          }
          attemptPlay(2);
        };
        
        if (audio.readyState >= 3) {
          startPlayback();
        } else {
          const onCanPlay = () => {
            audio.removeEventListener('canplay', onCanPlay);
            this.pendingCanPlayListener = null;
            startPlayback();
          };
          this.pendingCanPlayListener = onCanPlay;
          audio.addEventListener('canplay', onCanPlay);
          
          this.pendingCanPlayTimeout = setTimeout(() => {
            audio.removeEventListener('canplay', onCanPlay);
            this.pendingCanPlayListener = null;
            this.pendingCanPlayTimeout = null;
            if (!hasEnded) {
              console.log("[TTS] canplay timeout, attempting play anyway");
              startPlayback();
            }
          }, 3000);
        }
      });
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("[TTS] Fetch timed out");
      } else {
        console.error("[TTS] Error:", error.message);
      }
      this.fireCallback("error", onEnd);
      return false;
    }
  }

  speak(
    text: string, 
    prosody: ProsodyParams, 
    onEnd?: (result: SpeakResult) => void,
    options?: SpeakOptions
  ): boolean {
    this.stop();

    if (this.useElevenLabs && options) {
      const myGeneration = this.speakGeneration;
      this.speakWithElevenLabs(text, options, onEnd).then((success) => {
        if (!success && this.speakGeneration === myGeneration) {
          console.log("[TTS] ElevenLabs failed, falling back to browser TTS");
          this.speakWithBrowserTTS(text, prosody, onEnd);
        } else if (!success) {
          console.log("[TTS] ElevenLabs failed but generation changed, skipping fallback");
        }
      });
      return true;
    }

    return this.speakWithBrowserTTS(text, prosody, onEnd);
  }

  private clearBrowserTTSPoll() {
    if (this.browserTTSPollTimer) {
      clearInterval(this.browserTTSPollTimer);
      this.browserTTSPollTimer = null;
    }
  }

  private speakWithBrowserTTS(
    text: string,
    prosody: ProsodyParams,
    onEnd?: (result: SpeakResult) => void
  ): boolean {
    if (!this.synth) {
      onEnd?.("unavailable");
      return false;
    }
    
    this.loadVoices();

    if (this.synth.paused) {
      this.synth.resume();
    }

    if (this.voices.length === 0) {
      onEnd?.("unavailable");
      return false;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    const englishVoices = this.voices.filter(v => v.lang.startsWith("en"));
    const preferredVoice = englishVoices.find(v => 
      v.name.toLowerCase().includes("samantha") ||
      v.name.toLowerCase().includes("google") ||
      v.name.toLowerCase().includes("natural")
    ) || englishVoices[0] || this.voices[0];
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = Math.max(0.5, Math.min(2, prosody.rate));
    utterance.pitch = Math.max(0, Math.min(2, 1 + prosody.pitch * 0.5));
    utterance.volume = Math.max(0.1, Math.min(1, prosody.volume)) * this._masterVolume;

    let browserCallbackFired = false;
    const fireBrowserCallback = (result: SpeakResult) => {
      if (browserCallbackFired) return;
      browserCallbackFired = true;
      this.clearBrowserTTSPoll();
      this.currentUtterance = null;
      if (this.synth?.speaking) {
        this.synth.cancel();
      }
      console.log("[TTS] Browser TTS callback:", result);
      onEnd?.(result);
    };
    
    utterance.onstart = () => {
      this.hasSpokenOnce = true;
    };
    
    utterance.onend = () => {
      if (prosody.breakMs > 0) {
        setTimeout(() => fireBrowserCallback("success"), prosody.breakMs);
      } else {
        fireBrowserCallback("success");
      }
    };

    utterance.onerror = (event) => {
      if (event.error === "canceled") {
        return;
      }
      fireBrowserCallback("error");
    };

    this.currentUtterance = utterance;
    
    try {
      this.synth.speak(utterance);
      
      setTimeout(() => {
        if (this.synth && !this.synth.speaking && this.currentUtterance === utterance && !this.hasSpokenOnce) {
          this.synth.cancel();
          this.synth.speak(utterance);
        }
      }, 100);

      this.clearBrowserTTSPoll();
      let pollCount = 0;
      let speechStarted = false;
      const maxPolls = Math.max(40, Math.ceil(text.length * 0.5));
      this.browserTTSPollTimer = setInterval(() => {
        pollCount++;
        const speaking = this.synth?.speaking ?? false;
        
        if (speaking) {
          speechStarted = true;
        }
        
        if (speechStarted && !speaking && !browserCallbackFired) {
          console.log("[TTS] Poll detected browser TTS finished (onend missed)");
          fireBrowserCallback("success");
          return;
        }
        
        if (pollCount > maxPolls) {
          console.log("[TTS] Browser TTS poll timeout, forcing advance");
          fireBrowserCallback("success");
          return;
        }

        if (pollCount > 10 && !speechStarted && !speaking) {
          console.log("[TTS] Browser TTS never started after 3s, advancing");
          fireBrowserCallback("unavailable");
          return;
        }
      }, 300);
      
      return true;
    } catch (e) {
      this.currentUtterance = null;
      onEnd?.("error");
      return false;
    }
  }

  stop() {
    this.clearWatchdog();
    this.clearBrowserTTSPoll();
    this.cleanupCanPlayListener();
    this.callbackFired = true;
    this.speakGeneration++;
    
    if (this.fetchController) {
      this.fetchController.abort();
      this.fetchController = null;
    }
    
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio.onstalled = null;
      this.currentAudio.onabort = null;
      this.currentAudio.oncanplaythrough = null;
      this.currentAudio = null;
    }
    
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    
    if (this.synth) {
      this.synth.cancel();
    }
    this.currentUtterance = null;
  }

  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    if (this.synth) {
      this.synth.pause();
    }
  }

  resume() {
    if (this.currentAudio) {
      this.currentAudio.play();
    }
    if (this.synth) {
      this.synth.resume();
    }
  }

  get isSpeaking(): boolean {
    if (this.currentAudio && !this.currentAudio.paused) {
      return true;
    }
    return this.synth?.speaking ?? false;
  }

  get isPaused(): boolean {
    if (this.currentAudio?.paused) {
      return true;
    }
    return this.synth?.paused ?? false;
  }

  speakHint(fullText: string, onEnd?: () => void): boolean {
    if (!this.synth) {
      onEnd?.();
      return false;
    }

    this.synth.cancel();
    this.loadVoices();

    const utterance = new SpeechSynthesisUtterance(fullText);
    const englishVoices = this.voices.filter(v => v.lang.startsWith("en"));
    const voice = englishVoices.find(v =>
      v.name.toLowerCase().includes("samantha") ||
      v.name.toLowerCase().includes("google") ||
      v.name.toLowerCase().includes("natural")
    ) || englishVoices[0] || this.voices[0];

    if (voice) utterance.voice = voice;
    utterance.rate = 0.85;
    utterance.pitch = 0.9;
    utterance.volume = 0.3 * this._masterVolume;

    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();

    try {
      this.synth.speak(utterance);
      return true;
    } catch {
      onEnd?.();
      return false;
    }
  }
}

export const ttsEngine = new TTSEngine();
