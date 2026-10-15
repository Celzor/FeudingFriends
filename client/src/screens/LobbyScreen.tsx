import React, { useEffect, useContext, useState, useMemo } from "react";

import { IPlayerData } from "../../../types";

import { DataContext } from "../providers/DataProvider";

import LoadingButton from "../components/LoadingButton";
import { isRefract } from "../socket";

import "../scss/LobbyScreen.scss";
function LobbyConfig() {
  const { isLobbyHost, lobbyData, hostUpdateLobbyConfig } =
    useContext(DataContext);

  // local form state
  const [questionPools, setQuestionPools] = useState<number[]>([]);
  const [rounds, setRounds] = useState<number>(0);
  const [roundTimer, setRoundTimer] = useState<number>(0);
  const [winningScore, setWinningScore] = useState<number>(-1);
  const [lightningRound, setLightningRound] = useState<boolean>(true);

  // update local state on websocket change, if not host
  useEffect(() => {
    if (!lobbyData) return;
    // if (isLobbyHost) return;

    setQuestionPools(lobbyData.config.questionPools);
    setRounds(lobbyData.config.numberOfRounds);
    setWinningScore(lobbyData.config.winningScore);
    setLightningRound(lobbyData.config.lightningRound);
    setRoundTimer(lobbyData.config.timerSeconds);
  }, [lobbyData]);

  const updateQuestionPools = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const options = [...event.target.selectedOptions];
    const values = options.map((option) => Number(option.value));
    setQuestionPools(values);
    hostUpdateLobbyConfig({
      ...lobbyData.config,
      questionPools: values,
    });
  };

  const updateRounds = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRounds(Number(event.target.value));
    hostUpdateLobbyConfig({
      ...lobbyData.config,
      numberOfRounds: Number(event.target.value),
    });
  };

  const updateTimer = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRoundTimer(Number(event.target.value));
    hostUpdateLobbyConfig({
      ...lobbyData.config,
      timerSeconds: Number(event.target.value),
    });
  };

  const updateWinningScore = (event: React.ChangeEvent<HTMLInputElement>) => {
    setWinningScore(Number(event.target.value));
    hostUpdateLobbyConfig({
      ...lobbyData.config,
      winningScore: Number(event.target.value),
    });
  };

  const updateLightningRound = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLightningRound(event.target.checked);
    hostUpdateLobbyConfig({
      ...lobbyData.config,
      lightningRound: event.target.checked,
    });
  };

  return (
    <div className="lobbyMain">
      <h2>Lobby Config</h2>
      <div className="lobbyConfig">
        <div className="questionSet">
          <label htmlFor="questionPools">Question Sets</label>
          <select
            className="questionPools"
            name="questionPools"
            id="questionPools"
            multiple
            size={6}
            disabled={!isLobbyHost}
            onChange={updateQuestionPools}
            value={questionPools.map(String)} // Convert numbers to strings
          >
            {[3, 4, 5, 6, 7, 8].map((question: number) => (
              <option value={question} key={question}>
                {question}
              </option> // Add key prop to option element
            ))}
          </select>
        </div>
        <div className="winConditions">
          <div className="lobbySetting">
            <label htmlFor="rounds">Round Count</label>
            <input
              className="playerInput"
              type="number"
              name="rounds"
              id="rounds"
              min="1"
              max="32"
              value={rounds}
              onChange={updateRounds}
              disabled={!isLobbyHost}
            />
          </div>
          <div className="lobbySetting">
            <label htmlFor="roundTimer">Seconds per answer (0 = off)</label>
            <input
              className="playerInput"
              type="number"
              name="timer"
              id="roundTimer"
              min="0"
              max="300"
              value={roundTimer}
              onChange={updateTimer}
              disabled={!isLobbyHost}
            />
          </div>
          <div className="lobbySetting LightningRound">
            <label htmlFor="lightningRound">Lightning Round</label>
            <input
              className="playerInput"
              type="checkbox"
              name="lightningRound"
              id="lightningRound"
              checked={lightningRound}
              onChange={updateLightningRound}
              disabled={!isLobbyHost}
            />
          </div>
          <div className="lobbySetting">
            <label htmlFor="score">Winning Score</label>
            <input
              className="playerInput"
              type="number"
              name="score"
              id="score"
              value={winningScore}
              onChange={updateWinningScore}
              disabled={!isLobbyHost}
            />
          </div>
        </div>
      </div>
    </div>
  );
}



