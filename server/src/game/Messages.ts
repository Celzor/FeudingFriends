import {
  ITeamData,
  IPlayerData,
  IMessage,
  ILobbyData,
  IQuestionType,
  IAnswerType,
} from "../../../types";

export const LobbyUpdate: (newLobby: ILobbyData) => IMessage = (
  newLobby: ILobbyData
) => {
  return {
    type: "lobby_update",
    data: { lobby: newLobby },
  };
};

export const ErrorMessage = (errorMessage: string): IMessage => {
  return {
    type: "error",
    message: errorMessage,
  };
};
