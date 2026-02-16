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
  happy: { rate: 1.05, pitch: 0.15, volume: 0.9 },
  sad: { rate: 0.9, pitch: -0.2, volume: 0.8 },
  angry: { rate: 1.05, pitch: 0.2, volume: 0.95 },
  sarcastic: { rate: 0.95, pitch: -0.1, volume: 0.85 },
  fearful: { rate: 1.05, pitch: 0.15, volume: 0.85 },
  excited: { rate: 1.08, pitch: 0.2, volume: 0.95 },
  whisper: { rate: 0.85, pitch: -0.15, volume: 0.6 },
  urgent: { rate: 1.1, pitch: 0.15, volume: 0.95 },
};

const presetModifiers: Record<VoicePreset, Partial<ProsodyParams>> = {
  natural: { rate: 1, pitch: 0, volume: 0.9 },
  deadpan: { rate: 0.9, pitch: -0.3, volume: 0.8 },
  theatrical: { rate: 1.1, pitch: 0.2, volume: 1 },
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

export function detectEmotion(_text: string, _direction?: string): EmotionStyle {
  // Keep it simple - always neutral for natural audition-style reads
  // No theatrical emotions, just people reading lines naturally
  return "neutral";
}

export type SpeakResult = "success" | "error" | "unavailable";

interface SpeakOptions {
  characterName?: string;
  characterIndex?: number;
  emotion?: EmotionStyle;
  preset?: VoicePreset;
  playbackSpeed?: number; // 0.5 to 1.5
  onStart?: (duration: number, wordCount: number) => void;
}

class TTSEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private onEndCallback: ((result: SpeakResult) => void) | null = null;
  private isReady = false;
  private hasSpokenOnce = false;
  private currentAudio: HTMLAudioElement | null = null;
  private useElevenLabs = true;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private callbackFired = false;
  private fetchController: AbortController | null = null;
  private speakGeneration = 0;
  private browserTTSPollTimer: ReturnType<typeof setInterval> | null = null;
  private audioUnlocked = false;
  
  // Audio mixing for WebRTC - allows TTS audio to be streamed to other participants
  private audioContext: AudioContext | null = null;
  private ttsDestination: MediaStreamAudioDestinationNode | null = null;
  private currentMediaSource: MediaElementAudioSourceNode | null = null;

  constructor() {
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
    if (this.audioUnlocked) return;
    
    try {
      const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      silentAudio.volume = 0.01;
      silentAudio.play().then(() => {
        silentAudio.pause();
        this.audioUnlocked = true;
        console.log("[TTS] Audio unlocked for mobile playback");
      }).catch(() => {
        console.log("[TTS] Silent audio unlock failed (expected if not in gesture)");
      });

      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.ttsDestination = this.audioContext.createMediaStreamDestination();
      }
      if (this.audioContext.state === 'suspended') {
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

  async speakWithElevenLabs(
    text: string,
    options: SpeakOptions,
    onEnd?: (result: SpeakResult) => void
  ): Promise<boolean> {
    try {
      console.log("[TTS] Fetching audio for:", options.characterName);
      
      // Strip emphasis markers before sending to TTS
      const cleanText = stripEmphasisMarkers(text);
      
      // Capture the current generation so we can detect if stop() was called during fetch
      const myGeneration = this.speakGeneration;
      
      // Abort any previous in-flight fetch
      if (this.fetchController) {
        this.fetchController.abort();
      }
      
      // Create a new controller for this request (combines timeout + cancellation)
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
          emotion: "neutral",
          preset: "natural",
          playbackSpeed: options.playbackSpeed ?? 1.0,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(fetchTimeout);
      
      // If stop() was called while we were fetching, discard this response
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

      const audioBlob = await response.blob();
      if (audioBlob.size === 0) {
        console.log("[TTS] Empty audio blob");
        this.fireCallback("error", onEnd);
        return false;
      }
      
      // Check generation again after blob loaded
      if (myGeneration !== this.speakGeneration) {
        console.log("[TTS] Generation changed during blob load, discarding");
        return false;
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create audio element
      const audio = new Audio();
      audio.preload = "auto";
      this.currentAudio = audio;
      
      const targetSpeed = options.playbackSpeed ?? 1.0;
      console.log("[TTS] Target playback speed:", targetSpeed);

      // Start watchdog timer
      this.startWatchdog(text, onEnd);

      return new Promise((resolve) => {
        let hasEnded = false;
        let mediaSource: MediaElementAudioSourceNode | null = null;
        
        const cleanup = () => {
          if (!hasEnded) {
            hasEnded = true;
            URL.revokeObjectURL(audioUrl);
            // Disconnect media source to free resources
            if (mediaSource) {
              try { mediaSource.disconnect(); } catch (e) { /* ignore */ }
              if (this.currentMediaSource === mediaSource) {
                this.currentMediaSource = null;
              }
            }
            if (this.currentAudio === audio) {
              this.currentAudio = null;
            }
          }
        };

        audio.onended = () => {
          console.log("[TTS] Audio finished");
          cleanup();
          this.fireCallback("success", onEnd);
          resolve(true);
        };

        audio.onerror = () => {
          console.log("[TTS] Audio playback error");
          cleanup();
          this.fireCallback("error", onEnd);
          resolve(false);
        };
        
        // Handle stalled/stuck audio
        audio.onstalled = () => {
          console.log("[TTS] Audio stalled");
        };
        
        audio.onabort = () => {
          console.log("[TTS] Audio aborted");
          cleanup();
          // Don't fire callback on abort - let watchdog handle it
        };
        
        // Apply playback speed after audio is ready to play
        audio.oncanplaythrough = () => {
          audio.playbackRate = targetSpeed;
          console.log("[TTS] Applied playback speed:", audio.playbackRate);
        };

        // Set source and play
        audio.src = audioUrl;
        audio.volume = 1;
        
        const attemptPlay = (retries: number) => {
          if (this.audioContext?.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
          }
          
          audio.play().then(() => {
            audio.playbackRate = targetSpeed;
            
            if (this.audioContext && this.ttsDestination) {
              try {
                mediaSource = this.audioContext.createMediaElementSource(audio);
                this.currentMediaSource = mediaSource;
                mediaSource.connect(this.audioContext.destination);
                mediaSource.connect(this.ttsDestination);
                console.log("[TTS] Audio routed through AudioContext for WebRTC");
              } catch (e) {
                console.log("[TTS] AudioContext routing failed (normal on first play):", e);
              }
            }
            
            const duration = audio.duration || text.length * 0.08;
            const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
            console.log("[TTS] Playing audio, duration:", duration, "words:", wordCount);
            options?.onStart?.(duration, wordCount);
          }).catch((e) => {
            console.log("[TTS] Play failed (attempt " + (3 - retries) + "):", e.message);
            if (retries > 0) {
              setTimeout(() => attemptPlay(retries - 1), 100);
            } else {
              console.log("[TTS] All play attempts failed, falling back");
              cleanup();
              this.fireCallback("error", onEnd);
              resolve(false);
            }
          });
        };
        
        attemptPlay(2);
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
    utterance.volume = Math.max(0.1, Math.min(1, prosody.volume));

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
    this.callbackFired = true; // Prevent any pending callbacks
    this.speakGeneration++; // Invalidate any in-flight requests
    
    // Abort any in-flight fetch
    if (this.fetchController) {
      this.fetchController.abort();
      this.fetchController = null;
    }
    
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
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
}

export const ttsEngine = new TTSEngine();