function PlayersInLobby() {
  const {
    isLobbyHost,
    lobbyData,
    teamsData,
    updatePlayerTeam,
  } = useContext(DataContext);

  return (
    <div className="PlayersInLobby">
      <h2>Players in Lobby</h2>

      <div className="PlayersInLobbyInner">
        <div className="playerLobbyUl">
          {lobbyData.players.map((player: IPlayerData, index: number) => (
            <div className="PlayersInLobbyRow" key={index}>
              <span className="playyerInLobbyLi">{player.playerName}</span>
              {!isLobbyHost && player.teamId !== false ? player.teamId : ""}
              {isLobbyHost && (
                <select
                  aria-label={`Team for ${player.playerName}`}
                  name="team"
                  id="team"
                  value={player.teamId !== false ? player.teamId : ""}
                  onChange={(e) => updatePlayerTeam(player, e.target.value)}
                >
                  <option disabled value="">
                    ---
                  </option>

                  {teamsData.map((team) => (
                    <option key={team.teamId} value={team.teamId}>
                      {team.teamName} ({team.teamId})
                    </option>
                  ))}

                  <option value="new_team">NEW TEAM</option>
                </select>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// lobby screen, setup teams for host, team assignment
export default function LobbyScreen() {
  const { isLobbyHost, playerName, lobbyData, teamsData, startGame } =
    useContext(DataContext);

  const [isCopiedCode, setIsCopiedCode] = useState(false);
  const [isCopiedLink, setIsCopiedLink] = useState(false);

  const teamsView = useMemo(() => {
    if (!teamsData || !lobbyData) return null;

    return teamsData.map((team, index) => (
      <div className="lobbyTeam" key={team.teamId}>
        <strong>{team.teamName}</strong>

        <ul>
          {lobbyData.players
            .filter((player: IPlayerData) => player.teamId == team.teamId)
            .map((player: IPlayerData, index: number) => (
              <li key={index}>{player.playerName}</li>
            ))}
        </ul>
      </div>
    ));
  }, [teamsData, lobbyData]);

  return (
    <div className="lobbyScreen">
      <div className="lineHeightReduce lobbyIdentity">
        <div className="lobbyIdentityDetails">
          <h1>Game ID: {lobbyData.lobbyCode}</h1>
          <p className="hostDetails">
            {isLobbyHost ? "You are the host" : "You are " + playerName}
          </p>
          {!isLobbyHost && <p>Host: {lobbyData.hostName}</p>}
        </div>
        <div className="lobbyJoinDetails">
          {isRefract && <p>Everyone in the call joins automatically.</p>}
          <button
            hidden={isRefract}
            className="copyButton"
            onClick={() => {
              navigator.clipboard.writeText(lobbyData.lobbyCode);
              setIsCopiedCode(true);
              setTimeout(() => {
                setIsCopiedCode(false);
              }, 2000);
            }}
          >
            {isCopiedCode ? "Copied Code ✅" : "Copy Code"}
          </button>
          <button
            hidden={isRefract}
            className="copyButton"
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/?__game_code=${lobbyData.lobbyCode}`
              );
              setIsCopiedLink(true);
              setTimeout(() => {
                setIsCopiedLink(false);
              }, 2000);
            }}
          >
            {isCopiedLink ? "Copied Join Link ✅" : "Copy Join Link"}
          </button>
        </div>
      </div>

      <div className="lobbyContent">
        <div className="lobbyTopContainer">
          <LobbyConfig />
          <PlayersInLobby />
        </div>
      </div>

      <div className="lobbyFooter">
        <div className="teamsBottomLobbyContainer">
          <p>Teams:</p>
          <div className="lobbyTeams">{teamsView}</div>
        </div>
        {isLobbyHost ? (
          <LoadingButton onClick={() => startGame()} buttonText="BEGIN" />
        ) : (
          <p className="lobbyWaiting">Waiting for the host to begin…</p>
        )}
      </div>
    </div>
  );
}
