import React, { useEffect, useContext, useState, useMemo } from "react";

import {
  IAnswerType,
  IPlayerData,
  IQuestionType,
  ITeamData,
} from "../../../types";

import { DataContext } from "../providers/DataProvider";

import LoadingButton from "../components/LoadingButton";

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
    console.log(values);

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
        <div className="questionSet" key={"test"}>
          <p>Question Sets</p>
          <select
            className="questionPools"
            name="questionPools"
            id="questionPools"
            multiple
            disabled={!isLobbyHost}
            onChange={updateQuestionPools}
            value={questionPools.map(String)} // Convert numbers to strings
          >
            {[3, 4, 5, 6, 7].map((question: number) => (
              <option value={question} key={question}>
                {question}
              </option> // Add key prop to option element
            ))}
          </select>
        </div>
        <div className="winConditions">
          <div key={"test1"}>
            <p>Round Count</p>
            <input
              className="playerInput"
              type="number"
              name="rounds"
              id="rounds"
              min="1"
              max="100"
              value={rounds}
              onChange={updateRounds}
              disabled={!isLobbyHost}
            />

            <p>Round Timer</p>
            <input
              className="playerInput"
              type="number"
              name="timer"
              id="roundTimer"
              min="0"
              max="50000"
              value={roundTimer}
              onChange={updateTimer}
              disabled={!isLobbyHost}
            />
          </div>
          <div className="LightningRound">
            <p>Lightning Round</p>
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
          <div key={"test2"}>
            <p>Winning Score</p>
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

const IS_DEV = process.env.NODE_ENV !== "production";

function PlayersInLobby() {
  const {
    isLobbyHost,
    MOCK_fakeJoinLobby,
    lobbyData,
    teamsData,
    updatePlayerTeam,
  } = useContext(DataContext);

  return (
    <div className="PlayersInLobby">
      <h2>Players in Lobby</h2>

      {IS_DEV && (
        <LoadingButton
          buttonText="Add Fake User"
          onClick={async () => {
            // Add fake user

            MOCK_fakeJoinLobby(lobbyData.lobbyCode);
          }}
        />
      )}

      <div className="PlayersInLobbyInner">
        <ul className="playerLobbyUl">
          {lobbyData.players.map((player: IPlayerData, index: number) => (
            <div className="PlayersInLobbyRow" key={index}>
              <li className="playyerInLobbyLi">{player.playerName}</li>
              {!isLobbyHost && player.teamId !== false ? player.teamId : ""}
              {isLobbyHost && (
                <select
                  name="team"
                  id="team"
                  value={player.teamId !== false ? player.teamId : ""}
                  onChange={(e) => updatePlayerTeam(player, e.target.value)}
                >
                  <option disabled selected value="">
                    ---
                  </option>

                  {teamsData.map((team) => (
                    <option value={team.teamId}>
                      {team.teamName} ({team.teamId})
                    </option>
                  ))}

                  <option value="new_team">NEW TEAM</option>
                </select>
              )}
            </div>
          ))}
        </ul>
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
      <div
        key={index}
        style={{
          flex: 1,
        }}
      >
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
    <div>
      {/* game id */}
      <div className="lineHeightReduce">
        <h1>
          Game ID: {lobbyData.lobbyCode}
          <button
            style={{ marginLeft: "10px", color: "blue" }}
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
            style={{ marginLeft: "10px", color: "blue" }}
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
        </h1>

        <p className="hostDetails">
          {isLobbyHost ? "You are the host" : "You are " + playerName}
        </p>
        {playerName !== lobbyData.hostName && <p>Host: {lobbyData.hostName}</p>}
      </div>

      <hr />

      {/* lobby config */}
      <div className="lobbyTopContainer">
        <LobbyConfig />
        <PlayersInLobby />
      </div>

      <hr />

      {/* teams display */}
      <div className="teamsBottomLobbyContainer">
        <p>Teams:</p>
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "row",
            width: "100%",
          }}
        >
          {teamsView}
        </div>
      </div>

      {isLobbyHost ? (
        <LoadingButton onClick={() => startGame()} buttonText="BEGIN" />
      ) : null}
    </div>
  );
}
