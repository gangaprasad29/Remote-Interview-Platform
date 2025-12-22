import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { serve } from "inngest/express";

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js"; 
import { inngest, functions } from "./lib/inngest.js";

dotenv.config();

const app = express();
const __dirname = path.resolve();

// middlewear
app.use(express.json());
// credentials:true meaning?? => server allows a browser to include cookies on request
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));

app.use("/api/inngest", serve({ client: inngest, functions }));


const PORT = process.env.PORT || ENV.PORT || 10000;


app.get("/health", (req, res) => {
  res.status(200).json({ msg: "api is up and running" });
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

    app.listen(PORT, () => {
      console.log("🚀 Server is running on port:", PORT);
    });

  } catch (error) {
    console.error("💥 Error starting the server:", error);
    process.exit(1);
  }
};

startServer();
