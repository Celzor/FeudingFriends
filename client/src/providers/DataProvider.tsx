import React, { createContext, useEffect, useState } from "react";

import { socket } from "../socket";
import usePreviousState from "../hooks/usePreviousState";

import {
  IAnswerType,
  ILobbyData,
  ILobbyConfig,
  IPlayerData,
  IQuestionType,
  ITeamData,
} from "../../../types";

const DataContext = createContext<IDataProviderContext>(null);

type ISocketResponse = {
  type: string;
  message: string;
  data?: any;
};

// game state provider
const DataContextProvider = ({ children }) => {
  // socket state
  const [socketConnected, _setSocketConnected] = useState(false);
  useEffect(() => {
    function onConnect() {
      _setSocketConnected(true);
    }

    function onDisconnect() {
      _setSocketConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  ///// ------------------------------- the state is this

  // trry to load from localstorage
  let name = "";
  if (localStorage.playerName) name = localStorage.playerName;

  // user state
  const [playerName, _setPlayerName] = useState(name);
  const setPlayerName = async (name: string) => {
    localStorage.setItem("playerName", name);

    _setPlayerName(name);
  };

  // lobby state
  const [isInLobby, _setIsInLobby] = useState(false);
  const [isLobbyHost, _setIsLobbyHost] = useState(false);
  const [lobbyData, _setLobbyData, prevLobbyData] = usePreviousState(null);
  // const [prevLobbyData, _setPrevLobbyData] = useState<ILobbyData | null>(null);

  // TEAMS DATA
  const [teamsData, _setTeamsData] = useState<ITeamData[]>([]);

  // current round
  // const [currentRound, _setCurrentRound] = useState<number>(null);

  // current team playing
  // const [currentTeam, _setCurrentTeam] = useState<number>(null);

  // in game
  const [isInGame, _setIsInGame] = useState(false);
  // const [currentQuestion, _setCurrentQuestion] = useState<IQuestionType>(null);

  ///// -------------------------------

  const [timeOffset, _setTimeOffset] = useState<number | false>(false);

  // once the socket is connected, sync time
  useEffect(() => {
    function calcOffset(serverTime: number) {
      const localTime = Date.now();
      const offset = serverTime - localTime;
      console.log("time offset", offset, "ms");
      _setTimeOffset(offset);
    }

    if (socketConnected && !timeOffset) {
      sendSocketWait("ping", null).then((response) => {
        calcOffset(response.data.time);
      });
    }
  }, [socketConnected]);

  // tick every 500ms
  const [com, setCom] = useState(0);
  useEffect(() => {
    const comInterval = setInterval(() => {
      if (roundSecondsLeft > 0) {
        console.log("com", Date.now());
        setCom(Date.now());
      }
    }, 10);
    return () => clearInterval(comInterval);
  }, []);

  const [roundSecondsLeft, setRoundSecondsLeft] = useState(null);

  useEffect(() => {
    if (!lobbyData) return;

    // if we are in a round
    if (lobbyData.gameState !== "round") {
      return;
    }

    if (lobbyData.config.timerSeconds === 0) {
      return;
    }

    if (lobbyData.timerStart && lobbyData.timerStart === 0) {
      return;
    }

    const timeLeft =
      lobbyData.timerStart +
      lobbyData.config.timerSeconds * 1000 -
      new Date().getTime();

    if (timeLeft < 0 && roundSecondsLeft !== 0) {
      setRoundSecondsLeft(0);

      // if they are the host, mark questions wrong
      if (isLobbyHost) {
        // answerQuestion(false);
        triggerTimerFailure();
      }

      return;
    }

    setRoundSecondsLeft(timeLeft);
    return;
  }, [com, lobbyData]);

  // listen for incoming messages
  useEffect(() => {
    function onMessage(value) {
      console.log("onMessage", value);

      switch (value.type) {
        case "time_update":
          // console.log("time_update", value.data);
          break;

        // these are meant for game state updates
        case "lobby_update":
          onLobbyPlayersUpdate(value.data.lobby);
          break;

        // // this is a for client animations and audio etc (syncc)
        // case "client_action":
        //   // console.error("client_action", value.data);
        //   onClientAction(value.data);
        //   break;

        default:
          console.error("UNHANDLED onMessage", value);
      }
    }

    socket.on("message", onMessage);

    return () => {
      socket.off("message", onMessage);
    };
  }, []);

  /*  const onClientAction = (data: any) => {
    console.error("onClientAction", data);
  };
 */
  const onLobbyPlayersUpdate = (lobby) => {
    console.log("onLobbyPlayersUpdate", lobby);

    // _setPrevLobbyData(lobbyData);

    _setLobbyData(lobby);

    //const newPlayers = lobby.players;

    // add the player to the player list
    //const newPlayers = [...lobbyPlayers, newPlayers];

    // update the player list
    // _setLobbyPlayers(lobby.players);
    _setTeamsData(lobby.teams);
  };

  ///// ------------------------------- functions

  // wrapper for sending and waiting
  const sendSocketWait = async (
    type: string,
    data: any = null
  ): Promise<ISocketResponse> => {
    const responseData: ISocketResponse = await socket
      .timeout(5000)
      .emitWithAck("message", {
        type: type,
        data,
      });

    if (responseData.type === "error") {
      throw new Error(responseData.message);
    }

    return responseData;
  };

  const createNewLobby = async () => {
    try {
      const responseData: ISocketResponse = await sendSocketWait(
        "create_lobby",
        {
          playerName,
        }
      );
      _setIsLobbyHost(true);
      _setIsInLobby(true);

      const lobby: ILobbyData = responseData.data.lobby;

      // _setPrevLobbyData(lobby);
      _setLobbyData(lobby);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
      console.error("createNewLobby error", err);
      alert("Error creating lobby");
    }
  };

  // attempt to find game lobby and join it
  const MOCK_fakeJoinLobby = async (lobbyCode: string) => {
    try {
      const response: ISocketResponse = await sendSocketWait("join_lobby", {
        playerName: lobbyData.hostName + Math.random(),
        lobbyCode,
        fakeUser: true,
      });
      // _setIsLobbyHost(false);
      // _setIsInLobby(true);

      const responseLobby: ILobbyData = response.data.lobby;
      // console.log("joinGameLobby response", responseLobby);

      _setLobbyData(responseLobby);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
      console.error("joinGameLobby error", err);
      alert("Error joining lobby");
    }
  };

  // attempt to find game lobby and join it
  const joinGameLobby = async (lobbyCode: string) => {
    try {
      const response: ISocketResponse = await sendSocketWait("join_lobby", {
        playerName,
        lobbyCode,
      });
      _setIsLobbyHost(false);
      _setIsInLobby(true);

      const responseLobby: ILobbyData = response.data.lobby;
      console.log("joinGameLobby response", responseLobby);

      _setLobbyData(responseLobby);
    } catch (err) {
      // the server did not acknowledge the event in the given delay

      console.error("joinGameLobby error", err);
      alert("Error joining lobby");
    }
  };

  const hostGetQuestion = async (isLightningQuestion?: boolean) => {
    try {
      const response: ISocketResponse = await sendSocketWait("get_question", {
        lobbyCode: lobbyData.lobbyCode,
        isLightningQuestion,
      });

      const responseQuestion: IQuestionType = response.data.question;
      console.log("hostGetQuestion response", responseQuestion);
      // _setConfirmQuestion(responseQuestion);
      return responseQuestion;
    } catch (err) {
      // the server did not acknowledge the event in the given delay
      console.error("hostGetQuestion error", err);
      alert("Error getting question");
    }
  };

  const startGame = async () => {
    try {
      const response: ISocketResponse = await sendSocketWait("start_game", {
        lobbyCode: lobbyData.lobbyCode,
      });

      const resp: ILobbyData = response.data.lobby;
      _setLobbyData(resp);

      console.log("Starting game...", response);

      // advance to the first round

      // _setCurrentRound(0);
      // _setCurrentTeam(0);

      // _setCurrentQuestion(response.data.question);

      // advanceRound();

      _setIsInGame(true);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
      console.error("startGame error", err);
      alert("Error starting game");
    }
  };

  const triggerTimerFailure = async () => {
    try {
      const response: ISocketResponse = await sendSocketWait(
        "time_out_round_steal_trigger_end_whole_existance",
        {
          lobbyCode: lobbyData.lobbyCode,
        }
      );

      const resp: ILobbyData = response.data.lobby;
      _setLobbyData(resp);

      console.log("triggerTimerFailure", response);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
      console.error("triggerTimerFailure error", err);
      alert("Error triggerTimerFailure game");
    }
  };

  const startTheLightningBuzzer = async () => {
    try {
      const response: ISocketResponse = await sendSocketWait(
        "begin_lightning_buzzer",
        {
          lobbyCode: lobbyData.lobbyCode,
        }
      );

      const resp: ILobbyData = response.data.lobby;
      _setLobbyData(resp);

      console.log("Starting startTheLightningBuzzer...", response);

      _setIsInGame(true);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
      console.error("startTheLightningBuzzer error", err);
      alert("Error starting game");
    }
  };

  const hostEndRound = async () => {
    try {
      const response: ISocketResponse = await sendSocketWait("end_round", {
        lobbyCode: lobbyData.lobbyCode,
      });

      const resp: ILobbyData = response.data.lobby;

      _setLobbyData(resp);

      console.log("hostEndRound game...", response);

      // advance to the first round

      // _setCurrentRound(0);
      // _setCurrentTeam(0);

      // _setCurrentQuestion(response.data.question);

      // advanceRound();

      // _setIsInGame(true);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
      console.error("hostEndRound error", err);
      alert("Error ending round");
    }
  };

  // called to move on to the next round
  const teamBuzzIn = async () => {
    try {
      const response: ISocketResponse = await sendSocketWait(
        "lightning_buzz_in",
        {
          lobbyCode: lobbyData.lobbyCode,
        }
      );

      const resp: ILobbyData = response.data.lobby;

      console.log("teamBuzzIn", response);

      _setLobbyData(resp);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
      console.error("teamBuzzIn error", err);
      alert("Error advancing round");
    }
  };

  // called to move on to the next round
  const advanceRound = async (question: IQuestionType) => {
    try {
      const response: ISocketResponse = await sendSocketWait("advance_round", {
        lobbyCode: lobbyData.lobbyCode,
        question,
      });

      const resp: ILobbyData = response.data.lobby;

      console.log("advanceRound", response);

      _setLobbyData(resp);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
      console.error("advanceRound error", err);
      alert("Error advancing round");
    }
  };

  // start ligtning round
  const beginLightningRound = async (question: IQuestionType) => {
    try {
      const response: ISocketResponse = await sendSocketWait(
        "begin_lightning_round",
        {
          lobbyCode: lobbyData.lobbyCode,
          question,
        }
      );

      const resp: ILobbyData = response.data.lobby;

      console.log("beginLightningRound", response);

      _setLobbyData(resp);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
      console.error("beginLightningRound error", err);
      alert("Error advancing round");
    }
  };

  const answerLightningQuestion = async (answerChosen: IAnswerType | false) => {
    try {
      const response: ISocketResponse = await sendSocketWait(
        "choose_lightning_answer",
        {
          lobbyCode: lobbyData.lobbyCode,
          answerChosen,
        }
      );

      const responseLobby: ILobbyData = response.data.lobby;
      console.log("choose_lightning_answer responseLobby", responseLobby);

      _setLobbyData(responseLobby);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
    }
  };

  // from client to server
  // when the host asks to finish the game (after the final round_end screen)
  const hostEndGame = async () => {
    try {
      const response: ISocketResponse = await sendSocketWait("end_game", {
        lobbyCode: lobbyData.lobbyCode,
      });

      const responseLobby: ILobbyData = response.data.lobby;
      console.log("end_game responseLobby", responseLobby);

      _setLobbyData(responseLobby);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
    }
  };

  // choose which answer was chosen
  const answerQuestion = async (answerChosen: IAnswerType | false) => {
    try {
      const response: ISocketResponse = await sendSocketWait(
        "choose_team_answer",
        {
          lobbyCode: lobbyData.lobbyCode,
          answerChosen,
        }
      );

      const responseLobby: ILobbyData = response.data.lobby;
      console.log("answerQuestion responseLobby", responseLobby);

      _setLobbyData(responseLobby);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
    }
  };

  const updatePlayerTeam = async (
    player: IPlayerData,
    team: number | string
  ) => {
    try {
      let teamId = team;
      let teamsDataCopy: ITeamData[] = teamsData;

      if (team === "new_team") {
        const newTeam: ITeamData = {
          teamId: teamsData.length + 1,
          teamName: `Team ${teamsData.length + 1}`,
          teamScore: 0,
        };
        teamsDataCopy = [...teamsData, newTeam];
        _setTeamsData(teamsDataCopy);

        teamId = newTeam.teamId;
      }

      // update player teams
      const newPlayers: IPlayerData[] = lobbyData.players.map(
        (p: IPlayerData) => {
          if (p.socketId === player.socketId) {
            console.log("updating player team", p, teamId);
            return { ...p, teamId: Number(teamId) };
          }
          return p;
        }
      );
      _setLobbyData({ ...lobbyData, players: newPlayers });

      const response: ISocketResponse = await sendSocketWait("update_teams", {
        lobbyCode: lobbyData.lobbyCode,
        teams: teamsDataCopy,
        players: newPlayers,
      });

      const responseLobby: ILobbyData = response.data.lobby;

      console.log("Acccck", responseLobby);

      _setLobbyData(responseLobby);

      // _setHostName(resp.hostName);
      // _setLobbyCode(resp.lobbyCode);
      // _setIsLobbyHost(false);
      // _setIsInLobby(true);
    } catch (err) {
      // the server did not acknowledge the event in the given delay
    }
  };

  const hostUpdateLobbyConfig = async (lobbyConfig: ILobbyConfig) => {
    try {
      const response: ISocketResponse = await sendSocketWait(
        "update_lobby_config",
        {
          lobbyCode: lobbyData.lobbyCode,
          lobbyConfig,
        }
      );

      const resp: ILobbyData = response.data.lobby;

      console.log("update_lobby_config", response);

      _setLobbyData(resp);

      return resp;
    } catch (err) {
      // the server did not acknowledge the event in the given delay
    }
  };

  return (
    <DataContext.Provider
      value={{
        socketConnected,

        isInLobby,
        isLobbyHost,
        lobbyData,
        prevLobbyData,

        roundSecondsLeft,

        // lobbyCode,
        // lobbyPlayers,

        teamsData,
        // hostConfirmQuestion,
        // hostName,

        playerName,

        isInGame,

        // currentQuestion,
        // currentRound,
        // currentTeam,

        // gameState,

        // lobby functions
        createNewLobby,
        hostUpdateLobbyConfig,
        hostGetQuestion,

        MOCK_fakeJoinLobby,
        joinGameLobby,
        setPlayerName,
        updatePlayerTeam,

        // host functions
        startGame,
        hostEndRound,
        advanceRound,
        beginLightningRound,
        startTheLightningBuzzer,
        teamBuzzIn,

        hostEndGame,

        answerQuestion,
        answerLightningQuestion,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

//extract the type
type IDataProviderContext = {
  socketConnected: boolean;

  isInLobby: boolean;
  isLobbyHost: boolean;
  lobbyData: ILobbyData;
  prevLobbyData: ILobbyData;

  teamsData: ITeamData[];
  // hostConfirmQuestion: IQuestionType | false;
  playerName: string;

  isInGame: boolean;

  roundSecondsLeft?: number;

  // currentQuestion: IQuestionType;
  // currentRound: number;
  // currentTeam: number;

  createNewLobby: () => Promise<void>;
  hostUpdateLobbyConfig: (lobbyConfig: ILobbyConfig) => Promise<ILobbyData>;
  hostGetQuestion: (isLightningQuestion?: boolean) => Promise<IQuestionType>;

  joinGameLobby: (lobbyCode: string) => Promise<void>;
  setPlayerName: (name: string) => Promise<void>;
  updatePlayerTeam: (
    player: IPlayerData,
    team: number | string
  ) => Promise<void>;

  startGame: () => Promise<void>;
  hostEndRound: () => Promise<void>;
  advanceRound: (question: IQuestionType) => Promise<void>;
  beginLightningRound: (question: IQuestionType) => Promise<void>;
  startTheLightningBuzzer: () => Promise<void>;
  teamBuzzIn: () => Promise<void>;

  hostEndGame: () => Promise<void>;

  answerQuestion: (answer: IAnswerType | false) => Promise<void>;
  answerLightningQuestion: (answer: IAnswerType | false) => Promise<void>;

  MOCK_fakeJoinLobby: (lobbyCode: string) => Promise<void>;
};

export { DataContext, DataContextProvider };
