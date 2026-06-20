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

  // Phase 3: real-time race transform state
  @type("number") x = 0;
  @type("number") y = 0.3;
  @type("number") z = -80;
  @type("number") yaw = 0;
  @type("number") speed = 0;
  @type("boolean") isNitro = false;
  @type("boolean") isDrifting = false;
  @type("string") raceStatus: "lobby" | "racing" | "disconnected" = "lobby";
  @type("number") laneIndex = 0;
  @type("number") lastUpdate = Date.now();
}

export class RaceStateSchema extends Schema {
  @type("string") roomId = "";
  @type("string") status: "lobby" | "countdown" | "racing" | "ended" = "lobby";
  @type("string") raceClass = "open";
  @type([LobbyPlayerSchema]) players = new ArraySchema<LobbyPlayerSchema>();
  @type("number") countdownSeconds = 5;
  @type("number") countdownStartedAt = 0;
  @type("number") raceStartedAt = 0;
  @type("number") maxPlayers = 4;
  @type("number") minPlayersToStart = 2;
}
