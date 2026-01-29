import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import { nanoid } from "nanoid";
import type { Room, Participant, RoomUpdate, Role, Scene } from "@shared/schema";
import { roomEventSchema, rtcOfferSchema, rtcAnswerSchema, rtcIceCandidateSchema } from "@shared/schema";

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, { roomId: string; participantId: string }>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function broadcastRoomUpdate(io: SocketIOServer, room: Room) {
  const update: RoomUpdate = { type: "room_updated", room };
  io.to(room.id).emit("room_update", update);
}

function handleCreateRoom(
  socket: Socket,
  io: SocketIOServer,
  data: { scriptName: string; roles: Role[]; scenes: Scene[]; hostName: string }
) {
  const participantId = nanoid();
  const roomId = nanoid();
  const code = generateRoomCode();

  const host: Participant = {
    id: participantId,
    name: data.hostName,
    roleId: null,
    isHost: true,
    isReady: false,
    recordingOptOut: false,
    joinedAt: new Date().toISOString(),
  };

  const room: Room = {
    id: roomId,
    code,
    hostId: participantId,
    state: "lobby",
    participants: [host],
    scriptName: data.scriptName,
    roles: data.roles,
    scenes: data.scenes,
    currentSceneIndex: 0,
    currentLineIndex: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  rooms.set(roomId, room);
  socketToRoom.set(socket.id, { roomId, participantId });
  socket.join(roomId);

  const response: RoomUpdate = { type: "room_created", room, participantId };
  socket.emit("room_update", response);
  console.log(`[Multiplayer] Room ${code} created by ${data.hostName}`);
}

function handleJoinRoom(
  socket: Socket,
  io: SocketIOServer,
  data: { code: string; participantName: string }
) {
  const room = Array.from(rooms.values()).find(
    (r) => r.code.toUpperCase() === data.code.toUpperCase()
  );

  if (!room) {
    const error: RoomUpdate = { type: "room_error", message: "Room not found" };
    socket.emit("room_update", error);
    return;
  }

  if (room.state !== "lobby") {
    const error: RoomUpdate = { type: "room_error", message: "Rehearsal already in progress" };
    socket.emit("room_update", error);
    return;
  }

  const participantId = nanoid();
  const participant: Participant = {
    id: participantId,
    name: data.participantName,
    roleId: null,
    isHost: false,
    isReady: false,
    recordingOptOut: false,
    joinedAt: new Date().toISOString(),
  };

  room.participants.push(participant);
  room.updatedAt = new Date().toISOString();

  socketToRoom.set(socket.id, { roomId: room.id, participantId });
  socket.join(room.id);

  // Notify existing participants about new joiner (for WebRTC peer setup)
  const joinNotify: RoomUpdate = { type: "participant_joined", participantId };
  socket.to(room.id).emit("room_update", joinNotify);

  const response: RoomUpdate = { type: "room_joined", room, participantId };
  socket.emit("room_update", response);
  broadcastRoomUpdate(io, room);
  console.log(`[Multiplayer] ${data.participantName} joined room ${room.code}`);
}

function handleLeaveRoom(socket: Socket, io: SocketIOServer) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const leavingParticipant = room.participants.find((p) => p.id === info.participantId);
  room.participants = room.participants.filter((p) => p.id !== info.participantId);
  room.updatedAt = new Date().toISOString();

  // Notify others about participant leaving (for WebRTC cleanup)
  const leaveNotify: RoomUpdate = { type: "participant_left", participantId: info.participantId };
  socket.to(room.id).emit("room_update", leaveNotify);

  socketToRoom.delete(socket.id);
  socket.leave(room.id);

  if (room.participants.length === 0) {
    rooms.delete(room.id);
    console.log(`[Multiplayer] Room ${room.code} closed (empty)`);
    return;
  }

  if (leavingParticipant?.isHost && room.participants.length > 0) {
    const newHost = room.participants[0];
    newHost.isHost = true;
    room.hostId = newHost.id;
    console.log(`[Multiplayer] Host transferred to ${newHost.name}`);
  }

  broadcastRoomUpdate(io, room);
}

