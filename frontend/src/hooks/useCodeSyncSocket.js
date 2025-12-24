import { useEffect, useRef, useState } from "react";

/**
 * Hook for real-time code and language synchronization using Socket.io
 * - Participant: Sends code and language updates via socket
 * - Host: Receives code and language updates via socket (read-only)
 */
export function useCodeSyncSocket(socket, isParticipant, initialCode = "", initialLanguage = "javascript", sessionId) {
  const [syncedCode, setSyncedCode] = useState(initialCode);
  const [syncedLanguage, setSyncedLanguage] = useState(initialLanguage);
  const [isParticipantTyping, setIsParticipantTyping] = useState(false);
  const lastSentCodeRef = useRef(initialCode);
  const lastSentLanguageRef = useRef(initialLanguage);
  const debounceTimerRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Initialize code and language from initial values
  useEffect(() => {
    if (!isInitializedRef.current) {
      setSyncedCode(initialCode);
      setSyncedLanguage(initialLanguage);
      lastSentCodeRef.current = initialCode;
      lastSentLanguageRef.current = initialLanguage;
      isInitializedRef.current = true;
    }
  }, []);

  // Update synced code when initialCode changes (for host when problem loads)
  // Note: isHost = !isParticipant, but we only have isParticipant in this hook
  useEffect(() => {
    if (!isParticipant && initialCode && (!syncedCode || syncedCode === "")) {
      setSyncedCode(initialCode);
    }
  }, [isParticipant, initialCode, syncedCode]);

  // Get isConnected from socket
  const isConnected = socket?.connected || false;

  // Listen for code and language updates (for HOST)
  useEffect(() => {
    if (!socket) {
      console.warn("Host: Cannot setup listeners - socket not available");
      return;
    }
    
    if (isParticipant) {
      console.log("Host: Skipping listener setup - user is participant");
      return;
    }
    
    if (!isConnected) {
      console.warn("Host: Cannot setup listeners - socket not connected");
      return;
    }

    console.log("Host: Setting up Socket.io listeners for code sync", {
      socketId: socket.id,
      connected: socket.connected,
      sessionId,
    });

    // Handle initial session state from server (when host joins late)
    const handleSessionState = (data) => {
      try {
        console.log("Host: Received initial session state from server", {
          codeLength: data.code?.length || 0,
          language: data.language,
          hasOutput: !!data.output,
        });
        
        if (data.code !== undefined) {
          setSyncedCode(data.code);
        }
        if (data.language !== undefined) {
          setSyncedLanguage(data.language);
        }
        if (data.output !== undefined) {
          // Emit custom event for output
          window.dispatchEvent(new CustomEvent("code:run-output", { detail: data.output }));
        }
      } catch (error) {
        console.error("Host: Error handling session state:", error);
      }
    };

    const handleCodeUpdate = (data) => {
      try {
        console.log("🔴 [HOST] Received code:update via Socket.io", {
          codeLength: data.code?.length || 0,
          language: data.language,
          sessionId: data.sessionId,
          currentSyncedCodeLength: syncedCode?.length || 0,
          currentSyncedLanguage: syncedLanguage,
        });
        
        if (data.code !== undefined) {
          console.log(`🔄 [HOST] Updating synced code from ${syncedCode?.length || 0} to ${data.code.length} chars`);
          setSyncedCode(data.code);
          setIsParticipantTyping(false);
        }
        if (data.language !== undefined) {
          console.log(`🔄 [HOST] Updating synced language from ${syncedLanguage} to ${data.language}`);
          setSyncedLanguage(data.language);
        }
        console.log("✅ [HOST] Code update processed successfully");
      } catch (error) {
        console.error("❌ [HOST] Error handling code update:", error);
      }
    };

    const handleLanguageUpdate = (data) => {
      try {
        console.log("Host: Received language update via Socket.io:", data.language);
        if (data.language !== undefined) {
          setSyncedLanguage(data.language);
        }
      } catch (error) {
        console.error("Host: Error handling language update:", error);
      }
    };

    const handleTyping = () => {
      setIsParticipantTyping(true);
      setTimeout(() => setIsParticipantTyping(false), 2000);
    };

    const handleCodeRun = (data) => {
      try {
        console.log("Host: Received code run output via Socket.io");
        // This will be handled by parent component via callback
        if (data.output !== undefined) {
          // Emit custom event that parent can listen to
          window.dispatchEvent(new CustomEvent("code:run-output", { detail: data.output }));
        }
      } catch (error) {
        console.error("Host: Error handling code run output:", error);
      }
    };

    socket.on("session:state", handleSessionState);
    socket.on("code:update", handleCodeUpdate);
    socket.on("language:update", handleLanguageUpdate);
    socket.on("code:typing", handleTyping);
    socket.on("code:run", handleCodeRun);

    return () => {
      socket.off("session:state", handleSessionState);
      socket.off("code:update", handleCodeUpdate);
      socket.off("language:update", handleLanguageUpdate);
      socket.off("code:typing", handleTyping);
      socket.off("code:run", handleCodeRun);
    };
  }, [socket, isParticipant, isConnected]);

  // Send code updates (for PARTICIPANT only)
  const sendCodeUpdate = (newCode) => {
    if (!socket) {
      console.warn("Participant: Cannot send code update - socket not available");
      return;
    }
    
    if (!isParticipant) {
      console.warn("Participant: Cannot send code update - not a participant");
      return;
    }
    
    if (!isConnected) {
      console.warn("Participant: Cannot send code update - socket not connected");
      return;
    }

    // Debounce: Only send if code actually changed
    if (newCode === lastSentCodeRef.current) {
      console.log("Participant: Code unchanged, skipping send");
      return;
    }

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce updates (send every 300ms max)
    debounceTimerRef.current = setTimeout(() => {
      try {
        console.log("Participant: Sending code update via Socket.io", {
          sessionId,
          codeLength: newCode.length,
          language: lastSentLanguageRef.current,
          socketId: socket.id,
          connected: socket.connected,
        });
        
        console.log("🟢 [PARTICIPANT] Emitting code:update", {
          sessionId,
          codeLength: newCode.length,
          language: lastSentLanguageRef.current,
          socketId: socket.id,
          socketConnected: socket.connected,
        });

        socket.emit("code:update", {
          sessionId,
          code: newCode,
          language: lastSentLanguageRef.current,
          senderRole: "participant",
        });

        lastSentCodeRef.current = newCode;
        console.log("✅ [PARTICIPANT] Code update sent successfully");
      } catch (error) {
        console.error("Participant: Error sending code update:", error);
      }
    }, 300);
  };

  // Send language update (for PARTICIPANT only)
  const sendLanguageUpdate = (newLanguage) => {
    if (!socket || !isParticipant || !isConnected) return;
    if (newLanguage === lastSentLanguageRef.current) return;

    try {
      console.log("Participant: Sending language update via Socket.io:", newLanguage);
      socket.emit("language:update", {
        sessionId,
        language: newLanguage,
        senderRole: "participant",
      });

      lastSentLanguageRef.current = newLanguage;
    } catch (error) {
      console.error("Participant: Error sending language update:", error);
    }
  };

  // Send typing indicator (for PARTICIPANT only)
  const sendTypingIndicator = () => {
    if (!socket || !isParticipant || !isConnected) return;

    try {
      socket.emit("code:typing", {
        sessionId,
        senderRole: "participant",
      });
    } catch (error) {
      console.error("Error sending typing indicator:", error);
    }
  };

  // Send code run output (for PARTICIPANT only)
  const sendCodeRunOutput = (output) => {
    if (!socket || !isParticipant || !isConnected) return;

    try {
      console.log("Participant: Sending code run output via Socket.io");
      socket.emit("code:run", {
        sessionId,
        output,
        senderRole: "participant",
      });
    } catch (error) {
      console.error("Participant: Error sending code run output:", error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    syncedCode,
    syncedLanguage,
    sendCodeUpdate,
    sendLanguageUpdate,
    sendTypingIndicator,
    sendCodeRunOutput,
    isParticipantTyping,
    // Only expose setters for participant (for initial state setup)
    // Host should NEVER use these - they only receive from socket
    ...(isParticipant ? { setSyncedCode, setSyncedLanguage } : {}),
    isConnected,
  };
}

