import React, { createContext, useEffect, useRef, useState } from "react";
import { socket, isRefract } from "../socket";
import usePreviousState from "../hooks/usePreviousState";
import type {
  IAnswerType,
  ILobbyData,
  ILobbyConfig,
  IPlayerData,
  IQuestionType,
  ITeamData,
} from "../../../types";
const savedName = () => {
  try {
    return localStorage.getItem("playerName") || "";
  } catch {
    return "";
  }
};

const DataContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [playerName, setName] = useState(savedName);
  const [lobbyData, setLobbyData, prevLobbyData] =
    usePreviousState<ILobbyData | null>(null);
  const [error, setError] = useState("");
  const [timeOffset, setTimeOffset] = useState(0);
  const [roundSecondsLeft, setRoundSecondsLeft] = useState<number | null>(null);
  const latestLobby = useRef(lobbyData);
  latestLobby.current = lobbyData;
  const isLobbyHost = Boolean(
    lobbyData && lobbyData.hostSocketId === socket.id,
  );
  const teamsData = lobbyData?.teams || [];
  const accept = (response: any) => {
    if (response?.type === "error")
      throw new Error(
        response.message || "That action could not be completed.",
      );
    if (response?.data?.lobby) setLobbyData(response.data.lobby);
    return response;
  };
  async function request(type: string, data: Record<string, unknown> = {}) {
    setError("");
    return accept(
      await socket
        .timeout(10000)
        .emitWithAck("message", {
          type,
          data: { lobbyCode: latestLobby.current?.lobbyCode, ...data },
        }),
    );
  }
  const action = async (type: string, data: Record<string, unknown> = {}) => {
    try {
      await request(type, data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Connection failed. Please try again.",
      );
    }
  };
  useEffect(() => {
    const connect = () => {
      setSocketConnected(true);
      const start = Date.now();
      socket
        .timeout(5000)
        .emitWithAck("message", { type: "ping" })
        .then((r) => setTimeOffset(r.data.time - (start + Date.now()) / 2))
        .catch(() => {});
      if (latestLobby.current && !isRefract)
        request("sync_lobby").catch((e) => {
          setError(`${e.message} Please rejoin the game.`);
          setLobbyData(null);
        });
    };
    const disconnect = () => setSocketConnected(false);
    const reset = (name: string) => {
      setLobbyData(null);
      setName(name);
      setError("");
    };
    const message = (response: any) => {
      try {
        accept(response);
      } catch (e) {
        setError(e.message);
      }
    };
    const failure = (e: Error) => setError(e.message || "Could not connect.");
    socket.on("connect", connect);
    socket.on("disconnect", disconnect);
    socket.on("message", message);
    socket.on("reset", reset);
    socket.on("error", failure);
    socket.on("connect_error", failure);
    if (socket.connected) connect();
    return () => {
      socket.off("connect", connect);
      socket.off("disconnect", disconnect);
      socket.off("message", message);
      socket.off("reset", reset);
      socket.off("error", failure);
      socket.off("connect_error", failure);
    };
  }, []);
  useEffect(() => {
    const active =
      lobbyData?.gameState === "round" ||
      (lobbyData?.gameState === "lightning_round" &&
        lobbyData.lightningRoundTeamIndex !== undefined);
    if (!active || !lobbyData?.timerStart || !lobbyData.config.timerSeconds) {
      setRoundSecondsLeft(null);
      return;
    }
    const tick = () =>
      setRoundSecondsLeft(
        Math.max(
          0,
          lobbyData.timerStart +
            lobbyData.config.timerSeconds * 1000 -
            Date.now() -
            timeOffset,
        ),
      );
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [
    lobbyData?.gameState,
    lobbyData?.timerStart,
    lobbyData?.config.timerSeconds,
    lobbyData?.lightningRoundTeamIndex,
    timeOffset,
  ]);

  const setPlayerName = async (name: string) => {
    setName(name);
    try {
      localStorage.setItem("playerName", name);
    } catch {}
  };
  const updatePlayerTeam = async (
    player: IPlayerData,
    team: number | string,
  ) => {
    let teams = teamsData;
    let teamId = Number(team);
    if (team === "new_team") {
      teamId = Math.max(...teams.map((t) => t.teamId)) + 1;
      teams = [...teams, { teamId, teamName: `Team ${teamId}`, teamScore: 0 }];
    }
    await action("update_teams", {
      teams,
      players: lobbyData.players.map((p) =>
        p.socketId === player.socketId ? { ...p, teamId } : p,
      ),
    });
  };
  const hostGetQuestion = async (
    isLightningQuestion = false,
  ): Promise<IQuestionType> => {
    try {
      return (await request("get_question", { isLightningQuestion })).data
        .question;
    } catch (e) {
      setError(e.message);
      return undefined;
    }
  };
  const hostUpdateLobbyConfig = async (
    lobbyConfig: ILobbyConfig,
  ): Promise<ILobbyData> => {
    try {
      return (await request("update_lobby_config", { lobbyConfig })).data.lobby;
    } catch (e) {
      setError(e.message);
      return undefined;
    }
  };
  return (
    <DataContext.Provider
      value={{
        socketConnected,
        playerName,
        lobbyData,
        prevLobbyData,
        isLobbyHost,
        teamsData,
        error,
        roundSecondsLeft,
        isInLobby: Boolean(lobbyData),
        isInGame: Boolean(lobbyData && lobbyData.gameState !== "lobby"),
        setPlayerName,
        createNewLobby: () => action("create_lobby", { playerName }),
        joinGameLobby: (lobbyCode: string) =>
          action("join_lobby", { lobbyCode: lobbyCode.trim(), playerName }),
        hostUpdateLobbyConfig,
        hostGetQuestion,
        updatePlayerTeam,
        startGame: () => action("start_game"),
        hostEndRound: () => action("end_round"),
        continueLightning: () => action("continue_lightning"),
        advanceRound: (question: IQuestionType) =>
          action("advance_round", { question }),
        beginLightningRound: (question: IQuestionType) =>
          action("begin_lightning_round", { question }),
        startTheLightningBuzzer: () => action("begin_lightning_buzzer"),
        teamBuzzIn: (challenge?: { step: number; target: number }) =>
          action("lightning_buzz_in", { challenge }),
        hostEndGame: () => action("end_game"),
        answerQuestion: (answerChosen: IAnswerType | false) =>
          action("choose_team_answer", { answerChosen }),
        answerLightningQuestion: (answerChosen: IAnswerType | false) =>
          action("choose_lightning_answer", { answerChosen }),
      }}
    >
      {error && (
        <div className="gameError" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      {children}
    </DataContext.Provider>
  );
};
type ContextValue = {
  socketConnected: boolean;
  playerName: string;
  lobbyData: ILobbyData;
  prevLobbyData: ILobbyData;
  isLobbyHost: boolean;
  teamsData: ITeamData[];
  error: string;
  roundSecondsLeft: number | null;
  isInLobby: boolean;
  isInGame: boolean;
  setPlayerName: (name: string) => Promise<void>;
  createNewLobby: () => Promise<void>;
  joinGameLobby: (code: string) => Promise<void>;
  hostUpdateLobbyConfig: (config: ILobbyConfig) => Promise<ILobbyData>;
  hostGetQuestion: (lightning?: boolean) => Promise<IQuestionType>;
  updatePlayerTeam: (
    player: IPlayerData,
    team: number | string,
  ) => Promise<void>;
  startGame: () => Promise<void>;
  hostEndRound: () => Promise<void>;
  continueLightning: () => Promise<void>;
  advanceRound: (question: IQuestionType) => Promise<void>;
  beginLightningRound: (question: IQuestionType) => Promise<void>;
  startTheLightningBuzzer: () => Promise<void>;
  teamBuzzIn: (challenge?: { step: number; target: number }) => Promise<void>;
  hostEndGame: () => Promise<void>;
  answerQuestion: (answer: IAnswerType | false) => Promise<void>;
  answerLightningQuestion: (answer: IAnswerType | false) => Promise<void>;
};
const DataContext = createContext<ContextValue>(null);
export { DataContext, DataContextProvider };
