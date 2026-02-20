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

      if (screenCanvasRef.current) {
        const canvasStream = screenCanvasRef.current.captureStream(30);
        recordingStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...mixedAudio.getAudioTracks(),
        ]);
        console.log('[Camera] Starting canvas + mixed audio recording');
      } else {
        recordingStream = mixedAudio;
        console.log('[Camera] Starting audio-only recording (no canvas available)');
      }

      const hasVideo = recordingStream.getVideoTracks().length > 0;
      const mimeType = hasVideo
        ? (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
          ? 'video/mp4;codecs=avc1'
          : MediaRecorder.isTypeSupported('video/mp4')
          ? 'video/mp4'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm')
        : (MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm');

      mimeTypeRef.current = mimeType;

      const mediaRecorder = new MediaRecorder(recordingStream, {
        mimeType,
        ...(hasVideo 
          ? { videoBitsPerSecond: 5000000, audioBitsPerSecond: 192000 } 
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

  const clearRecording = useCallback(() => {
    setRecordingBlob(null);
    setHasRecording(false);
    setRecordingTime(0);
    recordingChunksRef.current = [];
  }, []);

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
  };
}
