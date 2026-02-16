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
}

export function useCamera() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

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

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
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

    ttsEngine.initAudioContext();
    const ttsStream = ttsEngine.getTTSAudioStream();
    if (ttsStream && ttsStream.getAudioTracks().length > 0) {
      const ttsSource = audioContext.createMediaStreamSource(ttsStream);
      ttsSource.connect(destination);
      console.log('[Camera] Mixed TTS audio into recording');
    } else {
      console.log('[Camera] No TTS audio stream available');
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

      const { stream: mixedAudio, cleanup: audioCleanup } = await buildMixedAudioStream();

      let recordingStream: MediaStream;

      if (isEnabled && canvasRef.current) {
        const canvasStream = canvasRef.current.captureStream(30);
        recordingStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...mixedAudio.getAudioTracks(),
        ]);
        console.log('[Camera] Starting camera video + mixed audio recording');
      } else if (screenCanvasRef.current) {
        const canvasStream = screenCanvasRef.current.captureStream(30);
        recordingStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...mixedAudio.getAudioTracks(),
        ]);
        console.log('[Camera] Starting screen canvas + mixed audio recording');
      } else {
        recordingStream = mixedAudio;
        console.log('[Camera] Starting audio-only recording (no canvas available)');
      }

      const hasVideo = recordingStream.getVideoTracks().length > 0;
      const mimeType = hasVideo
        ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4')
        : (MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4');

      mimeTypeRef.current = mimeType;

      const mediaRecorder = new MediaRecorder(recordingStream, {
        mimeType,
        ...(hasVideo ? { videoBitsPerSecond: 2500000 } : { audioBitsPerSecond: 128000 }),
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        setRecordingBlob(blob);
        setHasRecording(true);
        console.log('[Camera] Recording saved, size:', blob.size);
        audioCleanup();
      };

      mediaRecorder.start(1000);
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsRecording(false);
    console.log('[Camera] Recording stopped');
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const downloadRecording = useCallback((filename: string = 'castmate-recording') => {
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
    videoRef,
    canvasRef,
    screenCanvasRef,
    toggleCamera,
    startCamera,
    stopCamera,
    toggleRecording,
    startRecording,
    stopRecording,
    downloadRecording,
    clearRecording,
  };
}
