import { useEffect, useRef } from 'react';
import type { PeerStream } from '@/hooks/use-webrtc';
import type { Participant } from '@shared/schema';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Video, VideoOff, Crown, VideoOff as RecordingOff } from 'lucide-react';

interface VideoTileProps {
  stream: MediaStream | null;
  participant?: Participant;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  recordingOptOut?: boolean;
  className?: string;
}

function VideoTile({ stream, participant, isLocal, isMuted, isVideoOff, isSpeaking, recordingOptOut, className }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={cn(
        "relative bg-muted rounded-lg overflow-hidden aspect-video",
        isSpeaking && "ring-2 ring-primary",
        className
      )}
      data-testid={`video-tile-${participant?.id || 'local'}`}
    >
      {stream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted // Always mute - audio is played via dedicated hidden audio elements
          className={cn(
            "w-full h-full object-cover",
            isLocal && "transform scale-x-[-1]"
          )}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <div className="w-16 h-16 rounded-full bg-muted-foreground/20 flex items-center justify-center">
            <span className="text-2xl font-medium text-muted-foreground">
              {participant?.name?.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded px-2 py-1">
          {participant?.isHost && <Crown className="h-3 w-3 text-yellow-400" />}
          <span className="text-xs text-white font-medium truncate max-w-[100px]">
            {isLocal ? 'You' : participant?.name || 'Unknown'}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {isMuted ? (
            <div className="bg-red-500/80 rounded-full p-1">
              <MicOff className="h-3 w-3 text-white" />
            </div>
          ) : (
            <div className="bg-black/50 rounded-full p-1">
              <Mic className="h-3 w-3 text-white" />
            </div>
          )}
          {isVideoOff && (
            <div className="bg-red-500/80 rounded-full p-1">
              <VideoOff className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
      </div>
      
      {recordingOptOut && (
        <div 
          className="absolute top-2 right-2 bg-amber-500/90 rounded px-1.5 py-0.5 flex items-center gap-1"
          title="Not included in recordings"
          data-testid={`badge-recording-opt-out-${participant?.id || 'local'}`}
        >
          <RecordingOff className="h-3 w-3 text-white" />
          <span className="text-[10px] text-white font-medium">No Rec</span>
        </div>
      )}
    </div>
  );
}

interface VideoGridProps {
  localStream: MediaStream | null;
  peerStreams: PeerStream[];
  participants: Participant[];
  myParticipantId: string | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  currentSpeakerId?: string | null;
  className?: string;
}

export function VideoGrid({
  localStream,
  peerStreams,
  participants,
  myParticipantId,
  isAudioEnabled,
  isVideoEnabled,
  currentSpeakerId,
  className,
}: VideoGridProps) {
  const totalParticipants = participants.length;
  const myParticipant = participants.find(p => p.id === myParticipantId);

  const gridCols = totalParticipants <= 2 ? 'grid-cols-1 sm:grid-cols-2' 
    : totalParticipants <= 4 ? 'grid-cols-2' 
    : totalParticipants <= 6 ? 'grid-cols-2 sm:grid-cols-3'
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  return (
    <div className={cn("grid gap-2 p-2", gridCols, className)} data-testid="video-grid">
      <VideoTile
        stream={localStream}
        participant={myParticipant}
        isLocal
        isMuted={!isAudioEnabled}
        isVideoOff={!isVideoEnabled}
        isSpeaking={currentSpeakerId === myParticipantId}
        recordingOptOut={myParticipant?.recordingOptOut}
      />
      
      {participants
        .filter(p => p.id !== myParticipantId)
        .map(participant => {
          const peerStream = peerStreams.find(ps => ps.participantId === participant.id);
          return (
            <VideoTile
              key={participant.id}
              stream={peerStream?.stream || null}
              participant={participant}
              isSpeaking={currentSpeakerId === participant.id}
              recordingOptOut={participant.recordingOptOut}
            />
          );
        })}
    </div>
  );
}