function handleSelectRole(
  socket: Socket,
  io: SocketIOServer,
  data: { roleId: string | null }
) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const participant = room.participants.find((p) => p.id === info.participantId);
  if (!participant) return;

  if (data.roleId) {
    const roleExists = room.roles.some((r) => r.id === data.roleId);
    if (!roleExists) return;

    const roleTaken = room.participants.some(
      (p) => p.id !== info.participantId && p.roleId === data.roleId
    );
    if (roleTaken) {
      const error: RoomUpdate = { type: "room_error", message: "Role already taken" };
      socket.emit("room_update", error);
      return;
    }
  }

  participant.roleId = data.roleId;
  room.updatedAt = new Date().toISOString();
  broadcastRoomUpdate(io, room);
}

function handleSetReady(
  socket: Socket,
  io: SocketIOServer,
  data: { ready: boolean }
) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const participant = room.participants.find((p) => p.id === info.participantId);
  if (!participant) return;

  participant.isReady = data.ready;
  room.updatedAt = new Date().toISOString();
  broadcastRoomUpdate(io, room);
}

function handleStartRehearsal(socket: Socket, io: SocketIOServer) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const participant = room.participants.find((p) => p.id === info.participantId);
  if (!participant?.isHost) {
    const error: RoomUpdate = { type: "room_error", message: "Only host can start" };
    socket.emit("room_update", error);
    return;
  }

  // Set state to counting_down first
  room.state = "counting_down";
  room.currentSceneIndex = 0;
  room.currentLineIndex = 0;
  room.updatedAt = new Date().toISOString();
  broadcastRoomUpdate(io, room);
  console.log(`[Multiplayer] Room ${room.code} starting countdown`);

  // Server-synced countdown: 3, 2, 1, go
  let count = 3;
  io.to(room.id).emit("countdown", { count });
  
  const countdownInterval = setInterval(() => {
    count--;
    if (count > 0) {
      io.to(room.id).emit("countdown", { count });
    } else {
      clearInterval(countdownInterval);
      // Now start rehearsing
      room.state = "rehearsing";
      room.updatedAt = new Date().toISOString();
      broadcastRoomUpdate(io, room);
      console.log(`[Multiplayer] Room ${room.code} started rehearsal`);
    }
  }, 1000);
}

function handlePauseRehearsal(socket: Socket, io: SocketIOServer) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const participant = room.participants.find((p) => p.id === info.participantId);
  if (!participant?.isHost) return;

  room.state = "paused";
  room.updatedAt = new Date().toISOString();
  broadcastRoomUpdate(io, room);
}

function handleResumeRehearsal(socket: Socket, io: SocketIOServer) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const participant = room.participants.find((p) => p.id === info.participantId);
  if (!participant?.isHost) return;

  room.state = "rehearsing";
  room.updatedAt = new Date().toISOString();
  broadcastRoomUpdate(io, room);
}

function handleNextLine(socket: Socket, io: SocketIOServer) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room || room.state !== "rehearsing") return;

  const participant = room.participants.find((p) => p.id === info.participantId);
  if (!participant) return;

  const currentScene = room.scenes[room.currentSceneIndex];
  if (!currentScene) return;

  const currentLine = currentScene.lines[room.currentLineIndex];
  const isHost = participant.isHost;
  const isCurrentSpeaker = currentLine && participant.roleId === currentLine.roleId;

  if (!isHost && !isCurrentSpeaker) {
    const error: RoomUpdate = { type: "room_error", message: "Only host or current speaker can advance" };
    socket.emit("room_update", error);
    return;
  }

  if (room.currentLineIndex < currentScene.lines.length - 1) {
    room.currentLineIndex++;
  } else if (room.currentSceneIndex < room.scenes.length - 1) {
    room.currentSceneIndex++;
    room.currentLineIndex = 0;
  } else {
    room.state = "completed";
  }

  room.updatedAt = new Date().toISOString();
  broadcastRoomUpdate(io, room);
}

function handlePrevLine(socket: Socket, io: SocketIOServer) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const participant = room.participants.find((p) => p.id === info.participantId);
  if (!participant?.isHost) return;

  if (room.currentLineIndex > 0) {
    room.currentLineIndex--;
  } else if (room.currentSceneIndex > 0) {
    room.currentSceneIndex--;
    const prevScene = room.scenes[room.currentSceneIndex];
    room.currentLineIndex = prevScene ? prevScene.lines.length - 1 : 0;
  }

  room.updatedAt = new Date().toISOString();
  broadcastRoomUpdate(io, room);
}

