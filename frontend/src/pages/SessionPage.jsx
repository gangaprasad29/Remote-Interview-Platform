import { useUser } from "@clerk/clerk-react";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEndSession, useJoinSession, useSessionById } from "../hooks/useSessions";
import { PROBLEMS } from "../data/problems";
import { executeCode } from "../lib/piston";
import Navbar from "../components/Navbar";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { getDifficultyBadgeClass } from "../lib/utils";
import { Loader2Icon, LogOutIcon, PhoneOffIcon } from "lucide-react";
import CodeEditorPanel from "../components/CodeEditorPanel";
import OutputPanel from "../components/OutputPanel";

import useStreamClient from "../hooks/useStreamClient";
import { useSocket } from "../hooks/useSocket";
import { useCodeSyncSocket } from "../hooks/useCodeSyncSocket";
import { StreamCall, StreamVideo } from "@stream-io/video-react-sdk";
import VideoCallUI from "../components/VideoCallUI";

function SessionPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useUser();
  const [output, setOutput] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const { data: sessionData, isLoading: loadingSession, refetch } = useSessionById(id);

  const joinSessionMutation = useJoinSession();
  const endSessionMutation = useEndSession();

  const session = sessionData?.session;
  const isHost = session?.host?.clerkId === user?.id;
  const isParticipant = session?.participant?.clerkId === user?.id;

  const { call, channel, chatClient, isInitializingCall, streamClient } = useStreamClient(
    session,
    loadingSession,
    isHost,
    isParticipant
  );

  // Socket.io connection for real-time code sync
  const { socket, isConnected: isSocketConnected } = useSocket(
    session?.sessionId || id,
    isHost,
    isParticipant
  );

  // find the problem data based on session problem title
  const problemData = session?.problem
    ? Object.values(PROBLEMS).find((p) => p.title === session.problem)
    : null;

  // PARTICIPANT ONLY: Local state for code and language
  // HOST: NO local state - only uses synced state from socket
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const initialCode = problemData?.starterCode?.[selectedLanguage] || "";
  const [localCode, setLocalCode] = useState(initialCode);
  const isInitialMountRef = useRef(true);
  const socketNotReadyWarnedRef = useRef(false);
  const hasSyncedOnConnectRef = useRef(false);

  // Real-time code and language synchronization using Socket.io
  const {
    syncedCode,
    syncedLanguage,
    sendCodeUpdate,
    sendLanguageUpdate,
    sendTypingIndicator,
    sendCodeRunOutput,
    isParticipantTyping,
    isConnected: isCodeSyncConnected,
  } = useCodeSyncSocket(
    socket,
    isParticipant,
    initialCode,
    selectedLanguage,
    session?.sessionId || id
  );

  // Listen for code run output from participant (for HOST)
  useEffect(() => {
    if (!isHost || !socket) return;

    const handleCodeRunOutput = (event) => {
      const output = event.detail;
      console.log("Host: Received code run output via Socket.io");
      setOutput(output);
    };

    window.addEventListener("code:run-output", handleCodeRunOutput);

    return () => {
      window.removeEventListener("code:run-output", handleCodeRunOutput);
    };
  }, [isHost, socket]);

  // Determine which code and language to use
  // CRITICAL RULE: Host MUST use syncedCode/syncedLanguage (from socket) ONLY
  // Host has ZERO local editor state - participant is single source of truth
  const displayCode = isHost ? (syncedCode || "") : localCode;
  const displayLanguage = isHost ? (syncedLanguage || "javascript") : selectedLanguage;

  // Auto-sync code when socket becomes ready (for participant)
  useEffect(() => {
    if (isParticipant && socket && isCodeSyncConnected && localCode && !hasSyncedOnConnectRef.current) {
      // Socket just connected for the first time, sync current code
      console.log("✅ [PARTICIPANT] Socket connected, syncing current code");
      sendCodeUpdate(localCode);
      sendLanguageUpdate(selectedLanguage);
      hasSyncedOnConnectRef.current = true;
      socketNotReadyWarnedRef.current = false; // Reset warning flag
    }
    
    // Reset sync flag if socket disconnects
    if (!isCodeSyncConnected) {
      hasSyncedOnConnectRef.current = false;
    }
  }, [isParticipant, socket, isCodeSyncConnected, localCode, selectedLanguage, sendCodeUpdate, sendLanguageUpdate]);

  // Debug logging for socket connection status
  useEffect(() => {
    console.log("SessionPage Socket Status:", {
      isHost,
      isParticipant,
      hasSocket: !!socket,
      socketConnected: isCodeSyncConnected,
      socketId: socket?.id,
      sessionId: session?.sessionId || id,
      hostCodeLength: isHost ? syncedCode?.length : 0,
      hostLanguage: isHost ? syncedLanguage : null,
    });
  }, [isHost, isParticipant, socket, isCodeSyncConnected, session?.sessionId, id, syncedCode, syncedLanguage]);

  // auto-join session if user is not already a participant and not the host
  useEffect(() => {
    if (!session || !user || loadingSession) return;
    if (isHost || isParticipant) return;

    joinSessionMutation.mutate(id, { onSuccess: refetch });

    // remove the joinSessionMutation, refetch from dependencies to avoid infinite loop
  }, [session, user, loadingSession, isHost, isParticipant, id]);

  // redirect when session ends
  useEffect(() => {
    if (!session || loadingSession) return;

    if (session.status === "ended") {
      const redirectPath = isHost ? "/host/dashboard" : "/participant/dashboard";
      navigate(redirectPath);
    }
  }, [session, loadingSession, navigate, isHost]);

  // PARTICIPANT ONLY: Initialize code when problem loads
  // HOST: Does NOT initialize - waits for socket state from server
  useEffect(() => {
    if (!isParticipant) return; // Host does nothing here
    if (!problemData?.starterCode?.[selectedLanguage]) return;
    
    const starterCode = problemData.starterCode[selectedLanguage];
    
    // Participant: update local code and sync initial state via Socket.io
    // Only on initial mount to prevent overwriting user edits
    if (isInitialMountRef.current && initialCode) {
      isInitialMountRef.current = false;
      setLocalCode(starterCode);
      
      // Wait for socket to be ready before sending
      const sendInitialState = () => {
        if (socket && isCodeSyncConnected) {
          console.log("Participant: Sending initial code and language via Socket.io");
          sendCodeUpdate(starterCode);
          sendLanguageUpdate(selectedLanguage);
        } else {
          // Retry after a short delay if socket not ready
          setTimeout(sendInitialState, 500);
        }
      };
      
      sendInitialState();
    }
  }, [isParticipant, problemData, selectedLanguage, initialCode, socket, isCodeSyncConnected, sendCodeUpdate, sendLanguageUpdate]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    
    if (isHost) {
      // Host cannot change language - it's synced from participant
      console.warn("Host attempted to change language - this should not happen");
      return;
    }
    
    // Participant: update language and sync
    setSelectedLanguage(newLang);
    // use problem-specific starter code
    const starterCode = problemData?.starterCode?.[newLang] || "";
    setLocalCode(starterCode);
    
    // Sync both code and language changes
    sendCodeUpdate(starterCode);
    sendLanguageUpdate(newLang);
    
    setOutput(null);
  };

  const handleCodeChange = (newCode) => {
    if (isHost) {
      // Host cannot edit code - this should never be called due to readOnly
      console.warn("Host attempted to edit code - this should not happen");
      return;
    }

    // Participant: update local code and sync via Socket.io
    setLocalCode(newCode);
    
    // CRITICAL: Always send updates via socket
    if (socket && isCodeSyncConnected) {
      sendCodeUpdate(newCode);
      sendTypingIndicator();
      // Reset warning flag once socket is working
      socketNotReadyWarnedRef.current = false;
    } else {
      // Only warn once, not on every keystroke
      if (!socketNotReadyWarnedRef.current) {
        console.warn("⚠️ [PARTICIPANT] Socket not ready, code updates will sync when connected", {
          hasSocket: !!socket,
          isConnected: isCodeSyncConnected,
        });
        socketNotReadyWarnedRef.current = true;
      }
      // Still update local state so user can type, sync will happen when socket connects
    }
  };

  const handleRunCode = async () => {
    if (isHost) {
      // Host cannot run code
      return;
    }

    setIsRunning(true);
    setOutput(null);

    const codeToRun = localCode;
    const result = await executeCode(selectedLanguage, codeToRun);
    setOutput(result);
    
    // Sync output to host via Socket.io
    if (socket && isCodeSyncConnected) {
      sendCodeRunOutput(result);
    }
    
    setIsRunning(false);
  };

  const handleEndSession = () => {
    if (confirm("Are you sure you want to end this session? All participants will be notified.")) {
      // this will navigate to role-specific dashboard
      const redirectPath = isHost ? "/host/dashboard" : "/participant/dashboard";
      endSessionMutation.mutate(id, { onSuccess: () => navigate(redirectPath) });
    }
  };

  return (
    <div className="h-screen bg-base-100 flex flex-col">
      <Navbar />

      <div className="flex-1">
        <PanelGroup direction="horizontal">
          {/* LEFT PANEL - CODE EDITOR & PROBLEM DETAILS */}
          <Panel defaultSize={50} minSize={30}>
            <PanelGroup direction="vertical">
              {/* PROBLEM DSC PANEL */}
              <Panel defaultSize={50} minSize={20}>
                <div className="h-full overflow-y-auto bg-base-200">
                  {/* HEADER SECTION */}
                  <div className="p-6 bg-base-100 border-b border-base-300">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h1 className="text-3xl font-bold text-base-content">
                          {session?.problem || "Loading..."}
                        </h1>
                        {problemData?.category && (
                          <p className="text-base-content/60 mt-1">{problemData.category}</p>
                        )}
                        <p className="text-base-content/60 mt-2">
                          Host: {session?.host?.name || "Loading..."} •{" "}
                          {session?.participant ? 2 : 1}/2 participants
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`badge badge-lg ${getDifficultyBadgeClass(
                            session?.difficulty
                          )}`}
                        >
                          {session?.difficulty.slice(0, 1).toUpperCase() +
                            session?.difficulty.slice(1) || "Easy"}
                        </span>
                        {isHost && (session?.status === "active" || session?.status === "waiting") && (
                          <button
                            onClick={handleEndSession}
                            disabled={endSessionMutation.isPending}
                            className="btn btn-error btn-sm gap-2"
                          >
                            {endSessionMutation.isPending ? (
                              <Loader2Icon className="w-4 h-4 animate-spin" />
                            ) : (
                              <LogOutIcon className="w-4 h-4" />
                            )}
                            End Session
                          </button>
                        )}
                        {session?.status === "ended" && (
                          <span className="badge badge-ghost badge-lg">Ended</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* problem desc */}
                    {problemData?.description && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Description</h2>
                        <div className="space-y-3 text-base leading-relaxed">
                          <p className="text-base-content/90">{problemData.description.text}</p>
                          {problemData.description.notes?.map((note, idx) => (
                            <p key={idx} className="text-base-content/90">
                              {note}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* examples section */}
                    {problemData?.examples && problemData.examples.length > 0 && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Examples</h2>

                        <div className="space-y-4">
                          {problemData.examples.map((example, idx) => (
                            <div key={idx}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="badge badge-sm">{idx + 1}</span>
                                <p className="font-semibold text-base-content">Example {idx + 1}</p>
                              </div>
                              <div className="bg-base-200 rounded-lg p-4 font-mono text-sm space-y-1.5">
                                <div className="flex gap-2">
                                  <span className="text-primary font-bold min-w-[70px]">
                                    Input:
                                  </span>
                                  <span>{example.input}</span>
                                </div>
                                <div className="flex gap-2">
                                  <span className="text-secondary font-bold min-w-[70px]">
                                    Output:
                                  </span>
                                  <span>{example.output}</span>
                                </div>
                                {example.explanation && (
                                  <div className="pt-2 border-t border-base-300 mt-2">
                                    <span className="text-base-content/60 font-sans text-xs">
                                      <span className="font-semibold">Explanation:</span>{" "}
                                      {example.explanation}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Constraints */}
                    {problemData?.constraints && problemData.constraints.length > 0 && (
                      <div className="bg-base-100 rounded-xl shadow-sm p-5 border border-base-300">
                        <h2 className="text-xl font-bold mb-4 text-base-content">Constraints</h2>
                        <ul className="space-y-2 text-base-content/90">
                          {problemData.constraints.map((constraint, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="text-primary">•</span>
                              <code className="text-sm">{constraint}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

              <Panel defaultSize={50} minSize={20}>
                <PanelGroup direction="vertical">
                  <Panel defaultSize={70} minSize={30}>
                    {isHost && (!syncedCode || syncedCode === "") ? (
                      <div className="h-full bg-base-300 flex items-center justify-center">
                        <div className="text-center p-8">
                          <div className="text-6xl mb-4">👀</div>
                          <h3 className="text-xl font-semibold text-base-content mb-2">
                            Waiting for participant to start coding...
                          </h3>
                          <p className="text-base-content/60">
                            The code editor will appear here once the participant begins coding.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <CodeEditorPanel
                        selectedLanguage={displayLanguage}
                        code={displayCode}
                        isRunning={isRunning}
                        onLanguageChange={handleLanguageChange}
                        onCodeChange={handleCodeChange}
                        onRunCode={handleRunCode}
                        readOnly={isHost}
                        isParticipantTyping={isParticipantTyping}
                      />
                    )}
                  </Panel>

                  <PanelResizeHandle className="h-2 bg-base-300 hover:bg-primary transition-colors cursor-row-resize" />

                  <Panel defaultSize={30} minSize={15}>
                    <OutputPanel output={output} />
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-2 bg-base-300 hover:bg-primary transition-colors cursor-col-resize" />

          {/* RIGHT PANEL - VIDEO CALLS & CHAT */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full bg-base-200 p-4 overflow-auto">
              {isInitializingCall ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader2Icon className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
                    <p className="text-lg">Connecting to video call...</p>
                  </div>
                </div>
              ) : !streamClient || !call ? (
                <div className="h-full flex items-center justify-center">
                  <div className="card bg-base-100 shadow-xl max-w-md">
                    <div className="card-body items-center text-center">
                      <div className="w-24 h-24 bg-error/10 rounded-full flex items-center justify-center mb-4">
                        <PhoneOffIcon className="w-12 h-12 text-error" />
                      </div>
                      <h2 className="card-title text-2xl">Connection Failed</h2>
                      <p className="text-base-content/70">Unable to connect to the video call</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full">
                  <StreamVideo client={streamClient}>
                    <StreamCall call={call}>
                      <VideoCallUI chatClient={chatClient} channel={channel} />
                    </StreamCall>
                  </StreamVideo>
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default SessionPage;
