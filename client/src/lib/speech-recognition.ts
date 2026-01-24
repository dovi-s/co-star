export type SpeechRecognitionResult = {
  transcript: string;
  confidence: number;
  isFinal: boolean;
};

export type SpeechRecognitionState = "idle" | "listening" | "processing";

type SpeechRecognitionEventCallback = (result: SpeechRecognitionResult) => void;
type StateChangeCallback = (state: SpeechRecognitionState) => void;
type EndCallback = () => void;
type ErrorCallback = (error: string) => void;

class SpeechRecognitionEngine {
  private recognition: any = null;
  private isListening = false;
  private onResultCallback: SpeechRecognitionEventCallback | null = null;
  private onStateChangeCallback: StateChangeCallback | null = null;
  private onEndCallback: EndCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;
  private silenceTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxListenTimeout: ReturnType<typeof setTimeout> | null = null;
  private hasReceivedSpeech = false;
  private currentState: SpeechRecognitionState = "idle";
  private lastTranscript = "";

  constructor() {
    if (typeof window !== "undefined") {
      const SpeechRecognitionAPI = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        this.recognition = new SpeechRecognitionAPI();
        this.recognition.continuous = true;   // Continuous mode - keeps listening until we stop
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
          console.log("[Speech] Recognition started");
          this.isListening = true;
          this.hasReceivedSpeech = false;
          this.lastTranscript = "";
          this.setState("listening");
          
          // Max listen time of 45 seconds - plenty of time for longer lines
          this.clearMaxListenTimeout();
          this.maxListenTimeout = setTimeout(() => {
            console.log("[Speech] Max listen time reached, stopping");
            if (this.isListening) {
              this.stop();
            }
          }, 45000);
        };

        this.recognition.onend = () => {
          console.log("[Speech] Recognition ended, had speech:", this.hasReceivedSpeech);
          this.isListening = false;
          this.clearSilenceTimeout();
          this.clearMaxListenTimeout();
          this.setState("idle");
          
          // If we got speech but no final result yet, send the last transcript as final
          if (this.hasReceivedSpeech && this.lastTranscript) {
            console.log("[Speech] Sending last transcript as final:", this.lastTranscript);
            this.onResultCallback?.({
              transcript: this.lastTranscript,
              confidence: 0.8,
              isFinal: true,
            });
          }
          
          this.onEndCallback?.();
        };

        this.recognition.onerror = (event: any) => {
          console.log("[Speech] Error:", event.error);
          if (event.error !== "no-speech" && event.error !== "aborted") {
            this.onErrorCallback?.(event.error);
          }
          this.isListening = false;
          this.clearSilenceTimeout();
          this.clearMaxListenTimeout();
          this.setState("idle");
        };

        this.recognition.onresult = (event: any) => {
          this.hasReceivedSpeech = true;
          
          const result = event.results[event.results.length - 1];
          const transcript = result[0].transcript.trim();
          const confidence = result[0].confidence || 0.9;
          const isFinal = result.isFinal;
          
          console.log("[Speech] Result:", isFinal ? "FINAL" : "interim", transcript.substring(0, 50));

          // Store for potential recovery
          if (transcript.length > this.lastTranscript.length) {
            this.lastTranscript = transcript;
          }

          // Report all results
          if (transcript.length > 0) {
            this.onResultCallback?.({
              transcript,
              confidence,
              isFinal,
            });
          }

          // On final result, clear timeouts
          if (isFinal) {
            this.clearSilenceTimeout();
            this.clearMaxListenTimeout();
          } else {
            // Reset silence timeout on interim results
            this.resetSilenceTimeout();
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
    // 6 second silence after speaking = done (generous pause allowance)
    this.silenceTimeout = setTimeout(() => {
      if (this.isListening && this.hasReceivedSpeech) {
        console.log("[Speech] Silence timeout after speech, stopping");
        this.stop();
      }
    }, 6000);
  }

  private clearSilenceTimeout() {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  private clearMaxListenTimeout() {
    if (this.maxListenTimeout) {
      clearTimeout(this.maxListenTimeout);
      this.maxListenTimeout = null;
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

  onError(callback: ErrorCallback) {
    this.onErrorCallback = callback;
  }

  start(): boolean {
    if (!this.recognition) {
      console.log("[Speech] Recognition not available");
      return false;
    }

    if (this.isListening) {
      console.log("[Speech] Already listening");
      return true;
    }

    try {
      this.hasReceivedSpeech = false;
      this.lastTranscript = "";
      this.recognition.start();
      console.log("[Speech] Starting recognition");
      return true;
    } catch (e) {
      console.error("[Speech] Failed to start:", e);
      return false;
    }
  }

  stop() {
    console.log("[Speech] Stop requested, isListening:", this.isListening);
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.clearSilenceTimeout();
    this.clearMaxListenTimeout();
  }

  abort() {
    console.log("[Speech] Abort requested");
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {}
    }
    this.clearSilenceTimeout();
    this.clearMaxListenTimeout();
    this.isListening = false;
    this.lastTranscript = "";
    this.setState("idle");
  }
}

export const speechRecognition = new SpeechRecognitionEngine();
