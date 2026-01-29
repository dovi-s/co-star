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
  existingVideoStream?: MediaStream | null; // Reuse lobby camera to avoid duplicate permission
  ttsAudioStream?: MediaStream | null; // TTS audio stream from host to mix and send to all participants
  isHost?: boolean; // Whether this client is the host (only host sends TTS audio)
}

export function useWebRTC({ socket, myParticipantId, participants, enabled, existingVideoStream, ttsAudioStream, isHost }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peerStreams, setPeerStreams] = useState<PeerStream[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set());
  
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const pendingOffersRef = useRef<Map<string, { type: 'offer'; sdp: string }>>(new Map());
  const pendingPeersRef = useRef<Set<string>>(new Set());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const ttsIncludedInMixRef = useRef<boolean>(false); // Track if TTS is included in audio mix

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
      // Safari/iOS may not have event.streams - fallback to creating stream from track
      const incomingStream = event.streams?.[0];
      const incomingTrack = event.track;
      
      console.log(`[WebRTC] ontrack from ${participantId}:`, {
        kind: incomingTrack?.kind,
        enabled: incomingTrack?.enabled,
        muted: incomingTrack?.muted,
        readyState: incomingTrack?.readyState,
        streamExists: !!incomingStream,
        streamTracks: incomingStream ? `${incomingStream.getAudioTracks().length}a/${incomingStream.getVideoTracks().length}v` : 'n/a',
      });
      
      setPeerStreams(prev => {
        const existing = prev.find(p => p.participantId === participantId);
        
        // Create a new MediaStream that includes ALL tracks
        // This ensures we don't lose any tracks and forces React to re-render
        const newStream = new MediaStream();
        
        if (existing && existing.stream) {
          // First, add any tracks from the existing stream that aren't in the new stream
          // (this preserves tracks we already had)
          existing.stream.getTracks().forEach(track => {
            const isInIncoming = incomingStream?.getTracks().find(t => t.id === track.id) ||
                                 incomingTrack?.id === track.id;
            if (!isInIncoming) {
              newStream.addTrack(track);
            }
          });
        }
        
        // Add all tracks from the incoming stream OR just the single track
        if (incomingStream) {
          incomingStream.getTracks().forEach(track => newStream.addTrack(track));
        } else if (incomingTrack) {
          // Safari fallback: no streams array, use track directly
          console.log(`[WebRTC] Safari fallback: adding ${incomingTrack.kind} track directly`);
          newStream.addTrack(incomingTrack);
        }
        
        console.log(`[WebRTC] Created stream for ${participantId} with ${newStream.getAudioTracks().length} audio, ${newStream.getVideoTracks().length} video tracks`);
        
        if (existing) {
          return prev.map(p => 
            p.participantId === participantId 
              ? { ...p, stream: newStream }
              : p
          );
        }
        return [...prev, { participantId, stream: newStream }];
      });
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${participantId}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        setConnectedPeers(prev => new Set(Array.from(prev).concat(participantId)));
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setConnectedPeers(prev => {
          const next = new Set(prev);
          next.delete(participantId);
          return next;
        });
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
      let stream: MediaStream;
      let micStream: MediaStream;
      let videoStream: MediaStream | null = existingVideoStream || null;
      
      // If no existing video stream, request both camera AND mic together in one prompt
      // This avoids annoying the user with two separate permission dialogs
      if (!videoStream || videoStream.getVideoTracks().length === 0) {
        console.log('[WebRTC] No existing video, requesting camera + mic together');
        try {
          const combinedStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: true,
          });
          // Split the combined stream into video and audio parts
          videoStream = new MediaStream(combinedStream.getVideoTracks());
          micStream = new MediaStream(combinedStream.getAudioTracks());
          console.log('[WebRTC] Camera + mic access granted together');
        } catch (combinedErr) {
          console.log('[WebRTC] Combined access failed, trying audio only:', combinedErr);
          // Fall back to audio only
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          videoStream = null;
        }
      } else {
        // Have existing video, just get mic
        console.log('[WebRTC] Reusing existing video, requesting mic only');
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      // If host and we have TTS audio stream, mix it with mic so everyone hears TTS
      if (isHost && ttsAudioStream && ttsAudioStream.getAudioTracks().length > 0) {
        console.log('[WebRTC] Host: mixing TTS audio with mic for participants');
        
        try {
          // Create audio context for mixing
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          
          // Ensure AudioContext is running (important for iOS/Safari)
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('[WebRTC] AudioContext resumed');
          }
          
          // Create destination for mixed audio
          const mixedDestination = audioContext.createMediaStreamDestination();
          mixedDestinationRef.current = mixedDestination;
          
          // Connect microphone to mixed output
          const micSource = audioContext.createMediaStreamSource(micStream);
          micSource.connect(mixedDestination);
          
          // Connect TTS audio to mixed output
          const ttsSource = audioContext.createMediaStreamSource(ttsAudioStream);
          ttsSource.connect(mixedDestination);
          
          // Create final stream with mixed audio + video (if any)
          stream = new MediaStream();
          
          // Add mixed audio track
          mixedDestination.stream.getAudioTracks().forEach(track => {
            stream.addTrack(track);
          });
          
          // Add video track if we have camera
          if (videoStream && videoStream.getVideoTracks().length > 0) {
            videoStream.getVideoTracks().forEach(track => {
              stream.addTrack(track);
            });
            setIsVideoEnabled(true);
          } else {
            setIsVideoEnabled(false);
          }
          
          console.log('[WebRTC] Host: mixed stream created with TTS + mic');
          ttsIncludedInMixRef.current = true; // Mark TTS as included
        } catch (e) {
          console.log('[WebRTC] Audio mixing failed, falling back to mic only:', e);
          ttsIncludedInMixRef.current = false;
          stream = micStream;
          if (videoStream && videoStream.getVideoTracks().length > 0) {
            videoStream.getVideoTracks().forEach(track => {
              stream.addTrack(track);
            });
            setIsVideoEnabled(true);
          } else {
            setIsVideoEnabled(false);
          }
        }
      } else {
        // Non-host or no TTS stream: just use mic + video
        stream = new MediaStream();
        
        micStream.getAudioTracks().forEach(track => {
          stream.addTrack(track);
        });
        
        if (videoStream && videoStream.getVideoTracks().length > 0) {
          console.log('[WebRTC] Using video stream');
          videoStream.getVideoTracks().forEach(track => {
            stream.addTrack(track);
          });
          setIsVideoEnabled(true);
        } else {
          console.log('[WebRTC] No camera available, audio only');
          setIsVideoEnabled(false);
        }
      }
      
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
      setError('Could not access microphone');
      return null;
    }
  }, [processPendingOffers, processPendingPeers, existingVideoStream, ttsAudioStream, isHost]);

  const stopMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
    // Clean up audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    mixedDestinationRef.current = null;
    ttsIncludedInMixRef.current = false; // Reset TTS flag
    
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    setPeerStreams([]);
    setConnectedPeers(new Set());
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
      startMedia();
    } else if (!enabled) {
      stopMedia();
    }
  }, [enabled, startMedia, stopMedia]);

  useEffect(() => {
    if (!enabled || !localStreamRef.current || !myParticipantId) return;
    
    participants.forEach(p => {
      if (p.id !== myParticipantId && !peerConnectionsRef.current.has(p.id)) {
        console.log('[WebRTC] Creating connection to existing participant:', p.id, p.name);
        createPeerConnection(p.id, true);
      }
    });
  }, [enabled, participants, myParticipantId, createPeerConnection]);

  useEffect(() => {
    return () => {
      stopMedia();
    };
  }, [stopMedia]);

  // Handle late TTS stream availability - update audio mixing when TTS becomes available after WebRTC started
  useEffect(() => {
    if (!isHost || !ttsAudioStream || !localStreamRef.current) return;
    
    // If TTS is already included in the mix, nothing to do
    if (ttsIncludedInMixRef.current) return;
    
    console.log('[WebRTC] Late TTS stream available - updating audio mixing');
    
    try {
      // Create AudioContext if not already created
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const audioContext = audioContextRef.current;
      
      // Ensure AudioContext is running (important for iOS/Safari)
      if (audioContext.state === 'suspended') {
        console.log('[WebRTC] AudioContext suspended, attempting resume...');
        audioContext.resume().then(() => {
          console.log('[WebRTC] AudioContext resumed successfully');
        }).catch(err => {
          console.warn('[WebRTC] AudioContext resume failed:', err);
        });
      }
      
      const mixedDestination = audioContext.createMediaStreamDestination();
      mixedDestinationRef.current = mixedDestination;
      
      // Get current audio tracks from local stream
      const currentAudioTracks = localStreamRef.current.getAudioTracks();
      if (currentAudioTracks.length > 0) {
        // Create source from current mic track
        const currentMicStream = new MediaStream([currentAudioTracks[0]]);
        const micSource = audioContext.createMediaStreamSource(currentMicStream);
        micSource.connect(mixedDestination);
      }
      
      // Connect TTS audio to mixed output
      const ttsSource = audioContext.createMediaStreamSource(ttsAudioStream);
      ttsSource.connect(mixedDestination);
      
      // Replace audio tracks on all peer connections
      const newAudioTrack = mixedDestination.stream.getAudioTracks()[0];
      if (newAudioTrack) {
        peerConnectionsRef.current.forEach((pc, peerId) => {
          const senders = pc.getSenders();
          const audioSender = senders.find(s => s.track?.kind === 'audio');
          if (audioSender) {
            audioSender.replaceTrack(newAudioTrack).then(() => {
              console.log(`[WebRTC] Replaced audio track for peer ${peerId} with TTS-mixed audio`);
            }).catch(err => {
              console.warn(`[WebRTC] Failed to replace audio track for peer ${peerId}:`, err);
            });
          }
        });
        
        // Rebuild localStreamRef with mixed audio + existing video
        const videoTracks = localStreamRef.current.getVideoTracks();
        const newStream = new MediaStream();
        newStream.addTrack(newAudioTrack);
        videoTracks.forEach(track => newStream.addTrack(track));
        
        // Replace localStreamRef so new peer connections use mixed audio
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      }
      
      ttsIncludedInMixRef.current = true; // Mark TTS as now included
      console.log('[WebRTC] Late TTS mixing complete');
    } catch (err) {
      console.error('[WebRTC] Failed to update audio mixing with late TTS:', err);
    }
  }, [isHost, ttsAudioStream]);

  // Check if all remote participants have connected peer connections AND have streams
  const otherParticipants = participants.filter(p => p.id !== myParticipantId);
  const allPeersConnected = otherParticipants.length === 0 || 
    otherParticipants.every(p => connectedPeers.has(p.id));
  
  // Also check if we've received streams from all peers (more reliable than connection state)
  const allPeersHaveStreams = otherParticipants.length === 0 ||
    otherParticipants.every(p => peerStreams.some(ps => ps.participantId === p.id));

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
    allPeersConnected,
    allPeersHaveStreams, // More reliable: checks for actual media streams
    connectedPeersCount: connectedPeers.size,
  };
}
