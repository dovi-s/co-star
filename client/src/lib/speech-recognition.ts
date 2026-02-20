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
          console.log("[Speech] Recognition ended, had speech:", this.hasReceivedSpeech, "accumulated:", this.accumulatedTranscript.length, "chars");
          this.isListening = false;
          this.clearSilenceTimeout();
          this.clearMaxListenTimeout();
          this.setState("idle");
          
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
    this.accumulatedTranscript = "";
    this.finalizedSegments = [];
    this.setState("idle");
  }
}

export const speechRecognition = new SpeechRecognitionEngine();
