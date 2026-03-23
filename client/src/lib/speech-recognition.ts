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
  private resultOffset = 0;
  private isPaused = false;
  private startupHeartbeat: ReturnType<typeof setTimeout> | null = null;
  private micStream: MediaStream | null = null;
  private startGeneration = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.SpeechRecognitionAPI = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;
      
      if (this.SpeechRecognitionAPI) {
        try {
          this.createRecognition();
          if (!this.recognition) {
            this.SpeechRecognitionAPI = null;
          }
        } catch (e) {
          this.SpeechRecognitionAPI = null;
          this.recognition = null;
        }
      }
      
      if (!this.SpeechRecognitionAPI && this.isIOS && this.isPWA) {
      }

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.abort();
        }
      });
      window.addEventListener('pagehide', () => {
        this.abort();
      });
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
    
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.isPaused = false;
      this.hasReceivedSpeech = false;
      this.lastTranscript = "";
      this.lastResultTranscript = "";
      this.resultOffset = 0;
      this.startTime = Date.now();
      this.lastActivityTime = Date.now();
      this.consecutiveErrors = 0;
      this.setState("listening");
      
      this.clearMaxListenTimeout();
      this.maxListenTimeout = setTimeout(() => {
        if (this.isListening) {
          this.stop();
        }
      }, 90000);

      this.startWatchdog();

      this.clearStartupHeartbeat();
      if (this.isPWA || this.isMobile) {
        this.startupHeartbeat = setTimeout(() => {
          this.startupHeartbeat = null;
          if (this.isListening && !this.hasReceivedSpeech && this.shouldAutoRestart && !this.isPaused) {
            try { this.recognition?.abort(); } catch {}
            this.isListening = false;
            setTimeout(() => {
              if (this.shouldAutoRestart && !this.isPaused && !this.isListening) {
                this.recreateAndStart();
              }
            }, 300);
          }
        }, 4000);
      }
    };

    this.recognition.onend = () => {
      const wasIntentional = this.intentionalStop;
      const wasPaused = this.isPaused;
      this.isListening = false;
      this.intentionalStop = false;
      this.clearSilenceTimeout();
      this.stopWatchdog();

      if (wasPaused) {
        this.clearMaxListenTimeout();
        this.shouldAutoRestart = false;
        this.setState("idle");
        return;
      }

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
        const delay = this.isMobile ? 200 : 100;
        this.restartDelay = setTimeout(() => {
          this.restartDelay = null;
          if (this.shouldAutoRestart && !this.isListening) {
            this.recreateAndStart();
          }
        }, delay);
        return;
      }
      
      this.clearMaxListenTimeout();
      this.setState("idle");
      this.onEndCallback?.();
    };

    this.recognition.onerror = (event: any) => {
      this.consecutiveErrors++;
      
      if (event.error === "aborted") {
        this.isListening = false;
        this.clearSilenceTimeout();
        this.stopWatchdog();
        return;
      }
      
      if (event.error === "no-speech") {
        this.isListening = false;
        this.clearSilenceTimeout();
        this.stopWatchdog();
        
        const maxRetries = this.isMobile ? 20 : 5;
        this.noSpeechRestartCount++;
        if (this.noSpeechRestartCount < maxRetries && this.shouldAutoRestart) {
          const delay = this.isMobile ? 300 : 150;
          setTimeout(() => {
            if (!this.isListening && this.shouldAutoRestart) {
              this.recreateAndStart();
            }
          }, delay);
        } else {
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
        if (this.consecutiveErrors < 8 && this.shouldAutoRestart) {
          setTimeout(() => {
            if (!this.isListening && this.shouldAutoRestart) {
              this.recreateAndStart();
            }
          }, this.isMobile ? 600 : 400);
        } else {
          this.shouldAutoRestart = false;
          this.setState("idle");
          this.onEndCallback?.();
        }
        return;
      }

      if (event.error === "audio-capture") {
        this.isListening = false;
        this.clearSilenceTimeout();
        this.stopWatchdog();
        if (this.consecutiveErrors < 8 && this.shouldAutoRestart) {
          setTimeout(() => {
            if (!this.isListening && this.shouldAutoRestart) {
              this.recreateAndStart();
            }
          }, 800);
        } else {
          this.shouldAutoRestart = false;
          this.setState("idle");
          this.onEndCallback?.();
        }
        return;
      }

      if (event.error === "not-allowed") {
        this.shouldAutoRestart = false;
        this.onErrorCallback?.("not-allowed");
      } else if (event.error === "service-not-allowed") {
        this.isListening = false;
        if (this.consecutiveErrors < 5 && this.shouldAutoRestart) {
          setTimeout(() => {
            if (!this.isListening && this.shouldAutoRestart) {
              this.recreateAndStart();
            }
          }, 500);
          return;
        }
        this.onErrorCallback?.(event.error);
      } else {
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
      if (this.isPaused) return;

      this.hasReceivedSpeech = true;
      this.noSpeechRestartCount = 0;
      this.consecutiveErrors = 0;
      this.lastActivityTime = Date.now();
      this.clearStartupHeartbeat();

      let currentTranscript = "";
      let latestIsFinal = false;
      let latestConfidence = 0.9;

      for (let i = this.resultOffset; i < event.results.length; i++) {
        const res = event.results[i];
        currentTranscript += res[0].transcript;
        if (i === event.results.length - 1) {
          latestIsFinal = res.isFinal;
          latestConfidence = res[0].confidence || 0.9;
        }
      }
      currentTranscript = currentTranscript.trim();

      if (currentTranscript.length === 0) {
        this.resetSilenceTimeout();
        return;
      }

      if (currentTranscript === this.lastResultTranscript && !latestIsFinal) {
        return;
      }
      this.lastResultTranscript = currentTranscript;

      if (currentTranscript.length > this.lastTranscript.length) {
        this.lastTranscript = currentTranscript;
      }

      const accumulated = [
        ...this.finalizedSegments,
        currentTranscript,
      ].join(" ").trim();

      this.accumulatedTranscript = accumulated;

      if (latestIsFinal) {
        this.finalizedSegments.push(currentTranscript);
        this.accumulatedTranscript = this.finalizedSegments.join(" ").trim();
        this.resultOffset = event.results.length;
        this.lastTranscript = "";
        this.lastResultTranscript = "";
      }

      if (accumulated.length > 0) {
        this.onResultCallback?.({
          transcript: latestIsFinal ? this.accumulatedTranscript : accumulated,
          confidence: latestConfidence,
          isFinal: latestIsFinal,
        });
      }

      this.resetSilenceTimeout();
    };
  }

  private recreateAndStart() {
    try {
      if (this.recognition) {
        try {
          this.recognition.onstart = null;
          this.recognition.onend = null;
          this.recognition.onerror = null;
          this.recognition.onresult = null;
        } catch {}
        try { this.recognition.abort(); } catch {}
        this.recognition = null;
      }
      this.isListening = false;
      this.isPaused = false;
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
    const timeout = this.isMobile ? 5000 : 3000;
    this.silenceTimeout = setTimeout(() => {
      if (this.isListening && this.hasReceivedSpeech && !this.isPaused) {
        if (this.lastTranscript && !this.accumulatedTranscript.includes(this.lastTranscript)) {
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
        this.hasReceivedSpeech = false;
        this.lastTranscript = "";
        this.lastResultTranscript = "";
        this.setState("listening");
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

  private clearStartupHeartbeat() {
    if (this.startupHeartbeat) {
      clearTimeout(this.startupHeartbeat);
      this.startupHeartbeat = null;
    }
  }

  private releaseMicStream() {
    if (this.micStream) {
      try { this.micStream.getTracks().forEach(t => t.stop()); } catch {}
      this.micStream = null;
    }
  }

  private clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private startWatchdog() {
    this.stopWatchdog();
    if (!this.isMobile) return;

    this.watchdogInterval = setInterval(() => {
      if (!this.isListening || this.isPaused) {
        this.stopWatchdog();
        return;
      }

      if (this.hasReceivedSpeech) {
        return;
      }

      const timeSinceActivity = Date.now() - this.lastActivityTime;
      const timeSinceStart = Date.now() - this.startTime;

      if (timeSinceStart > 5000 && timeSinceActivity > 10000) {
        try {
          this.recognition?.abort();
        } catch {}
        this.isListening = false;
        this.setState("idle");
        this.stopWatchdog();
        setTimeout(() => {
          if (!this.isListening && this.shouldAutoRestart && !this.isPaused) {
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
      this.isPaused = false;
      this.recognition.start();
      return true;
    } catch (e: any) {
      console.error("[Speech] Failed to start:", e?.message || e);
      
      if (e?.message?.includes("already started") || e?.name === "InvalidStateError") {
        this.isListening = true;
        this.isPaused = false;
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
      return false;
    }

    if (this.isListening) {
      return true;
    }

    this.noSpeechRestartCount = 0;
    this.consecutiveErrors = 0;
    this.shouldAutoRestart = true;
    return this.startInternal();
  }

  private get usesContinuousMode(): boolean {
    return !!this.recognition?.continuous;
  }

  pause() {
    this.startGeneration++;
    this.shouldAutoRestart = false;
    this.isPaused = true;
    this.clearSilenceTimeout();
    this.stopWatchdog();
    this.clearMaxListenTimeout();
    this.clearStartupHeartbeat();
    this.clearRetryTimer();
    this.releaseMicStream();
    if (this.restartDelay) {
      clearTimeout(this.restartDelay);
      this.restartDelay = null;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch {}
    }
    this.isListening = false;
    this.resetAccumulated();
    this.setState("idle");
  }

  softStart(preserveTranscript = false): boolean {
    if (!this.SpeechRecognitionAPI) return false;

    this.startGeneration++;
    const gen = this.startGeneration;

    this.isPaused = false;
    this.noSpeechRestartCount = 0;
    this.consecutiveErrors = 0;
    this.shouldAutoRestart = true;
    this.clearStartupHeartbeat();
    this.clearRetryTimer();

    if (this.restartDelay) {
      clearTimeout(this.restartDelay);
      this.restartDelay = null;
    }

    if (!preserveTranscript) {
      this.resetAccumulated();
    }
    this.releaseMicStream();

    if (this.recognition && this.isListening) {
      try { this.recognition.abort(); } catch {}
      this.isListening = false;
    }

    if (this.isPWA && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        if (gen !== this.startGeneration) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        this.micStream = stream;
        this.recreateAndStart();
        setTimeout(() => {
          if (this.micStream === stream) {
            stream.getTracks().forEach(t => t.stop());
            this.micStream = null;
          }
        }, 2000);
      }).catch(() => {
        if (gen !== this.startGeneration) return;
        this.recreateAndStart();
      });
    } else {
      this.recreateAndStart();
    }

    const initialDelay = this.isPWA ? 1500 : 800;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (gen !== this.startGeneration) return;
      if (this.isListening || !this.shouldAutoRestart || this.isPaused) return;
      const maxAttempts = this.isPWA ? 8 : 5;
      const verifyStart = (attempt: number) => {
        if (gen !== this.startGeneration) return;
        if (this.isListening || !this.shouldAutoRestart || this.isPaused || attempt >= maxAttempts) return;
        this.recreateAndStart();
        const nextDelay = attempt < 3 ? 600 : 1200;
        setTimeout(() => verifyStart(attempt + 1), nextDelay);
      };
      verifyStart(0);
    }, initialDelay);

    return true;
  }

  stop() {
    this.startGeneration++;
    this.intentionalStop = true;
    this.shouldAutoRestart = false;
    this.isPaused = false;
    this.stopWatchdog();
    this.clearStartupHeartbeat();
    this.clearRetryTimer();
    this.releaseMicStream();
    
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
    this.startGeneration++;
    this.shouldAutoRestart = false;
    this.isPaused = false;
    this.stopWatchdog();
    this.clearStartupHeartbeat();
    this.clearRetryTimer();
    this.releaseMicStream();
    
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
    this.resultOffset = 0;
    this.setState("idle");
  }
}

export const speechRecognition = new SpeechRecognitionEngine();
