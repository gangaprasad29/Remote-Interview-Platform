# Socket Debugging Guide - Real-Time Sync

## 🔍 **Enhanced Logging Added**

I've added detailed logging with emoji prefixes to help debug the socket connection:

### Backend Logs (Terminal/Console)
- 🔵 `[BACKEND]` - General events
- ✅ `[BACKEND]` - Success operations
- ❌ `[BACKEND]` - Errors/rejections
- 📡 `[BACKEND]` - Broadcasting events
- 📝 `[BACKEND]` - State updates
- 📤 `[BACKEND]` - Sending data

### Frontend Logs (Browser Console - F12)
- 🟢 `[PARTICIPANT]` - Participant actions
- 🔴 `[HOST]` - Host receiving events
- ✅ Success operations
- ❌ Errors
- 🔄 State updates

---

## 📊 **What to Check**

### 1. **Socket Connection**
**Backend should show:**
```
Socket connected: <socket-id>
```

**Frontend should show:**
```
🟢 [FRONTEND] Joining session room: { sessionId: "...", role: "host/participant" }
```

**Backend should show:**
```
✅ [BACKEND] Socket <id> joined room session:<id> as host/participant (X total in room)
```

### 2. **Code Update Flow**

**When Participant types:**
1. **Frontend Console:**
   ```
   🟢 [PARTICIPANT] Emitting code:update
   ✅ [PARTICIPANT] Code update sent successfully
   ```

2. **Backend Console:**
   ```
   🔵 [BACKEND] Received code:update event
   📡 [BACKEND] Broadcasting code:update to room session:<id> (X sockets in room)
   ✅ [BACKEND] Code update broadcasted
   ```

3. **Host Frontend Console:**
   ```
   🔴 [HOST] Received code:update via Socket.io
   🔄 [HOST] Updating synced code from X to Y chars
   ✅ [HOST] Code update processed successfully
   ```

---

## 🐛 **Common Issues to Check**

### Issue 1: **Socket Not Connecting**
**Symptoms:**
- No "Socket connected" messages
- Frontend shows connection errors

**Check:**
- Backend is running on port 10000
- CORS is configured correctly
- `VITE_API_URL` matches backend URL

### Issue 2: **Room Join Failing**
**Symptoms:**
- Socket connects but no "joined room" message
- `sessionId` is undefined or null

**Check:**
- `session?.sessionId || id` is valid
- Session data is loaded before socket connects

### Issue 3: **Code Updates Not Broadcasting**
**Symptoms:**
- Participant sends but host doesn't receive
- Backend shows "0 sockets in room"

**Check:**
- Both users are in the same room (`session:<same-id>`)
- `sessionId` matches exactly between participant and host
- Room size shows 2+ sockets

### Issue 4: **SessionId Mismatch**
**Symptoms:**
- Different sessionIds in logs
- Participant and host in different rooms

**Check:**
- `session?.sessionId` vs URL `id` parameter
- Ensure both use the same identifier

---

## 🔧 **Quick Debug Steps**

1. **Open Browser Console (F12)** on both windows
2. **Check Backend Terminal** for socket events
3. **Look for these patterns:**

   ✅ **Working:**
   ```
   [BACKEND] Socket joined room session:abc123 as participant (1 total)
   [BACKEND] Socket joined room session:abc123 as host (2 total)
   [BACKEND] Broadcasting code:update to room session:abc123 (2 sockets)
   [HOST] Received code:update via Socket.io
   ```

   ❌ **Not Working:**
   ```
   [BACKEND] Broadcasting code:update to room session:abc123 (1 sockets)
   // Only 1 socket = host not in room!
   ```

4. **Verify SessionId:**
   - Check `session?.sessionId` in SessionPage
   - Ensure it matches between participant and host
   - Look for any `undefined` or `null` values

---

## 📝 **Test Checklist**

- [ ] Both users connect to socket
- [ ] Both users join the same room
- [ ] Room shows 2+ sockets
- [ ] Participant emits code:update
- [ ] Backend receives and broadcasts
- [ ] Host receives code:update
- [ ] Host's editor updates

---

## 🚨 **If Still Not Working**

Share these logs:
1. **Backend terminal output** (last 20-30 lines)
2. **Participant browser console** (filter: `[PARTICIPANT]`)
3. **Host browser console** (filter: `[HOST]`)
4. **SessionPage console** (filter: `Socket Status`)

This will help identify exactly where the sync is breaking!

