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
      
      // Set a timeout for the fetch itself
      const controller = new AbortController();
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
        
        const cleanup = () => {
          if (!hasEnded) {
            hasEnded = true;
            URL.revokeObjectURL(audioUrl);
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
        
        audio.play().then(() => {
          // Also set after play starts (belt and suspenders)
          audio.playbackRate = targetSpeed;
          const duration = audio.duration || text.length * 0.08; // Estimate ~80ms per char
          const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
          console.log("[TTS] Playing audio, duration:", duration, "words:", wordCount);
          options?.onStart?.(duration, wordCount);
        }).catch((e) => {
          console.log("[TTS] Play failed:", e.message);
          cleanup();
          this.fireCallback("error", onEnd);
          resolve(false);
        });
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
      this.speakWithElevenLabs(text, options, onEnd).then((success) => {
        if (!success) {
          this.speakWithBrowserTTS(text, prosody, onEnd);
        }
      });
      return true;
    }

    return this.speakWithBrowserTTS(text, prosody, onEnd);
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

    this.onEndCallback = onEnd ?? null;
    
    utterance.onstart = () => {
      this.hasSpokenOnce = true;
    };
    
    utterance.onend = () => {
      if (prosody.breakMs > 0) {
        setTimeout(() => {
          this.onEndCallback?.("success");
        }, prosody.breakMs);
      } else {
        this.onEndCallback?.("success");
      }
    };

    utterance.onerror = (event) => {
      if (event.error === "canceled") {
        return;
      }
      this.onEndCallback?.("error");
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
      
      return true;
    } catch (e) {
      onEnd?.("error");
      return false;
    }
  }

  stop() {
    this.clearWatchdog();
    this.callbackFired = true; // Prevent any pending callbacks
    
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
