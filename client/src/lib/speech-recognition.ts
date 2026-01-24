export type SpeechRecognitionResult = {
  transcript: string;
  confidence: number;
  isFinal: boolean;
};

export type SpeechRecognitionState = "idle" | "listening" | "processing";

type SpeechRecognitionEventCallback = (result: SpeechRecognitionResult) => void;
type StateChangeCallback = (state: SpeechRecognitionState) => void;
type EndCallback = () => void;

class SpeechRecognitionEngine {
  private recognition: any = null;
  private isListening = false;
  private onResultCallback: SpeechRecognitionEventCallback | null = null;
  private onStateChangeCallback: StateChangeCallback | null = null;
  private onEndCallback: EndCallback | null = null;
  private silenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private hasReceivedSpeech = false;
  private currentState: SpeechRecognitionState = "idle";

  constructor() {
    if (typeof window !== "undefined") {
      const SpeechRecognitionAPI = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        this.recognition = new SpeechRecognitionAPI();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
          this.isListening = true;
          this.hasReceivedSpeech = false;
          this.setState("listening");
        };

        this.recognition.onend = () => {
          this.isListening = false;
          this.clearSilenceTimeout();
          this.setState("idle");
          this.onEndCallback?.();
        };

        this.recognition.onerror = (event: any) => {
          if (event.error !== "no-speech" && event.error !== "aborted") {
            console.log("Speech recognition error:", event.error);
          }
          this.isListening = false;
          this.clearSilenceTimeout();
          this.setState("idle");
        };

        this.recognition.onresult = (event: any) => {
          this.hasReceivedSpeech = true;
          this.resetSilenceTimeout();

          const result = event.results[event.results.length - 1];
          const transcript = result[0].transcript.trim();
          const confidence = result[0].confidence || 0.9;
          const isFinal = result.isFinal;

          // Only report if there's actual content
          if (transcript.length > 0) {
            this.onResultCallback?.({
              transcript,
              confidence,
              isFinal,
            });
          }

          if (isFinal) {
            this.clearSilenceTimeout();
          }
        };
      }
    }
  }

  private setState(state: SpeechRecognitionState) {
    if (this.currentState !== state) {
      this.currentState = state;
      this.onStateChangeCallback?.(state);
    }
  }

  private resetSilenceTimeout() {
    this.clearSilenceTimeout();
    // Give user 2.5 seconds of silence before considering their speech complete
    // This allows for natural pauses in speech
    this.silenceTimeout = setTimeout(() => {
      if (this.isListening && this.hasReceivedSpeech) {
        this.stop();
      }
    }, 2500);
  }

  private clearSilenceTimeout() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  get available(): boolean {
    return this.recognition !== null;
  }

  get listening(): boolean {
    return this.isListening;
  }

  get state(): SpeechRecognitionState {
    return this.currentState;
  }

  onResult(callback: SpeechRecognitionEventCallback) {
    this.onResultCallback = callback;
  }

  onStateChange(callback: StateChangeCallback) {
    this.onStateChangeCallback = callback;
  }

  onEnd(callback: EndCallback) {
    this.onEndCallback = callback;
  }

  start(): boolean {
    if (!this.recognition) {
      return false;
    }

    if (this.isListening) {
      return true;
    }

    try {
      this.hasReceivedSpeech = false;
      this.recognition.start();
      return true;
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
      return false;
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.clearSilenceTimeout();
  }

  abort() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {}
    }
    this.clearSilenceTimeout();
    this.isListening = false;
    this.setState("idle");
  }
}

export const speechRecognition = new SpeechRecognitionEngine();
