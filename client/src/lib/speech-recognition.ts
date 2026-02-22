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
  private watchdogInterval: ReturnType<typeof setInterval> | null = null;
  private hasReceivedSpeech = false;
  private currentState: SpeechRecognitionState = "idle";
  private lastTranscript = "";
  private accumulatedTranscript = "";
  private finalizedSegments: string[] = [];
  private intentionalStop = false;
  private isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  private isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  private isPWA = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  private noSpeechRestartCount = 0;
  private lastActivityTime = 0;
  private startTime = 0;

  constructor() {
    if (typeof window !== "undefined") {
      const SpeechRecognitionAPI = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        this.recognition = new SpeechRecognitionAPI();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
          console.log("[Speech] Recognition started, mobile:", this.isMobile, "iOS:", this.isIOS, "PWA:", this.isPWA);
          this.isListening = true;
          this.hasReceivedSpeech = false;
          this.lastTranscript = "";
          this.startTime = Date.now();
          this.lastActivityTime = Date.now();
          this.setState("listening");
          
          this.clearMaxListenTimeout();
          this.maxListenTimeout = setTimeout(() => {
            console.log("[Speech] Max listen time reached, stopping");
            if (this.isListening) {
              this.stop();
            }
          }, 90000);

          this.startWatchdog();
        };

        this.recognition.onend = () => {
          const wasIntentional = this.intentionalStop;
          console.log("[Speech] Recognition ended, intentional:", wasIntentional, "had speech:", this.hasReceivedSpeech, "mobile:", this.isMobile);
          this.isListening = false;
          this.intentionalStop = false;
          this.clearSilenceTimeout();
          this.clearMaxListenTimeout();
          this.stopWatchdog();
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
          console.log("[Speech] Error:", event.error, "mobile:", this.isMobile, "iOS:", this.isIOS);
          
          if (event.error === "no-speech") {
            this.isListening = false;
            this.clearSilenceTimeout();
            this.clearMaxListenTimeout();
            this.stopWatchdog();
            this.setState("idle");
            
            const maxRetries = this.isMobile ? 15 : 5;
            this.noSpeechRestartCount++;
            if (this.noSpeechRestartCount < maxRetries) {
              console.log("[Speech] no-speech, auto-restart attempt:", this.noSpeechRestartCount, "/", maxRetries);
              const delay = this.isMobile ? 400 : 150;
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
            this.stopWatchdog();
            this.setState("idle");
            console.log("[Speech] Network error, attempting restart");
            setTimeout(() => {
              if (!this.isListening) {
                this.startInternal();
              }
            }, this.isMobile ? 800 : 500);
            return;
          }

          if (event.error === "audio-capture") {
            console.log("[Speech] Audio capture error - mic may be in use or unavailable");
            this.isListening = false;
            this.clearSilenceTimeout();
            this.clearMaxListenTimeout();
            this.stopWatchdog();
            this.setState("idle");
            setTimeout(() => {
              if (!this.isListening) {
                this.startInternal();
              }
            }, 1000);
            return;
          }
          
          if (event.error !== "aborted") {
            this.onErrorCallback?.(event.error);
          }
          this.isListening = false;
          this.clearSilenceTimeout();
          this.clearMaxListenTimeout();
          this.stopWatchdog();
          this.setState("idle");
        };

        this.recognition.onresult = (event: any) => {
          this.hasReceivedSpeech = true;
          this.noSpeechRestartCount = 0;
          this.lastActivityTime = Date.now();
          
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
    const timeout = this.isMobile ? 2500 : 1500;
    this.silenceTimeout = setTimeout(() => {
      if (this.isListening && this.hasReceivedSpeech) {
        console.log("[Speech] Silence timeout after speech, stopping");
        this.stop();
      }
    }, timeout);
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

  private startWatchdog() {
    this.stopWatchdog();
    if (!this.isMobile) return;

    this.watchdogInterval = setInterval(() => {
      if (!this.isListening) {
        this.stopWatchdog();
        return;
      }

      if (this.hasReceivedSpeech) {
        return;
      }

      const timeSinceActivity = Date.now() - this.lastActivityTime;
      const timeSinceStart = Date.now() - this.startTime;

      if (timeSinceStart > 5000 && timeSinceActivity > 10000) {
        console.log("[Speech] Watchdog: recognition stalled (no speech received), restarting");
        try {
          this.recognition?.abort();
        } catch {}
        this.isListening = false;
        this.setState("idle");
        this.stopWatchdog();
        setTimeout(() => {
          if (!this.isListening) {
            this.startInternal();
          }
        }, 500);
      }
    }, 3000);
  }

  private stopWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
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

  get isIOSPWA(): boolean {
    return this.isIOS && this.isPWA;
  }

  get isMobileDevice(): boolean {
    return this.isMobile;
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
      this.lastActivityTime = Date.now();
      this.recognition.start();
      console.log("[Speech] Starting recognition (internal)");
      return true;
    } catch (e) {
      console.error("[Speech] Failed to start:", e);
      if (this.isMobile) {
        setTimeout(() => {
          if (!this.isListening) {
            try {
              this.recognition.start();
              console.log("[Speech] Retry start succeeded");
            } catch (e2) {
              console.error("[Speech] Retry start also failed:", e2);
            }
          }
        }, 500);
      }
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
    this.stopWatchdog();
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
    this.stopWatchdog();
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
