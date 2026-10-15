import { Socket } from "socket.io";

import {
  ITeamData,
  IPlayerData,
  IMessage,
  ILobbyData,
  IQuestionType,
  IAnswerType,
} from "../../../types";

import LobbyLogic from "./LobbyLogic";

import { LobbyUpdate, ErrorMessage } from "./Messages";

export default class GameNetcode {
  private connections: Socket[] = [];
  private lobbies: { [key: string]: ILobbyData } = {};

  private questions: { [key: number]: IQuestionType[] };

  constructor(questions: { [key: number]: IQuestionType[] }) {
    this.connections = [];
    this.lobbies = {};

    // object with keys with the amount of answers
    this.questions = questions;
  }

  // get a random question from the question pools selected
  private selectQuestionFromPools(questionPools: number[]) {
    // get a random question from the pool (there are 3,4,5,6, and 7-length questions)
    // the input array is a list of the pools to get questions from

    // get a random question length from the list
    const questionLength: number =
      questionPools[Math.floor(Math.random() * questionPools.length)];

    // get the question pool
    const questionPool = this.questions[String(questionLength)];

    // get a random question
    const questionIndex = Math.floor(Math.random() * questionPool.length);
    // console.log("questionIndex", questionPool[questionIndex]);

    return questionPool[questionIndex];
  }

  //// ---------
  //// connection handlers

  public async addConnection(socket: Socket) {
    console.log(`[${socket.id}] connected`);
    this.connections[socket.id] = socket;
  }

  public async removeConnection(socket: Socket) {
    console.log(`[${socket.id}] disconnected`);
    delete this.connections[socket.id];
  }

  //// ---------
  //// sending messages

  // send to everyone in the lobby
  public async sendToLobby(lobbyId: string, data: any) {
    const lobby: ILobbyData = this._getLobby(lobbyId);

    if (!lobby) {
      console.error("sendToLobby: lobby not found", lobbyId);
      return;
    }

    await this.sendToHost(lobbyId, data);
    await this.sendToPlayers(lobbyId, data);
  }

  // send to (just) the host of a lobby
  public async sendToHost(lobbyId: string, data: any) {
    const lobby: ILobbyData = this._getLobby(lobbyId);
    if (
      lobby.hostSocketId.indexOf("false") === -1 &&
      this.connections[lobby.hostSocketId]
    )
      this.connections[lobby.hostSocketId].emit("message", data);
  }

  // send to all players (not the host) in a lobby
  public async sendToPlayers(lobbyId: string, data: any) {
    const lobby: ILobbyData = this._getLobby(lobbyId);
    if (!lobby) {
      console.error("sendToPlayers: lobby not found", lobbyId);
      return;
    }

    for (const player of lobby.players) {
      if (
        player.socketId.indexOf("false") === -1 &&
        this.connections[player.socketId]
      )
        this.connections[player.socketId].emit("message", data);
    }
  }

  //// ---------
  //// message handlers

  public async onMessage(socket: Socket, message: any) {
    console.debug("onMessage", message);
    switch (message.type) {
      case "ping":
        return {
          type: "pong",
          data: { time: Date.now() },
        };

      // host creates new lobby
      case "create_lobby":
        return this.hostCreateLobby(socket.id, message.data.playerName);

      // host sets lobby configuration
      case "update_lobby_config":
        return this.hostUpdateLobbyConfig(
          socket.id,
          message.data.lobbyCode,
          message.data.lobbyConfig
        );

      // player joins lobby
      case "join_lobby":
        // MOCK ADD FAKE USER
        if (message.data.fakeUser) {
          return this.playerJoinLobby(
            "false" + socket.id + String(Math.random()),
            message.data.playerName,
            message.data.lobbyCode
          );
        }

        return this.playerJoinLobby(
          socket.id,
          message.data.playerName,
          message.data.lobbyCode
        );

      // player leaves lobby
      case "leave_lobby":
        return this.playerLeaveLobby(socket.id, message.data.lobbyCode);

      // host updates teams
      case "update_teams":
        return this.hostUpdateTeams(
          message.data.lobbyCode,
          message.data.teams,
          message.data.players
        );

      // host starts the game (after teams are set, etc)
      case "start_game":
        return this.hostStartGame(
          message.data.lobbyCode
          // message.data.question
        );

      // host gets a question
      case "get_question":
        return this.hostGetQuestion(
          message.data.lobbyCode,
          message.data.isLightningQuestion
        );

      // host gets a question
      case "end_round":
        return this.hostEndRound(message.data.lobbyCode);

      // host starts the round
      case "begin_lightning_round":
        return this.hostBeginLightningRound(
          message.data.lobbyCode,
          message.data.question
        );

      // host starts the round
      case "begin_lightning_buzzer":
        return this.hostBeginLightningBuzzer(message.data.lobbyCode);

      // host starts the round
      case "lightning_buzz_in":
        return this.teamBuzzIn(message.data.lobbyCode, socket.id);

      // host starts the round
      case "end_game":
        return this.hostEndGame(message.data.lobbyCode, socket.id);

      // host says when the time runs out
      case "time_out_round_steal_trigger_end_whole_existance":
        return this.markRoundFailure(message.data.lobbyCode);

      // host starts the round
      case "advance_round":
        return this.hostStartRound(
          message.data.lobbyCode,
          message.data.question
        );

      // team answers a question
      case "choose_lightning_answer":
        return this.hostChooseLightningAnswer(
          message.data.lobbyCode,
          message.data.answerChosen,
          message.data.lobbyData
        );

      // team answers a question
      case "choose_team_answer":
        return this.hostChooseTeamAnswer(
          message.data.lobbyCode,
          message.data.answerChosen
        );

      default:
        console.error("unknown message type", message.type);
        return {
          type: "error",
          message: "unknown message type",
        };
    }
  }

