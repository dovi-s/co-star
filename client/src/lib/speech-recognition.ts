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
  private SpeechRecognitionAPI: any = null;
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
  private isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  private isPWA = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  private noSpeechRestartCount = 0;
  private lastActivityTime = 0;
  private startTime = 0;
  private shouldAutoRestart = false;
  private lastResultTranscript = "";
  private restartDelay: ReturnType<typeof setTimeout> | null = null;
  private consecutiveErrors = 0;

  constructor() {
    if (typeof window !== "undefined") {
      this.SpeechRecognitionAPI = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;
      
      if (this.SpeechRecognitionAPI) {
        try {
          this.createRecognition();
          if (!this.recognition) {
            console.log("[Speech] Recognition instance creation failed, API unavailable");
            this.SpeechRecognitionAPI = null;
          }
        } catch (e) {
          console.log("[Speech] Recognition unavailable (likely iOS PWA):", e);
          this.SpeechRecognitionAPI = null;
          this.recognition = null;
        }
      }
      
      if (!this.SpeechRecognitionAPI && this.isIOS && this.isPWA) {
        console.log("[Speech] Web Speech API not available in iOS standalone/PWA mode");
      }
    }
  }

  private createRecognition() {
    if (!this.SpeechRecognitionAPI) return;
    
    try {
      this.recognition = new this.SpeechRecognitionAPI();
    } catch (e) {
      console.error("[Speech] Failed to create recognition instance:", e);
      this.recognition = null;
      return;
    }
    
    const useSingleShot = this.isSafari || this.isIOS;
    this.recognition.continuous = !useSingleShot;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    console.log("[Speech] Init: mobile:", this.isMobile, "iOS:", this.isIOS, "Safari:", this.isSafari, "PWA:", this.isPWA, "continuous:", this.recognition.continuous);

    this.recognition.onstart = () => {
      console.log("[Speech] Recognition started");
      this.isListening = true;
      this.hasReceivedSpeech = false;
      this.lastTranscript = "";
      this.lastResultTranscript = "";
      this.startTime = Date.now();
      this.lastActivityTime = Date.now();
      this.consecutiveErrors = 0;
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
      console.log("[Speech] Recognition ended, intentional:", wasIntentional, "had speech:", this.hasReceivedSpeech, "autoRestart:", this.shouldAutoRestart);
      this.isListening = false;
      this.intentionalStop = false;
      this.clearSilenceTimeout();
      this.stopWatchdog();

      if (wasIntentional) {
        this.clearMaxListenTimeout();
        this.shouldAutoRestart = false;
        
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
        
        this.setState("idle");
        this.onEndCallback?.();
        return;
      }

      if (this.shouldAutoRestart) {
        const delay = this.isSafari || this.isIOS ? 150 : 100;
        console.log("[Speech] Auto-restarting in", delay, "ms (single-shot cycle)");
        this.restartDelay = setTimeout(() => {
          this.restartDelay = null;
          if (this.shouldAutoRestart && !this.isListening) {
            this.startInternal();
          }
        }, delay);
        return;
      }
      
      this.clearMaxListenTimeout();
      this.setState("idle");
      this.onEndCallback?.();
    };

    this.recognition.onerror = (event: any) => {
      console.log("[Speech] Error:", event.error, "mobile:", this.isMobile, "iOS:", this.isIOS);
      this.consecutiveErrors++;
      
      if (event.error === "no-speech") {
        this.isListening = false;
        this.clearSilenceTimeout();
        this.stopWatchdog();
        
        const maxRetries = this.isMobile ? 15 : 5;
        this.noSpeechRestartCount++;
        if (this.noSpeechRestartCount < maxRetries && this.shouldAutoRestart) {
          console.log("[Speech] no-speech, auto-restart attempt:", this.noSpeechRestartCount, "/", maxRetries);
          const delay = this.isMobile ? 400 : 150;
          setTimeout(() => {
            if (!this.isListening && this.shouldAutoRestart) {
              this.startInternal();
            }
          }, delay);
        } else {
          console.log("[Speech] Too many no-speech restarts, giving up");
          this.noSpeechRestartCount = 0;
          this.shouldAutoRestart = false;
          this.clearMaxListenTimeout();
          this.setState("idle");
          this.onEndCallback?.();
        }
        return;
      }
      
      if (event.error === "network") {
        this.isListening = false;
        this.clearSilenceTimeout();
        this.stopWatchdog();
        console.log("[Speech] Network error, attempting restart");
        if (this.consecutiveErrors < 5 && this.shouldAutoRestart) {
          setTimeout(() => {
            if (!this.isListening && this.shouldAutoRestart) {
              this.recreateAndStart();
            }
          }, this.isMobile ? 800 : 500);
        } else {
          this.shouldAutoRestart = false;
          this.setState("idle");
          this.onEndCallback?.();
        }
        return;
      }

      if (event.error === "audio-capture") {
        console.log("[Speech] Audio capture error - mic may be in use or unavailable");
        this.isListening = false;
        this.clearSilenceTimeout();
        this.stopWatchdog();
        if (this.consecutiveErrors < 5 && this.shouldAutoRestart) {
          setTimeout(() => {
            if (!this.isListening && this.shouldAutoRestart) {
              this.recreateAndStart();
            }
          }, 1000);
        } else {
          this.shouldAutoRestart = false;
          this.setState("idle");
          this.onEndCallback?.();
        }
        return;
      }

      if (event.error === "not-allowed") {
        console.log("[Speech] Microphone permission denied");
        this.shouldAutoRestart = false;
        this.onErrorCallback?.("not-allowed");
      } else if (event.error === "service-not-allowed") {
        console.log("[Speech] Speech service not allowed, recreating");
        this.isListening = false;
        if (this.consecutiveErrors < 3 && this.shouldAutoRestart) {
          setTimeout(() => {
            if (!this.isListening && this.shouldAutoRestart) {
              this.recreateAndStart();
            }
          }, 500);
          return;
        }
        this.onErrorCallback?.(event.error);
      } else if (event.error !== "aborted") {
        this.onErrorCallback?.(event.error);
      }
      
      this.isListening = false;
      this.clearSilenceTimeout();
      this.clearMaxListenTimeout();
      this.stopWatchdog();
      this.shouldAutoRestart = false;
      this.setState("idle");
    };

    this.recognition.onresult = (event: any) => {
      this.hasReceivedSpeech = true;
      this.noSpeechRestartCount = 0;
      this.consecutiveErrors = 0;
      this.lastActivityTime = Date.now();
      
      const useSingleShot = this.isSafari || this.isIOS;

      if (useSingleShot) {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        fullTranscript = fullTranscript.trim();
        
        const lastResult = event.results[event.results.length - 1];
        const isFinal = lastResult.isFinal;
        const confidence = lastResult[0].confidence || 0.9;

        if (fullTranscript === this.lastResultTranscript && !isFinal) {
          return;
        }
        this.lastResultTranscript = fullTranscript;

        const accumulated = [
          ...this.finalizedSegments,
          ...(fullTranscript.length > 0 ? [fullTranscript] : [])
        ].join(" ").trim();

        this.accumulatedTranscript = accumulated;
        
        if (fullTranscript.length > this.lastTranscript.length) {
          this.lastTranscript = fullTranscript;
        }

        console.log("[Speech] Result (Safari):", isFinal ? "FINAL" : "interim",
          "segment:", fullTranscript.substring(0, 30),
          "accumulated:", accumulated.substring(0, 50));

        if (accumulated.length > 0) {
          this.onResultCallback?.({
            transcript: accumulated,
            confidence,
            isFinal: false,
          });
        }

        if (isFinal && fullTranscript.length > 0) {
          this.finalizedSegments.push(fullTranscript);
          this.accumulatedTranscript = this.finalizedSegments.join(" ").trim();
        }

        this.resetSilenceTimeout();
      } else {
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
      }
    };
  }

  private recreateAndStart() {
    console.log("[Speech] Recreating recognition instance");
    try {
      if (this.recognition) {
        try { this.recognition.abort(); } catch {}
      }
      this.isListening = false;
      this.createRecognition();
      if (this.recognition) {
        this.startInternal();
      }
    } catch (e) {
      console.error("[Speech] Failed to recreate:", e);
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
        console.log("[Speech] Watchdog: recognition stalled (no speech received), recreating");
        try {
          this.recognition?.abort();
        } catch {}
        this.isListening = false;
        this.setState("idle");
        this.stopWatchdog();
        setTimeout(() => {
          if (!this.isListening && this.shouldAutoRestart) {
            this.recreateAndStart();
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
    return this.SpeechRecognitionAPI !== null;
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

  get isIOSPWANoSpeech(): boolean {
    return this.isIOS && this.isPWA && !this.SpeechRecognitionAPI;
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
    if (!this.SpeechRecognitionAPI) return false;
    
    if (!this.recognition) {
      this.createRecognition();
    }
    if (!this.recognition) return false;
    
    if (this.isListening) return true;
    try {
      this.hasReceivedSpeech = false;
      this.lastTranscript = "";
      this.lastResultTranscript = "";
      this.lastActivityTime = Date.now();
      this.recognition.start();
      console.log("[Speech] Starting recognition (internal)");
      return true;
    } catch (e: any) {
      console.error("[Speech] Failed to start:", e?.message || e);
      
      if (e?.message?.includes("already started") || e?.name === "InvalidStateError") {
        this.isListening = true;
        return true;
      }
      
      if (this.isMobile || this.isSafari) {
        setTimeout(() => {
          if (!this.isListening && this.shouldAutoRestart) {
            this.recreateAndStart();
          }
        }, 500);
      }
      return false;
    }
  }

  start(): boolean {
    if (!this.SpeechRecognitionAPI) {
      console.log("[Speech] Recognition API not available");
      return false;
    }

    if (this.isListening) {
      console.log("[Speech] Already listening");
      return true;
    }

    this.noSpeechRestartCount = 0;
    this.consecutiveErrors = 0;
    this.shouldAutoRestart = true;
    return this.startInternal();
  }

  stop() {
    console.log("[Speech] Stop requested, isListening:", this.isListening);
    this.intentionalStop = true;
    this.shouldAutoRestart = false;
    this.stopWatchdog();
    
    if (this.restartDelay) {
      clearTimeout(this.restartDelay);
      this.restartDelay = null;
    }
    
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    } else if (this.intentionalStop && !this.isListening) {
      this.intentionalStop = false;
      if (this.accumulatedTranscript) {
        this.onResultCallback?.({
          transcript: this.accumulatedTranscript,
          confidence: 0.8,
          isFinal: true,
        });
      }
      this.setState("idle");
      this.onEndCallback?.();
    }
    this.clearSilenceTimeout();
    this.clearMaxListenTimeout();
  }

  abort() {
    console.log("[Speech] Abort requested");
    this.shouldAutoRestart = false;
    this.stopWatchdog();
    
    if (this.restartDelay) {
      clearTimeout(this.restartDelay);
      this.restartDelay = null;
    }
    
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
