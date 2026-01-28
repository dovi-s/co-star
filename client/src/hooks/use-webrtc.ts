import { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { RoomUpdate, Participant } from '@shared/schema';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface PeerStream {
  participantId: string;
  stream: MediaStream;
}

interface UseWebRTCOptions {
  socket: Socket | null;
  myParticipantId: string | null;
  participants: Participant[];
  enabled: boolean;
}

export function useWebRTC({ socket, myParticipantId, participants, enabled }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerStreams, setPeerStreams] = useState<PeerStream[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const pendingOffersRef = useRef<Map<string, { type: 'offer'; sdp: string }>>(new Map());
  const pendingPeersRef = useRef<Set<string>>(new Set());
  const localStreamRef = useRef<MediaStream | null>(null);

  const createPeerConnection = useCallback((participantId: string, isInitiator: boolean) => {
    if (!socket || !myParticipantId || !localStreamRef.current) return null;
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(participantId, pc);

    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('room_event', {
          type: 'rtc_ice_candidate',
          targetId: participantId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      setPeerStreams(prev => {
        const existing = prev.find(p => p.participantId === participantId);
        if (existing) {
          return prev.map(p => 
            p.participantId === participantId 
              ? { ...p, stream: event.streams[0] }
              : p
          );
        }
        return [...prev, { participantId, stream: event.streams[0] }];
      });
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${participantId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        closePeerConnection(participantId);
      }
    };

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('room_event', {
            type: 'rtc_offer',
            targetId: participantId,
            offer: {
              type: 'offer',
              sdp: pc.localDescription!.sdp,
            },
          });
        })
        .catch(err => console.error('[WebRTC] Error creating offer:', err));
    }

    return pc;
  }, [socket, myParticipantId]);

  const closePeerConnection = useCallback((participantId: string) => {
    const pc = peerConnectionsRef.current.get(participantId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(participantId);
    }
    pendingCandidatesRef.current.delete(participantId);
    setPeerStreams(prev => prev.filter(p => p.participantId !== participantId));
  }, []);

  const handleRtcOffer = useCallback(async (fromId: string, offer: { type: 'offer'; sdp: string }) => {
    if (!socket || !myParticipantId) return;
    
    if (!localStreamRef.current) {
      console.log('[WebRTC] Buffering offer from', fromId, '- local stream not ready');
      pendingOffersRef.current.set(fromId, offer);
      return;
    }

    let pc = peerConnectionsRef.current.get(fromId);
    if (!pc) {
      const newPc = createPeerConnection(fromId, false);
      if (!newPc) return;
      pc = newPc;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const pendingCandidates = pendingCandidatesRef.current.get(fromId) || [];
      for (const candidate of pendingCandidates) {
        await pc.addIceCandidate(candidate);
      }
      pendingCandidatesRef.current.delete(fromId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('room_event', {
        type: 'rtc_answer',
        targetId: fromId,
        answer: {
          type: 'answer',
          sdp: pc.localDescription!.sdp,
        },
      });
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
    }
  }, [socket, myParticipantId, createPeerConnection]);

  const handleRtcAnswer = useCallback(async (fromId: string, answer: { type: 'answer'; sdp: string }) => {
    const pc = peerConnectionsRef.current.get(fromId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      
      const pendingCandidates = pendingCandidatesRef.current.get(fromId) || [];
      for (const candidate of pendingCandidates) {
        await pc.addIceCandidate(candidate);
      }
      pendingCandidatesRef.current.delete(fromId);
    } catch (err) {
      console.error('[WebRTC] Error handling answer:', err);
    }
  }, []);

  const handleRtcIceCandidate = useCallback(async (fromId: string, candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }) => {
    const pc = peerConnectionsRef.current.get(fromId);
    const iceCandidate = new RTCIceCandidate(candidate);
    
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(iceCandidate);
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    } else {
      const pending = pendingCandidatesRef.current.get(fromId) || [];
      pending.push(iceCandidate);
      pendingCandidatesRef.current.set(fromId, pending);
    }
  }, []);

  const processPendingOffers = useCallback(() => {
    pendingOffersRef.current.forEach((offer, fromId) => {
      console.log('[WebRTC] Processing buffered offer from', fromId);
      handleRtcOffer(fromId, offer);
    });
    pendingOffersRef.current.clear();
  }, [handleRtcOffer]);

  const processPendingPeers = useCallback(() => {
    pendingPeersRef.current.forEach((peerId) => {
      if (!peerConnectionsRef.current.has(peerId)) {
        console.log('[WebRTC] Processing pending peer connection to', peerId);
        createPeerConnection(peerId, true);
      }
    });
    pendingPeersRef.current.clear();
  }, [createPeerConnection]);

  const startMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setError(null);
      
      setTimeout(() => {
        processPendingOffers();
        processPendingPeers();
      }, 100);
      
      return stream;
    } catch (err) {
      console.error('[WebRTC] Error accessing media:', err);
      setError('Could not access camera or microphone');
      return null;
    }
  }, [processPendingOffers, processPendingPeers]);

  const stopMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    setPeerStreams([]);
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(prev => !prev);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(prev => !prev);
    }
  }, []);

  useEffect(() => {
    if (!socket || !enabled) return;

    const handleRoomUpdate = (update: RoomUpdate) => {
      switch (update.type) {
        case 'participant_joined':
          if (update.participantId !== myParticipantId) {
            if (localStreamRef.current) {
              createPeerConnection(update.participantId, true);
            } else {
              console.log('[WebRTC] Buffering peer connection to', update.participantId, '- local stream not ready');
              pendingPeersRef.current.add(update.participantId);
            }
          }
          break;
        case 'participant_left':
          closePeerConnection(update.participantId);
          break;
        case 'rtc_offer':
          handleRtcOffer(update.fromId, update.offer);
          break;
        case 'rtc_answer':
          handleRtcAnswer(update.fromId, update.answer);
          break;
        case 'rtc_ice_candidate':
          handleRtcIceCandidate(update.fromId, update.candidate);
          break;
      }
    };

    socket.on('room_update', handleRoomUpdate);
    return () => {
      socket.off('room_update', handleRoomUpdate);
    };
  }, [socket, enabled, myParticipantId, createPeerConnection, closePeerConnection, handleRtcOffer, handleRtcAnswer, handleRtcIceCandidate]);

  useEffect(() => {
    if (enabled && !localStreamRef.current) {
      startMedia().then(stream => {
        if (stream && participants.length > 1) {
          participants.forEach(p => {
            if (p.id !== myParticipantId && !peerConnectionsRef.current.has(p.id)) {
              createPeerConnection(p.id, true);
            }
          });
        }
      });
    } else if (!enabled) {
      stopMedia();
    }
  }, [enabled, participants, myParticipantId, startMedia, stopMedia, createPeerConnection]);

  useEffect(() => {
    return () => {
      stopMedia();
    };
  }, [stopMedia]);

  return {
    localStream,
    peerStreams,
    isAudioEnabled,
    isVideoEnabled,
    error,
    toggleAudio,
    toggleVideo,
    startMedia,
    stopMedia,
  };
}
