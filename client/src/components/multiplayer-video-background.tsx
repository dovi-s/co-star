import { useEffect, useRef, useState, useMemo } from 'react';
import type { PeerStream } from '@/hooks/use-webrtc';
import type { Participant } from '@shared/schema';
import { cn } from '@/lib/utils';
import { Mic, MicOff, VideoOff, Crown } from 'lucide-react';
import { matchWords } from '@/lib/word-matcher';

interface LineData {
  text: string;
  roleName: string;
  direction?: string;
}

interface SceneData {
  name: string;
  description?: string;
}

interface MultiplayerVideoBackgroundProps {
  localStream: MediaStream | null;
  peerStreams: PeerStream[];
  participants: Participant[];
  myParticipantId: string | null;
  currentSpeakerId: string | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  currentLine?: LineData;
  previousLine?: LineData;
  nextLine?: LineData;
  isMyTurn: boolean;
  userTranscript?: string;
  isListening?: boolean;
  currentScene?: SceneData;
  isFirstLineOfScene?: boolean;
  className?: string;
}

interface SmallVideoTileProps {
  stream: MediaStream | null;
  participant?: Participant;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
}

function SmallVideoTile({ stream, participant, isLocal, isMuted, isVideoOff, isSpeaking }: SmallVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamIdRef = useRef<string>('');
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (!videoRef.current) return;
    const video = videoRef.current;
    
    if (!stream || streamIdRef.current !== stream.id) {
      setVideoReady(false);
      streamIdRef.current = stream?.id || '';
    }

    if (stream) {
      video.srcObject = stream;
      
      const videoTracks = stream.getVideoTracks();
      const hasVideoTracks = videoTracks.length > 0;
      
      if (hasVideoTracks) {
        setVideoReady(true);
      }
      
      const markVideoReady = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          setVideoReady(true);
        }
      };
      
      const handleCanPlay = () => markVideoReady();
      const handleLoadedMetadata = () => markVideoReady();
      
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      const handleTrackAdd = (e: MediaStreamTrackEvent) => {
        if (e.track.kind === 'video') {
          setVideoReady(true);
          video.srcObject = stream;
          video.play().catch(() => {});
        }
      };
      const handleTrackRemove = (e: MediaStreamTrackEvent) => {
        if (e.track.kind === 'video') {
          if (stream.getVideoTracks().length === 0) {
            setVideoReady(false);
          }
        }
      };
      stream.addEventListener('addtrack', handleTrackAdd);
      stream.addEventListener('removetrack', handleTrackRemove);
      
      if (video.readyState >= 2 && video.videoWidth > 0) {
        markVideoReady();
      } else if (hasVideoTracks) {
        setVideoReady(true);
      }
      
      const attemptPlay = (attempt = 0) => {
        if (!videoRef.current) return;
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        videoRef.current.play().then(() => {
          markVideoReady();
        }).catch(() => {
          if (attempt < 20) {
            retryTimerRef.current = setTimeout(() => attemptPlay(attempt + 1), Math.min(300 * (attempt + 1), 2000));
          }
        });
      };
      attemptPlay(0);
      setTimeout(() => attemptPlay(1), 300);
      setTimeout(() => attemptPlay(2), 800);
      setTimeout(() => attemptPlay(3), 1500);
      
      const pollInterval = setInterval(() => {
        if (!videoRef.current) return;
        const tracks = stream.getVideoTracks();
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
          if (videoRef.current.srcObject !== stream) {
            videoRef.current.srcObject = stream;
          }
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
          }
          if (videoRef.current.videoWidth > 0) {
            setVideoReady(true);
          }
        }
      }, 2000);
      
      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        stream.removeEventListener('addtrack', handleTrackAdd);
        stream.removeEventListener('removetrack', handleTrackRemove);
        clearInterval(pollInterval);
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
        }
      };
    } else {
      video.srcObject = null;
      setVideoReady(false);
    }
  }, [stream, participant?.id]);

  // Show video if we have a stream and video is ready
  const showVideo = stream && videoReady && !isVideoOff;

  return (
    <div
      className={cn(
        "relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-black",
        isSpeaking && "ring-2 ring-white"
      )}
      data-testid={`small-video-tile-${participant?.id || 'local'}`}
    >
      {/* Always render video element for stream attachment, hide visually if no video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        webkit-playsinline="true"
        className={cn(
          "w-full h-full object-cover",
          isLocal && "transform scale-x-[-1]",
          !showVideo && "hidden"
        )}
      />
      {!showVideo && (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-base font-medium text-white">
              {participant?.name?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
        <div className="flex items-center gap-0.5 bg-black/60 rounded px-1 py-0.5 max-w-[60px]">
          {participant?.isHost && <Crown className="h-2 w-2 text-yellow-400 flex-shrink-0" />}
          <span className="text-[9px] text-white font-medium truncate">
            {isLocal ? 'You' : participant?.name?.split(' ')[0] || '?'}
          </span>
        </div>
        {(isMuted || isVideoOff) && (
          <div className="flex gap-0.5">
            {isMuted && (
              <div className="bg-red-500/80 rounded-full p-0.5">
                <MicOff className="h-2 w-2 text-white" />
              </div>
            )}
            {isVideoOff && (
              <div className="bg-red-500/80 rounded-full p-0.5">
                <VideoOff className="h-2 w-2 text-white" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MultiplayerVideoBackground({
  localStream,
  peerStreams,
  participants,
  myParticipantId,
  currentSpeakerId,
  isAudioEnabled,
  isVideoEnabled,
  currentLine,
  previousLine,
  nextLine,
  isMyTurn,
  userTranscript = '',
  isListening = false,
  currentScene,
  isFirstLineOfScene = false,
  className,
}: MultiplayerVideoBackgroundProps) {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Focus mode: 'face' zooms in on face, 'script' shows script prominently
  const [focusMode, setFocusMode] = useState<'script' | 'face'>('script');
  
  // Script box vertical position adjustment (percentage from bottom, default 32 = bottom-32)
  const [scriptOffset, setScriptOffset] = useState(32); // Tailwind's bottom-32 = 8rem = 128px
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const startOffsetRef = useRef(32);
  
  // Handle mouse move/up for desktop drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = dragStartYRef.current - e.clientY;
      const newOffset = Math.max(8, Math.min(80, startOffsetRef.current + deltaY / 4));
      setScriptOffset(newOffset);
    };
    
    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  
  const currentSpeaker = participants.find(p => p.id === currentSpeakerId);
  const myParticipant = participants.find(p => p.id === myParticipantId);
  
  // Word matching for user's turn (like solo mode)
  const wordMatchResult = useMemo(() => {
    if (!isMyTurn || !currentLine || !userTranscript) {
      return null;
    }
    return matchWords(currentLine.text, userTranscript);
  }, [isMyTurn, currentLine?.text, userTranscript]);
  
  const effectiveSpeakerId = currentSpeakerId;
  const isLocalSpeaker = currentSpeakerId === myParticipantId;
  
  const [peerVideoReady, setPeerVideoReady] = useState(0);
  
  useEffect(() => {
    if (peerStreams.length === 0) return;
    
    const checkTracks = () => {
      const anyLive = peerStreams.some(ps => 
        ps.stream.getVideoTracks().some(t => t.readyState === 'live')
      );
      if (anyLive) {
        setPeerVideoReady(prev => prev + 1);
      }
    };
    
    const handlers: Array<() => void> = [];
    peerStreams.forEach(ps => {
      ps.stream.getVideoTracks().forEach(track => {
        const onUnmute = () => setPeerVideoReady(prev => prev + 1);
        track.addEventListener('unmute', onUnmute);
        handlers.push(() => track.removeEventListener('unmute', onUnmute));
      });
    });
    
    const interval = setInterval(checkTracks, 1500);
    checkTracks();
    
    return () => {
      clearInterval(interval);
      handlers.forEach(h => h());
    };
  }, [peerStreams]);
  
  const localHasVideo = localStream && localStream.getVideoTracks().length > 0 
    && localStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
  
  const speakerPeerStream = !isLocalSpeaker && effectiveSpeakerId 
    ? peerStreams.find(ps => ps.participantId === effectiveSpeakerId)?.stream 
    : null;
  
  const peerWithVideo = peerStreams.find(ps => {
    const videoTracks = ps.stream.getVideoTracks();
    return videoTracks.length > 0 && videoTracks.some(t => t.readyState === 'live');
  });
  const firstPeerStream = peerWithVideo?.stream || (peerStreams.length > 0 ? peerStreams[0].stream : null);
  
  const speakerPeerHasVideo = speakerPeerStream && speakerPeerStream.getVideoTracks().length > 0
    && speakerPeerStream.getVideoTracks().some(t => t.readyState === 'live');
  
  void peerVideoReady;
  
  const mainStream = speakerPeerHasVideo
    ? speakerPeerStream
    : (firstPeerStream && firstPeerStream.getVideoTracks().some(t => t.readyState === 'live'))
      ? firstPeerStream
      : localHasVideo
        ? localStream
        : (firstPeerStream || localStream);
  const showLocalAsMain = mainStream === localStream;

  useEffect(() => {
    if (!mainStream || !mainVideoRef.current || !mainCanvasRef.current) return;

    const video = mainVideoRef.current;
    const canvas = mainCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    video.srcObject = mainStream;
    
    // Play with retry for mobile autoplay restrictions
    let retryTimer: NodeJS.Timeout | null = null;
    const attemptPlay = (attempt = 0) => {
      video.play().catch(() => {
        if (attempt < 10) {
          retryTimer = setTimeout(() => attemptPlay(attempt + 1), 300 * (attempt + 1));
        }
      });
    };
    attemptPlay();

    const drawFrame = () => {
      if (!video.videoWidth || !video.videoHeight) {
        animationRef.current = requestAnimationFrame(drawFrame);
        return;
      }

      const containerWidth = window.innerWidth;
      const containerHeight = window.innerHeight;
      
      canvas.width = containerWidth;
      canvas.height = containerHeight;

      const videoAspect = video.videoWidth / video.videoHeight;
      const containerAspect = containerWidth / containerHeight;

      let drawWidth, drawHeight, drawX, drawY;

      if (containerAspect > videoAspect) {
        drawWidth = containerWidth;
        drawHeight = containerWidth / videoAspect;
        drawX = 0;
        drawY = (containerHeight - drawHeight) / 2;
      } else {
        drawHeight = containerHeight;
        drawWidth = containerHeight * videoAspect;
        drawX = (containerWidth - drawWidth) / 2;
        drawY = 0;
      }

      ctx.save();
      if (showLocalAsMain) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, canvas.width - drawX - drawWidth, drawY, drawWidth, drawHeight);
      } else {
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
      }
      ctx.restore();

      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.3,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.7
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    video.onloadedmetadata = () => {
      animationRef.current = requestAnimationFrame(drawFrame);
    };

    if (video.readyState >= 2) {
      animationRef.current = requestAnimationFrame(drawFrame);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [mainStream, showLocalAsMain]);

  const mainParticipantId = showLocalAsMain 
    ? myParticipantId 
    : (effectiveSpeakerId || peerStreams[0]?.participantId || myParticipantId);
  
  const stripParticipants = participants.filter(p => {
    if (showLocalAsMain) return p.id !== myParticipantId;
    return p.id !== mainParticipantId;
  });

  const toggleFocus = () => {
    setFocusMode(prev => prev === 'script' ? 'face' : 'script');
  };

  return (
    <div className={cn("fixed inset-0 z-0 bg-black", className)}>
      <video
        ref={mainVideoRef}
        className="hidden"
        playsInline
        muted
        autoPlay
      />
      {mainStream ? (
        <canvas
          ref={mainCanvasRef}
          className={cn(
            "w-full h-full object-cover transition-all duration-300 ease-out",
            focusMode === 'script' && "brightness-75"
          )}
          onClick={toggleFocus}
          data-testid="video-canvas"
        />
      ) : (
        <div 
          className={cn(
            "w-full h-full flex items-center justify-center transition-all duration-300",
            focusMode === 'script' && "opacity-60"
          )}
          onClick={toggleFocus}
        >
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl font-medium text-white">
                {isLocalSpeaker 
                  ? (myParticipant?.name?.charAt(0).toUpperCase() || 'Y')
                  : (currentSpeaker?.name?.charAt(0).toUpperCase() || '?')}
              </span>
            </div>
            <p className="text-white/70 text-sm">
              {isLocalSpeaker 
                ? 'Your camera is off'
                : currentSpeaker?.name 
                  ? `Waiting for ${currentSpeaker.name}'s video...`
                  : 'Waiting for video...'}
            </p>
          </div>
        </div>
      )}

      <div 
        className="absolute top-20 left-4 flex flex-col gap-2 z-20"
        data-testid="participant-strip"
      >
        {stripParticipants.map(participant => {
          const isLocalInStrip = participant.id === myParticipantId;
          const peerStream = peerStreams.find(ps => ps.participantId === participant.id);
          const stream = isLocalInStrip ? localStream : (peerStream?.stream || null);
          const isSpeakingNow = participant.id === effectiveSpeakerId;
          
          return (
            <SmallVideoTile
              key={participant.id}
              stream={stream}
              participant={participant}
              isLocal={isLocalInStrip}
              isMuted={false}
              isVideoOff={false}
              isSpeaking={isSpeakingNow}
            />
          );
        })}
      </div>

      {/* Turn indicator - positioned below header */}
      <div className="absolute top-16 right-4 z-20">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full",
            isMyTurn ? "bg-primary animate-pulse" : "bg-green-500"
          )} />
          <span className="text-white text-sm font-medium">
            {isMyTurn 
              ? 'Your turn' 
              : currentSpeaker 
                ? `${currentSpeaker.name}'s turn` 
                : currentLine?.roleName 
                  ? `${currentLine.roleName} (reader)` 
                  : 'Reader speaking'}
          </span>
        </div>
      </div>

      <div 
        className="absolute left-4 right-4 z-20"
        style={{ bottom: `${scriptOffset * 4}px` }}
        onClick={(e) => {
          e.stopPropagation();
          if (focusMode === 'face') {
            setFocusMode('script');
          }
        }}
        data-testid="script-overlay"
      >
        <div className="max-w-2xl mx-auto">
          {/* Drag handle to adjust script position */}
          <div 
            className="flex justify-center mb-2"
            onTouchStart={(e) => {
              isDraggingRef.current = true;
              dragStartYRef.current = e.touches[0].clientY;
              startOffsetRef.current = scriptOffset;
            }}
            onTouchMove={(e) => {
              if (!isDraggingRef.current) return;
              const deltaY = dragStartYRef.current - e.touches[0].clientY;
              const newOffset = Math.max(8, Math.min(80, startOffsetRef.current + deltaY / 4));
              setScriptOffset(newOffset);
            }}
            onTouchEnd={() => {
              isDraggingRef.current = false;
            }}
            onMouseDown={(e) => {
              isDraggingRef.current = true;
              dragStartYRef.current = e.clientY;
              startOffsetRef.current = scriptOffset;
              e.preventDefault();
            }}
            data-testid="script-drag-handle"
          >
            <div className="w-12 h-1.5 bg-white/40 rounded-full cursor-ns-resize hover:bg-white/60 transition-colors" />
          </div>
          {/* Scene transition card - like solo mode */}
          {isFirstLineOfScene && currentScene && (
            <div 
              className="bg-black/50 backdrop-blur-xl border border-white/20 px-4 py-3 rounded-lg mb-3 animate-in fade-in slide-in-from-top-2 duration-300"
              data-testid="scene-transition-card"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                  Scene
                </span>
              </div>
              <p className="text-sm font-medium leading-snug text-white">
                {currentScene.name}
              </p>
              {currentScene.description && (
                <p className="mt-1.5 text-xs leading-relaxed italic text-white/60">
                  {currentScene.description}
                </p>
              )}
            </div>
          )}

          <div className={cn(
            "bg-black/70 backdrop-blur-md rounded-2xl p-6 border transition-all duration-300 ease-out",
            focusMode === 'script' 
              ? "border-white/20 shadow-lg shadow-black/20" 
              : "border-white/5 opacity-50 blur-[1px]"
          )}>
            {previousLine && (
              <div className="text-center mb-4 opacity-50">
                <span className="text-xs font-medium text-white/70">{previousLine.roleName}</span>
                <p className="text-sm text-white/70">{previousLine.text}</p>
              </div>
            )}
            
            {currentLine && (
              <div className={cn(
                "text-center py-4 px-2 rounded-lg transition-all",
                isMyTurn ? "bg-primary/20 border border-primary/40" : ""
              )}>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className={cn(
                    "text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded",
                    isMyTurn ? "bg-primary text-primary-foreground" : "bg-white/20 text-white"
                  )}>
                    {currentLine.roleName}
                  </span>
                  {isMyTurn && isListening && (
                    <Mic className="h-4 w-4 text-primary animate-pulse" />
                  )}
                </div>
                {currentLine.direction && (
                  <p className="text-sm text-white/60 italic mb-2">
                    ({currentLine.direction})
                  </p>
                )}
                
                {/* Text with word-by-word opacity like solo mode */}
                <p className="text-xl text-white font-medium leading-relaxed">
                  {isMyTurn && wordMatchResult ? (
                    // User speaking - matched words full opacity, unmatched dimmed
                    wordMatchResult.words.map((w, i) => (
                      <span
                        key={i}
                        className={cn(
                          "transition-opacity duration-150",
                          w.matched ? "opacity-100" : "opacity-50"
                        )}
                      >
                        {w.word}{i < wordMatchResult.words.length - 1 ? " " : ""}
                      </span>
                    ))
                  ) : (
                    currentLine.text
                  )}
                </p>
                
                {/* Progress bar below text - like solo mode */}
                {isMyTurn && wordMatchResult && userTranscript && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, wordMatchResult.percentMatched)}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/70 font-medium">
                      {Math.round(wordMatchResult.percentMatched)}%
                    </span>
                  </div>
                )}
                
                {isMyTurn && !userTranscript && (
                  <p className="text-sm text-primary mt-3">
                    {isListening ? "Listening..." : "Speak your line"}
                  </p>
                )}
              </div>
            )}
            
            {nextLine && (
              <div className="text-center mt-4 opacity-40">
                <span className="text-xs font-medium text-white/50">{nextLine.roleName}</span>
                <p className="text-sm text-white/50">{nextLine.text}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