function handleGoToLine(socket: Socket, io: SocketIOServer, data: { lineIndex: number }) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const participant = room.participants.find((p) => p.id === info.participantId);
  if (!participant?.isHost) return;

  const currentScene = room.scenes[room.currentSceneIndex];
  if (data.lineIndex >= 0 && data.lineIndex < (currentScene?.lines.length ?? 0)) {
    room.currentLineIndex = data.lineIndex;
    room.updatedAt = new Date().toISOString();
    broadcastRoomUpdate(io, room);
  }
}

function handleGoToScene(socket: Socket, io: SocketIOServer, data: { sceneIndex: number }) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const participant = room.participants.find((p) => p.id === info.participantId);
  if (!participant?.isHost) return;

  if (data.sceneIndex >= 0 && data.sceneIndex < room.scenes.length) {
    room.currentSceneIndex = data.sceneIndex;
    room.currentLineIndex = 0;
    room.updatedAt = new Date().toISOString();
    broadcastRoomUpdate(io, room);
  }
}

function handleKickParticipant(socket: Socket, io: SocketIOServer, data: { participantId: string }) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const host = room.participants.find((p) => p.id === info.participantId);
  if (!host?.isHost) return;

  const targetSocket = Array.from(socketToRoom.entries()).find(
    ([, v]) => v.roomId === room.id && v.participantId === data.participantId
  );

  if (targetSocket) {
    const kicked: RoomUpdate = { type: "kicked" };
    io.to(targetSocket[0]).emit("room_update", kicked);
    socketToRoom.delete(targetSocket[0]);
  }

  room.participants = room.participants.filter((p) => p.id !== data.participantId);
  room.updatedAt = new Date().toISOString();
  broadcastRoomUpdate(io, room);
}

function handleTransferHost(socket: Socket, io: SocketIOServer, data: { newHostId: string }) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const currentHost = room.participants.find((p) => p.id === info.participantId);
  if (!currentHost?.isHost) return;

  const newHost = room.participants.find((p) => p.id === data.newHostId);
  if (!newHost) return;

  currentHost.isHost = false;
  newHost.isHost = true;
  room.hostId = newHost.id;
  room.updatedAt = new Date().toISOString();
  broadcastRoomUpdate(io, room);
  console.log(`[Multiplayer] Host transferred to ${newHost.name}`);
}

function handleRecordingOptOut(socket: Socket, io: SocketIOServer, data: { optOut: boolean }) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const room = rooms.get(info.roomId);
  if (!room) return;

  const participant = room.participants.find((p) => p.id === info.participantId);
  if (!participant) return;

  participant.recordingOptOut = data.optOut;
  room.updatedAt = new Date().toISOString();
  broadcastRoomUpdate(io, room);
  console.log(`[Multiplayer] ${participant.name} ${data.optOut ? 'opted out of' : 'opted into'} recording`);
}

// WebRTC signaling handlers
function handleRtcOffer(socket: Socket, io: SocketIOServer, data: { targetId: string; offer: unknown }) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const offerResult = rtcOfferSchema.safeParse(data.offer);
  if (!offerResult.success) {
    console.warn(`[Multiplayer] Invalid RTC offer from ${socket.id}`);
    return;
  }

  const room = rooms.get(info.roomId);
  if (!room) return;

  const targetExists = room.participants.some((p) => p.id === data.targetId);
  if (!targetExists) {
    console.warn(`[Multiplayer] RTC offer target ${data.targetId} not in room`);
    return;
  }

  const targetSocket = Array.from(socketToRoom.entries()).find(
    ([, v]) => v.roomId === info.roomId && v.participantId === data.targetId
  );

  if (targetSocket) {
    const update: RoomUpdate = {
      type: "rtc_offer",
      fromId: info.participantId,
      offer: offerResult.data,
    };
    io.to(targetSocket[0]).emit("room_update", update);
  }
}

