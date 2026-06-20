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
}

export class RaceStateSchema extends Schema {
  @type("string") roomId = "";
  @type("string") status: "lobby" | "countdown" | "racing" | "ended" = "lobby";
  @type("string") raceClass = "open";
  @type([LobbyPlayerSchema]) players = new ArraySchema<LobbyPlayerSchema>();
  @type("number") countdownSeconds = 5;
  @type("number") countdownStartedAt: number | null = null;
  @type("number") raceStartedAt: number | null = null;
  @type("number") maxPlayers = 4;
  @type("number") minPlayersToStart = 2;
}
