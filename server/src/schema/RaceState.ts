import { Schema, type, ArraySchema } from "@colyseus/schema";

export class LobbyPlayerSchema extends Schema {
  @type("string") sessionId = "";
  @type("string") walletAddress = "";
  @type("string") selectedCarId = "";
  @type("string") carName = "";
  @type("string") carClass = "open";
  @type("number") powerRating = 0;
  @type("boolean") ready = false;
  @type("number") joinedAt = Date.now();

  // Real-time race transform state
  @type("number") x = 0;
  @type("number") y = 0.3;
  @type("number") z = -80;
  @type("number") yaw = 0;
  @type("number") speed = 0;
  @type("boolean") isNitro = false;
  @type("boolean") isDrifting = false;

  // Race lifecycle
  @type("string") raceStatus: "lobby" | "racing" | "finished" | "disconnected" | "dnf" = "lobby";
  @type("number") laneIndex = 0;
  @type("number") lastUpdate = Date.now();

  // Server-authoritative race progress
  @type("number") currentLap = 1;
  @type("number") totalLaps = 3;
  @type("number") checkpointIndex = 0; // Next expected checkpoint (0-based order index)
  @type("number") checkpointsPassed = 0;
  @type("number") startedAt = 0;     // Server timestamp when race starts
  @type("number") finishedAt = 0;    // Server timestamp when finish accepted
  @type("number") totalTimeMs = 0;   // finishedAt - startedAt
  @type("number") bestLapMs = 0;
  @type("number") firstLapMs = 0;

  // Placement (assigned by server when race ends)
  @type("number") placement = 0;
}

export class RaceResultSchema extends Schema {
  @type("string") sessionId = "";
  @type("string") walletAddress = "";
  @type("string") displayWallet = "";
  @type("string") carName = "";
  @type("string") carClass = "";
  @type("number") placement = 0;
  @type("number") totalTimeMs = 0;
  @type("number") bestLapMs = 0;
  @type("number") firstLapMs = 0;
  @type("string") status = "dnf"; // finished | dnf | disconnected
}

export class RaceStateSchema extends Schema {
  @type("string") roomId = "";
  @type("string") status: "lobby" | "countdown" | "racing" | "finished" = "lobby";
  @type("string") raceClass = "open";
  @type([LobbyPlayerSchema]) players = new ArraySchema<LobbyPlayerSchema>();
  @type("number") countdownSeconds = 5;
  @type("number") countdownStartedAt = 0;
  @type("number") raceStartedAt = 0;
  @type("number") maxPlayers = 6;
  @type("number") minPlayersToStart = 2;

  // Final race results (populated when race ends)
  @type([RaceResultSchema]) results = new ArraySchema<RaceResultSchema>();
}