  //// ---------
  //// lobby helpers

  private _getLobby(lobbyCode: string) {
    if (!this.lobbies[lobbyCode]) {
      throw new Error("lobby not found");
    }

    return this.lobbies[lobbyCode];
  }

  // return the whole lobby, but remove the text from the answers arrays
  private _redactUnselectedAnswers(lobby: ILobbyData) {
    const redactedLobby = JSON.parse(JSON.stringify(lobby));

    // // currentQuestion
    if (redactedLobby.currentQuestion) {
      for (const answer of redactedLobby.currentQuestion.answers) {
        if (!answer.answerSelected) answer.answerText = "";
      }
    }

    if (redactedLobby.lightningQuestion) {
      for (const answer of redactedLobby.lightningQuestion.answers) {
        if (!answer.answerSelected) answer.answerText = "";
      }
    }

    return redactedLobby;
  }

  ///// ---------
  ///// lobby handlers

  private async hostCreateLobby(
    socketId: string,
    playerName: string
  ): Promise<IMessage> {
    try {
      const newLobby = LobbyLogic.createLobby(socketId, playerName);
      this.lobbies[newLobby.lobbyCode] = newLobby;

      // send reply to message
      return LobbyUpdate(newLobby);
    } catch (e) {
      console.error("hostCreateLobby", e);
      return ErrorMessage("error creating lobby");
    }
  }

  private async playerJoinLobby(
    socketId: string,
    playerName: string,
    lobbyCode: string
  ) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      if (!playerName || playerName.length < 1) {
        throw new Error("player name is too short");
      }

      // socket name check
      if (lobby.players.find((p) => p.socketId === socketId)) {
        throw new Error("socketId already in lobby");
      }

      if (lobby.players.find((p) => p.playerName === playerName)) {
        throw new Error("playerName already in lobby");
      }

      console.log("join_lobby", playerName, lobbyCode, lobby);
      const newLobby = LobbyLogic.playerJoinLobby(lobby, socketId, playerName);
      this.lobbies[lobbyCode] = newLobby;
      console.log("lobby_joined", lobby);

