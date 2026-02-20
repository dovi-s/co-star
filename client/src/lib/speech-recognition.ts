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
  private accumulatedTranscript = "";
  private finalizedSegments: string[] = [];
  private intentionalStop = false;
  private isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  private noSpeechRestartCount = 0;

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
          console.log("[Speech] Recognition started, preserving accumulated:", this.accumulatedTranscript.length, "chars");
          this.isListening = true;
          this.hasReceivedSpeech = false;
          this.lastTranscript = "";
          this.setState("listening");
          
          // Max listen time of 90 seconds - plenty of time for very long monologues
          this.clearMaxListenTimeout();
          this.maxListenTimeout = setTimeout(() => {
            console.log("[Speech] Max listen time reached, stopping");
            if (this.isListening) {
              this.stop();
            }
          }, 90000);
        };

        this.recognition.onend = () => {
          const wasIntentional = this.intentionalStop;
          console.log("[Speech] Recognition ended, intentional:", wasIntentional, "had speech:", this.hasReceivedSpeech, "accumulated:", this.accumulatedTranscript.length, "chars", "mobile:", this.isMobile);
          this.isListening = false;
          this.intentionalStop = false;
          this.clearSilenceTimeout();
          this.clearMaxListenTimeout();
          this.setState("idle");
          
          if (wasIntentional) {
            if (this.hasReceivedSpeech && this.lastTranscript && !this.accumulatedTranscript.includes(this.lastTranscript)) {
              this.finalizedSegments.push(this.lastTranscript);
              this.accumulatedTranscript = this.finalizedSegments.join(" ").trim();
            }
            
            if (this.accumulatedTranscript) {
              this.onResultCallback?.({
                transcript: this.accumulatedTranscript,
                confidence: 0.8,
                isFinal: true,
              });
            }
          }
          
          this.onEndCallback?.();
        };

        this.recognition.onerror = (event: any) => {
          console.log("[Speech] Error:", event.error, "mobile:", this.isMobile);
          
          if (event.error === "no-speech") {
            this.isListening = false;
            this.clearSilenceTimeout();
            this.clearMaxListenTimeout();
            this.setState("idle");
            
            this.noSpeechRestartCount++;
            if (this.noSpeechRestartCount < 5) {
              console.log("[Speech] no-speech on mobile, auto-restart attempt:", this.noSpeechRestartCount);
              const delay = this.isMobile ? 300 : 150;
              setTimeout(() => {
                if (!this.isListening) {
                  this.startInternal();
                }
              }, delay);
            } else {
              console.log("[Speech] Too many no-speech restarts, giving up");
              this.noSpeechRestartCount = 0;
              this.onEndCallback?.();
            }
            return;
          }
          
          if (event.error === "network") {
            this.isListening = false;
            this.clearSilenceTimeout();
            this.clearMaxListenTimeout();
            this.setState("idle");
            console.log("[Speech] Network error, attempting restart");
            setTimeout(() => {
              if (!this.isListening) {
                this.startInternal();
              }
            }, 500);
            return;
          }
          
          if (event.error !== "aborted") {
            this.onErrorCallback?.(event.error);
          }
          this.isListening = false;
          this.clearSilenceTimeout();
          this.clearMaxListenTimeout();
          this.setState("idle");
        };

        this.recognition.onresult = (event: any) => {
          this.hasReceivedSpeech = true;
          this.noSpeechRestartCount = 0;
          
          const result = event.results[event.results.length - 1];
          const transcript = result[0].transcript.trim();
          const confidence = result[0].confidence || 0.9;
          const isFinal = result.isFinal;
          
          if (isFinal && transcript.length > 0) {
            this.finalizedSegments.push(transcript);
          }
          
          const accumulated = [
            ...this.finalizedSegments,
            ...(isFinal ? [] : (transcript.length > 0 ? [transcript] : []))
          ].join(" ").trim();
          
          this.accumulatedTranscript = accumulated;
          
          console.log("[Speech] Result:", isFinal ? "FINAL" : "interim", 
            "segment:", transcript.substring(0, 30),
            "accumulated:", accumulated.substring(0, 50));

          if (transcript.length > this.lastTranscript.length) {
            this.lastTranscript = transcript;
          }

          if (accumulated.length > 0) {
            this.onResultCallback?.({
              transcript: accumulated,
              confidence,
              isFinal,
            });
          }

          if (isFinal) {
            this.clearSilenceTimeout();
            this.resetSilenceTimeout();
          } else {
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
    this.silenceTimeout = setTimeout(() => {
      if (this.isListening && this.hasReceivedSpeech) {
        console.log("[Speech] Silence timeout after speech, stopping");
        this.stop();
      }
    }, 3000);
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

  resetAccumulated() {
    this.accumulatedTranscript = "";
    this.finalizedSegments = [];
  }

  get accumulated(): string {
    return this.accumulatedTranscript;
  }

  private startInternal(): boolean {
    if (!this.recognition) return false;
    if (this.isListening) return true;
    try {
      this.hasReceivedSpeech = false;
      this.lastTranscript = "";
      this.recognition.start();
      console.log("[Speech] Starting recognition (internal)");
      return true;
    } catch (e) {
      console.error("[Speech] Failed to start:", e);
      return false;
    }
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

    this.noSpeechRestartCount = 0;
    return this.startInternal();
  }

  stop() {
    console.log("[Speech] Stop requested, isListening:", this.isListening);
    this.intentionalStop = true;
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
    this.accumulatedTranscript = "";
    this.finalizedSegments = [];
    this.setState("idle");
  }
}

export const speechRecognition = new SpeechRecognitionEngine();
