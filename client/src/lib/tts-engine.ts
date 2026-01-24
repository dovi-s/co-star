import type { EmotionStyle, ProsodyParams, VoicePreset } from "@shared/schema";

const emotionToProsody: Record<EmotionStyle, Partial<ProsodyParams>> = {
  neutral: { rate: 1, pitch: 0, volume: 0.9 },
  happy: { rate: 1.1, pitch: 0.3, volume: 0.95 },
  sad: { rate: 0.85, pitch: -0.4, volume: 0.75 },
  angry: { rate: 1.15, pitch: 0.5, volume: 1 },
  sarcastic: { rate: 0.95, pitch: -0.2, volume: 0.85 },
  fearful: { rate: 1.2, pitch: 0.6, volume: 0.7 },
  excited: { rate: 1.25, pitch: 0.4, volume: 1 },
  whisper: { rate: 0.8, pitch: -0.3, volume: 0.5 },
  urgent: { rate: 1.3, pitch: 0.3, volume: 1 },
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

export function detectEmotion(text: string, direction?: string): EmotionStyle {
  const lowerText = text.toLowerCase();
  const lowerDir = direction?.toLowerCase() ?? "";

  if (lowerDir.includes("whisper") || lowerDir.includes("quietly")) return "whisper";
  if (lowerDir.includes("angry") || lowerDir.includes("furious")) return "angry";
  if (lowerDir.includes("sarcastic") || lowerDir.includes("mockingly")) return "sarcastic";
  if (lowerDir.includes("sad") || lowerDir.includes("tearfully")) return "sad";
  if (lowerDir.includes("excited") || lowerDir.includes("enthusiastic")) return "excited";
  if (lowerDir.includes("urgent") || lowerDir.includes("desperately")) return "urgent";
  if (lowerDir.includes("fearful") || lowerDir.includes("scared")) return "fearful";
  if (lowerDir.includes("happy") || lowerDir.includes("joyfully")) return "happy";

  if (lowerText.includes("!") && lowerText.length < 50) return "excited";
  if (lowerText.includes("?!") || lowerText.includes("!?")) return "urgent";
  if (lowerText.endsWith("...")) return "sad";

  const exclamationCount = (lowerText.match(/!/g) || []).length;
  if (exclamationCount >= 2) return "angry";

  return "neutral";
}

export type SpeakResult = "success" | "error" | "unavailable";

interface SpeakOptions {
  characterName?: string;
  characterIndex?: number;
  emotion?: EmotionStyle;
  preset?: VoicePreset;
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

  async speakWithElevenLabs(
    text: string,
    options: SpeakOptions,
    onEnd?: (result: SpeakResult) => void
  ): Promise<boolean> {
    try {
      const response = await fetch("/api/tts/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          characterName: options.characterName || "Character",
          characterIndex: options.characterIndex || 0,
          emotion: options.emotion || "neutral",
          preset: options.preset || "natural",
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (error.fallback) {
          return false;
        }
        throw new Error(error.error || "TTS request failed");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      this.currentAudio = new Audio(audioUrl);
      this.currentAudio.volume = 1;

      return new Promise((resolve) => {
        if (!this.currentAudio) {
          onEnd?.("error");
          resolve(false);
          return;
        }

        this.currentAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          onEnd?.("success");
          this.currentAudio = null;
          resolve(true);
        };

        this.currentAudio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          onEnd?.("error");
          this.currentAudio = null;
          resolve(false);
        };

        this.currentAudio.play().catch(() => {
          URL.revokeObjectURL(audioUrl);
          onEnd?.("error");
          this.currentAudio = null;
          resolve(false);
        });
      });
    } catch (error) {
      console.error("ElevenLabs TTS error:", error);
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
