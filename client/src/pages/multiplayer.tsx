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
import { ttsEngine, calculateProsody, SpeakResult } from '@/lib/tts-engine';
import { speechRecognition, type SpeechRecognitionState } from '@/lib/speech-recognition';
import { matchWords } from '@/lib/word-matcher';
import { Users, Copy, Check, Play, Crown, UserCircle, ArrowLeft, Loader2, Pause, SkipForward, SkipBack, Volume2, Mic, MicOff, Video, VideoOff, Circle, Camera, CameraOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type View = 'menu' | 'create' | 'join' | 'lobby';

interface MultiplayerPageProps {
  onBack: () => void;
  onStartRehearsal?: (room: any) => void;
  initialView?: View;
}

export default function MultiplayerPage({ onBack, onStartRehearsal, initialView = 'menu' }: MultiplayerPageProps) {
  const { session } = useSessionContext();
  const { toast } = useToast();
  
  const [view, setView] = useState<View>(initialView);
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingBlobRef = useRef<Blob | null>(null);

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
    onRoomCreated: (room) => {
      toast({ title: 'Room Created', description: `Share code: ${room.code}` });
      setView('lobby');
    },
    onRoomJoined: () => {
      toast({ title: 'Joined Room' });
      setView('lobby');
    },
    onError: (message) => {
      toast({ title: 'Error', description: message, variant: 'destructive' });
    },
    onKicked: () => {
      toast({ title: 'Removed from room', variant: 'destructive' });
      setView('menu');
    },
    onRoomClosed: () => {
      toast({ title: 'Room closed' });
      setView('menu');
    },
  });

  // WebRTC should start during countdown so peers are connected by the time rehearsal starts
  const isRehearsingOrPaused = !!multiplayer.room && (multiplayer.room.state === 'rehearsing' || multiplayer.room.state === 'paused' || multiplayer.room.state === 'counting_down');
  const isActivelyRehearing = !!multiplayer.room && multiplayer.room.state === 'rehearsing';
  
  // Lobby camera state - declared before webrtc so stream can be reused
  const [lobbyVideoEnabled, setLobbyVideoEnabled] = useState(false);
  const [lobbyStream, setLobbyStream] = useState<MediaStream | null>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraPreferenceForRehearsal, setCameraPreferenceForRehearsal] = useState(true);
  
  // Get TTS audio stream for mixing with WebRTC (so everyone hears AI voices)
  const [ttsAudioStream, setTtsAudioStream] = useState<MediaStream | null>(null);
  
  // Initialize TTS audio context when audio is unlocked
  useEffect(() => {
    if (audioUnlocked && multiplayer.isHost) {
      ttsEngine.initAudioContext();
      const stream = ttsEngine.getTTSAudioStream();
      if (stream) {
        console.log('[Multiplayer] TTS audio stream ready for WebRTC mixing');
        setTtsAudioStream(stream);
      }
    }
  }, [audioUnlocked, multiplayer.isHost]);
  
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
  
  // Recording functions
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setIsRecording(false);
    } else {
      // Start recording
      const stream = webrtc.localStream;
      if (!stream) {
        toast({ title: 'No camera stream', description: 'Enable camera to record', variant: 'destructive' });
        return;
      }
      
      recordingChunksRef.current = [];
      setRecordingTime(0);
      setHasRecording(false);
      
      // Determine supported MIME type
      const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      let mimeType = 'video/webm';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      try {
        const recorder = new MediaRecorder(stream, { mimeType });
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
        
        // Start timer
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(t => t + 1);
        }, 1000);
        
      } catch (err) {
        console.error('[Recording] Error starting:', err);
        toast({ title: 'Recording failed', variant: 'destructive' });
      }
    }
  }, [isRecording, webrtc.localStream, toast]);
  
  const downloadRecording = useCallback(() => {
    if (!recordingBlobRef.current) return;
    const url = URL.createObjectURL(recordingBlobRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = `castmate-tableread-${new Date().toISOString().slice(0,10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);
  
  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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
  
  const speakAiLine = useCallback((lineId: string, text: string, roleName: string, characterIndex: number, isHost: boolean) => {
    // ALWAYS stop any current audio first to prevent overlap
    ttsEngine.stop();
    
    // Clear any pending safety timeout from previous line
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    // Clear any pending advance timeout
    if (aiSpeakTimeoutRef.current) {
      clearTimeout(aiSpeakTimeoutRef.current);
      aiSpeakTimeoutRef.current = null;
    }
    
    // Prevent duplicate calls for the same line
    if (speakingLineRef.current === lineId) {
      console.log('[Multiplayer TTS] Already speaking this line, skipping');
      return;
    }
    
    speakingLineRef.current = lineId;
    setIsAiSpeaking(true);
    isAiSpeakingRef.current = true; // Update ref immediately
    
    console.log('[Multiplayer TTS] Speaking:', roleName, text.substring(0, 30), 'isHost:', isHost);
    
    const prosody = calculateProsody('neutral', 'natural');
    
    // Safety timeout: if TTS doesn't complete in reasonable time, advance anyway (host only)
    const estimatedDuration = Math.max(5000, text.length * 100); // ~100ms per character
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
      isAiSpeakingRef.current = false; // Update ref immediately for callbacks
      
      // Only HOST advances to prevent race conditions
      if (isHost) {
        aiSpeakTimeoutRef.current = setTimeout(() => {
          console.log('[Multiplayer TTS] Host calling nextLine() via ref');
          // Use ref to ensure we always call the latest multiplayer.nextLine
          multiplayerRef.current.nextLine();
        }, 200);
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
      text, 
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
      }
    );
  }, []);

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
    
    console.log('[Multiplayer] TTS Effect:', {
      lineId: currentLine.id,
      lineIndex: room.currentLineIndex,
      roleName: currentLine.roleName,
      isRoleAssignedToParticipant,
      isHost: multiplayer.isHost,
      speakingLineRef: speakingLineRef.current,
    });
    
    // ONLY HOST plays TTS for unassigned roles to avoid sync issues
    // Joining devices see lines visually and hear through host's speakers/WebRTC
    if (!isRoleAssignedToParticipant && multiplayer.isHost) {
      hasStartedRef.current = true; // Mark that we've started
      const roleIndex = room.roles.findIndex(r => r.id === lineRoleId);
      console.log('[Multiplayer] Starting TTS for AI line:', currentLine.roleName, roleIndex);
      speakAiLine(currentLine.id, currentLine.text, currentLine.roleName, roleIndex >= 0 ? roleIndex : 0, true);
    } else if (isRoleAssignedToParticipant) {
      // This is a human player's turn - check if it's MY turn
      const assignedParticipant = room.participants.find(p => p.roleId === lineRoleId);
      const isMyTurn = assignedParticipant?.id === multiplayer.participantId;
      
      console.log('[Multiplayer] User turn detected for:', currentLine.roleName, 'isMyTurn:', isMyTurn);
      
      if (isMyTurn) {
        // Directly trigger speech recognition here, don't rely on separate effect
        console.log('[Multiplayer] MY TURN - triggering speech recognition directly');
        isAiSpeakingRef.current = false; // Ensure this is false
        setIsAiSpeaking(false);
        
        // Small delay to let any audio finish
        setTimeout(() => {
          if (isActivelyRehearsalRef.current && !isAiSpeakingRef.current) {
            waitingForUserRef.current = true;
            
            if (speechRecognition.available) {
              console.log('[Multiplayer] Starting speech recognition for my turn');
              const started = speechRecognition.start();
              console.log('[Multiplayer] Speech recognition start result:', started);
            }
            
            // Set up timeout for auto-advance
            if (userTurnTimeoutRef.current) {
              clearTimeout(userTurnTimeoutRef.current);
            }
            // Safety timeout: 60 seconds like solo mode (generous time for user)
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
        }, 300);
      }
    }
    
    // NOTE: No cleanup needed - the aiSpeakTimeoutRef is intentionally NOT cleared
    // when this effect re-runs because it may contain the nextLine() call that 
    // advances to the next line. Clearing it would break auto-advance.
  }, [isActivelyRehearing, multiplayer.room, speakAiLine, multiplayer.isHost, multiplayer.participantId, webrtc.allPeersConnected, webrtc.allPeersHaveStreams, webrtc.connectedPeersCount]);

  useEffect(() => {
    return () => {
      ttsEngine.stop();
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

    if (speechRecognition.available && !micBlocked) {
      setTimeout(() => {
        // Use ref to check current state, not stale closure
        if (waitingForUserRef.current && !isAiSpeakingRef.current) {
          const started = speechRecognition.start();
          if (!started) {
            console.log("[Multiplayer] Speech recognition failed to start");
          } else {
            console.log("[Multiplayer] Speech recognition started successfully");
          }
        }
      }, 200);
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
    console.log("[Multiplayer] Advancing after user line");
    setUserTranscript("");
    currentLineAccuracyRef.current = 0;
    multiplayerRef.current.nextLine();
  }, []);

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
      
      // On final result, auto-advance if we have at least some progress (35%+ like solo)
      if (result.isFinal && waitingForUserRef.current && isActivelyRehearsalRef.current && line) {
        const match = matchWords(line.text, result.transcript);
        if (match.percentMatched >= 35) {
          console.log("[Multiplayer] Final result with", Math.round(match.percentMatched), "% match, advancing");
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
          
          // Quick transition (200ms for snappy response like solo)
          autoAdvanceTimeoutRef.current = setTimeout(() => {
            if (isActivelyRehearsalRef.current) {
              advanceAfterUserLine();
            }
          }, 200);
        } else {
          console.log("[Multiplayer] Low match on final result, waiting for more speech");
          // Don't advance yet, keep listening
        }
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

  // Clear transcript and reset when line changes
  useEffect(() => {
    const line = getCurrentLineForMatch();
    if (line) {
      // Reset for new line
      advancedForLineRef.current = null;
      currentLineAccuracyRef.current = 0;
      setUserTranscript("");
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

  // Manual skip handler - stops TTS and clears all timeouts before advancing
  const handleManualSkip = useCallback(() => {
    console.log('[Multiplayer] Manual skip - stopping all audio');
    
    // Stop TTS immediately
    ttsEngine.stop();
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
    
    // Clear any pending advance timeouts
    if (aiSpeakTimeoutRef.current) {
      clearTimeout(aiSpeakTimeoutRef.current);
      aiSpeakTimeoutRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    
    // Stop speech recognition
    speechRecognition.abort();
    waitingForUserRef.current = false;
    if (userTurnTimeoutRef.current) {
      clearTimeout(userTurnTimeoutRef.current);
      userTurnTimeoutRef.current = null;
    }
    
    // Reset speaking ref so next line can speak
    speakingLineRef.current = null;
    
    // Now advance
    multiplayer.nextLine();
  }, [multiplayer]);

  useEffect(() => {
    return () => {
      speechRecognition.abort();
      if (userTurnTimeoutRef.current) {
        clearTimeout(userTurnTimeoutRef.current);
      }
    };
  }, []);

  const handleCreateRoom = () => {
    if (!session || !playerName.trim()) return;
    multiplayer.createRoom(
      session.name,
      session.roles,
      session.scenes,
      playerName.trim()
    );
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim() || !playerName.trim()) return;
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
    multiplayer.leaveRoom();
    setView('menu');
  };

  const allReady = multiplayer.room?.participants.every(p => p.isReady) ?? false;
  const canStart = multiplayer.isHost && allReady && (multiplayer.room?.participants.length ?? 0) >= 1;

  if (view === 'menu') {
    return (
      <div className="min-h-screen flex flex-col bg-background" data-testid="multiplayer-menu">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur-sm safe-top">
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
              <h1 className="font-medium text-sm truncate text-foreground">Table Read</h1>
              <p className="text-[11px] text-muted-foreground">Multiplayer</p>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col">
          <div className="px-5 pt-6 pb-4 relative">
            <div className="absolute -top-4 left-0 right-0 h-24 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent pointer-events-none" />
            <h2 className="text-lg font-semibold text-foreground relative">
              Rehearse together
            </h2>
            <p className="text-sm text-muted-foreground mt-1 relative">
              Read through scripts with friends in real-time.
            </p>
          </div>

          <div className="flex-1 px-4 pt-2 pb-6 space-y-3">
            <Card 
              className="hover-elevate cursor-pointer transition-all duration-150 press-effect" 
              onClick={() => session ? setView('create') : undefined}
              data-testid="card-create-room"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg",
                    session ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Create Room</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {session ? `Host with "${session.name}"` : 'Import a script first'}
                    </CardDescription>
                  </div>
                  {session && <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />}
                </div>
              </CardHeader>
            </Card>

            <Card 
              className="hover-elevate cursor-pointer transition-all duration-150 press-effect" 
              onClick={() => setView('join')}
              data-testid="card-join-room"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                    <UserCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">Join Room</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Enter a 6-character room code
                    </CardDescription>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>

        <footer className="px-5 py-6 pb-8 border-t border-border/40 safe-bottom">
          <p className="text-[11px] text-muted-foreground/60 text-center">
            Video and audio stay between participants.
          </p>
        </footer>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="min-h-screen flex flex-col bg-background" data-testid="multiplayer-create">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur-sm safe-top">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('menu')}
              className="shrink-0"
              data-testid="button-back-menu"
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

        <div className="sticky bottom-0 px-4 pt-3 pb-4 border-t border-border/40 bg-background safe-bottom">
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
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur-sm safe-top">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView('menu')}
              className="shrink-0"
              data-testid="button-back-menu"
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

        <div className="sticky bottom-0 px-4 pt-3 pb-4 border-t border-border/40 bg-background safe-bottom">
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

  if (multiplayer.room && (multiplayer.room.state === 'rehearsing' || multiplayer.room.state === 'paused')) {
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
        
        {isCountingDown && serverCountdown !== null && (
          <div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
            onClick={() => {
              unlockAudio(); // Unlock audio when user taps during countdown
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

        <header className="absolute top-0 left-0 right-0 z-30 bg-black/40 backdrop-blur-sm safe-top">
          <div className="flex items-center justify-between px-3 py-2 gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleLeave} 
              className="text-white hover:text-white hover:bg-white/20 shrink-0"
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
              {/* Record button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={hasRecording && !isRecording ? downloadRecording : toggleRecording}
                className={cn(
                  "text-white hover:text-white hover:bg-white/20 h-8 w-8",
                  isRecording && "text-red-500"
                )}
                data-testid="button-toggle-recording"
              >
                {isRecording ? (
                  <div className="relative">
                    <Circle className="h-4 w-4 fill-red-500 text-red-500 animate-pulse" />
                  </div>
                ) : hasRecording ? (
                  <Circle className="h-4 w-4 fill-green-500 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={webrtc.toggleAudio}
                className={cn(
                  "text-white hover:text-white hover:bg-white/20 h-8 w-8",
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
                  "text-white hover:text-white hover:bg-white/20 h-8 w-8",
                  !webrtc.isVideoEnabled && "text-red-400"
                )}
                data-testid="button-toggle-video-rehearsal"
              >
                {webrtc.isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>

        <footer className="absolute bottom-0 left-0 right-0 z-30 bg-black/40 backdrop-blur-sm safe-bottom">
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
                      onClick={() => multiplayer.prevLine()}
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
                      data-testid="button-prev-line"
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      onClick={() => room.state === 'paused' ? multiplayer.resumeRehearsal() : multiplayer.pauseRehearsal()}
                      className="bg-white text-black hover:bg-white/90"
                      data-testid="button-play-pause"
                    >
                      {room.state === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleManualSkip}
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
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
                      className="text-white/50 hover:text-white"
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
