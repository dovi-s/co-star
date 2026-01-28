import { useState } from 'react';
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
import { Users, Copy, Check, Play, Crown, UserCircle, ArrowLeft, Loader2, Pause, SkipForward, SkipBack, Volume2, Mic, MicOff, Video, VideoOff, Circle } from 'lucide-react';
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

  const isInRoom = !!multiplayer.room && (view === 'lobby' || multiplayer.room.state === 'rehearsing' || multiplayer.room.state === 'paused');
  
  const webrtc = useWebRTC({
    socket: multiplayer.socket,
    myParticipantId: multiplayer.currentParticipant?.id ?? null,
    participants: multiplayer.room?.participants ?? [],
    enabled: isInRoom,
  });

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
          currentLine={currentLine ? {
            text: currentLine.text,
            roleName: currentLine.roleName,
            direction: currentLine.direction,
          } : undefined}
          previousLine={prevLine ? {
            text: prevLine.text,
            roleName: prevLine.roleName,
          } : undefined}
          nextLine={nextLine ? {
            text: nextLine.text,
            roleName: nextLine.roleName,
          } : undefined}
          isMyTurn={isMyTurn}
        />

        <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-30 bg-black/40 backdrop-blur-sm safe-top">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLeave} 
              className="text-white hover:text-white hover:bg-white/20"
              data-testid="button-leave-rehearsal"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Leave
            </Button>
            <Badge variant="outline" className="font-mono bg-black/40 text-white border-white/30">{room.code}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={webrtc.toggleAudio}
                className={cn(
                  "text-white hover:text-white hover:bg-white/20",
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
                  "text-white hover:text-white hover:bg-white/20",
                  !webrtc.isVideoEnabled && "text-red-400"
                )}
                data-testid="button-toggle-video-rehearsal"
              >
                {webrtc.isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => multiplayer.setRecordingOptOut(!multiplayer.currentParticipant?.recordingOptOut)}
                className={cn(
                  "text-white hover:text-white hover:bg-white/20",
                  multiplayer.currentParticipant?.recordingOptOut && "text-amber-400"
                )}
                data-testid="button-toggle-recording-opt-out-rehearsal"
                title={multiplayer.currentParticipant?.recordingOptOut ? "Recording excluded" : "Exclude from recording"}
              >
                <Circle className={`h-4 w-4 ${multiplayer.currentParticipant?.recordingOptOut ? "" : "fill-red-500 text-red-500"}`} />
              </Button>
            </div>
            <Badge className={cn(
              "bg-black/40 border-white/30",
              room.state === 'paused' ? 'text-white/70' : 'text-green-400'
            )}>
              {room.state === 'paused' ? 'Paused' : 'Live'}
            </Badge>
            {myRole && <Badge className="bg-primary/80 text-white">{myRole.name}</Badge>}
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
                      onClick={() => multiplayer.nextLine()}
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
                      data-testid="button-next-line"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </>
                )}
                
                {!multiplayer.isHost && isMyTurn && (
                  <Button
                    onClick={() => multiplayer.nextLine()}
                    className="bg-white text-black hover:bg-white/90"
                    data-testid="button-done-speaking"
                  >
                    Done Speaking
                  </Button>
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
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Video Call</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={webrtc.toggleAudio}
                    data-testid="button-toggle-audio"
                    className={!webrtc.isAudioEnabled ? "text-red-500" : ""}
                  >
                    {webrtc.isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={webrtc.toggleVideo}
                    data-testid="button-toggle-video"
                    className={!webrtc.isVideoEnabled ? "text-red-500" : ""}
                  >
                    {webrtc.isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => multiplayer.setRecordingOptOut(!multiplayer.currentParticipant?.recordingOptOut)}
                    data-testid="button-toggle-recording-opt-out"
                    className={multiplayer.currentParticipant?.recordingOptOut ? "text-amber-500" : ""}
                    title={multiplayer.currentParticipant?.recordingOptOut ? "Recording excluded" : "Exclude from recording"}
                  >
                    <Circle className={`h-4 w-4 ${multiplayer.currentParticipant?.recordingOptOut ? "" : "fill-red-500 text-red-500"}`} />
                  </Button>
                </div>
              </CardTitle>
              {webrtc.error && (
                <CardDescription className="text-red-500">{webrtc.error}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <VideoGrid
                localStream={webrtc.localStream}
                peerStreams={webrtc.peerStreams}
                participants={room.participants}
                myParticipantId={multiplayer.participantId}
                isAudioEnabled={webrtc.isAudioEnabled}
                isVideoEnabled={webrtc.isVideoEnabled}
              />
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
                        "justify-start h-auto py-3",
                        isTakenByOther && "opacity-50"
                      )}
                      disabled={isTakenByOther}
                      onClick={() => handleSelectRole(role.id)}
                      data-testid={`button-select-role-${role.id}`}
                    >
                      <div className="text-left">
                        <div className="font-medium">{role.name}</div>
                        <div className="text-xs opacity-70">
                          {role.lineCount} line{role.lineCount !== 1 ? 's' : ''}
                          {isTakenByOther && ` - ${takenBy.name}`}
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
              onClick={() => multiplayer.setReady(!multiplayer.currentParticipant?.isReady)}
              data-testid="button-toggle-ready"
            >
              {multiplayer.currentParticipant?.isReady ? 'Not Ready' : 'Ready'}
            </Button>
            
            {multiplayer.isHost && (
              <Button
                className="flex-1"
                disabled={!canStart}
                onClick={() => multiplayer.startRehearsal()}
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