function handleRtcAnswer(socket: Socket, io: SocketIOServer, data: { targetId: string; answer: unknown }) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const answerResult = rtcAnswerSchema.safeParse(data.answer);
  if (!answerResult.success) {
    console.warn(`[Multiplayer] Invalid RTC answer from ${socket.id}`);
    return;
  }

  const room = rooms.get(info.roomId);
  if (!room) return;

  const targetExists = room.participants.some((p) => p.id === data.targetId);
  if (!targetExists) {
    console.warn(`[Multiplayer] RTC answer target ${data.targetId} not in room`);
    return;
  }

  const targetSocket = Array.from(socketToRoom.entries()).find(
    ([, v]) => v.roomId === info.roomId && v.participantId === data.targetId
  );

  if (targetSocket) {
    const update: RoomUpdate = {
      type: "rtc_answer",
      fromId: info.participantId,
      answer: answerResult.data,
    };
    io.to(targetSocket[0]).emit("room_update", update);
  }
}

function handleRtcIceCandidate(socket: Socket, io: SocketIOServer, data: { targetId: string; candidate: unknown }) {
  const info = socketToRoom.get(socket.id);
  if (!info) return;

  const candidateResult = rtcIceCandidateSchema.safeParse(data.candidate);
  if (!candidateResult.success) {
    console.warn(`[Multiplayer] Invalid RTC ICE candidate from ${socket.id}`);
    return;
  }

  const room = rooms.get(info.roomId);
  if (!room) return;

  const targetExists = room.participants.some((p) => p.id === data.targetId);
  if (!targetExists) {
    console.warn(`[Multiplayer] RTC ICE target ${data.targetId} not in room`);
    return;
  }

  const targetSocket = Array.from(socketToRoom.entries()).find(
    ([, v]) => v.roomId === info.roomId && v.participantId === data.targetId
  );

  if (targetSocket) {
    const update: RoomUpdate = {
      type: "rtc_ice_candidate",
      fromId: info.participantId,
      candidate: candidateResult.data,
    };
    io.to(targetSocket[0]).emit("room_update", update);
  }
}

export function setupMultiplayer(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    console.log(`[Multiplayer] Client connected: ${socket.id}`);

    socket.on("room_event", (rawEvent: unknown) => {
      const parseResult = roomEventSchema.safeParse(rawEvent);
      if (!parseResult.success) {
        console.warn(`[Multiplayer] Invalid event from ${socket.id}:`, parseResult.error.message);
        const error: RoomUpdate = { type: "room_error", message: "Invalid event format" };
        socket.emit("room_update", error);
        return;
      }
      
      const event = parseResult.data;
      switch (event.type) {
        case "create_room":
          handleCreateRoom(socket, io, event);
          break;
        case "join_room":
          handleJoinRoom(socket, io, event);
          break;
        case "leave_room":
          handleLeaveRoom(socket, io);
          break;
        case "select_role":
          handleSelectRole(socket, io, event);
          break;
        case "set_ready":
          handleSetReady(socket, io, event);
          break;
        case "start_rehearsal":
          handleStartRehearsal(socket, io);
          break;
        case "pause_rehearsal":
          handlePauseRehearsal(socket, io);
          break;
        case "resume_rehearsal":
          handleResumeRehearsal(socket, io);
          break;
        case "next_line":
          handleNextLine(socket, io);
          break;
        case "prev_line":
          handlePrevLine(socket, io);
          break;
        case "go_to_line":
          handleGoToLine(socket, io, event);
          break;
        case "go_to_scene":
          handleGoToScene(socket, io, event);
          break;
        case "kick_participant":
          handleKickParticipant(socket, io, event);
          break;
        case "transfer_host":
          handleTransferHost(socket, io, event);
          break;
        case "set_recording_opt_out":
          handleRecordingOptOut(socket, io, event);
          break;
        case "rtc_offer":
          handleRtcOffer(socket, io, event);
          break;
        case "rtc_answer":
          handleRtcAnswer(socket, io, event);
          break;
        case "rtc_ice_candidate":
          handleRtcIceCandidate(socket, io, event);
          break;
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Multiplayer] Client disconnected: ${socket.id}`);
      handleLeaveRoom(socket, io);
    });
  });

  console.log("[Multiplayer] WebSocket server initialized");
  return io;
}
