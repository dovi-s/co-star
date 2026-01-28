import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Room, RoomEvent, RoomUpdate, Role, Scene } from '@shared/schema';

interface UseMultiplayerOptions {
  onRoomCreated?: (room: Room, participantId: string) => void;
  onRoomJoined?: (room: Room, participantId: string) => void;
  onRoomUpdated?: (room: Room) => void;
  onError?: (message: string) => void;
  onKicked?: () => void;
  onRoomClosed?: () => void;
}

export function useMultiplayer(options: UseMultiplayerOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Multiplayer] Connected to server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Multiplayer] Disconnected from server');
      setIsConnected(false);
    });

    socket.on('room_update', (update: RoomUpdate) => {
      console.log('[Multiplayer] Received update:', update.type);
      
      switch (update.type) {
        case 'room_created':
          setRoom(update.room);
          setParticipantId(update.participantId);
          setError(null);
          options.onRoomCreated?.(update.room, update.participantId);
          break;
        case 'room_joined':
          setRoom(update.room);
          setParticipantId(update.participantId);
          setError(null);
          options.onRoomJoined?.(update.room, update.participantId);
          break;
        case 'room_updated':
          setRoom(update.room);
          options.onRoomUpdated?.(update.room);
          break;
        case 'room_error':
          setError(update.message);
          options.onError?.(update.message);
          break;
        case 'kicked':
          setRoom(null);
          setParticipantId(null);
          options.onKicked?.();
          break;
        case 'room_closed':
          setRoom(null);
          setParticipantId(null);
          options.onRoomClosed?.();
          break;
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendEvent = useCallback((event: RoomEvent) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('room_event', event);
    }
  }, []);

  const createRoom = useCallback((scriptName: string, roles: Role[], scenes: Scene[], hostName: string) => {
    sendEvent({ type: 'create_room', scriptName, roles, scenes, hostName });
  }, [sendEvent]);

  const joinRoom = useCallback((code: string, participantName: string) => {
    sendEvent({ type: 'join_room', code, participantName });
  }, [sendEvent]);

  const leaveRoom = useCallback(() => {
    sendEvent({ type: 'leave_room' });
    setRoom(null);
    setParticipantId(null);
  }, [sendEvent]);

  const selectRole = useCallback((roleId: string | null) => {
    sendEvent({ type: 'select_role', roleId });
  }, [sendEvent]);

  const setReady = useCallback((ready: boolean) => {
    sendEvent({ type: 'set_ready', ready });
  }, [sendEvent]);

  const startRehearsal = useCallback(() => {
    sendEvent({ type: 'start_rehearsal' });
  }, [sendEvent]);

  const pauseRehearsal = useCallback(() => {
    sendEvent({ type: 'pause_rehearsal' });
  }, [sendEvent]);

  const resumeRehearsal = useCallback(() => {
    sendEvent({ type: 'resume_rehearsal' });
  }, [sendEvent]);

  const nextLine = useCallback(() => {
    sendEvent({ type: 'next_line' });
  }, [sendEvent]);

  const prevLine = useCallback(() => {
    sendEvent({ type: 'prev_line' });
  }, [sendEvent]);

  const goToLine = useCallback((lineIndex: number) => {
    sendEvent({ type: 'go_to_line', lineIndex });
  }, [sendEvent]);

  const goToScene = useCallback((sceneIndex: number) => {
    sendEvent({ type: 'go_to_scene', sceneIndex });
  }, [sendEvent]);

  const kickParticipant = useCallback((targetParticipantId: string) => {
    sendEvent({ type: 'kick_participant', participantId: targetParticipantId });
  }, [sendEvent]);

  const transferHost = useCallback((newHostId: string) => {
    sendEvent({ type: 'transfer_host', newHostId });
  }, [sendEvent]);

  const currentParticipant = room?.participants.find(p => p.id === participantId);
  const isHost = currentParticipant?.isHost ?? false;

  return {
    isConnected,
    room,
    participantId,
    currentParticipant,
    isHost,
    error,
    socket: socketRef.current,
    createRoom,
    joinRoom,
    leaveRoom,
    selectRole,
    setReady,
    startRehearsal,
    pauseRehearsal,
    resumeRehearsal,
    nextLine,
    prevLine,
    goToLine,
    goToScene,
    kickParticipant,
    transferHost,
  };
}
