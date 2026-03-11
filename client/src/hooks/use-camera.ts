import { useState, useRef, useCallback, useEffect } from 'react';
import { ttsEngine } from '@/lib/tts-engine';

export interface CameraState {
  isEnabled: boolean;
  isRecording: boolean;
  recordingTime: number;
  stream: MediaStream | null;
  error: string | null;
  hasRecording: boolean;
  recordingBlob: Blob | null;
  earbudsOnly: boolean;
}

export function useCamera() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [earbudsOnly, setEarbudsOnly] = useState(() => {
    try { return localStorage.getItem("costar-earbuds-only") === "true"; } catch { return false; }
  });
  const earbudsOnlyRef = useRef(earbudsOnly);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mimeTypeRef = useRef<string>('video/webm');
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingMicStreamRef = useRef<MediaStream | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const pendingDownloadRef = useRef(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      setStream(mediaStream);
      setIsEnabled(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('[Camera] Error starting camera:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else {
          setError('Could not access camera.');
        }
      }
      setIsEnabled(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsEnabled(false);
  }, [stream]);

  const toggleCamera = useCallback(async () => {
    if (isEnabled) {
      stopCamera();
    } else {
      await startCamera();
    }
  }, [isEnabled, startCamera, stopCamera]);

  const toggleEarbudsOnly = useCallback((enabled: boolean) => {
    setEarbudsOnly(enabled);
    earbudsOnlyRef.current = enabled;
    try { localStorage.setItem("costar-earbuds-only", String(enabled)); } catch {}
  }, []);

  const buildMixedAudioStream = useCallback(async (): Promise<{ stream: MediaStream; cleanup: () => void }> => {
    const audioContext = new AudioContext();
    recordingAudioContextRef.current = audioContext;
    const destination = audioContext.createMediaStreamDestination();

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    let micStream: MediaStream | null = null;

    if (isEnabled && stream) {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const micSource = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
        micSource.connect(destination);
        console.log('[Camera] Mixed mic audio from camera stream');
      }
    } else {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordingMicStreamRef.current = micStream;
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);
        console.log('[Camera] Mixed mic audio from separate stream');
      } catch (e) {
        console.log('[Camera] No mic available for recording:', e);
      }
    }

    if (earbudsOnlyRef.current) {
      console.log('[Camera] Earbuds-only mode: TTS audio excluded from recording');
    } else {
      ttsEngine.initAudioContext();
      const ttsStream = ttsEngine.getTTSAudioStream();
      if (ttsStream && ttsStream.getAudioTracks().length > 0) {
        const ttsSource = audioContext.createMediaStreamSource(ttsStream);
        ttsSource.connect(destination);
        console.log('[Camera] Mixed TTS audio into recording');
      } else {
        console.log('[Camera] No TTS audio stream available');
      }
    }

    const cleanup = () => {
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
      }
      recordingMicStreamRef.current = null;
      audioContext.close().catch(() => {});
      recordingAudioContextRef.current = null;
    };

    return { stream: destination.stream, cleanup };
  }, [isEnabled, stream]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      recordingChunksRef.current = [];
      setRecordingTime(0);
      setHasRecording(false);
      setRecordingBlob(null);
      setShowDiscardPrompt(false);

      const { stream: mixedAudio, cleanup: audioCleanup } = await buildMixedAudioStream();
      audioCleanupRef.current = audioCleanup;

      let recordingStream: MediaStream;

      if (isEnabled && screenCanvasRef.current) {
        const canvasStream = screenCanvasRef.current.captureStream(30);
        recordingStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...mixedAudio.getAudioTracks(),
        ]);
        console.log('[Camera] Starting video + mixed audio recording');
      } else {
        recordingStream = mixedAudio;
        console.log('[Camera] Starting audio-only recording');
      }

      const hasVideo = recordingStream.getVideoTracks().length > 0;
      
      const videoFormats = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm',
      ];
      const audioFormats = [
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];
      
      const candidates = hasVideo ? videoFormats : audioFormats;
      let mimeType = candidates.find(fmt => {
        try { return MediaRecorder.isTypeSupported(fmt); } catch { return false; }
      });
      if (!mimeType) {
        const fallback = hasVideo ? audioFormats : [];
        mimeType = fallback.find(fmt => {
          try { return MediaRecorder.isTypeSupported(fmt); } catch { return false; }
        });
        if (mimeType && hasVideo) {
          recordingStream = mixedAudio;
          console.log('[Camera] Video recording not supported, falling back to audio-only');
        }
      }
      if (!mimeType) {
        console.log('[Camera] No supported recording format found');
        setError('Recording is not supported on this browser.');
        if (audioCleanupRef.current) {
          audioCleanupRef.current();
          audioCleanupRef.current = null;
        }
        return false;
      }
      console.log('[Camera] Selected recording format:', mimeType);

      mimeTypeRef.current = mimeType;

      const mediaRecorder = new MediaRecorder(recordingStream, {
        mimeType,
        ...(hasVideo 
          ? { videoBitsPerSecond: 2000000, audioBitsPerSecond: 192000 } 
          : { audioBitsPerSecond: 192000 }),
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const chunks = recordingChunksRef.current;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: mimeType });
          if (blob.size > 0) {
            setRecordingBlob(blob);
            setHasRecording(true);
            console.log('[Camera] Recording saved, size:', blob.size);
          } else {
            console.log('[Camera] Recording blob empty');
          }
        } else {
          console.log('[Camera] No recording chunks captured');
        }
        if (audioCleanupRef.current) {
          audioCleanupRef.current();
          audioCleanupRef.current = null;
        }
      };

      mediaRecorder.onerror = (e) => {
        console.error('[Camera] MediaRecorder error:', e);
      };

      mediaRecorder.start(500);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

      console.log('[Camera] Recording started');
      return true;
    } catch (err) {
      console.error('[Camera] Error starting recording:', err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Microphone permission denied.');
      } else {
        setError('Could not start recording.');
      }
      return false;
    }
  }, [isEnabled, stream, buildMixedAudioStream]);

  const stopRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData();
      } catch {}
      setTimeout(() => {
        try {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        } catch {}
        mediaRecorderRef.current = null;
      }, 100);
    } else {
      mediaRecorderRef.current = null;
    }

    setIsRecording(false);
    console.log('[Camera] Recording stopped');
  }, []);

  const requestStopRecording = useCallback(() => {
    if (!isRecording) return;
    setShowDiscardPrompt(true);
  }, [isRecording]);

  const confirmStopAndDownload = useCallback(() => {
    setShowDiscardPrompt(false);
    pendingDownloadRef.current = true;
    stopRecording();
  }, [stopRecording]);

  const confirmStopAndDiscard = useCallback(() => {
    setShowDiscardPrompt(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null;
      recorder.onstop = () => {
        if (audioCleanupRef.current) {
          audioCleanupRef.current();
          audioCleanupRef.current = null;
        }
      };
      try { recorder.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    setIsRecording(false);
    setHasRecording(false);
    setRecordingBlob(null);
    setRecordingTime(0);
    console.log('[Camera] Recording discarded');
  }, []);

  const cancelStopRecording = useCallback(() => {
    setShowDiscardPrompt(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      requestStopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, requestStopRecording]);

  const downloadRecording = useCallback((filename: string = 'costar-recording') => {
    if (!recordingBlob) return;

    const isAudio = mimeTypeRef.current.startsWith('audio/');
    const extension = mimeTypeRef.current.includes('mp4') 
      ? (isAudio ? 'm4a' : 'mp4') 
      : 'webm';
    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [recordingBlob]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadRecording = useCallback(async (metadata: {
    scriptName: string;
    durationSeconds?: number;
    accuracy?: number;
    performanceRunId?: string;
    recentScriptId?: string;
    savedScriptId?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!recordingBlob) return { success: false, error: "No recording available" };

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      const ext = mimeTypeRef.current.includes("mp4") ? "mp4" : "webm";
      formData.append("file", recordingBlob, `recording.${ext}`);
      formData.append("scriptName", metadata.scriptName);
      if (metadata.durationSeconds != null) formData.append("durationSeconds", String(metadata.durationSeconds));
      if (metadata.accuracy != null) formData.append("accuracy", String(metadata.accuracy));
      if (metadata.performanceRunId) formData.append("performanceRunId", metadata.performanceRunId);
      if (metadata.recentScriptId) formData.append("recentScriptId", metadata.recentScriptId);
      if (metadata.savedScriptId) formData.append("savedScriptId", metadata.savedScriptId);

      setUploadProgress(10);

      const response = await fetch("/api/recordings/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      setUploadProgress(90);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, error: data.message || "Upload failed" };
      }

      setUploadProgress(100);
      return { success: true };
    } catch (err) {
      console.error("[Camera] Upload error:", err);
      return { success: false, error: "Network error during upload" };
    } finally {
      setIsUploading(false);
    }
  }, [recordingBlob]);

  const clearRecording = useCallback(() => {
    setRecordingBlob(null);
    setHasRecording(false);
    setRecordingTime(0);
    setShowDiscardPrompt(false);
    recordingChunksRef.current = [];
  }, []);

  useEffect(() => {
    if (pendingDownloadRef.current && recordingBlob) {
      pendingDownloadRef.current = false;
      const isAudio = mimeTypeRef.current.startsWith('audio/');
      const extension = mimeTypeRef.current.includes('mp4') 
        ? (isAudio ? 'm4a' : 'mp4') 
        : 'webm';
      const url = URL.createObjectURL(recordingBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `costar-recording.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      console.log('[Camera] Auto-downloaded recording after save');
    }
  }, [recordingBlob]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordingAudioContextRef.current) {
        recordingAudioContextRef.current.close().catch(() => {});
      }
      if (recordingMicStreamRef.current) {
        recordingMicStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
      }
    };
  }, []);

  return {
    isEnabled,
    isRecording,
    recordingTime,
    stream,
    error,
    hasRecording,
    recordingBlob,
    showDiscardPrompt,
    earbudsOnly,
    toggleEarbudsOnly,
    videoRef,
    canvasRef,
    screenCanvasRef,
    toggleCamera,
    startCamera,
    stopCamera,
    toggleRecording,
    startRecording,
    stopRecording,
    requestStopRecording,
    confirmStopAndDownload,
    confirmStopAndDiscard,
    cancelStopRecording,
    downloadRecording,
    clearRecording,
    uploadRecording,
    isUploading,
    uploadProgress,
  };
}