      // notify other players and host
      await this.sendToLobby(lobbyCode, LobbyUpdate(newLobby));
      return LobbyUpdate(newLobby);
    } catch (e) {
      console.error("playerJoinLobby", e);
      return ErrorMessage("error joining lobby");
    }
  }

  private async playerLeaveLobby(socketId: string, lobbyCode: string) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      // remove the player from the lobby
      const playerIndex = lobby.players.findIndex(
        (p) => p.socketId === socketId
      );

      if (playerIndex >= 0) {
        lobby.players.splice(playerIndex, 1);
      }

      // notify other players and host
      this.sendToLobby(lobbyCode, LobbyUpdate(lobby));

      // send a message to the player
      return LobbyUpdate(lobby);
    } catch (e) {
      console.error("playerLeaveLobby", e);
      return ErrorMessage("error leaving lobby");
    }
  }

  private async hostUpdateLobbyConfig(
    socketId: string,
    lobbyCode: string,
    lobbyConfig: any
  ) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      console.log("hostUpdateLobbyConfig", lobbyCode, lobbyConfig);

      // update the lobby
      lobby.config = lobbyConfig;

      console.log("hostUpdateLobbyConfig", lobbyCode, lobby);

      // send to all pllayers
      await this.sendToPlayers(lobbyCode, LobbyUpdate(lobby));

      // send a message to the host
      return LobbyUpdate(lobby);
    } catch (e) {
      console.error("hostUpdateLobbyConfig", e);
      return ErrorMessage("error updating lobby config");
    }
  }

  private async hostUpdateTeams(
    lobbyCode: string,
    teams: ITeamData[],
    players: IPlayerData[]
  ) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);
      if (!lobby) {
        console.error("hostUpdateTeams: lobby not found", lobbyCode);
        return;
      }

      console.log("hostUpdateTeams", lobbyCode, teams, players);

      // update the lobby
      lobby.teams = teams;
      lobby.players = players;

      console.log("hostUpdateTeams", lobbyCode, lobby);

      // send to all pllayers
      await this.sendToPlayers(lobbyCode, LobbyUpdate(lobby));
      return LobbyUpdate(lobby);
    } catch (e) {
      console.error("hostUpdateTeams", e);
      return ErrorMessage("error updating teams");
    }
  }

  private async hostGetQuestion(
    lobbyCode: string,
    isLightningQuestion: boolean = false
  ) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      if (isLightningQuestion) {
        // send a message to the host
        const lightningQuestion = this.selectQuestionFromPools([1, 2]);
        return {
          type: "question_check",
          data: { question: lightningQuestion },
        };
      }

      // get a question
      const question = this.selectQuestionFromPools(lobby.config.questionPools);
      console.log("questionIndex", question);

      // send a message to the host
      return {
        type: "question_check",
        data: { question },
      };
    } catch (e) {
      console.error("hostGetQuestion", e);
      return ErrorMessage("error getting question");
    }
  }

  // start game advances all players to the "waiting for first question" screen
  // the hsot chooses the first question
  private async hostStartGame(lobbyCode: string) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      console.log("hostStartGame", lobbyCode, lobby);

      const newLobby = LobbyLogic.startGame(lobby);
      this.lobbies[lobbyCode] = newLobby;

      // send to all players
      await this.sendToPlayers(lobbyCode, LobbyUpdate(newLobby));
      return LobbyUpdate(newLobby);
    } catch (e) {
      console.error("hostGetQuestion", e);
      return ErrorMessage("error getting question");
    }
  }

  // start game advances all players to the "waiting for first question" screen
  // the hsot chooses the first question
  private async hostEndRound(lobbyCode: string) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      console.log("hostEndRound", lobbyCode, lobby);

      lobby.gameState = "host_set_question";

      // send to all players
      await this.sendToPlayers(lobbyCode, LobbyUpdate(lobby));
      return LobbyUpdate(lobby);
    } catch (e) {
      console.error("hostGetQuestion", e);
      return ErrorMessage("error getting question");
    }
  }

  private async hostBeginLightningBuzzer(lobbyCode: string) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      // if lobby is in "round"
      if (lobby.gameState !== "lightning_round") {
        console.error(
          "hostStartRound: lobby not in lightning_round",
          lobbyCode
        );
        return;
      }

      // start the round
      console.log("hostBeginLightningRound", lobbyCode);
      // const newLobby = LobbyLogic.startRound(lobby, question);

      const newLobby = lobby;

      newLobby.lightningRoundStarted = true;

      this.lobbies[lobbyCode] = newLobby;

      // send to all players
      await this.sendToPlayers(lobbyCode, {
        type: "lobby_update",
        data: { lobby: this._redactUnselectedAnswers(newLobby) },
      });

      // send a message to the host
      return {
        type: "lobby_update",
        data: { lobby: newLobby },
      };
    } catch (e) {
      console.error("hostGetQuestion", e);
      return ErrorMessage("error getting question");
    }
  }

  private async teamBuzzIn(lobbyCode: string, socketId: string) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      // start the round
      console.log("hostBeginLightningRound", lobbyCode);
      // const newLobby = LobbyLogic.startRound(lobby, question);

      const newLobby = lobby;

      // if lobby is in "round"
      if (
        lobby.gameState !== "lightning_round" ||
        !lobby.lightningRoundStarted
      ) {
        console.error(
          "hostStartRound: lobby not in lightning_round",
          lobbyCode
        );
        return;
      }

      // figure out which team this socketId belongs to
      const player = lobby.players.find((p) => p.socketId === socketId);
      if (!player) {
        console.error("teamBuzzIn: player not found", socketId);
        return;
      }

      const teamIndex = lobby.teams.findIndex(
        (t) => t.teamId === player.teamId
      );
      if (teamIndex < 0) {
        console.error("teamBuzzIn: team not found", player.teamId);
        return;
      }

      newLobby.lightningRoundTeamIndex = teamIndex;

      this.lobbies[lobbyCode] = newLobby;

      // send to all players
      await this.sendToPlayers(lobbyCode, {
        type: "lobby_update",
        data: { lobby: this._redactUnselectedAnswers(newLobby) },
      });

      await this.sendToHost(lobbyCode, {
        type: "lobby_update",
        data: { lobby: newLobby },
      });

      // send a message to the host
      return {
        type: "lobby_update",
        data: { lobby: newLobby },
      };
    } catch (e) {
      console.error("hostGetQuestion", e);
      return ErrorMessage("error getting question");
    }
  }

  // hostEndGame - called on th9e final round, when the host needs to switch the state to "game_end"
  private async hostEndGame(lobbyCode: string, socketId: string) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      // if the socketId is not the host, ignore
      if (lobby.hostSocketId !== socketId) {
        console.error("hostEndGame: not the host", lobbyCode, socketId);
        return;
      }

      console.log("hostEndGame", lobbyCode);

      // set the game state
      lobby.gameState = "game_over";

      // send to all players
      await this.sendToPlayers(lobbyCode, {
        type: "lobby_update",
        data: { lobby: this._redactUnselectedAnswers(lobby) },
      });

      // send a message to the host
      return {
        type: "lobby_update",
        data: { lobby },
      };
    } catch (e) {
      console.error("hostEndGame", e);
      return ErrorMessage("error getting question");
    }
  }

  private async markRoundFailure(lobbyCode: string) {
    // if in a round, we're gonna check if it's the main team, if it is, they lose all lives, and it goes to stealing team, and time gets reset
    // if we are stealing, the round ends

    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      // if lobby is in "round"
      if (lobby.gameState !== "round") {
        console.error("hostStartRound: lobby not in round", lobbyCode);
        return;
      }

      if (lobby.suddenDeathTeamIndex !== undefined) {
        // if the team is stealing
        // lobby.gameState = "round_end";
        LobbyLogic.chooseAnswer(lobby, false);
      } else {
        // if de teem is gfuessing (no stal)
        let teamOver = false;
        while (!teamOver) {
          const newLobby = LobbyLogic.chooseAnswer(lobby, false);
          console.log("markRoundFailure", lobbyCode, newLobby);
          teamOver = newLobby.suddenDeathTeamIndex !== undefined;
        }
      }

      // if there is a timer, include the current time and how many seconds
      if (lobby.config.timerSeconds) {
        lobby.timerStart = new Date().getTime();
      }

      // send to all players
      await this.sendToPlayers(lobbyCode, {
        type: "lobby_update",
        data: { lobby: this._redactUnselectedAnswers(lobby) },
      });

      // send a message to the host
      return {
        type: "lobby_update",
        data: { lobby },
      };
    } catch (e) {
      console.error("hostGetQuestion", e);
      return ErrorMessage("error getting question");
    }
  }

  private async hostBeginLightningRound(
    lobbyCode: string,
    question: IQuestionType
  ) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      // if lobby is in "round"
      if (lobby.gameState !== "lightning_round_set_question") {
        console.error(
          "hostStartRound: lobby not in lightning_round_set_question",
          lobbyCode
        );
        return;
      }

      // start the round
      console.log("hostBeginLightningRound", lobbyCode, question);
      // const newLobby = LobbyLogic.startRound(lobby, question);

      const newLobby = lobby;

      newLobby.lightningQuestion = question;

      // reset to 0 used lives for all teams
      lobby.teams.forEach((team) => {
        team.wrongGuesses = 0;
      });

      newLobby.gameState = "lightning_round";

      this.lobbies[lobbyCode] = newLobby;

      // send to all players
      await this.sendToPlayers(lobbyCode, {
        type: "lobby_update",
        data: { lobby: this._redactUnselectedAnswers(newLobby) },
      });

      // send a message to the host
      return {
        type: "lobby_update",
        data: { lobby: newLobby },
      };
    } catch (e) {
      console.error("hostGetQuestion", e);
      return ErrorMessage("error getting question");
    }
  }

  // the host sends the chosen question at start of round
  private async hostStartRound(lobbyCode: string, question: IQuestionType) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      // if lobby is in "round"
      if (lobby.gameState !== "host_set_question") {
        console.error(
          "hostStartRound: lobby not in host_set_question",
          lobbyCode
        );
        return;
      }

      // start the round
      console.log("hostStartRound", lobbyCode, question);
      const newLobby = LobbyLogic.startRound(lobby, question);
      this.lobbies[lobbyCode] = newLobby;

      // // start countdown
      // if (lobby.config.timerSeconds > 0) {
      //   setTimeout(async () => {

      //     // if

      //     const hostUpdate = await this.hostChooseTeamAnswer(lobbyCode, false);

      //     await this.sendToHost(lobbyCode, hostUpdate);
      //   }, lobby.config.timerSeconds * 1000);
      // }

      // send to all players
      await this.sendToPlayers(lobbyCode, {
        type: "lobby_update",
        data: { lobby: this._redactUnselectedAnswers(newLobby) },
      });

      // send a message to the host
      return {
        type: "lobby_update",
        data: { lobby: newLobby },
      };
    } catch (e) {
      console.error("hostGetQuestion", e);
      return ErrorMessage("error getting question");
    }
  }

  // the host says which answer the current team chose, if it was not correct,
  /// they lose one of three lives, and they get to try again

  private async hostChooseLightningAnswer(
    lobbyCode: string,
    answerChosen: IAnswerType | false,
    lobbyData: ILobbyData
  ) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      // if lobby is in "round"
      if (lobby.gameState !== "lightning_round") {
        console.error(
          "hostChooseTeamAnswer: lobby not in lightning_round",
          lobbyCode
        );
        return;
      }

      lobby.randomSeed = Math.random();

      // if they get it wrong, the other team tries
      if (answerChosen === false) {
        if (!lobby.teams[lobby.lightningRoundTeamIndex].wrongGuesses) {
          lobby.teams[lobby.lightningRoundTeamIndex].wrongGuesses = 1;
        } else {
          lobby.teams[lobby.lightningRoundTeamIndex].wrongGuesses += 1;
        }

        // next team can try...
        let nextTeamIndex: number = lobby.lightningRoundTeamIndex + 1;
        if (nextTeamIndex >= lobby.teams.length) {
          nextTeamIndex = 0;
        }
        lobby.lightningRoundTeamIndex = nextTeamIndex;
      } else {
        lobby.lightningRoundStarted = false;

        // set team index that won
        // lobby.teams[lobby.lightningRoundTeamIndex].teamScore += 1;

        lobby.currentTeamIndex = lobby.lightningRoundTeamIndex;

        // start game prioper
        console.log("hostChooseLightningAnswer", lobbyCode, lobbyData);
        lobby.gameState = "host_set_question";

        // check if the answer is correct
        // const lobbyUpdated = LobbyLogic.chooseAnswer(lobby, answerChosen);
        // this.lobbies[lobbyCode] = lobbyUpdated;
      }

      // // advance the round
      // console.log("hostChooseLightningAnswer", lobbyCode, answerChosen);

      // // check if the answer is correct
      // const lobbyUpdated = LobbyLogic.chooseAnswer(lobby, answerChosen);
      // this.lobbies[lobbyCode] = lobbyUpdated;

      // send to all players
      await this.sendToPlayers(lobbyCode, {
        type: "lobby_update",
        data: { lobby: this._redactUnselectedAnswers(lobby) },
      });

      // send a message to the host
      return {
        type: "lobby_update",
        data: { lobby },
      };
    } catch (e) {
      console.error("hostGetQuestion", e);
      return ErrorMessage("error getting question");
    }
  }

  // the host says which answer the current team chose, if it was not correct,
  /// they lose one of three lives, and they get to try again

  private async hostChooseTeamAnswer(
    lobbyCode: string,
    answerChosen: IAnswerType | false
  ) {
    try {
      // find the lobby
      const lobby = this._getLobby(lobbyCode);

      // if lobby is in "round"
      if (lobby.gameState !== "round") {
        console.error("hostChooseTeamAnswer: lobby not in round", lobbyCode);
        return;
      }

      // advance the round
      console.log("hostChooseTeamAnswer", lobbyCode, answerChosen);

      // check if the answer is correct
      const lobbyUpdated = LobbyLogic.chooseAnswer(lobby, answerChosen);
      this.lobbies[lobbyCode] = lobbyUpdated;

      // send to all players
      await this.sendToPlayers(lobbyCode, {
        type: "lobby_update",
        data: { lobby: this._redactUnselectedAnswers(lobby) },
      });

      // send a message to the host
      return {
        type: "lobby_update",
        data: { lobby },
      };
    } catch (e) {
      console.error("hostGetQuestion", e);
      return ErrorMessage("error getting question");
    }
  }
}
