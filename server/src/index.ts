import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "colyseus";
import { RaceRoom } from "./rooms/RaceRoom";

const PORT = parseInt(process.env.GAME_SERVER_PORT || "2567", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

const app = express();

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Health check for Colyseus server
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

const server = http.createServer(app);
const gameServer = new Server({ server });

// Register the racing room
gameServer.define("race_room", RaceRoom);

// Start
server.listen(PORT, () => {
  console.log(`\n🏎️  Racete Game Server`);
  console.log(`   Colyseus   → ws://localhost:${PORT}`);
  console.log(`   Health     → http://localhost:${PORT}/health`);
  console.log(`   CORS       → ${CORS_ORIGIN}\n`);
});
