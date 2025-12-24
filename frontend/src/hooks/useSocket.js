import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useUser } from "@clerk/clerk-react";
import { useUserRole } from "./useUserRole";

/**
 * Hook for Socket.io connection per session
 * Handles real-time code and language synchronization
 */
export function useSocket(sessionId, isHost, isParticipant) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useUser();
  const { role } = useUserRole();
  const socketRef = useRef(null);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || (!isHost && !isParticipant)) {
      return;
    }

    // Prevent duplicate socket connections
    if (socketRef.current?.connected) {
      console.log("Socket already connected, reusing existing connection");
      setSocket(socketRef.current);
      setIsConnected(true);
      return;
    }

    // Create socket connection
    // Socket.io needs the BASE server URL (not /api path)
    // Extract base URL from VITE_API_URL or use default
    let apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    
    // Remove /api path if present (socket.io connects to base server, not API routes)
    apiUrl = apiUrl.replace(/\/api\/?$/, ""); // Remove trailing /api
    apiUrl = apiUrl.replace(/\/$/, ""); // Remove trailing slash
    
    console.log("🔌 [FRONTEND] Connecting socket to:", apiUrl);
    
    const newSocket = io(apiUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      autoConnect: true,
    });

    socketRef.current = newSocket;

    // Connection events
    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      setIsConnected(true);

      // Join session room (only once)
      if (!hasJoinedRef.current) {
        hasJoinedRef.current = true;
        const userRole = role || (isHost ? "host" : "participant");
        console.log("🟢 [FRONTEND] Joining session room:", {
          sessionId,
          role: userRole,
          socketId: newSocket.id,
          isHost,
          isParticipant,
        });
        newSocket.emit("join-session", {
          sessionId,
          role: userRole,
        });
      }
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ [FRONTEND] Socket connection error:", {
        message: error.message,
        type: error.type,
        description: error.description,
        serverUrl: apiUrl,
      });
      setIsConnected(false);
    });

    newSocket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      hasJoinedRef.current = false;
      if (newSocket) {
        newSocket.emit("leave-session", { sessionId });
        newSocket.removeAllListeners();
        newSocket.disconnect();
      }
    };
  }, [sessionId, isHost, isParticipant, role]);

  return { socket, isConnected };
}

