import express from "express";
import dotenv from "dotenv";
import path from "path";
import { ENV } from "./lib/env.js";

dotenv.config();

const app = express();
const __dirname = path.resolve();

const PORT = ENV.PORT || process.env.PORT || 10000;

app.use(express.json());

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

app.listen(PORT, () => {
  console.log("server running on", PORT);
});
