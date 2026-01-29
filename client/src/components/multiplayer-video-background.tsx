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

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // Ensure video plays on mobile
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div
      className={cn(
        "relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-black/60 backdrop-blur-sm",
        isSpeaking && "ring-2 ring-white"
      )}
      data-testid={`small-video-tile-${participant?.id || 'local'}`}
    >
      {stream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            "w-full h-full object-cover",
            isLocal && "transform scale-x-[-1]"
          )}
        />
      ) : (
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
  className,
}: MultiplayerVideoBackgroundProps) {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Focus mode: 'face' zooms in on face, 'script' shows script prominently
  const [focusMode, setFocusMode] = useState<'script' | 'face'>('script');
  
  const currentSpeaker = participants.find(p => p.id === currentSpeakerId);
  const myParticipant = participants.find(p => p.id === myParticipantId);
  
  // Word matching for user's turn (like solo mode)
  const wordMatchResult = useMemo(() => {
    if (!isMyTurn || !currentLine || !userTranscript) {
      return null;
    }
    return matchWords(currentLine.text, userTranscript);
  }, [isMyTurn, currentLine?.text, userTranscript]);
  
  const effectiveSpeakerId = currentSpeakerId || myParticipantId;
  const isLocalSpeaker = effectiveSpeakerId === myParticipantId;
  
  const remoteStream = effectiveSpeakerId && effectiveSpeakerId !== myParticipantId
    ? peerStreams.find(ps => ps.participantId === effectiveSpeakerId)?.stream
    : null;
  
  const mainStream = isLocalSpeaker ? localStream : (remoteStream || null);
  const showLocalAsMain = isLocalSpeaker;
  
  // Debug logging for video streams
  useEffect(() => {
    console.log('[VideoBackground] Stream state:', {
      localStream: !!localStream,
      peerStreamsCount: peerStreams.length,
      peerStreamIds: peerStreams.map(ps => ps.participantId),
      effectiveSpeakerId,
      isLocalSpeaker,
      mainStream: !!mainStream,
    });
  }, [localStream, peerStreams, effectiveSpeakerId, isLocalSpeaker, mainStream]);

  useEffect(() => {
    if (!mainStream || !mainVideoRef.current || !mainCanvasRef.current) return;

    const video = mainVideoRef.current;
    const canvas = mainCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    video.srcObject = mainStream;
    video.play().catch(console.error);

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
    };
  }, [mainStream, showLocalAsMain]);

  const stripParticipants = participants.filter(p => p.id !== effectiveSpeakerId);

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
          const isMe = participant.id === myParticipantId;
          const stream = isMe 
            ? localStream 
            : peerStreams.find(ps => ps.participantId === participant.id)?.stream || null;
          
          return (
            <SmallVideoTile
              key={participant.id}
              stream={stream}
              participant={participant}
              isLocal={isMe}
              isMuted={isMe ? !isAudioEnabled : false}
              isVideoOff={isMe ? !isVideoEnabled : !stream}
              isSpeaking={false}
            />
          );
        })}
      </div>

      <div className="absolute top-4 right-4 z-20">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full",
            isMyTurn || isLocalSpeaker ? "bg-primary animate-pulse" : "bg-green-500"
          )} />
          <span className="text-white text-sm font-medium">
            {isMyTurn || isLocalSpeaker ? 'Your turn' : currentSpeaker ? `${currentSpeaker.name} speaking` : 'Waiting...'}
          </span>
        </div>
      </div>

      <div 
        className="absolute bottom-32 left-4 right-4 z-20"
        onClick={(e) => {
          e.stopPropagation();
          if (focusMode === 'face') {
            setFocusMode('script');
          }
        }}
        data-testid="script-overlay"
      >
        <div className="max-w-2xl mx-auto">
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
                
                {/* Word-by-word highlighting like solo mode */}
                {isMyTurn && wordMatchResult ? (
                  <div className="space-y-3">
                    {/* Progress bar */}
                    <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 transition-all duration-200"
                        style={{ width: `${wordMatchResult.progress * 100}%` }}
                      />
                    </div>
                    
                    {/* Words with highlighting */}
                    <p className="text-xl text-white font-medium leading-relaxed">
                      {wordMatchResult.words.map((word, i) => (
                        <span
                          key={i}
                          className={cn(
                            "transition-colors duration-150",
                            word.matched ? "text-green-400" : "text-white"
                          )}
                        >
                          {word.text}{' '}
                        </span>
                      ))}
                    </p>
                    
                    {/* User transcript display */}
                    {userTranscript && (
                      <p className="text-sm text-white/60 italic">
                        "{userTranscript}"
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xl text-white font-medium leading-relaxed">
                    {currentLine.text}
                  </p>
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
