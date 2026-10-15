import React, { useEffect, useContext, useState } from "react";

import { DataContext } from "../providers/DataProvider";

import { isRefract } from "../socket";
import MainScreen from "../screens/MainScreen";
import LobbyScreen from "../screens/LobbyScreen";
import GameScreen from "../screens/GameScreen";

export default function Game() {
  const { socketConnected, lobbyData } = useContext(DataContext);

  if (!socketConnected) {
    return <div>Connecting Socket...</div>;
  }

  if (!lobbyData) {
    return isRefract ? <p>Synchronizing the activity…</p> : <MainScreen />;
  }

  if (lobbyData.gameState !== "lobby") {
    return <GameScreen />;
  }

  return <LobbyScreen />;
}
