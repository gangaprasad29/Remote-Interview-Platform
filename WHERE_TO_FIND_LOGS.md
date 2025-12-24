# 📋 Where to Find Socket Failure Logs

## ✅ **Servers Started!**

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:10000

---

## 🔍 **BACKEND LOGS (Socket Failures)**

### Location:
**Terminal/Console where backend is running**
- The terminal window where you see `🚀 Server is running on port: 10000`
- Or the terminal where you ran `cd backend && npm run dev`

### What to Look For:

#### ✅ **Good Signs:**
```
Socket connected: <socket-id>
✅ [BACKEND] Socket <id> joined room session:<id> as host/participant (2 total in room)
✅ [BACKEND] Code update broadcasted in room session:<id>
```

#### ❌ **Failure Signs:**
```
❌ [BACKEND] Rejected: Only participants can send code updates
❌ [BACKEND] Rejected: Session ID is required
Socket connection error: ...
📡 [BACKEND] Broadcasting code:update to room session:<id> (1 sockets in room)
// ⚠️ Only 1 socket = host/participant not in same room!
```

### Key Log Prefixes:
- `🔵 [BACKEND]` - General events
- `✅ [BACKEND]` - Success operations  
- `❌ [BACKEND]` - Errors/rejections
- `📡 [BACKEND]` - Broadcasting (check room size!)
- `📝 [BACKEND]` - State updates

---

## 🔍 **FRONTEND LOGS (Socket Failures)**

### Location:
**Browser Developer Console**
1. Open your browser (Chrome/Firefox/Edge)
2. Press **F12** (or Right-click → Inspect)
3. Click **Console** tab
4. Filter by typing: `[PARTICIPANT]` or `[HOST]` or `Socket`

### What to Look For:

#### ✅ **Good Signs (Participant):**
```
🟢 [FRONTEND] Joining session room: { sessionId: "...", role: "participant" }
🟢 [PARTICIPANT] Emitting code:update
✅ [PARTICIPANT] Code update sent successfully
```

#### ✅ **Good Signs (Host):**
```
🟢 [FRONTEND] Joining session room: { sessionId: "...", role: "host" }
🔴 [HOST] Received code:update via Socket.io
🔄 [HOST] Updating synced code from X to Y chars
✅ [HOST] Code update processed successfully
```

#### ❌ **Failure Signs:**
```
❌ Socket connection error: ...
❌ [PARTICIPANT] Cannot send code update - socket not connected
❌ [HOST] Cannot setup listeners - socket not available
❌ [HOST] Cannot setup listeners - socket not connected
Socket disconnected
```

### Key Log Prefixes:
- `🟢 [PARTICIPANT]` - Participant sending events
- `🔴 [HOST]` - Host receiving events
- `✅` - Success
- `❌` - Errors
- `🔄` - State updates

---

## 🐛 **Common Socket Failure Patterns**

### 1. **Connection Failed**
**Backend Log:**
```
❌ No "Socket connected" messages
```

**Frontend Log:**
```
Socket connection error: ...
❌ Cannot send code update - socket not connected
```

**Fix:** Check backend is running, CORS settings, URL matches

---

### 2. **Room Join Failed**
**Backend Log:**
```
❌ [BACKEND] Rejected: Session ID is required
```

**Frontend Log:**
```
// No "joined room" message after "Socket connected"
```

**Fix:** Check `sessionId` is valid, session data loaded

---

### 3. **Code Not Syncing (Room Size = 1)**
**Backend Log:**
```
📡 [BACKEND] Broadcasting code:update to room session:abc123 (1 sockets in room)
// ⚠️ Should be 2+ if both host and participant are connected!
```

**Fix:** Check both users have same `sessionId`, both joined room

---

### 4. **Participant Sends But Host Doesn't Receive**
**Participant Log:**
```
✅ [PARTICIPANT] Code update sent successfully
```

**Backend Log:**
```
✅ [BACKEND] Code update broadcasted
```

**Host Log:**
```
// ❌ No "[HOST] Received code:update" message
```

**Fix:** Host not in same room, check sessionId match

---

## 📊 **Quick Debug Checklist**

1. **Check Backend Terminal:**
   - [ ] See "Socket connected" messages
   - [ ] See "joined room" messages
   - [ ] Room size shows 2+ sockets
   - [ ] No error messages

2. **Check Participant Browser Console:**
   - [ ] See "Joining session room"
   - [ ] See "Emitting code:update"
   - [ ] See "Code update sent successfully"
   - [ ] No connection errors

3. **Check Host Browser Console:**
   - [ ] See "Joining session room"
   - [ ] See "Received code:update"
   - [ ] See "Code update processed"
   - [ ] No connection errors

---

## 🚨 **If You See Errors**

**Copy these logs:**
1. Last 20-30 lines from **Backend Terminal**
2. Console output from **Participant Browser** (filter: `[PARTICIPANT]` or `Socket`)
3. Console output from **Host Browser** (filter: `[HOST]` or `Socket`)

This will help identify exactly where the socket sync is failing!

