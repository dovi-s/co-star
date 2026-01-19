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

class TTSEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private onEndCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (this.synth) {
      this.voices = this.synth.getVoices();
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  speak(text: string, prosody: ProsodyParams, onEnd?: () => void): boolean {
    if (!this.synth) return false;

    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    
    const englishVoice = this.voices.find(
      v => v.lang.startsWith("en") && v.name.toLowerCase().includes("natural")
    ) || this.voices.find(v => v.lang.startsWith("en")) || this.voices[0];
    
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.rate = Math.max(0.5, Math.min(2, prosody.rate));
    utterance.pitch = Math.max(0, Math.min(2, 1 + prosody.pitch * 0.5));
    utterance.volume = Math.max(0, Math.min(1, prosody.volume));

    this.onEndCallback = onEnd ?? null;
    
    utterance.onend = () => {
      if (prosody.breakMs > 0) {
        setTimeout(() => {
          this.onEndCallback?.();
        }, prosody.breakMs);
      } else {
        this.onEndCallback?.();
      }
    };

    utterance.onerror = () => {
      this.onEndCallback?.();
    };

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
    return true;
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.currentUtterance = null;
  }

  pause() {
    if (this.synth) {
      this.synth.pause();
    }
  }

  resume() {
    if (this.synth) {
      this.synth.resume();
    }
  }

  get isSpeaking(): boolean {
    return this.synth?.speaking ?? false;
  }

  get isPaused(): boolean {
    return this.synth?.paused ?? false;
  }
}

export const ttsEngine = new TTSEngine();
