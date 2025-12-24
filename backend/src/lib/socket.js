import { Server } from "socket.io";

let io = null;

// In-memory session state storage
// sessionState[sessionId] = { code, language, output }
const sessionState = {};

export const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Join session room
    socket.on("join-session", ({ sessionId, role }) => {
      console.log("🔵 [BACKEND] Received join-session request", {
        socketId: socket.id,
        sessionId,
        role,
      });

      if (!sessionId) {
        console.warn("❌ [BACKEND] Rejected: Session ID is required");
        socket.emit("error", { message: "Session ID is required" });
        return;
      }

      const room = `session:${sessionId}`;
      socket.join(room);
      
      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
      console.log(`✅ [BACKEND] Socket ${socket.id} joined room ${room} as ${role} (${roomSize} total in room)`);

      // If host joins, send current session state immediately
      if (role === "host") {
        if (sessionState[sessionId]) {
          const state = sessionState[sessionId];
          console.log(`📤 [BACKEND] Sending current session state to host for session ${sessionId}`, {
            codeLength: state.code?.length || 0,
            language: state.language,
            hasOutput: !!state.output,
          });
          socket.emit("session:state", {
            code: state.code || "",
            language: state.language || "javascript",
            output: state.output || null,
            sessionId,
          });
        } else {
          console.log(`ℹ️ [BACKEND] No existing state for session ${sessionId}, host will wait for participant`);
        }
      }

      // Notify others in the room
      socket.to(room).emit("user-joined", { socketId: socket.id, role });
    });

    // Handle code updates (only from participants)
    socket.on("code:update", ({ sessionId, code, language, senderRole }) => {
      console.log("🔵 [BACKEND] Received code:update event", {
        socketId: socket.id,
        sessionId,
        codeLength: code?.length || 0,
        language,
        senderRole,
      });

      if (senderRole !== "participant") {
        console.warn("❌ [BACKEND] Rejected: Only participants can send code updates");
        socket.emit("error", { message: "Only participants can send code updates" });
        return;
      }

      if (!sessionId) {
        console.warn("❌ [BACKEND] Rejected: Session ID is required");
        socket.emit("error", { message: "Session ID is required" });
        return;
      }

      // Update session state in memory
      if (!sessionState[sessionId]) {
        sessionState[sessionId] = {};
        console.log(`📝 [BACKEND] Created new session state for ${sessionId}`);
      }
      sessionState[sessionId].code = code;
      if (language) {
        sessionState[sessionId].language = language;
      }

      const room = `session:${sessionId}`;
      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
      console.log(`📡 [BACKEND] Broadcasting code:update to room ${room} (${roomSize} sockets in room)`);
      
      // Broadcast to all others in the room (hosts)
      socket.to(room).emit("code:update", {
        code,
        language,
        sessionId,
        timestamp: Date.now(),
      });

      console.log(`✅ [BACKEND] Code update broadcasted in room ${room}, code length: ${code?.length || 0}`);
    });

    // Handle language updates (only from participants)
    socket.on("language:update", ({ sessionId, language, senderRole }) => {
      if (senderRole !== "participant") {
        socket.emit("error", { message: "Only participants can send language updates" });
        return;
      }

      if (!sessionId) {
        socket.emit("error", { message: "Session ID is required" });
        return;
      }

      // Update session state in memory
      if (!sessionState[sessionId]) {
        sessionState[sessionId] = {};
      }
      sessionState[sessionId].language = language;

      const room = `session:${sessionId}`;
      // Broadcast to all others in the room (hosts)
      socket.to(room).emit("language:update", {
        language,
        sessionId,
        timestamp: Date.now(),
      });

      console.log(`Language update broadcasted in room ${room}: ${language}`);
    });

    // Handle typing indicator
    socket.on("code:typing", ({ sessionId, senderRole }) => {
      if (senderRole !== "participant") return;

      if (!sessionId) return;

      const room = `session:${sessionId}`;
      socket.to(room).emit("code:typing", { sessionId });
    });

    // Handle code run output (only from participants)
    socket.on("code:run", ({ sessionId, output, senderRole }) => {
      if (senderRole !== "participant") {
        socket.emit("error", { message: "Only participants can send code run output" });
        return;
      }

      if (!sessionId) {
        socket.emit("error", { message: "Session ID is required" });
        return;
      }

      // Update session state in memory
      if (!sessionState[sessionId]) {
        sessionState[sessionId] = {};
      }
      sessionState[sessionId].output = output;

      const room = `session:${sessionId}`;
      // Broadcast output to all others in the room (hosts)
      socket.to(room).emit("code:run", {
        output,
        sessionId,
        timestamp: Date.now(),
      });

      console.log(`Code run output broadcasted in room ${room}`);
    });

    // Leave session room
    socket.on("leave-session", ({ sessionId }) => {
      if (sessionId) {
        const room = `session:${sessionId}`;
        socket.leave(room);
        console.log(`Socket ${socket.id} left room ${room}`);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });

    // Cleanup session state when session ends (optional - can be called via API)
    socket.on("session:end", ({ sessionId }) => {
      if (sessionId && sessionState[sessionId]) {
        delete sessionState[sessionId];
        console.log(`Session state cleared for session ${sessionId}`);
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initializeSocket first.");
  }
  return io;
};

