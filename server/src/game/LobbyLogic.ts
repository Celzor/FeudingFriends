import {
  ITeamData,
  IPlayerData,
  ILobbyData,
  IQuestionType,
  IAnswerType,
  IRoundResults,
} from "../../../types";

export default class LobbyLogic {
  /// ------------------ private functions ------------------ ///

  private static _findSmallerTeamIndex(lobby: ILobbyData) {
    // this function should return either the smmler of the teo teams, or the first team id
    // if they are the same size

    // count the number of players on each team
    const teamCounts = lobby.teams.reduce((acc, team) => {
      acc[team.teamId] = 0;
      return acc;
    }, {});

    // count the players on each team

    lobby.players.forEach((player) => {
      if (player.teamId) teamCounts[player.teamId] += 1;
    });

    // if team 1 has fewer players, add to team 1
    if (!teamCounts[1] || teamCounts[1] <= teamCounts[2]) return 1;
    return 2;
  }
  // sum total score of all answered answers
  private static getQuestionTotalScore(question: IQuestionType) {
    const totalSelectedScore = question.answers.reduce(
      (acc: number, answer: IAnswerType) => {
        if (answer.answerSelected) {
          return acc + answer.answerScore;
        }
        return acc;
      },
      0
    );
    console.log("totalScore", totalSelectedScore, question);

    return totalSelectedScore;
  }

  // IS THE GAME OVER?
  private static isGameOver(lobby: ILobbyData) {
    let isGameOver: boolean = false;
    if (
      lobby.config.winningScore > 0 &&
      lobby.teams.some((team) => team.teamScore >= lobby.config.winningScore)
    ) {
      // game over
      isGameOver = true;
    }
    if (
      lobby.config.numberOfRounds > 0 &&
      lobby.currentRound >= lobby.config.numberOfRounds
    ) {
      // game over
      isGameOver = true;
    }

    return isGameOver;
  }

  private static isRoundOver(lobby: ILobbyData) {
    const percentage = 60;

    // the round is over if more than 80% of the answers have been selected
    //for a lightning round the answer score is null, this needs to be factored in to the code

    const totalAnswers = lobby.currentQuestion.answers.length;
    const selectedAnswers = lobby.currentQuestion.answers.filter(
      (answer) => answer.answerSelected
    ).length;

    // PERCENTAGE OF ANSWERS SELECTED FOR WIN. round down to the nearest whole number
    var totalWinNumber = Math.floor(totalAnswers * (percentage / 100));

    // PERCENTAGE OF ANSWERS SELECTED FOR WIN

    return selectedAnswers >= totalWinNumber;
  }

  private static markRoundResults(
    lobby: ILobbyData,
    result: "correct" | "incorrect",
    type: "complete" | "steal",
    teamData: ITeamData,
    roundPoints: number
  ) {
    if (!lobby.roundResults) {
      lobby.roundResults = [];
    }

    const roundResults: IRoundResults = {
      round: lobby.currentRound,
      question: lobby.currentQuestion,
      result,
      type,
      teamData,
      roundPoints,
    };

    lobby.roundResults.push(roundResults);

    return lobby;
  }

  private static cleanUpRound(lobby: ILobbyData) {
    lobby.randomSeed = Math.random();

    let correctTeamIndex = lobby.currentTeamIndex;
    if (lobby.suddenDeathTeamIndex !== undefined) {
      correctTeamIndex = lobby.suddenDeathTeamIndex;
    }

    lobby.currentQuestion.correctTeamIndex = correctTeamIndex;

    // end the round (advance round, set host choose question, etc)
    lobby.suddenDeathTeamIndex = undefined;

    // add the current question to the array
    lobby.questions.push(lobby.currentQuestion);
    lobby.currentQuestion = undefined;

    // reset all wrongGuesses
    lobby.teams.forEach((team) => {
      team.wrongGuesses = 0;
    });

    lobby.currentTeamIndex = this.nextTeamIndex(lobby);
    lobby.currentRound = lobby.currentRound += 1;

    return lobby;
  }

  private static nextTeamIndex(lobby: ILobbyData): number {
    // next team
    let nextTeamIndex: number = lobby.currentTeamIndex + 1;
    if (nextTeamIndex >= lobby.teams.length) {
      nextTeamIndex = 0;
    }

    return nextTeamIndex;
  }

  /// ------------------ public functions ------------------ ///

  public static createLobby(socketId: string, playerName: string) {
    // create random lobby code (numbers only, 6 long)
    const lobbyCode = Math.floor(1000 + Math.random() * 9000).toString();

    // create new lobby
    const lobby: ILobbyData = {
      lobbyCode,
      gameState: "lobby",
      hostSocketId: socketId,
      hostName: playerName,

      randomSeed: Math.random(),

      config: {
        questionPools: [5, 6, 7],
        numberOfRounds: 2,
        winningScore: -1,
        lightningRound: false,

        timerSeconds: 0,
      },

      // start with default teams
      teams: [
        { teamId: 1, teamName: "Team One", teamScore: 0 },
        { teamId: 2, teamName: "Team Two", teamScore: 0 },
      ],
      questions: [],
      players: [],
    };

    console.debug("createLobby", lobby);
    return lobby;
  }

