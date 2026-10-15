import { challengeTarget } from "./challenge";
export { challengeTarget } from "./challenge";
import type {
  ILobbyData,
  ILobbyConfig,
  IQuestionType,
  IAnswerType,
  ITeamData,
  IPlayerData,
  IMessage,
} from "../types";
import LobbyLogic from "./LobbyLogic";

export interface GameConnection {
  id: string;
  emit: (event: string, message: IMessage) => unknown;
}
export type QuestionPools = Record<number, IQuestionType[]>;
const hostActions: Record<string, string[]> = {
  update_lobby_config: ["lobby"],
  update_teams: ["lobby"],
  start_game: ["lobby"],
  get_question: ["host_set_question", "lightning_round_set_question"],
  begin_lightning_round: ["lightning_round_set_question"],
  begin_lightning_buzzer: ["lightning_round"],
  choose_lightning_answer: ["lightning_round"],
  continue_lightning: ["lightning_reveal"],
  advance_round: ["host_set_question"],
  choose_team_answer: ["round"],
  end_round: ["round_end"],
  end_game: ["game_end"],
  return_to_lobby: ["game_over"],
};
const clone = <T>(v: T): T => structuredClone(v);
const error = (message: string): IMessage => ({ type: "error", message });
const requireThat = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

/** Shared referee: node in Docker; the elected coordinator frame in Refract. */
export default class Game {
  private disposed = false;
  private connections = new Map<string, GameConnection>();
  private lobbies = new Map<string, ILobbyData>();
  private pending = new Map<
    string,
    { lightning: boolean; question: IQuestionType }
  >();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private disconnected = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private pools: QuestionPools) {}
  addConnection(socket: GameConnection) {
    this.connections.set(socket.id, socket);
    clearTimeout(this.disconnected.get(socket.id));
    this.disconnected.delete(socket.id);
  }
  removeConnection(socket: GameConnection) {
    if (this.disposed) return;
    this.connections.delete(socket.id);
    const timeout = setTimeout(() => {
      for (const lobby of this.lobbies.values()) {
        if (lobby.hostSocketId === socket.id) this.deleteLobby(lobby.lobbyCode);
        else if (lobby.gameState === "lobby") {
          lobby.players = lobby.players.filter((p) => p.socketId !== socket.id);
          this.publish(lobby);
        }
      }
      this.disconnected.delete(socket.id);
    }, 120_000);
    this.disconnected.set(socket.id, timeout);
  }
  dispose() {
    this.disposed = true;
    for (const t of [...this.timers.values(), ...this.disconnected.values()])
      clearTimeout(t);
    this.timers.clear();
    this.disconnected.clear();
    this.connections.clear();
    this.lobbies.clear();
  }
  /** Trusted activity-host roster update; never exposed as a client action. */
  reconcileMembers(code: string, members: { id: string; name: string }[]) {
    const lobby = this.lobbies.get(code);
    if (!lobby) return;
    const ids = new Set(members.map((p) => p.id));
    for (const player of lobby.players)
      if (!ids.has(player.socketId)) this.connections.delete(player.socketId);
    lobby.players = lobby.players.filter((p) => ids.has(p.socketId));
    for (const person of members) {
      if (
        person.id === lobby.hostSocketId ||
        lobby.players.some((p) => p.socketId === person.id)
      )
        continue;
      if (
        lobby.gameState === "lobby" &&
        lobby.players.filter((p) => p.teamId !== false).length < 16
      )
        LobbyLogic.playerJoinLobby(lobby, person.id, person.name);
      else
        lobby.players.push({
          socketId: person.id,
          playerName: person.name,
          teamId: false,
        });
    }
    lobby.revision = (lobby.revision || 0) + 1;
    this.publish(lobby);
  }
  private deleteLobby(code: string) {
    clearTimeout(this.timers.get(code));
    this.timers.delete(code);
    this.lobbies.delete(code);
    this.pending.delete(code);
  }
  private view(lobby: ILobbyData, id: string): ILobbyData {
    const value = clone(lobby);
    if (id !== lobby.hostSocketId) {
      for (const q of [value.currentQuestion, value.lightningQuestion])
        if (q)
          for (const a of q.answers) {
            if (!a.answerSelected && value.gameState !== "lightning_reveal") {
              a.answerText = "";
              a.answerScore = null;
            }
          }
    }
    return value;
  }
  private response(lobby: ILobbyData, id: string): IMessage {
    return { type: "lobby_update", data: { lobby: this.view(lobby, id) } };
  }
  private publish(lobby: ILobbyData) {
    for (const id of new Set([
      lobby.hostSocketId,
      ...lobby.players.map((p) => p.socketId),
    ]))
      this.connections.get(id)?.emit("message", this.response(lobby, id));
  }
  private armTimer(lobby: ILobbyData, reset = true) {
    clearTimeout(this.timers.get(lobby.lobbyCode));
    this.timers.delete(lobby.lobbyCode);
    const active =
      lobby.gameState === "round" ||
      (lobby.gameState === "lightning_round" &&
        lobby.lightningRoundTeamIndex !== undefined);
    if (!active || !lobby.config.timerSeconds) {
      lobby.timerStart = undefined;
      return;
    }
    if (reset)
      lobby.timerStart = Math.max(Date.now(), (lobby.timerStart || 0) + 1);
    const start = lobby.timerStart;
    const timer = setTimeout(
      () => {
        if (!this.lobbies.has(lobby.lobbyCode) || lobby.timerStart !== start)
          return;
        if (lobby.gameState === "round") LobbyLogic.chooseAnswer(lobby, false);
        else this.lightningAnswer(lobby, false);
        lobby.revision = (lobby.revision || 0) + 1;
        this.armTimer(lobby);
        this.publish(lobby);
      },
      Math.max(1, start + lobby.config.timerSeconds * 1000 - Date.now()),
    );
    this.timers.set(lobby.lobbyCode, timer);
  }
  private config(input: any): ILobbyConfig {
    requireThat(
      input &&
        Array.isArray(input.questionPools) &&
        input.questionPools.length > 0 &&
        input.questionPools.length <= 6 &&
        input.questionPools.every(
          (n: unknown) =>
            Number.isInteger(n) && Number(n) >= 3 && Number(n) <= 8,
        ),
      "Select at least one valid question set.",
    );
    for (const [key, min, max] of [
      ["numberOfRounds", 1, 32],
      ["timerSeconds", 0, 300],
      ["winningScore", -1, 50000],
    ] as const)
      requireThat(
        Number.isInteger(input[key]) && input[key] >= min && input[key] <= max,
        `Invalid ${key}.`,
      );
    requireThat(
      typeof input.lightningRound === "boolean",
      "Invalid lightning setting.",
    );
    return {
      questionPools: [...new Set<number>(input.questionPools)],
      numberOfRounds: input.numberOfRounds,
      timerSeconds: input.timerSeconds,
      winningScore: input.winningScore,
      lightningRound: input.lightningRound,
    };
  }
  private select(lobby: ILobbyData, lightning: boolean) {
    const numbers = lobby.config.questionPools;
    const pool = lightning
      ? Object.entries(this.pools)
          .filter(([number]) => Number(number) <= 2)
          .flatMap(([, questions]) => questions)
      : this.pools[numbers[Math.floor(Math.random() * numbers.length)]];
    requireThat(pool?.length, "Question pool unavailable.");
    const question = clone(pool[Math.floor(Math.random() * pool.length)]);
    this.pending.set(lobby.lobbyCode, { lightning, question });
    return question;
  }
  private confirmed(lobby: ILobbyData, input: any, lightning: boolean) {
    const pending = this.pending.get(lobby.lobbyCode);
    requireThat(
      pending &&
        pending.lightning === lightning &&
        pending.question.question === input?.question,
      "Choose a question supplied by the referee.",
    );
    this.pending.delete(lobby.lobbyCode);
    return clone(pending.question);
  }
  private answer(question: IQuestionType, input: any): IAnswerType | false {
    if (input === false) return false;
    const found = question?.answers.find(
      (a) => a.answerText === input?.answerText,
    );
    requireThat(
      found && !found.answerSelected,
      "Select an unanswered answer from this board.",
    );
    return found;
  }
  private lightningAnswer(lobby: ILobbyData, answer: IAnswerType | false) {
    requireThat(
      lobby.lightningRoundTeamIndex !== undefined,
      "Wait for a team to buzz in.",
    );
    if (answer === false) {
      const team = lobby.teams[lobby.lightningRoundTeamIndex];
      team.wrongGuesses = (team.wrongGuesses || 0) + 1;
      const next = lobby.teams.findIndex(
        (t, i) => i !== lobby.lightningRoundTeamIndex && !t.wrongGuesses,
      );
      if (next !== -1) lobby.lightningRoundTeamIndex = next;
      else {
        lobby.lightningRoundStarted = false;
        lobby.currentTeamIndex = lobby.lightningRoundTeamIndex;
        lobby.gameState = "lightning_reveal";
      }
    } else {
      answer.answerSelected = true;
      lobby.currentTeamIndex = lobby.lightningRoundTeamIndex;
      lobby.lightningRoundStarted = false;
      lobby.gameState = "lightning_reveal";
    }
  }
  async onMessage(socket: GameConnection, message: any): Promise<IMessage> {
    try {
      requireThat(
        message &&
          typeof message.type === "string" &&
          JSON.stringify(message).length <= 32_768,
        "Invalid message.",
      );
      const { type } = message;
      const data = message.data || {};
      if (type === "ping") return { type: "pong", data: { time: Date.now() } };
      if (type === "create_lobby") {
        requireThat(
          typeof data.playerName === "string" &&
            data.playerName.trim().length > 0 &&
            data.playerName.trim().length <= 40,
          "Enter a name (1–40 characters).",
        );
        requireThat(
          ![...this.lobbies.values()].some(
            (l) =>
              l.hostSocketId === socket.id ||
              l.players.some((p) => p.socketId === socket.id),
          ),
          "Leave your current lobby first.",
        );
        requireThat(this.lobbies.size < 1000, "The server is full.");
        const lobby = LobbyLogic.createLobby(socket.id, data.playerName.trim());
        do {
          lobby.lobbyCode = String(Math.floor(100000 + Math.random() * 900000));
        } while (this.lobbies.has(lobby.lobbyCode));
        lobby.revision = 0;
        this.lobbies.set(lobby.lobbyCode, lobby);
        return this.response(lobby, socket.id);
      }
      requireThat(typeof data.lobbyCode === "string", "Lobby code required.");
      let lobby = this.lobbies.get(data.lobbyCode);
      requireThat(lobby, "Lobby not found.");
      if (type === "join_lobby") {
        requireThat(!data.fakeUser, "Test players are not supported.");
        requireThat(
          lobby.gameState === "lobby",
          "This game has already started.",
        );
        requireThat(
          typeof data.playerName === "string" &&
            data.playerName.trim().length > 0 &&
            data.playerName.trim().length <= 40,
          "Enter a name (1–40 characters).",
        );
        requireThat(lobby.players.length < 16, "This lobby is full.");
        requireThat(
          ![...this.lobbies.values()].some(
            (l) =>
              l.hostSocketId === socket.id ||
              l.players.some((p) => p.socketId === socket.id),
          ),
          "Already in a lobby.",
        );
        requireThat(
          !lobby.players.some((p) => p.playerName === data.playerName.trim()),
          "That name is taken.",
        );
        LobbyLogic.playerJoinLobby(lobby, socket.id, data.playerName.trim());
      } else {
        const isHost = lobby.hostSocketId === socket.id;
        const player = lobby.players.find((p) => p.socketId === socket.id);
        requireThat(isHost || player, "You are not a member of this lobby.");
        if (hostActions[type]) {
          requireThat(isHost, "Only the host can do that.");
          requireThat(
            hostActions[type].includes(lobby.gameState),
            "This action is not available now.",
          );
        }
        if (type === "sync_lobby") return this.response(lobby, socket.id);
        if (type === "leave_lobby") {
          if (isHost) {
            for (const p of lobby.players)
              this.connections
                .get(p.socketId)
                ?.emit("message", error("The host closed this lobby."));
            this.deleteLobby(lobby.lobbyCode);
          } else {
            requireThat(lobby.gameState === "lobby", "Leave after the game.");
            lobby.players = lobby.players.filter(
              (p) => p.socketId !== socket.id,
            );
            this.publish(lobby);
          }
          return { type: "left_lobby" };
        }
        switch (type) {
          case "update_lobby_config":
            lobby.config = this.config(data.lobbyConfig);
            break;
          case "update_teams": {
            requireThat(
              Array.isArray(data.teams) &&
                data.teams.length >= 2 &&
                data.teams.length <= 8,
              "Choose 2–8 teams.",
            );
            const teams: ITeamData[] = data.teams.map((t: any) => {
              requireThat(
                Number.isSafeInteger(t.teamId) &&
                  t.teamId > 0 &&
                  typeof t.teamName === "string" &&
                  t.teamName.trim().length > 0 &&
                  t.teamName.length <= 40,
                "Invalid team.",
              );
              return {
                teamId: t.teamId,
                teamName: t.teamName.trim(),
                teamScore: 0,
                wrongGuesses: 0,
              };
            });
            requireThat(
              new Set(teams.map((t) => t.teamId)).size === teams.length,
              "Duplicate teams.",
            );
            requireThat(
              Array.isArray(data.players) &&
                data.players.length === lobby.players.length,
              "Invalid player roster.",
            );
            const players: IPlayerData[] = lobby.players.map((p) => {
              const matches = data.players.filter(
                (v: any) => v.socketId === p.socketId,
              );
              requireThat(
                matches.length === 1 &&
                  teams.some((t) => t.teamId === matches[0].teamId),
                "Invalid player assignment.",
              );
              return { ...p, teamId: matches[0].teamId };
            });
            lobby.teams = teams;
            lobby.players = players;
            break;
          }
          case "start_game":
            requireThat(
              lobby.teams.filter((t) =>
                lobby.players.some((p) => p.teamId === t.teamId),
              ).length >= 2,
              "At least two teams need players.",
            );
            lobby.teams = lobby.teams.filter((t) =>
              lobby.players.some((p) => p.teamId === t.teamId),
            );
            LobbyLogic.startGame(lobby);
            break;
          case "get_question": {
            const lightning =
              lobby.gameState === "lightning_round_set_question";
            requireThat(
              Boolean(data.isLightningQuestion) === lightning,
              "Invalid question type.",
            );
            return {
              type: "question_check",
              data: { question: this.select(lobby, lightning) },
            };
          }
          case "begin_lightning_round":
            lobby.lightningQuestion = this.confirmed(
              lobby,
              data.question,
              true,
            );
            lobby.gameState = "lightning_round";
            lobby.lightningRoundStarted = false;
            lobby.lightningRoundTeamIndex = undefined;
            lobby.lightningChallenge = {
              mode: (["chase", "moles", "reaction"] as const)[
                Math.floor(Math.random() * 3)
              ],
              seed: Math.floor(Math.random() * 1e9),
              startedAt: 0,
            };
            lobby.teams.forEach((t) => (t.wrongGuesses = 0));
            break;
          case "begin_lightning_buzzer":
            requireThat(!lobby.lightningRoundStarted, "Already started.");
            lobby.lightningRoundStarted = true;
            lobby.lightningChallenge.startedAt = Date.now() + 1500;
            break;
          case "lightning_buzz_in": {
            requireThat(
              player &&
                lobby.gameState === "lightning_round" &&
                lobby.lightningRoundStarted &&
                lobby.lightningRoundTeamIndex === undefined,
              "The buzzer is closed.",
            );
            const challenge = lobby.lightningChallenge;
            const elapsed = Date.now() - challenge.startedAt;
            const step =
              challenge.mode === "reaction"
                ? 0
                : Math.floor(
                    elapsed / (challenge.mode === "moles" ? 1100 : 900),
                  );
            const target = challengeTarget(challenge.seed, step);
            requireThat(
              elapsed >= 0 &&
                (challenge.mode !== "reaction" ||
                  elapsed >= 1800 + (challenge.seed % 2200)),
              "Wait for GO!",
            );
            requireThat(
              data.challenge &&
                Number.isInteger(data.challenge.step) &&
                data.challenge.step === step &&
                data.challenge.target === target,
              "Catch the current target.",
            );
            const teamIndex = lobby.teams.findIndex(
              (t) => t.teamId === player.teamId,
            );
            requireThat(teamIndex >= 0, "Join a team first.");
            lobby.lightningRoundTeamIndex = teamIndex;
            break;
          }
          case "choose_lightning_answer":
            this.lightningAnswer(
              lobby,
              this.answer(lobby.lightningQuestion, data.answerChosen),
            );
            break;
          case "continue_lightning":
            lobby.gameState = "host_set_question";
            break;
          case "advance_round":
            LobbyLogic.startRound(
              lobby,
              this.confirmed(lobby, data.question, false),
            );
            break;
          case "choose_team_answer":
            LobbyLogic.chooseAnswer(
              lobby,
              this.answer(lobby.currentQuestion, data.answerChosen),
            );
            break;
          case "end_round":
            lobby.gameState = "host_set_question";
            break;
          case "end_game":
            lobby.gameState = "game_over";
            break;
          case "return_to_lobby": {
            const code = lobby.lobbyCode;
            clearTimeout(this.timers.get(code));
            this.timers.delete(code);
            this.pending.delete(code);
            // Start from fresh defaults so no round, challenge or answer state
            // survives. Identities and settings come only from the referee.
            lobby = {
              ...LobbyLogic.createLobby(lobby.hostSocketId, lobby.hostName),
              lobbyCode: code,
              revision: lobby.revision,
              config: clone(lobby.config),
              teams: lobby.teams.map(({ teamId, teamName }) => ({
                teamId,
                teamName,
                teamScore: 0,
                wrongGuesses: 0,
              })),
              players: clone(lobby.players),
            };
            this.lobbies.set(code, lobby);
            break;
          }
          default:
            return error("Unknown action.");
        }
      }
      lobby.revision = (lobby.revision || 0) + 1;
      if (
        [
          "choose_team_answer",
          "choose_lightning_answer",
          "advance_round",
          "lightning_buzz_in",
          "continue_lightning",
        ].includes(type)
      )
        this.armTimer(lobby);
      this.publish(lobby);
      return this.response(lobby, socket.id);
    } catch (e) {
      return error(e instanceof Error ? e.message : "Invalid request.");
    }
  }
}
