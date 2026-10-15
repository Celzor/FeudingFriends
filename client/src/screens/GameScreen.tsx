import React, { useMemo, useEffect, useContext, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import "../scss/buttonAnimation.scss";
import { IAnswerType, IQuestionType } from "../../../types";

import { DataContext } from "../providers/DataProvider";

import TeamsView from "../components/TeamsView";
import GameView from "../components/GameView";

// game in progress, orcherstrate rounds

//add a table for each of the teams, above the winner team write Congratulations, show all the players names for the winning team, and above the losing team , show their score, all the player names
export default function GameScreen() {
  const { isLobbyHost, playerName, lobbyData } = useContext(DataContext);

  return (
    <div className="gameHeader">
      <div className="header-info">
        <h2>Game ID: {lobbyData.lobbyCode}</h2>
        <p>{isLobbyHost ? "You are the host" : "You are " + playerName}</p>
      </div>

      <hr />
      <GameView />
      {lobbyData.gameState != "game_end" && <hr />}
      {lobbyData.gameState != "game_end" &&
        lobbyData.gameState != "game_over" && <TeamsView />}
    </div>
  );
}