  public static playerJoinLobby(
    lobby: ILobbyData,
    socketId: string,
    playerName: string
  ) {
    // add the player to the lobby
    const player: IPlayerData = {
      socketId: socketId,
      playerName: playerName,
      teamId: false,
    };

    // set teams automatically (max two teams)
    // if team 1 has fewer players, add to team 1
    const mapTeamCounts = this._findSmallerTeamIndex(lobby);

    console.log("smallerTeam", mapTeamCounts);

    player.teamId = mapTeamCounts;

    lobby.players.push(player);

    return lobby;
  }

  public static startGame(lobby: ILobbyData) {
    // set random team to gp first,  shuffle the teams
    // lobby.teams = lobby.teams.sort(() => Math.random() - 0.5);
    lobby.currentTeamIndex = 0;

    if (lobby.config.lightningRound) {
      lobby.gameState = "lightning_round_set_question";
    } else {
      lobby.gameState = "host_set_question";
    }
    return lobby;
  }

  public static startRound(lobby: ILobbyData, question: IQuestionType) {
    // initialize the lobby with the first question
    if (lobby.currentRound === undefined) lobby.currentRound = 0;

    // if there is a timer, include the current time and how many seconds
    if (lobby.config.timerSeconds) {
      lobby.timerStart = new Date().getTime();
    }

    // add the question as thee current question
    lobby.currentQuestion = question;

    lobby.gameState = "round";

    // reset to 0 used lives for all teams
    lobby.teams.forEach((team) => {
      team.wrongGuesses = 0;
    });

    console.log("lobby", lobby.currentQuestion.answers);
    return lobby;
  }

  public static chooseAnswer(
    lobby: ILobbyData,
    answerChosen: IAnswerType | false
  ) {
    lobby.randomSeed = Math.random();

    // tan answer was chosen (correct)
    if (answerChosen) {
      // if we're in a sudden death round, then the team that's doing the sudden death wins the round
      // after they answer this question, the round ends, sudden death is finished
      if (lobby.suddenDeathTeamIndex !== undefined) {
        // update this answer as selected
        lobby.currentQuestion.answers.map((answer: IAnswerType) => {
          if (answer.answerText === answerChosen.answerText)
            answer.answerSelected = true;
          return answer;
        });

        const totalScore = this.getQuestionTotalScore(lobby.currentQuestion);

        // add the score to the sudden death tem
        lobby.teams[lobby.suddenDeathTeamIndex].teamScore = lobby.teams[
          lobby.suddenDeathTeamIndex
        ].teamScore += totalScore;

        this.markRoundResults(
          lobby,
          "correct",
          "steal",
          lobby.teams[lobby.suddenDeathTeamIndex],
          totalScore
        );

        lobby = this.cleanUpRound(lobby);

        const isGameOver = this.isGameOver(lobby);
        if (isGameOver) {
          lobby.gameState = "game_end";
        } else {
          lobby.gameState = "round_end";
        }
      }

      // just a normal team answering a question
      else {
        // find the question they answered
        const chosenAnswer = lobby.currentQuestion.answers.find(
          (answer) => answer.answerText === answerChosen.answerText
        );

        // add points to the team
        // ddddd - they now get them at the end of the round
        // lobby.teams[lobby.currentTeam].teamScore += chosenAnswer.answerScore;

        // set answered
        lobby.currentQuestion.answers.map((answer) => {
          if (answer.answerText === answerChosen.answerText)
            answer.answerSelected = true;
          return answer;
        });

        // set it as selected
        chosenAnswer.answerSelected = true;

        // the round is over if more than 80% of the answers have been selected
        const iisRoundOver = this.isRoundOver(lobby);
        if (iisRoundOver) {
          // lobby.randomSeed = Math.random();

          const totalScore = this.getQuestionTotalScore(lobby.currentQuestion);

          lobby.teams[lobby.currentTeamIndex].teamScore += totalScore;

          this.markRoundResults(
            lobby,
            "correct",
            "complete",
            lobby.teams[lobby.currentTeamIndex],
            totalScore
          );

          lobby = this.cleanUpRound(lobby);

          const isGameOver = this.isGameOver(lobby);
          if (isGameOver) {
            lobby.gameState = "game_end";
          } else {
            lobby.gameState = "round_end";
          }
        }
      }
    }

    // wrong/answer not on board
    else {
      // noone gets any points, next round
      if (lobby.suddenDeathTeamIndex !== undefined) {
        // lobby.gameState = "round_end";

        // selectnext team
        // lobby.currentTeamIndex = this.nextTeamIndex(lobby);

        this.markRoundResults(
          lobby,
          "incorrect",
          "steal",
          lobby.teams[lobby.suddenDeathTeamIndex],
          0
        );

        lobby = this.cleanUpRound(lobby);

        const isGameOver = this.isGameOver(lobby);
        if (isGameOver) {
          lobby.gameState = "game_end";
        } else {
          lobby.gameState = "round_end";
        }
      }

      //
      else {
        // if incorrect, remove a life from the team
        lobby.teams[lobby.currentTeamIndex].wrongGuesses += 1;

        // if the team has no lives left, go to the next team to choose one answer
        if (lobby.teams[lobby.currentTeamIndex].wrongGuesses >= 3) {
          // select the next item in the array, which might be the first
          const suddenDeathTeam = lobby.currentTeamIndex + 1;
          if (suddenDeathTeam >= lobby.teams.length) {
            lobby.suddenDeathTeamIndex = 0;
          } else {
            lobby.suddenDeathTeamIndex = suddenDeathTeam;
          }
        }
      }
    }

    return lobby;
  }
}
