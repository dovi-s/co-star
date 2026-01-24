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

  // Check stage directions first - most reliable
  const whisperWords = ["whisper", "quietly", "softly", "under breath", "hushed", "murmur", "muttering"];
  const angryWords = ["angry", "angrily", "furious", "rage", "yelling", "shouting", "screaming", "snapping", "frustrated", "irritated", "seething", "livid"];
  const sarcasticWords = ["sarcastic", "sarcastically", "mockingly", "dryly", "deadpan", "ironic", "cynical", "snide", "eye roll", "rolling eyes"];
  const sadWords = ["sad", "sadly", "tearfully", "crying", "sobbing", "choking up", "voice breaking", "trembling", "devastated", "heartbroken", "grief", "mournful"];
  const excitedWords = ["excited", "excitedly", "enthusiastic", "thrilled", "giddy", "beaming", "gleeful", "ecstatic", "bouncing", "jumping"];
  const urgentWords = ["urgent", "urgently", "desperately", "panicked", "frantic", "rushing", "hurried", "breathless", "alarmed"];
  const fearfulWords = ["fearful", "scared", "terrified", "trembling", "shaking", "nervous", "anxious", "worried", "frightened", "horrified", "cowering"];
  const happyWords = ["happy", "happily", "joyful", "joyfully", "laughing", "smiling", "grinning", "delighted", "amused", "chuckling", "giggling"];

  if (whisperWords.some(w => lowerDir.includes(w))) return "whisper";
  if (angryWords.some(w => lowerDir.includes(w))) return "angry";
  if (sarcasticWords.some(w => lowerDir.includes(w))) return "sarcastic";
  if (sadWords.some(w => lowerDir.includes(w))) return "sad";
  if (excitedWords.some(w => lowerDir.includes(w))) return "excited";
  if (urgentWords.some(w => lowerDir.includes(w))) return "urgent";
  if (fearfulWords.some(w => lowerDir.includes(w))) return "fearful";
  if (happyWords.some(w => lowerDir.includes(w))) return "happy";

  // Analyze text content for implicit emotions
  const allCaps = text === text.toUpperCase() && text.length > 3;
  const exclamationCount = (lowerText.match(/!/g) || []).length;
  const questionCount = (lowerText.match(/\?/g) || []).length;
  
  if (allCaps && exclamationCount >= 1) return "angry";
  if (lowerText.includes("?!") || lowerText.includes("!?")) return "urgent";
  if (exclamationCount >= 2) return "excited";
  if (lowerText.endsWith("...") && lowerText.length < 30) return "sad";
  
  // Check for emotional words in the dialogue itself
  if (/\b(help|run|stop|no|wait)\b/i.test(text) && exclamationCount >= 1) return "urgent";
  if (/\b(please|sorry|forgive|miss you|love you)\b/i.test(text) && lowerText.includes("...")) return "sad";
  if (/\b(oh god|oh no|what the|holy)\b/i.test(text)) return "fearful";
  if (/\b(haha|lol|funny|hilarious)\b/i.test(text)) return "happy";
  
  if (exclamationCount === 1 && lowerText.length < 50) return "excited";

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
