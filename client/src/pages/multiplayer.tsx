import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMultiplayer } from '@/hooks/use-multiplayer';
import { useWebRTC } from '@/hooks/use-webrtc';
import { VideoGrid } from '@/components/video-grid';
import { MultiplayerVideoBackground } from '@/components/multiplayer-video-background';
import { useSessionContext } from '@/context/session-context';
import { useToast } from '@/hooks/use-toast';
import { ttsEngine, calculateProsody, detectEmotion, getConversationalTiming, addBreathingPauses, SpeakResult } from '@/lib/tts-engine';
import { speechRecognition, type SpeechRecognitionState } from '@/lib/speech-recognition';
import { matchWords } from '@/lib/word-matcher';
import { drawWatermark } from '@/lib/watermark';
import { Users, Copy, Check, Play, Crown, UserCircle, ArrowLeft, Loader2, Pause, SkipForward, SkipBack, Volume2, Mic, MicOff, Video, VideoOff, Circle, Camera, CameraOff, Download, Star, RefreshCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type View = 'create' | 'join' | 'lobby';

interface MultiplayerPageProps {
  onBack: () => void;
  onStartRehearsal?: (room: any) => void;
  initialView?: 'create' | 'join';
}

interface PeerAudioElementProps {
  stream: MediaStream;
  participantId: string;
  audioUnlocked: boolean;
}

function PeerAudioElement({ stream, participantId, audioUnlocked }: PeerAudioElementProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasPlayedRef = useRef(false);
  const streamIdRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Cleanup previous timers
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (watchdogTimerRef.current) {
      clearInterval(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }

    // Log stream info for debugging
    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();
    console.log(`[PeerAudio ${participantId}] Stream info:`, {
      streamId: stream.id,
      audioTracks: audioTracks.length,
      videoTracks: videoTracks.length,
      audioTrackEnabled: audioTracks[0]?.enabled,
      audioTrackMuted: audioTracks[0]?.muted,
      audioTrackReadyState: audioTracks[0]?.readyState,
    });

    // Reset hasPlayed when stream changes
    if (streamIdRef.current !== stream.id) {
      streamIdRef.current = stream.id;
      hasPlayedRef.current = false;
    }

    // Always reattach stream (mobile Safari needs this)
    audio.srcObject = stream;
    audio.volume = 1.0;
    audio.muted = false;

    // Only attempt to play if audio is unlocked by user gesture
    if (!audioUnlocked) {
      console.log(`[PeerAudio ${participantId}] Waiting for audio unlock...`);
      return;
    }

    const attemptPlay = () => {
      if (!audio) return;
      
      // Always reassign srcObject for mobile Safari
      audio.srcObject = stream;
      audio.muted = false;
      audio.volume = 1.0;
      
      // Force load for mobile
      try {
        audio.load();
      } catch (e) {
        // Ignore load errors
      }
      
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.then(() => {
          if (!hasPlayedRef.current) {
            console.log(`[PeerAudio ${participantId}] Playing successfully`);
          }
          hasPlayedRef.current = true;
          setIsPlaying(true);
        }).catch((err) => {
          console.log(`[PeerAudio ${participantId}] Play error: ${err.name} - ${err.message}`);
          setIsPlaying(false);
        });
      }
    };

    // Initial play attempts with increasing delays for mobile
    setTimeout(() => attemptPlay(), 100);
    setTimeout(() => attemptPlay(), 500);
    setTimeout(() => attemptPlay(), 1000);

    // Watchdog: periodically check if audio stopped and restart it
    // More aggressive - checks even if never played before
    watchdogTimerRef.current = setInterval(() => {
      if (audio.paused) {
        console.log(`[PeerAudio ${participantId}] Watchdog: audio paused, restarting...`);
        attemptPlay();
      }
    }, 3000);

    // Handle visibility changes (app coming back to foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && audioUnlocked) {
        console.log(`[PeerAudio ${participantId}] Visibility restored, ensuring audio plays`);
        attemptPlay();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle page focus (another way to detect coming back to foreground)
    const handleFocus = () => {
      if (audioUnlocked) {
        console.log(`[PeerAudio ${participantId}] Window focused, ensuring audio plays`);
        attemptPlay();
      }
    };
    window.addEventListener('focus', handleFocus);

    // Listen for track additions which might happen after stream is received
    const handleTrackAdd = () => {
      console.log(`[PeerAudio ${participantId}] Track added, reattempting play`);
      hasPlayedRef.current = false;
      attemptPlay();
    };
    stream.addEventListener('addtrack', handleTrackAdd);

    // Track play/pause state
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      if (watchdogTimerRef.current) {
        clearInterval(watchdogTimerRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      stream.removeEventListener('addtrack', handleTrackAdd);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [stream, audioUnlocked, participantId]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      controls={false}
      preload="auto"
      webkit-playsinline="true"
      x-webkit-airplay="allow"
      style={{ position: 'fixed', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}
    />
  );
}

export default function MultiplayerPage({ onBack, onStartRehearsal, initialView = 'join' }: MultiplayerPageProps) {
  const { session } = useSessionContext();
  const { toast } = useToast();
  
  const [view, setView] = useState<View>(initialView);
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingBlobRef = useRef<Blob | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const watermarkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const watermarkVideoRef = useRef<HTMLVideoElement | null>(null);
  const watermarkAnimFrameRef = useRef<number | null>(null);
  
  const [navNotification, setNavNotification] = useState<string | null>(null);
  const navNotifTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLineIndexRef = useRef<number | null>(null);
  const prevSceneIndexRef = useRef<number | null>(null);
  
  // Completion state
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionStats, setCompletionStats] = useState<{
    totalLines: number;
    userLines: number;
    averageAccuracy: number;
    perfectLines: number;
  } | null>(null);
  const linePerformanceRef = useRef<{ lineId: string; accuracy: number }[]>([]);

  // Track if audio has been unlocked by user gesture (required for mobile)
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioUnlockedRef = useRef(false);
  
  // Unlock audio on mobile by playing silent sound and creating AudioContext
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
    
    // Method 1: Play silent audio
    const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silentAudio.play().catch(() => {});
    
    // Method 2: Create AudioContext (helps on iOS)
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctx.resume().then(() => ctx.close()).catch(() => {});
    } catch {}
    
    console.log('[Multiplayer] Audio unlocked by user gesture');
  }, []);

  const multiplayer = useMultiplayer({
    onRoomCreated: () => {
      setView('lobby');
    },
    onRoomJoined: () => {
      setView('lobby');
    },
    onError: (message) => {
      toast({ title: 'Error', description: message, variant: 'destructive' });
    },
    onKicked: () => {
      toast({ title: 'Removed from room', variant: 'destructive' });
      onBack();
    },
    onRoomClosed: () => {
      toast({ title: 'Room closed' });
      onBack();
    },
  });

  // TTS audio stream for WebRTC mixing (declared early so it can be used in timing logic)
  const [ttsAudioStream, setTtsAudioStream] = useState<MediaStream | null>(null);
  
  // WebRTC should start during countdown so peers are connected by the time rehearsal starts
  // For hosts, try to wait until TTS stream is ready to ensure audio mixing works
  // But use a fallback timeout to not block WebRTC indefinitely
  const isCountdownOrRehearsing = !!multiplayer.room && (multiplayer.room.state === 'rehearsing' || multiplayer.room.state === 'paused' || multiplayer.room.state === 'counting_down');
  const [ttsWaitTimedOut, setTtsWaitTimedOut] = useState(false);
  
  // Timeout to proceed with WebRTC even if TTS isn't ready (after 2 seconds)
  useEffect(() => {
    if (isCountdownOrRehearsing && multiplayer.isHost && !ttsAudioStream && !ttsWaitTimedOut) {
      const timeout = setTimeout(() => {
        console.log('[Multiplayer] TTS wait timeout - proceeding with WebRTC without TTS mixing');
        setTtsWaitTimedOut(true);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isCountdownOrRehearsing, multiplayer.isHost, ttsAudioStream, ttsWaitTimedOut]);
  
  // Reset timeout state when not in countdown/rehearsing
  useEffect(() => {
    if (!isCountdownOrRehearsing) {
      setTtsWaitTimedOut(false);
    }
  }, [isCountdownOrRehearsing]);
  
  const hostTtsReady = !multiplayer.isHost || ttsAudioStream !== null || ttsWaitTimedOut;
  const isRehearsingOrPaused = isCountdownOrRehearsing && hostTtsReady;
  const isActivelyRehearing = !!multiplayer.room && multiplayer.room.state === 'rehearsing';
  
  // Lobby camera state - declared before webrtc so stream can be reused
  const [lobbyVideoEnabled, setLobbyVideoEnabled] = useState(false);
  const [lobbyStream, setLobbyStream] = useState<MediaStream | null>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraPreferenceForRehearsal, setCameraPreferenceForRehearsal] = useState(true);
  
  // Early mic permission state - request in lobby before rehearsal starts
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  
  // Request mic permission early (in lobby)
  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop the stream - we just wanted to get permission
      stream.getTracks().forEach(track => track.stop());
      setMicPermissionGranted(true);
      setMicPermissionDenied(false);
      console.log('[Multiplayer] Mic permission granted early');
    } catch (err) {
      console.error('[Multiplayer] Mic permission denied:', err);
      setMicPermissionDenied(true);
    }
  }, []);
  
  // Auto-request mic permission when entering lobby
  useEffect(() => {
    if (view === 'lobby' && !micPermissionGranted && !micPermissionDenied) {
      // Small delay to let UI render first
      const timer = setTimeout(() => {
        requestMicPermission();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [view, micPermissionGranted, micPermissionDenied, requestMicPermission]);
  
  // Initialize TTS audio context early for hosts - needed BEFORE WebRTC starts
  // We initialize when entering lobby so stream is ready when countdown begins
  useEffect(() => {
    if (view === 'lobby' && multiplayer.isHost) {
      ttsEngine.initAudioContext();
      const stream = ttsEngine.getTTSAudioStream();
      if (stream) {
        console.log('[Multiplayer] TTS audio stream ready for WebRTC mixing (early init)');
        setTtsAudioStream(stream);
      }
    }
  }, [view, multiplayer.isHost]);
  
  // Also init when audio is unlocked (belt and suspenders)
  useEffect(() => {
    if (audioUnlocked && multiplayer.isHost && !ttsAudioStream) {
      ttsEngine.initAudioContext();
      const stream = ttsEngine.getTTSAudioStream();
      if (stream) {
        console.log('[Multiplayer] TTS audio stream ready for WebRTC mixing');
        setTtsAudioStream(stream);
      }
    }
  }, [audioUnlocked, multiplayer.isHost, ttsAudioStream]);
  
  const webrtc = useWebRTC({
    socket: multiplayer.socket,
    myParticipantId: multiplayer.currentParticipant?.id ?? null,
    participants: multiplayer.room?.participants ?? [],
    enabled: isRehearsingOrPaused,
    existingVideoStream: lobbyStream, // Reuse lobby camera to avoid duplicate permission prompt
    ttsAudioStream: ttsAudioStream, // Host's TTS audio mixed into WebRTC for all participants
    isHost: multiplayer.isHost,
  });

  const toggleLobbyCamera = useCallback(async () => {
    if (lobbyVideoEnabled && lobbyStream) {
      lobbyStream.getTracks().forEach(track => track.stop());
      if (lobbyVideoRef.current) {
        lobbyVideoRef.current.srcObject = null;
      }
      setLobbyStream(null);
      setLobbyVideoEnabled(false);
      setCameraPreferenceForRehearsal(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        setLobbyStream(stream);
        setLobbyVideoEnabled(true);
        setCameraPreferenceForRehearsal(true);
        if (lobbyVideoRef.current) {
          lobbyVideoRef.current.srcObject = stream;
          try {
            await lobbyVideoRef.current.play();
          } catch (playErr) {
            console.warn('[Lobby] Video play warning:', playErr);
          }
        }
      } catch (err) {
        console.error('[Lobby] Camera error:', err);
        toast({ title: 'Camera access denied', variant: 'destructive' });
      }
    }
  }, [lobbyVideoEnabled, lobbyStream, toast]);

  useEffect(() => {
    if (lobbyStream && lobbyVideoRef.current) {
      lobbyVideoRef.current.srcObject = lobbyStream;
      lobbyVideoRef.current.play().catch(() => {});
    }
  }, [lobbyStream]);

  useEffect(() => {
    if (isRehearsingOrPaused && lobbyStream) {
      // Don't stop the stream tracks - WebRTC will reuse them!
      // Just detach from the video element and clear local state
      if (lobbyVideoRef.current) {
        lobbyVideoRef.current.srcObject = null;
      }
      // Keep lobbyStream reference for WebRTC - it will be cleaned up when WebRTC stops
      setLobbyVideoEnabled(false);
      
      if (!cameraPreferenceForRehearsal && webrtc.isVideoEnabled) {
        webrtc.toggleVideo();
      }
    }
  }, [isRehearsingOrPaused, lobbyStream, cameraPreferenceForRehearsal, webrtc]);

  useEffect(() => {
    return () => {
      if (lobbyStream) {
        lobbyStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [lobbyStream]);
  
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.requestData(); } catch {}
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }, 100);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
        mixedDestinationRef.current = null;
      }
      if (watermarkAnimFrameRef.current) {
        cancelAnimationFrame(watermarkAnimFrameRef.current);
        watermarkAnimFrameRef.current = null;
      }
      if (watermarkVideoRef.current) {
        watermarkVideoRef.current.srcObject = null;
        watermarkVideoRef.current = null;
      }
      watermarkCanvasRef.current = null;
      setIsRecording(false);
    } else {
      const stream = webrtc.localStream;
      if (!stream) {
        toast({ title: 'No media stream', description: 'Enable camera or microphone to record', variant: 'destructive' });
        return;
      }
      
      recordingChunksRef.current = [];
      setRecordingTime(0);
      setHasRecording(false);
      
      const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      let mimeType = 'video/webm';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      try {
        let recordStream = stream;
        
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        const destination = audioCtx.createMediaStreamDestination();
        mixedDestinationRef.current = destination;
        
        const micTracks = stream.getAudioTracks();
        if (micTracks.length > 0) {
          const micSource = audioCtx.createMediaStreamSource(new MediaStream(micTracks));
          micSource.connect(destination);
        }
        
        ttsEngine.initAudioContext();
        const ttsStream = ttsEngine.getTTSAudioStream();
        if (ttsStream && ttsStream.getAudioTracks().length > 0) {
          const ttsSource = audioCtx.createMediaStreamSource(ttsStream);
          ttsSource.connect(destination);
        }
        
        webrtc.peerStreams.forEach(ps => {
          const peerAudioTracks = ps.stream.getAudioTracks();
          if (peerAudioTracks.length > 0) {
            try {
              const peerSource = audioCtx.createMediaStreamSource(new MediaStream(peerAudioTracks));
              peerSource.connect(destination);
              console.log(`[Recording] Mixed in peer audio from ${ps.participantId}`);
            } catch (e) {
              console.warn(`[Recording] Failed to mix peer audio from ${ps.participantId}:`, e);
            }
          }
        });
        
        const videoTracks = stream.getVideoTracks();
        let finalVideoTracks = videoTracks;
        
        if (videoTracks.length > 0) {
          try {
            const wmCanvas = document.createElement('canvas');
            wmCanvas.width = 1280;
            wmCanvas.height = 720;
            watermarkCanvasRef.current = wmCanvas;
            
            const wmVideo = document.createElement('video');
            wmVideo.srcObject = new MediaStream(videoTracks);
            wmVideo.muted = true;
            wmVideo.playsInline = true;
            wmVideo.autoplay = true;
            wmVideo.play().catch(() => {});
            watermarkVideoRef.current = wmVideo;
            
            const wmCtx = wmCanvas.getContext('2d');
            if (wmCtx) {
              const drawWmFrame = () => {
                if (wmVideo.videoWidth > 0 && wmVideo.videoHeight > 0) {
                  wmCanvas.width = wmVideo.videoWidth;
                  wmCanvas.height = wmVideo.videoHeight;
                  wmCtx.drawImage(wmVideo, 0, 0);
                  drawWatermark(wmCtx, wmCanvas.width, wmCanvas.height);
                }
                watermarkAnimFrameRef.current = requestAnimationFrame(drawWmFrame);
              };
              drawWmFrame();
              
              const wmStream = wmCanvas.captureStream(30);
              const wmVideoTracks = wmStream.getVideoTracks();
              if (wmVideoTracks.length > 0) {
                finalVideoTracks = wmVideoTracks;
              }
            }
          } catch (wmErr) {
            console.warn('[Recording] Watermark canvas failed, using original video:', wmErr);
          }
        }
        
        const mixedStream = new MediaStream([
          ...finalVideoTracks,
          ...destination.stream.getAudioTracks()
        ]);
        recordStream = mixedStream;
        
        const recorder = new MediaRecorder(recordStream, { mimeType })
        mediaRecorderRef.current = recorder;
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordingChunksRef.current.push(e.data);
          }
        };
        
        recorder.onstop = () => {
          const blob = new Blob(recordingChunksRef.current, { type: mimeType });
          recordingBlobRef.current = blob;
          setHasRecording(true);
          toast({ title: 'Recording saved', description: 'Tap to download your recording' });
        };
        
        recorder.start(1000);
        setIsRecording(true);
        
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(t => t + 1);
        }, 1000);
        
      } catch (err) {
        console.error('[Recording] Error starting:', err);
        toast({ title: 'Recording failed', variant: 'destructive' });
      }
    }
  }, [isRecording, webrtc.localStream, webrtc.peerStreams, toast]);
  
  const downloadRecording = useCallback(() => {
    if (!recordingBlobRef.current) return;
    const url = URL.createObjectURL(recordingBlobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = `costar-tableread-${new Date().toISOString().slice(0,10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);
  
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.requestData(); } catch {}
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
        mixedDestinationRef.current = null;
      }
      if (watermarkAnimFrameRef.current) {
        cancelAnimationFrame(watermarkAnimFrameRef.current);
        watermarkAnimFrameRef.current = null;
      }
      if (watermarkVideoRef.current) {
        watermarkVideoRef.current.srcObject = null;
        watermarkVideoRef.current = null;
      }
      watermarkCanvasRef.current = null;
    };
  }, []);
  
  // Detect script completion
  useEffect(() => {
    const room = multiplayer.room;
    if (!room) return;
    
    // Check if we've reached the end of the script
    const isLastScene = room.currentSceneIndex === room.scenes.length - 1;
    const currentScene = room.scenes[room.currentSceneIndex];
    const isLastLine = currentScene && room.currentLineIndex === currentScene.lines.length - 1;
    
    // Detect completion when room state is 'completed' or we're at the last line
    if (room.state === 'completed' && !showCompletion) {
      // Stop recording if active
      if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.requestData(); } catch {}
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }, 100);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
          mixedDestinationRef.current = null;
        }
        setIsRecording(false);
      }
      
      // Calculate stats - personalized for THIS user's role
      const performances = linePerformanceRef.current;
      const userLines = performances.length;
      const averageAccuracy = userLines > 0 
        ? performances.reduce((sum, p) => sum + p.accuracy, 0) / userLines 
        : 0;
      const perfectLines = performances.filter(p => p.accuracy >= 95).length;
      
      // Count how many lines this user's role has (personalized stat)
      const myRoleId = multiplayer.currentParticipant?.roleId;
      let expectedUserLines = 0;
      room.scenes.forEach(scene => {
        scene.lines.forEach(line => {
          if (line.roleId === myRoleId) {
            expectedUserLines++;
          }
        });
      });
      
      setCompletionStats({
        totalLines: expectedUserLines, // Show expected lines for THIS user's role
        userLines,
        averageAccuracy,
        perfectLines
      });
      setShowCompletion(true);
    }
  }, [multiplayer.room, showCompletion, isRecording]);

  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const isAiSpeakingRef = useRef(false);
  const speakingLineRef = useRef<string | null>(null);
  const aiSpeakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track safety timeout separately so we can clear it on navigation
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Ref to always access latest multiplayer for callbacks
  const multiplayerRef = useRef(multiplayer);
  useEffect(() => {
    multiplayerRef.current = multiplayer;
  }, [multiplayer]);
  
  // Keep isAiSpeaking ref in sync
  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
  }, [isAiSpeaking]);
  
  const prefetchNextMultiplayerAILine = useCallback(() => {
    const room = multiplayer.room;
    if (!room) return;
    const scene = room.scenes[room.currentSceneIndex];
    if (!scene) return;
    
    const startIdx = room.currentLineIndex + 1;
    for (let i = startIdx; i < Math.min(startIdx + 3, scene.lines.length); i++) {
      const line = scene.lines[i];
      if (!line) continue;
      const isAssignedToHuman = room.participants.some(p => p.roleId === line.roleId);
      if (isAssignedToHuman) continue;
      
      const roleIndex = room.roles.findIndex(r => r.id === line.roleId);
      const emotion = detectEmotion(line.text, line.direction);
      const role = room.roles.find(r => r.id === line.roleId);
      const preset = (role?.voicePreset as any) || 'natural';
      
      ttsEngine.prefetch(line.text, {
        characterName: line.roleName,
        characterIndex: roleIndex >= 0 ? roleIndex : 0,
        emotion,
        preset,
        direction: line.direction || "",
        playbackSpeed: 1.0,
      });
      break;
    }
  }, [multiplayer.room]);

  const speakAiLine = useCallback((lineId: string, text: string, roleName: string, characterIndex: number, isHost: boolean, direction?: string, voicePreset?: string) => {
    ttsEngine.stop();
    
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    if (aiSpeakTimeoutRef.current) {
      clearTimeout(aiSpeakTimeoutRef.current);
      aiSpeakTimeoutRef.current = null;
    }
    
    if (speakingLineRef.current === lineId) {
      console.log('[Multiplayer TTS] Already speaking this line, skipping');
      return;
    }
    
    speakingLineRef.current = lineId;
    setIsAiSpeaking(true);
    isAiSpeakingRef.current = true;
    
    console.log('[Multiplayer TTS] Speaking:', roleName, text.substring(0, 30), 'isHost:', isHost);
    
    const emotion = detectEmotion(text, direction);
    const preset = (voicePreset as any) || 'natural';
    const prosody = calculateProsody(emotion, preset);
    const ttsText = addBreathingPauses(text);
    
    const estimatedDuration = Math.max(5000, text.length * 100);
    let hasAdvanced = false;
    
    const advanceToNext = () => {
      if (hasAdvanced) {
        console.log('[Multiplayer TTS] advanceToNext called but already advanced');
        return;
      }
      hasAdvanced = true;
      console.log('[Multiplayer TTS] advanceToNext triggered, isHost:', isHost);
      
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      
      if (isHost) {
        const room = multiplayerRef.current.room;
        let pauseMs = 400;
        if (room) {
          const scene = room.scenes[room.currentSceneIndex];
          const nextIdx = room.currentLineIndex + 1;
          if (scene && nextIdx < scene.lines.length) {
            const nextLineData = scene.lines[nextIdx];
            const nextIsHumanTurn = room.participants.some(p => p.roleId === nextLineData.roleId);
            const nextEmotion = detectEmotion(nextLineData.text, nextLineData.direction);
            const timing = getConversationalTiming(nextEmotion, text, emotion);
            pauseMs = nextIsHumanTurn ? timing.aiToUserPauseMs : timing.aiToAiPauseMs;
          }
        }
        
        aiSpeakTimeoutRef.current = setTimeout(() => {
          console.log('[Multiplayer TTS] Host calling nextLine() via ref');
          multiplayerRef.current.nextLine();
        }, pauseMs);
      } else {
        console.log('[Multiplayer TTS] Not host, waiting for host to advance');
      }
    };
    
    if (isHost) {
      safetyTimeoutRef.current = setTimeout(() => {
        console.log('[Multiplayer TTS] Safety timeout - forcing advance via ref');
        advanceToNext();
      }, estimatedDuration + 3000);
    }
    
    ttsEngine.speak(
      ttsText, 
      prosody, 
      (result: SpeakResult) => {
        console.log('[Multiplayer TTS] Complete:', result, 'isHost:', isHost);
        if (result === 'success' || result === 'error') {
          advanceToNext();
        }
      },
      {
        characterName: roleName,
        characterIndex,
        emotion,
        preset,
        direction: direction || "",
        onStart: () => {
          prefetchNextMultiplayerAILine();
        },
      }
    );
  }, [prefetchNextMultiplayerAILine]);

  const currentLineIdRef = useRef<string | null>(null);

  // Server-synced countdown from multiplayer hook
  const serverCountdown = multiplayer.countdown;
  const isCountingDown = multiplayer.room?.state === 'counting_down';

  // Track if we've started the first line yet (to delay until all peers connected)
  const hasStartedRef = useRef(false);
  const peerWaitStartTimeRef = useRef<number | null>(null);
  
  useEffect(() => {
    // Only play TTS when actively rehearsing (not counting down)
    if (!isActivelyRehearing || !multiplayer.room) {
      if (isAiSpeaking) {
        ttsEngine.stop();
        setIsAiSpeaking(false);
        isAiSpeakingRef.current = false;
      }
      speakingLineRef.current = null;
      currentLineIdRef.current = null;
      hasStartedRef.current = false; // Reset for next rehearsal
      peerWaitStartTimeRef.current = null;
      return;
    }
    
    const room = multiplayer.room;
    const currentScene = room.scenes[room.currentSceneIndex];
    const currentLine = currentScene?.lines[room.currentLineIndex];
    
    if (!currentLine) return;

    // For the FIRST line, wait until all peers have streams before starting TTS
    // This ensures everyone can hear the audio from the start
    // Use allPeersHaveStreams (more reliable) with a 5-second timeout to avoid infinite wait
    const otherParticipants = room.participants.filter(p => p.id !== multiplayer.participantId);
    const peersReady = webrtc.allPeersHaveStreams || webrtc.allPeersConnected;
    
    // Start the wait timer if not already started
    if (!peerWaitStartTimeRef.current && otherParticipants.length > 0 && !hasStartedRef.current) {
      peerWaitStartTimeRef.current = Date.now();
    }
    
    // Check if we've waited long enough (5 second max wait)
    const waitTime = peerWaitStartTimeRef.current ? Date.now() - peerWaitStartTimeRef.current : 0;
    const timedOut = waitTime > 5000;
    
    const needToWaitForPeers = otherParticipants.length > 0 && !hasStartedRef.current && !peersReady && !timedOut;
    
    if (needToWaitForPeers && multiplayer.isHost) {
      console.log('[Multiplayer] Waiting for peers (streams)...', {
        connected: webrtc.connectedPeersCount,
        hasStreams: webrtc.allPeersHaveStreams,
        expected: otherParticipants.length,
        waitedMs: waitTime,
      });
      return; // Don't start TTS yet
    }
    
    if (timedOut && !hasStartedRef.current) {
      console.log('[Multiplayer] Peer wait timeout, starting anyway');
    }

    // When line changes, ALWAYS stop current TTS immediately to prevent overlap
    if (currentLineIdRef.current !== currentLine.id) {
      console.log('[Multiplayer] Line changed from', currentLineIdRef.current, 'to', currentLine.id);
      // Stop any playing audio immediately
      ttsEngine.stop();
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
      // NOTE: Do NOT clear aiSpeakTimeoutRef here - it contains the pending nextLine() call
      // that triggered this line change. Clearing it would break auto-advance.
      speakingLineRef.current = null; // Reset so new line can speak
      currentLineIdRef.current = currentLine.id;
    }
    
    const lineRoleId = currentLine.roleId;
    const isRoleAssignedToParticipant = room.participants.some(p => p.roleId === lineRoleId);
    
    console.log('[Multiplayer] TTS Effect triggered:', {
      lineId: currentLine.id,
      lineIndex: room.currentLineIndex,
      sceneIndex: room.currentSceneIndex,
      roleName: currentLine.roleName,
      roleId: lineRoleId,
      isRoleAssignedToParticipant,
      assignedTo: room.participants.find(p => p.roleId === lineRoleId)?.name || 'AI',
      isHost: multiplayer.isHost,
      speakingLineRef: speakingLineRef.current,
      willSpeak: !isRoleAssignedToParticipant,
    });
    
    // ALL participants play TTS locally for unassigned roles
    // Host additionally controls line advancement via TTS completion callback
    // This ensures everyone hears AI voices directly (no WebRTC audio dependency)
    if (!isRoleAssignedToParticipant) {
      hasStartedRef.current = true;
      const roleIndex = room.roles.findIndex(r => r.id === lineRoleId);
      const role = room.roles.find(r => r.id === lineRoleId);
      console.log('[Multiplayer] Starting TTS for AI line:', currentLine.roleName, roleIndex, 'isHost:', multiplayer.isHost);
      speakAiLine(currentLine.id, currentLine.text, currentLine.roleName, roleIndex >= 0 ? roleIndex : 0, multiplayer.isHost, currentLine.direction, role?.voicePreset);
    } else if (isRoleAssignedToParticipant) {
      // This is a human player's turn - check if it's MY turn
      const assignedParticipant = room.participants.find(p => p.roleId === lineRoleId);
      const isMyTurn = assignedParticipant?.id === multiplayer.participantId;
      
      console.log('[Multiplayer] User turn detected for:', currentLine.roleName, 'isMyTurn:', isMyTurn);
      
      if (isMyTurn) {
        console.log('[Multiplayer] MY TURN - triggering speech recognition directly');
        isAiSpeakingRef.current = false;
        setIsAiSpeaking(false);
        prefetchNextMultiplayerAILine();
        
        speechRecognition.resetAccumulated();
        setTimeout(() => {
          if (isActivelyRehearsalRef.current && !isAiSpeakingRef.current) {
            waitingForUserRef.current = true;
            
            if (speechRecognition.available) {
              console.log('[Multiplayer] Starting speech recognition for my turn');
              const started = speechRecognition.start();
              console.log('[Multiplayer] Speech recognition start result:', started);
            }
            
            if (userTurnTimeoutRef.current) {
              clearTimeout(userTurnTimeoutRef.current);
            }
            userTurnTimeoutRef.current = setTimeout(() => {
              if (waitingForUserRef.current && isActivelyRehearsalRef.current) {
                console.log("[Multiplayer] User turn safety timeout, advancing");
                waitingForUserRef.current = false;
                speechRecognition.abort();
                setUserTranscript("");
                multiplayerRef.current.nextLine();
              }
            }, 60000);
          }
        }, 100);
      }
    }
    
    // NOTE: No cleanup needed - the aiSpeakTimeoutRef is intentionally NOT cleared
    // when this effect re-runs because it may contain the nextLine() call that 
    // advances to the next line. Clearing it would break auto-advance.
    // IMPORTANT: Use specific line/scene indices as dependencies for reliable re-trigger
  }, [isActivelyRehearing, multiplayer.room, multiplayer.room?.currentLineIndex, multiplayer.room?.currentSceneIndex, speakAiLine, multiplayer.isHost, multiplayer.participantId, webrtc.allPeersConnected, webrtc.allPeersHaveStreams, webrtc.connectedPeersCount, prefetchNextMultiplayerAILine]);

  useEffect(() => {
    return () => {
      ttsEngine.stop();
      ttsEngine.clearPrefetchCache();
      if (aiSpeakTimeoutRef.current) {
        clearTimeout(aiSpeakTimeoutRef.current);
      }
    };
  }, []);

  const [listeningState, setListeningState] = useState<SpeechRecognitionState>("idle");
  const waitingForUserRef = useRef(false);
  const userTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [micBlocked, setMicBlocked] = useState(false);
  const isActivelyRehearsalRef = useRef(false);
  const [userTranscript, setUserTranscript] = useState("");
  const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advancedForLineRef = useRef<string | null>(null);
  const currentLineAccuracyRef = useRef<number>(0);

  useEffect(() => {
    isActivelyRehearsalRef.current = isActivelyRehearing;
  }, [isActivelyRehearing]);

  useEffect(() => {
    if (isAiSpeaking) {
      waitingForUserRef.current = false;
      speechRecognition.abort();
      if (userTurnTimeoutRef.current) {
        clearTimeout(userTurnTimeoutRef.current);
        userTurnTimeoutRef.current = null;
      }
    }
  }, [isAiSpeaking]);

  const startListeningForUser = useCallback(() => {
    // Use ref to get current value, not stale closure
    if (isAiSpeakingRef.current) {
      console.log("[Multiplayer] Cannot start listening while AI is speaking");
      return;
    }
    
    console.log("[Multiplayer] Starting user turn, mic available:", speechRecognition.available, "blocked:", micBlocked);
    
    waitingForUserRef.current = true;
    speechRecognition.resetAccumulated();

    if (speechRecognition.available && !micBlocked) {
      setTimeout(() => {
        if (waitingForUserRef.current && !isAiSpeakingRef.current) {
          const started = speechRecognition.start();
          if (!started) {
            console.log("[Multiplayer] Speech recognition failed to start");
          } else {
            console.log("[Multiplayer] Speech recognition started successfully");
          }
        }
      }, 50);
    }

    if (userTurnTimeoutRef.current) {
      clearTimeout(userTurnTimeoutRef.current);
    }
    userTurnTimeoutRef.current = setTimeout(() => {
      if (waitingForUserRef.current && isActivelyRehearsalRef.current) {
        console.log("[Multiplayer] User turn timeout, auto-advancing");
        waitingForUserRef.current = false;
        speechRecognition.abort();
        multiplayerRef.current.nextLine();
      }
    }, 20000);
  }, [micBlocked]);

  // Helper to get current line for word matching
  const getCurrentLineForMatch = useCallback(() => {
    const room = multiplayer.room;
    if (!room) return null;
    const currentScene = room.scenes[room.currentSceneIndex];
    return currentScene?.lines[room.currentLineIndex] || null;
  }, [multiplayer.room]);

  // Advance after user line - like solo mode
  const advanceAfterUserLine = useCallback(() => {
    const room = multiplayer.room;
    const currentScene = room?.scenes[room?.currentSceneIndex || 0];
    const currentLine = currentScene?.lines[room?.currentLineIndex || 0];
    
    console.log("[Multiplayer] advanceAfterUserLine called:", {
      lineId: currentLine?.id,
      roleName: currentLine?.roleName,
      lineIndex: room?.currentLineIndex,
      isHost: multiplayer.isHost,
    });
    
    // Track performance for this line
    if (room && currentLine) {
      linePerformanceRef.current.push({
        lineId: currentLine.id,
        accuracy: currentLineAccuracyRef.current
      });
    }
    
    setUserTranscript("");
    currentLineAccuracyRef.current = 0;
    
    console.log("[Multiplayer] Calling nextLine() now...");
    multiplayerRef.current.nextLine();
  }, [multiplayer.room, multiplayer.isHost]);

  useEffect(() => {
    const handleResult = (result: { transcript: string; isFinal: boolean }) => {
      // Always update transcript for word tracing (like solo mode)
      if (waitingForUserRef.current && isActivelyRehearsalRef.current) {
        setUserTranscript(result.transcript);
      }
      
      // Check word matching against current line (like solo mode)
      const line = getCurrentLineForMatch();
      if (line && result.transcript.length > 0 && waitingForUserRef.current && isActivelyRehearsalRef.current) {
        const match = matchWords(line.text, result.transcript);
        console.log("[Multiplayer] Word match:", match.matchedCount, "/", match.totalWords, 
          `(${Math.round(match.percentMatched)}%)`);
        
        // Track best accuracy for this line
        currentLineAccuracyRef.current = Math.max(currentLineAccuracyRef.current, match.percentMatched);
        
        // Auto-advance when user has matched 80%+ of the words (like solo mode)
        if (match.percentMatched >= 80) {
          console.log("[Multiplayer] 80%+ match, advancing now!");
          speechRecognition.stop();
          waitingForUserRef.current = false;
          
          if (userTurnTimeoutRef.current) {
            clearTimeout(userTurnTimeoutRef.current);
            userTurnTimeoutRef.current = null;
          }
          if (autoAdvanceTimeoutRef.current) {
            clearTimeout(autoAdvanceTimeoutRef.current);
            autoAdvanceTimeoutRef.current = null;
          }
          
          // Quick pause then advance (150ms for snappy response like solo)
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            if (isActivelyRehearsalRef.current) {
              advanceAfterUserLine();
            }
          }, 150);
          return;
        }
      }
      
      // On final result, DON'T advance unless we have 80%+ match (handled above)
      // Browser sends premature "final" results after pauses - ignore them like solo mode does
      // The recognition will restart automatically via handleEnd and we'll keep listening
      if (result.isFinal && waitingForUserRef.current && isActivelyRehearsalRef.current && line) {
        const match = matchWords(line.text, result.transcript);
        console.log("[Multiplayer] Final result with", Math.round(match.percentMatched), "% match - ignoring, waiting for 80%+");
        // Don't advance, don't stop - let speech recognition restart and continue listening
        // The handleEnd callback will restart listening if still waiting
      }
    };

    const handleStateChange = (state: SpeechRecognitionState) => {
      setListeningState(state);
    };

    const handleEnd = () => {
      if (waitingForUserRef.current && isActivelyRehearsalRef.current) {
        console.log("[Multiplayer] Speech ended but still user's turn, auto-restarting...");
        setTimeout(() => {
          if (waitingForUserRef.current && !speechRecognition.listening && isActivelyRehearsalRef.current) {
            console.log("[Multiplayer] Restarting speech recognition");
            speechRecognition.start();
          }
        }, 300);
      }
    };

    const handleError = (error: string) => {
      console.log("[Multiplayer] Speech error:", error);
      if (error === "not-allowed") {
        setMicBlocked(true);
      }
      // On error, still try to advance if we're waiting (like solo mode)
      if (waitingForUserRef.current && isActivelyRehearsalRef.current) {
        waitingForUserRef.current = false;
        setTimeout(() => {
          if (isActivelyRehearsalRef.current) {
            advanceAfterUserLine();
          }
        }, 500);
      }
    };

    speechRecognition.onResult(handleResult);
    speechRecognition.onStateChange(handleStateChange);
    speechRecognition.onEnd(handleEnd);
    speechRecognition.onError(handleError);

    return () => {
      speechRecognition.onResult(() => {});
      speechRecognition.onStateChange(() => {});
      speechRecognition.onEnd(() => {});
      speechRecognition.onError(() => {});
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, [getCurrentLineForMatch, advanceAfterUserLine]);

  // Backup watcher: if word match hits 70%+, force advancement
  // This catches cases where the speech callback didn't trigger properly (like solo mode)
  useEffect(() => {
    const line = getCurrentLineForMatch();
    if (!line || !isActivelyRehearing || !userTranscript || !waitingForUserRef.current) {
      return;
    }
    
    // Don't re-advance for the same line
    if (advancedForLineRef.current === line.id) {
      return;
    }
    
    const match = matchWords(line.text, userTranscript);
    if (match.percentMatched >= 70) {
      console.log("[Multiplayer] Backup watcher: 70%+ match detected, forcing advance");
      advancedForLineRef.current = line.id;
      waitingForUserRef.current = false;
      speechRecognition.stop();
      
      if (userTurnTimeoutRef.current) {
        clearTimeout(userTurnTimeoutRef.current);
        userTurnTimeoutRef.current = null;
      }
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
        autoAdvanceTimeoutRef.current = null;
      }
      
      setTimeout(() => {
        if (isActivelyRehearsalRef.current) {
          advanceAfterUserLine();
        }
      }, 150);
    }
  }, [userTranscript, isActivelyRehearing, getCurrentLineForMatch, advanceAfterUserLine]);

  useEffect(() => {
    const line = getCurrentLineForMatch();
    if (line) {
      advancedForLineRef.current = null;
      currentLineAccuracyRef.current = 0;
      setUserTranscript("");
      speechRecognition.resetAccumulated();
    }
  }, [multiplayer.room?.currentLineIndex, multiplayer.room?.currentSceneIndex, getCurrentLineForMatch]);

  useEffect(() => {
    if (!isActivelyRehearing || !multiplayer.room) {
      waitingForUserRef.current = false;
      speechRecognition.abort();
      if (userTurnTimeoutRef.current) {
        clearTimeout(userTurnTimeoutRef.current);
        userTurnTimeoutRef.current = null;
      }
      return;
    }

    const room = multiplayer.room;
    const currentScene = room.scenes[room.currentSceneIndex];
    const currentLine = currentScene?.lines[room.currentLineIndex];
    
    if (!currentLine) return;
    
    const assignedParticipant = room.participants.find(p => p.roleId === currentLine.roleId);
    const isMyTurn = assignedParticipant?.id === multiplayer.participantId;
    const isUnassignedRole = !room.participants.some(p => p.roleId === currentLine.roleId);
    
    // Use ref to get current AI speaking state (avoids stale closure issues)
    const aiCurrentlySpeaking = isAiSpeakingRef.current;
    
    // NOTE: Speech recognition is now triggered directly in the TTS effect above
    // This effect only handles cleanup when it's NOT my turn
    console.log('[Multiplayer Speech] Turn check:', {
      lineRole: currentLine.roleName,
      isMyTurn,
      aiCurrentlySpeaking,
      isUnassignedRole,
      speechAvailable: speechRecognition.available,
    });
    
    // If it's NOT my turn, stop any ongoing speech recognition
    if (!isMyTurn || isUnassignedRole) {
      waitingForUserRef.current = false;
      speechRecognition.abort();
      if (userTurnTimeoutRef.current) {
        clearTimeout(userTurnTimeoutRef.current);
        userTurnTimeoutRef.current = null;
      }
    }
  }, [isActivelyRehearing, multiplayer.room, multiplayer.room?.currentLineIndex, multiplayer.room?.currentSceneIndex, multiplayer.participantId]);

  const stopAllMultiplayerPlayback = useCallback(() => {
    ttsEngine.stop();
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    
    if (aiSpeakTimeoutRef.current) {
      clearTimeout(aiSpeakTimeoutRef.current);
      aiSpeakTimeoutRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    speechRecognition.abort();
    waitingForUserRef.current = false;
    if (userTurnTimeoutRef.current) {
      clearTimeout(userTurnTimeoutRef.current);
      userTurnTimeoutRef.current = null;
    }
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    
    speakingLineRef.current = null;
    currentLineIdRef.current = null;
    setUserTranscript("");
    advancedForLineRef.current = null;
  }, []);

  const handleManualSkip = useCallback(() => {
    stopAllMultiplayerPlayback();
    multiplayer.nextLine();
  }, [multiplayer, stopAllMultiplayerPlayback]);

  const handleManualBack = useCallback(() => {
    stopAllMultiplayerPlayback();
    multiplayer.prevLine();
  }, [multiplayer, stopAllMultiplayerPlayback]);

  useEffect(() => {
    return () => {
      speechRecognition.abort();
      if (userTurnTimeoutRef.current) {
        clearTimeout(userTurnTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const room = multiplayer.room;
    if (!room || room.state !== 'rehearsing') {
      prevLineIndexRef.current = null;
      prevSceneIndexRef.current = null;
      return;
    }
    
    const curLine = room.currentLineIndex;
    const curScene = room.currentSceneIndex;
    const prevLine = prevLineIndexRef.current;
    const prevScene = prevSceneIndexRef.current;
    
    if (prevLine !== null && prevScene !== null) {
      const sceneChanged = curScene !== prevScene;
      const wentBack = !sceneChanged && curLine < prevLine;
      const skippedForward = !sceneChanged && curLine > prevLine + 1;
      
      if (wentBack || skippedForward || (sceneChanged && curScene < prevScene)) {
        const direction = (wentBack || (sceneChanged && curScene < prevScene)) ? 'went back' : 'skipped ahead';
        setNavNotification(`Script ${direction}`);
        
        if (navNotifTimeoutRef.current) clearTimeout(navNotifTimeoutRef.current);
        navNotifTimeoutRef.current = setTimeout(() => {
          setNavNotification(null);
        }, 2500);
      }
    }
    
    prevLineIndexRef.current = curLine;
    prevSceneIndexRef.current = curScene;
  }, [multiplayer.room?.currentLineIndex, multiplayer.room?.currentSceneIndex, multiplayer.room?.state]);

  const handleCreateRoom = () => {
    if (!session || !playerName.trim()) return;
    unlockAudio(); // Unlock audio on user gesture when creating room
    multiplayer.createRoom(
      session.name,
      session.roles,
      session.scenes,
      playerName.trim()
    );
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim() || !playerName.trim()) return;
    unlockAudio(); // Unlock audio on user gesture when joining
    multiplayer.joinRoom(joinCode.trim().toUpperCase(), playerName.trim());
  };

  const handleCopyCode = async () => {
    if (!multiplayer.room) return;
    await navigator.clipboard.writeText(multiplayer.room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectRole = (roleId: string) => {
    const currentRole = multiplayer.currentParticipant?.roleId;
    multiplayer.selectRole(currentRole === roleId ? null : roleId);
  };

  const handleLeave = () => {
    stopAllMultiplayerPlayback();
    multiplayer.leaveRoom();
    onBack();
  };

  const allReady = multiplayer.room?.participants.every(p => p.isReady) ?? false;
  const canStart = multiplayer.isHost && allReady && (multiplayer.room?.participants.length ?? 0) >= 1;

  if (view === 'create') {
    return (
      <div className="min-h-screen flex flex-col bg-background" data-testid="multiplayer-create">
        <header className="flex items-center justify-between gap-3 px-4 py-3 sticky top-0 z-50 glass-surface safe-top">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="shrink-0"
              data-testid="button-back-home"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-medium text-sm truncate text-foreground">Create Room</h1>
              <p className="text-[11px] text-muted-foreground truncate">
                {session?.name || 'No script'}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col">
          <div className="px-5 pt-6 pb-4 relative">
            <div className="absolute -top-4 left-0 right-0 h-24 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent pointer-events-none" />
            <h2 className="text-lg font-semibold text-foreground relative">
              Host a table read
            </h2>
            <p className="text-sm text-muted-foreground mt-1 relative">
              Others will join using your room code.
            </p>
          </div>

          <div className="flex-1 px-4 pt-2 pb-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Your Name</label>
                <Input
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  data-testid="input-player-name"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 px-4 pt-3 pb-4 glass-surface safe-bottom">
          <Button
            size="lg"
            className="w-full"
            onClick={handleCreateRoom}
            disabled={!session || !playerName.trim() || !multiplayer.isConnected}
            data-testid="button-create-room"
          >
            {!multiplayer.isConnected ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Create Room'
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="min-h-screen flex flex-col bg-background" data-testid="multiplayer-join">
        <header className="flex items-center justify-between gap-3 px-4 py-3 sticky top-0 z-50 glass-surface safe-top">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="shrink-0"
              data-testid="button-back-home"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-medium text-sm truncate text-foreground">Join Room</h1>
              <p className="text-[11px] text-muted-foreground">Enter room code</p>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col">
          <div className="px-5 pt-6 pb-4 relative">
            <div className="absolute -top-4 left-0 right-0 h-24 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent pointer-events-none" />
            <h2 className="text-lg font-semibold text-foreground relative">
              Join a table read
            </h2>
            <p className="text-sm text-muted-foreground mt-1 relative">
              Ask the host for their room code.
            </p>
          </div>

          <div className="flex-1 px-4 pt-2 pb-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Room Code</label>
                <Input
                  placeholder="ABC123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-center text-xl tracking-widest font-mono"
                  data-testid="input-room-code"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Your Name</label>
                <Input
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  data-testid="input-player-name-join"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 px-4 pt-3 pb-4 glass-surface safe-bottom">
          <Button
            size="lg"
            className="w-full"
            onClick={handleJoinRoom}
            disabled={joinCode.length !== 6 || !playerName.trim() || !multiplayer.isConnected}
            data-testid="button-join-room"
          >
            {!multiplayer.isConnected ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              'Join Room'
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (multiplayer.room && (multiplayer.room.state === 'rehearsing' || multiplayer.room.state === 'paused' || multiplayer.room.state === 'completed')) {
    const room = multiplayer.room;
    const currentScene = room.scenes[room.currentSceneIndex];
    const currentLine = currentScene?.lines[room.currentLineIndex];
    const prevLine = room.currentLineIndex > 0 ? currentScene?.lines[room.currentLineIndex - 1] : null;
    const nextLine = currentScene?.lines[room.currentLineIndex + 1] ?? null;
    
    const currentSpeaker = room.participants.find(p => p.roleId === currentLine?.roleId);
    const isMyTurn = currentLine?.roleId === multiplayer.currentParticipant?.roleId;
    const myRole = room.roles.find(r => r.id === multiplayer.currentParticipant?.roleId);
    const isFirstLineOfScene = room.currentLineIndex === 0;
    
    return (
      <div className="min-h-screen relative" data-testid="multiplayer-rehearsal">
        {/* Hidden audio elements for peer streams - ensures joiners hear audio from host/peers */}
        {webrtc.peerStreams.map((peerStream) => (
          <PeerAudioElement 
            key={`audio-${peerStream.participantId}`}
            stream={peerStream.stream}
            participantId={peerStream.participantId}
            audioUnlocked={audioUnlocked}
          />
        ))}
        
        <MultiplayerVideoBackground
          localStream={webrtc.localStream}
          peerStreams={webrtc.peerStreams}
          participants={room.participants}
          myParticipantId={multiplayer.participantId}
          currentSpeakerId={currentSpeaker?.id ?? null}
          isAudioEnabled={webrtc.isAudioEnabled}
          isVideoEnabled={webrtc.isVideoEnabled}
          currentLine={!isCountingDown && currentLine ? {
            text: currentLine.text,
            roleName: currentLine.roleName,
            direction: currentLine.direction,
          } : undefined}
          previousLine={!isCountingDown && prevLine ? {
            text: prevLine.text,
            roleName: prevLine.roleName,
          } : undefined}
          nextLine={!isCountingDown && nextLine ? {
            text: nextLine.text,
            roleName: nextLine.roleName,
          } : undefined}
          isMyTurn={!isCountingDown && isMyTurn}
          userTranscript={userTranscript}
          isListening={listeningState === 'listening'}
          currentScene={!isCountingDown && currentScene ? {
            name: currentScene.name,
            description: currentScene.description,
          } : undefined}
          isFirstLineOfScene={!isCountingDown && isFirstLineOfScene}
        />
        
        {navNotification && (
          <div className="absolute top-28 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-2 duration-300" data-testid="nav-notification">
            <div className="bg-black/70 backdrop-blur-md rounded-lg px-4 py-2 flex items-center gap-2">
              {navNotification.includes('back') ? (
                <SkipBack className="h-3 w-3 text-white/70" />
              ) : (
                <SkipForward className="h-3 w-3 text-white/70" />
              )}
              <span className="text-white text-sm">{navNotification}</span>
            </div>
          </div>
        )}
        
        {/* Countdown overlay */}
        {isCountingDown && serverCountdown !== null && (
          <div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md cursor-pointer"
            onClick={() => {
              unlockAudio();
            }}
          >
            <div className="text-center">
              <div className="text-8xl font-bold text-white mb-4">{serverCountdown}</div>
              <p className="text-xl text-white/70">
                {audioUnlocked ? 'Get ready...' : 'Tap to enable audio'}
              </p>
            </div>
          </div>
        )}
        
        {/* Enforced audio unlock overlay during rehearsal - required for mobile audio playback */}
        {!isCountingDown && isActivelyRehearing && !audioUnlocked && (
          <div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer"
            onClick={() => {
              unlockAudio();
            }}
            data-testid="audio-unlock-overlay"
          >
            <div className="text-center px-6">
              <Volume2 className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Enable Audio</h2>
              <p className="text-lg text-white/70 mb-6">
                Tap anywhere to hear AI voices and other participants
              </p>
              <Button variant="default" size="lg" onClick={unlockAudio}>
                Enable Audio
              </Button>
            </div>
          </div>
        )}

        <header className="absolute top-0 left-0 right-0 z-30 glass-surface-clear bg-black/40 safe-top">
          <div className="flex items-center justify-between px-3 py-2 gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleLeave} 
              className="text-white shrink-0"
              data-testid="button-leave-rehearsal"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-1 flex-wrap justify-center min-w-0">
              <Badge className={cn(
                "bg-black/40 border-white/30 text-xs shrink-0",
                room.state === 'paused' ? 'text-white/70' : 'text-green-400'
              )}>
                {room.state === 'paused' ? 'Paused' : 'Live'}
              </Badge>
              {myRole && <Badge className="bg-primary/80 text-white text-xs truncate max-w-[100px]">{myRole.name}</Badge>}
            </div>
            
            <div className="flex items-center gap-0.5 shrink-0">
              {hasRecording && !isRecording && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={downloadRecording}
                  className="text-green-400"
                  data-testid="button-download-recording"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleRecording}
                className={cn(
                  "text-white",
                  isRecording && "text-red-500"
                )}
                data-testid="button-toggle-recording"
              >
                {isRecording ? (
                  <div className="relative">
                    <Circle className="h-4 w-4 fill-red-500 text-red-500 animate-pulse" />
                  </div>
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={webrtc.toggleAudio}
                className={cn(
                  "text-white",
                  !webrtc.isAudioEnabled && "text-red-400"
                )}
                data-testid="button-toggle-audio-rehearsal"
              >
                {webrtc.isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={webrtc.toggleVideo}
                className={cn(
                  "text-white",
                  !webrtc.isVideoEnabled && "text-red-400"
                )}
                data-testid="button-toggle-video-rehearsal"
              >
                {webrtc.isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        <footer className="absolute bottom-0 left-0 right-0 z-30 glass-surface-clear bg-black/40 safe-bottom">
          <div className="p-4">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-white/70">
                  {currentScene?.name || `Scene ${room.currentSceneIndex + 1}`}
                </span>
                <span className="text-sm text-white/70">
                  Line {room.currentLineIndex + 1} of {currentScene?.lines.length ?? 0}
                </span>
              </div>
              
              <div className="flex items-center justify-center gap-2">
                {multiplayer.isHost && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleManualBack}
                      className="bg-white/10 border-white/30 text-white"
                      data-testid="button-prev-line"
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      onClick={() => {
                        if (room.state === 'paused') {
                          multiplayer.resumeRehearsal();
                        } else {
                          stopAllMultiplayerPlayback();
                          multiplayer.pauseRehearsal();
                        }
                      }}
                      className="bg-white text-black"
                      data-testid="button-play-pause"
                    >
                      {room.state === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleManualSkip}
                      className="bg-white/10 border-white/30 text-white"
                      data-testid="button-next-line"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </>
                )}
                
                {!multiplayer.isHost && isMyTurn && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-white/70">
                      <Mic className="h-4 w-4 animate-pulse text-primary" />
                      <span className="text-sm">Listening...</span>
                    </div>
                    <Button
                      onClick={handleManualSkip}
                      variant="ghost"
                      size="sm"
                      className="text-white/50"
                      data-testid="button-skip-line"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                {!multiplayer.isHost && !isMyTurn && (
                  <p className="text-sm text-white/70">
                    {currentSpeaker ? `${currentSpeaker.name} is speaking...` : 'Waiting...'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </footer>
        
        {/* Completion Modal */}
        {showCompletion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="glass-surface-heavy rounded-2xl p-6 m-4 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  completionStats && completionStats.averageAccuracy >= 95 ? "bg-yellow-500 text-white" :
                  completionStats && completionStats.averageAccuracy >= 80 ? "bg-green-500 text-white" :
                  "bg-foreground text-background"
                )}>
                  {completionStats && completionStats.averageAccuracy >= 95 ? (
                    <Star className="h-6 w-6 fill-current" />
                  ) : (
                    <Check className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Table Read Complete</h3>
                  <p className={cn(
                    "text-sm",
                    completionStats && completionStats.averageAccuracy >= 95 ? "text-yellow-600 dark:text-yellow-400" :
                    completionStats && completionStats.averageAccuracy >= 80 ? "text-green-600 dark:text-green-400" :
                    "text-muted-foreground"
                  )}>
                    {completionStats && completionStats.averageAccuracy >= 95 ? "Flawless performance" :
                     completionStats && completionStats.averageAccuracy >= 80 ? "Great job" :
                     completionStats && completionStats.averageAccuracy >= 60 ? "Solid run" : "Nice work"}
                  </p>
                </div>
              </div>
              
              {/* Show personalized role name */}
              {multiplayer.currentParticipant?.roleId && (
                <p className="text-sm text-muted-foreground text-center mb-3">
                  Your performance as <span className="font-medium text-foreground">
                    {multiplayer.room?.roles.find(r => r.id === multiplayer.currentParticipant?.roleId)?.name || 'your role'}
                  </span>
                </p>
              )}
              
              {completionStats && completionStats.totalLines > 0 && (
                <div className="flex items-center justify-center gap-6 py-4 px-4 bg-muted/30 rounded-lg mb-4">
                  {completionStats.userLines > 0 ? (
                    <>
                      <div className="text-center">
                        <span className="text-2xl font-bold text-foreground">{Math.round(completionStats.averageAccuracy)}%</span>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">accuracy</p>
                      </div>
                      <div className="w-px h-8 bg-border" />
                      <div className="text-center">
                        <span className="text-2xl font-bold text-foreground">{completionStats.perfectLines}/{completionStats.userLines}</span>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">perfect</p>
                      </div>
                      {completionStats.userLines < completionStats.totalLines && (
                        <>
                          <div className="w-px h-8 bg-border" />
                          <div className="text-center">
                            <span className="text-2xl font-bold text-foreground">{completionStats.userLines}/{completionStats.totalLines}</span>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">spoken</p>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="text-center">
                      <span className="text-2xl font-bold text-foreground">0/{completionStats.totalLines}</span>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">lines spoken</p>
                    </div>
                  )}
                </div>
              )}
              
              {hasRecording && (
                <Button
                  variant="outline"
                  className="w-full mb-3"
                  onClick={downloadRecording}
                  data-testid="button-download-recording"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Recording
                </Button>
              )}
              
              {multiplayer.isHost && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setShowCompletion(false);
                    linePerformanceRef.current = [];
                    // Go to first scene/line
                    multiplayer.goToScene(0);
                    // Resume if paused or completed
                    if (multiplayer.room?.state === 'paused' || multiplayer.room?.state === 'completed') {
                      multiplayer.resumeRehearsal();
                    }
                  }}
                  data-testid="button-run-again"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Run Again
                </Button>
              )}
              
              <button
                onClick={() => {
                  setShowCompletion(false);
                  handleLeave();
                }}
                className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-leave-after-complete"
              >
                Leave Room
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === 'lobby' && multiplayer.room) {
    const room = multiplayer.room;
    
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handleLeave} data-testid="button-leave-room">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Leave
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Room Code:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                className="font-mono text-lg tracking-widest"
                data-testid="button-copy-code"
              >
                {room.code}
                {copied ? <Check className="h-4 w-4 ml-2" /> : <Copy className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-xl font-semibold">{room.scriptName}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {room.participants.length} participant{room.participants.length !== 1 ? 's' : ''}
            </p>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Camera Preview</CardTitle>
                <Button
                  variant={lobbyVideoEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={toggleLobbyCamera}
                  data-testid="button-toggle-lobby-camera"
                >
                  {lobbyVideoEnabled ? (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Camera On
                    </>
                  ) : (
                    <>
                      <CameraOff className="h-4 w-4 mr-2" />
                      Camera Off
                    </>
                  )}
                </Button>
              </div>
              <CardDescription>
                {lobbyVideoEnabled ? 'Your camera is active' : 'Enable camera to preview before rehearsal'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "relative aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center",
                !lobbyVideoEnabled && "border border-dashed border-muted-foreground/30"
              )}>
                {lobbyVideoEnabled ? (
                  <video
                    ref={lobbyVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <CameraOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Camera off</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Mic permission status */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Microphone</CardTitle>
                {micPermissionGranted ? (
                  <Badge className="bg-green-500/20 text-green-600">
                    <Mic className="h-3 w-3 mr-1" />
                    Ready
                  </Badge>
                ) : micPermissionDenied ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={requestMicPermission}
                    data-testid="button-retry-mic-permission"
                  >
                    <MicOff className="h-4 w-4 mr-2 text-red-500" />
                    Retry
                  </Button>
                ) : (
                  <Badge variant="secondary">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Checking...
                  </Badge>
                )}
              </div>
              <CardDescription>
                {micPermissionGranted 
                  ? 'Mic access granted for speech recognition' 
                  : micPermissionDenied 
                    ? 'Mic access denied. Tap Retry to try again.' 
                    : 'Requesting mic permission...'}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Participants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {room.participants.map((p) => {
                const role = room.roles.find(r => r.id === p.roleId);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-md",
                      p.id === multiplayer.participantId ? "bg-primary/10" : "bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{p.name}</span>
                      {p.isHost && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {role && (
                        <Badge variant="secondary">{role.name}</Badge>
                      )}
                      {p.isReady && (
                        <Badge className="bg-green-500/20 text-green-600">Ready</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Your Role</CardTitle>
              <CardDescription>Choose the character you want to play</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {room.roles.map((role) => {
                  const takenBy = room.participants.find(p => p.roleId === role.id);
                  const isSelected = multiplayer.currentParticipant?.roleId === role.id;
                  const isTakenByOther = takenBy && takenBy.id !== multiplayer.participantId;
                  
                  return (
                    <Button
                      key={role.id}
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "justify-start h-auto py-2.5 px-3 w-full overflow-hidden",
                        isTakenByOther && "opacity-50"
                      )}
                      disabled={isTakenByOther}
                      onClick={() => handleSelectRole(role.id)}
                      data-testid={`button-select-role-${role.id}`}
                    >
                      <div className="text-left w-full min-w-0">
                        <div className="font-medium text-sm truncate" title={role.name}>
                          {role.name}
                        </div>
                        <div className="text-xs opacity-70 truncate">
                          {role.lineCount} line{role.lineCount !== 1 ? 's' : ''}
                          {isTakenByOther && ` · ${takenBy.name}`}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              variant={multiplayer.currentParticipant?.isReady ? "secondary" : "outline"}
              className="flex-1"
              onClick={() => {
                unlockAudio(); // Unlock audio on user gesture
                // For hosts, also init TTS on Ready click (user gesture)
                if (multiplayer.isHost) {
                  ttsEngine.initAudioContext();
                  const stream = ttsEngine.getTTSAudioStream();
                  if (stream && !ttsAudioStream) {
                    console.log('[Multiplayer] TTS audio stream ready on Ready click');
                    setTtsAudioStream(stream);
                  }
                }
                multiplayer.setReady(!multiplayer.currentParticipant?.isReady);
              }}
              data-testid="button-toggle-ready"
            >
              {multiplayer.currentParticipant?.isReady ? 'Not Ready' : 'Ready'}
            </Button>
            
            {multiplayer.isHost && (
              <Button
                className="flex-1"
                disabled={!canStart}
                onClick={() => {
                  unlockAudio();
                  // Ensure TTS audio context is initialized on user gesture (host only)
                  // This guarantees AudioContext works on iOS/Safari
                  ttsEngine.initAudioContext();
                  const stream = ttsEngine.getTTSAudioStream();
                  if (stream && !ttsAudioStream) {
                    console.log('[Multiplayer] TTS audio stream ready on Start click');
                    setTtsAudioStream(stream);
                  }
                  multiplayer.startRehearsal();
                }}
                data-testid="button-start-rehearsal"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Rehearsal
              </Button>
            )}
          </div>

          {!allReady && (
            <p className="text-center text-sm text-muted-foreground">
              Waiting for all participants to be ready...
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
