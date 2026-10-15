import React, { useEffect, useContext, useState } from "react";

import { useSearchParams } from "react-router-dom";

import { DataContext } from "../providers/DataProvider";

import LoadingButton from "../components/LoadingButton";

// scren with "join"/"create" lobby screens
export default function MainScreen() {
  const { playerName, setPlayerName, createNewLobby, joinGameLobby } =
    useContext(DataContext);

  let [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const gameCode = searchParams.get("__game_code");
    if (gameCode) {
      // Set the variable here
      // For example:
      setGameLobbyCodeInput(gameCode);

      // clear search parms
      setSearchParams([]);

      // if playername is not null, join us
      if (playerName != "") {
        joinGameLobby(gameCode);
      }
    }
  }, []);

  // const [playerName, setPlayerName] = useState("");
  const [gameLobbyCodeInput, setGameLobbyCodeInput] = useState("");

  return (
    <div className="maxWidth">
      <h2>Enter your name here!</h2>
      <input
        className="playerInput"
        type="text"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Enter your player name"
      />
      <br />

      <div className="or-container">
        <hr />
        <h2 className="or-text">AND</h2>
        <hr />
      </div>
      <LoadingButton
        buttonText="Host Lobby"
        disabled={playerName == ""}
        onClick={async () => createNewLobby()}
      />

      <div className="or-container">
        <hr />
        <h2 className="or-text">OR</h2>
        <hr />
      </div>

      <input
        className="playerInput"
        type="text"
        placeholder="Enter Lobby Code"
        value={gameLobbyCodeInput}
        onChange={(e) => setGameLobbyCodeInput(e.target.value)}
      />
      <br />

      <LoadingButton
        buttonText="Join Lobby"
        disabled={playerName == "" || gameLobbyCodeInput == ""}
        onClick={async () => joinGameLobby(gameLobbyCodeInput)}
      />

      <div className="easter-egg">
        Made by tgxcel enterprises, for more details,{" "}
        <a
          href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          target="_blank"
          rel="noopener noreferrer"
        >
          <b>click here</b>
        </a>
      </div>
    </div>
  );
}
