// ---------
// lobby types

export type ILobbyConfig = {
  questionPools: number[];
  numberOfRounds: number;
  winningScore: number;
  lightningRound: boolean;

  timerSeconds: number;
};

export type IGameState =
  | "lobby"
  | "lightning_round_set_question"
  | "lightning_reveal"
  | "lightning_round"
  | "host_set_question"
  | "round"
  | "round_end"
  | "game_end"
  | "game_over";

export type IRoundResults = {
  round: number;
  question: IQuestionType;
  result: "correct" | "incorrect";
  type: "complete" | "steal";
  teamData?: ITeamData;
  roundPoints: number;
};

export type ILobbyData = {
  revision?: number;
  lightningChallenge?: {
    mode: "chase" | "moles" | "reaction";
    seed: number;
    startedAt: number;
  };
  lobbyCode: string;
  hostName: string;
  hostSocketId: string;
  config: ILobbyConfig;
  gameState: IGameState;
  randomSeed: number;

  lightningQuestion?: IQuestionType;

  lightningRoundStarted?: boolean;
  lightningRoundTeamIndex?: number;

  currentRound?: number;
  roundResults?: IRoundResults[];
  currentQuestion?: IQuestionType;
  currentTeamIndex?: number;
  suddenDeathTeamIndex?: number;

  teams?: ITeamData[];
  questions?: IQuestionType[];
  players: IPlayerData[];

  timerStart?: number;
};

export type IPlayerData = {
  socketId: string;
  playerName: string;
  teamId?: number | false;
};

export type ITeamData = {
  teamId: number;
  teamName: string;
  teamScore: number;
  wrongGuesses?: number;
};

export type IAnswerType = {
  answerText: string;
  answerScore: number;
  answerSelected?: boolean; // has it already been chosen
  // teamSelected?: number; // which team selected this answer
};

export type IQuestionType = {
  question: string;
  answers: IAnswerType[];
  correctTeamIndex?: number;
};

// ---------
// message types

export type IMessageTypes =
  "error" | "lobby_update" | "question_check" | "pong" | "left_lobby";

export type IMessage = {
  type: IMessageTypes;
  data?: any;
  message?: string;
};

export type lightningRound = {
  teams?: ITeamData[];
  questions?: IQuestionType[];
  players: IPlayerData[];
};
