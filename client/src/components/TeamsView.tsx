import React, { useEffect, useContext, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import "../scss/buttonAnimation.scss";
import { IPlayerData, ITeamData } from "../../../types";

import { DataContext } from "../providers/DataProvider";

import useGameSounds from "../hooks/useGameSounds";

// shows all teams/players, current turn, etc
export default function TeamsView() {
  const { lobbyData, prevLobbyData } = useContext(DataContext);
  const finalRound =
    ["round", "host_set_question"].includes(lobbyData.gameState) &&
    lobbyData.config.numberOfRounds > 0 &&
    (lobbyData.currentRound ?? 0) + 1 >= lobbyData.config.numberOfRounds;

  const { playRandomWrongSound } = useGameSounds();
  const [showXmark, setShowXmark] = useState(0);

  // hide x after 2500 ms
  useEffect(() => {
    if (showXmark) {
      const timer = setTimeout(() => setShowXmark(0), 2500);
      return () => clearTimeout(timer);
    }
  }, [showXmark]);

  useEffect(() => {
    // this needs to look at the previous state, and determine
    // - if a team has a wrong answer
    // - if any team has more wrong answers than the previous state
    // - if so, play the fail sound
    if (
      lobbyData.gameState === "round" ||
      lobbyData.gameState === "lightning_round"
    ) {
      if (!prevLobbyData) return;

      // check for wrong answers
      lobbyData.teams.forEach((team: ITeamData, index: number) => {
        const prevTeam = prevLobbyData.teams[index];
        if ((prevTeam?.wrongGuesses || 0) < (team.wrongGuesses || 0)) {
          // play fail sound
          playRandomWrongSound(lobbyData.randomSeed, {
            onStart: () => setShowXmark((burst) => burst + 1),
          });
        }
      });
    }
  }, [lobbyData]);

  return (
    <div className="teamData">
      {showXmark > 0 && (
        <FontAwesomeIcon key={showXmark} icon={faXmark} className="xmark" />
      )}
      {lobbyData.teams.map((team: ITeamData, index: number) => {
        let isCurrentTeam = false;

        if (lobbyData.currentTeamIndex !== undefined) {
          isCurrentTeam = index == lobbyData.currentTeamIndex;
        }

        // overriude if there's a sudden death
        if (lobbyData.suddenDeathTeamIndex !== undefined) {
          isCurrentTeam = index == lobbyData.suddenDeathTeamIndex;
        }

        if (lobbyData.gameState === "lightning_round") {
          if (lobbyData.lightningRoundTeamIndex !== undefined)
            isCurrentTeam = index == lobbyData.lightningRoundTeamIndex;
        }

        const teamWrongGuesses: number = team.wrongGuesses;
        // console.log("teamWrongGuesses", teamWrongGuesses);

        return (
          <div
            key={index}
            className={`${isCurrentTeam ? "currentTeam" : "otherTeam"} ${finalRound ? "finalRoundTeam" : ""}`}
            aria-label={team.teamName}
          >
            {finalRound && (
              <div className="teamRoundWarning" role="status">
                <strong>
                  <span aria-hidden="true">⚡ </span>FINAL ROUND
                </strong>
                <span>
                  {isCurrentTeam
                    ? "YOUR TURN — MAKE IT COUNT!"
                    : "MAKE IT COUNT!"}
                </span>
              </div>
            )}
            {teamWrongGuesses > 0 && (
              <div>
                {Array.from({ length: teamWrongGuesses }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      color: "red",
                      height: "30px",
                      width: "30px",
                    }}
                  >
                    ❌
                  </span>
                ))}
              </div>
            )}

            <strong>{team.teamName} Score: </strong>
            <strong className="scoreBoard ">
              {team.teamScore.toString().padStart(4, "0")}
            </strong>

            <ul className="playerUl">
              {lobbyData.players
                .filter((player: IPlayerData) => player.teamId == team.teamId)
                .map((player: IPlayerData, index: number) => (
                  <li className="playerNameLi" key={index}>
                    {player.playerName}
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
