import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { createServer } from "http";
import { serve } from "inngest/express";
import { clerkMiddleware } from "@clerk/express";

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js"; 
import { inngest, functions } from "./lib/inngest.js";
import { protectRoute } from "./middlewear/protectRoute.js";
import { initializeSocket } from "./lib/socket.js";

import chatRoutes from "./routes/chatRoute.js";
import sessionRoutes from "./routes/sessionRoute.js";
import userRoutes from "./routes/userRoute.js";

// dotenv is already loaded in ./lib/env.js

const app = express();
const __dirname = path.resolve();

// middlewear
app.use(express.json());
// credentials:true meaning?? => server allows a browser to include cookies on request
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(clerkMiddleware()); // this adds auth field to request object: req.auth()

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/chat", chatRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/users", userRoutes);


const PORT = process.env.PORT || ENV.PORT || 10000;


app.get("/health", (req, res) => {
  res.status(200).json({ msg: "api is up and running" });
});

app.get("/keep-alive", (req, res) => {
  res.send("Keep Alive");
});

setInterval(() => {
  fetch("https://remote-interview-platform-bqb6.onrender.com/keep-alive")
    .then(() => console.log("Pinged self to stay alive"))
    .catch((error) => console.error("Ping failed:", error));
}, 5 * 60 * 1000); // every 5 minutes

// MongoDB connection status endpoint
app.get("/api/db-status", async (req, res) => {
  const mongoose = (await import("mongoose")).default;
  const { connectDB } = await import("./lib/db.js");
  
  const readyState = mongoose.connection.readyState;
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };

  if (readyState === 1) {
    return res.status(200).json({
      status: "connected",
      readyState: readyState,
      state: states[readyState],
      host: mongoose.connection.host,
      database: mongoose.connection.name
    });
  }

  // Try to connect if not connected
  if (readyState === 0) {
    try {
      await connectDB();
      const newState = mongoose.connection.readyState;
      if (newState === 1) {
        return res.status(200).json({
          status: "connected",
          readyState: newState,
          state: states[newState],
          host: mongoose.connection.host,
          database: mongoose.connection.name,
          message: "Connection established"
        });
      }
    } catch (error) {
      return res.status(503).json({
        status: "disconnected",
        readyState: readyState,
        state: states[readyState],
        error: error.message,
        message: "Failed to connect to MongoDB"
      });
    }
  }

  res.status(503).json({
    status: "disconnected",
    readyState: readyState,
    state: states[readyState],
    message: "MongoDB is not connected"
  });
});


/* Serve React frontend in production */
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(
      path.join(__dirname, "../frontend/dist/index.html")
    );
  });
}

const startServer = async () => {
  try {
    await connectDB();

    // Create HTTP server for Socket.io
    const httpServer = createServer(app);

    // Initialize Socket.io
    initializeSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log("🚀 Server is running on port:", PORT);
      console.log("🔌 Socket.io initialized");
    });

  } catch (error) {
    console.error("💥 Error starting the server:", error);
    process.exit(1);
  }
};

startServer();

