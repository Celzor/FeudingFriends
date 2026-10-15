import React, { useEffect, useContext, useState } from "react";

import { DataContext } from "../providers/DataProvider";

import MainScreen from "../screens/MainScreen";
import LobbyScreen from "../screens/LobbyScreen";
import GameScreen from "../screens/GameScreen";

export default function Game() {
  const { socketConnected, lobbyData } = useContext(DataContext);

  if (!socketConnected) {
    return <div>Connecting Socket...</div>;
  }

  if (!lobbyData) {
    // who the fuck hasn't even joined a fucking lobby yet?
    return <MainScreen />;
  }

  // in an actual fucking game
  if (lobbyData.gameState !== "lobby") {
    return <GameScreen />;
  }

  // fucking losers are only in the lobby
  return <LobbyScreen />;
}
