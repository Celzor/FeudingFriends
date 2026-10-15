import React, { useMemo, useEffect, useContext, useState } from "react";

import LoadingButton from "./LoadingButton";
import RenderQuestion from "./RenderQuestion";

import { DataContext } from "../providers/DataProvider";
import { IPlayerData, ITeamData } from "../../../types";

import useGameSounds from "../hooks/useGameSounds";

import "../scss/buttonAnimation.scss";
import "../scss/endScreen.scss";

export default function GameEnds() {
  const {
    lobbyData,
    startGame,
    hostEndRound,
    isLobbyHost,
    teamsData,
    prevLobbyData,
  } = useContext(DataContext);

  const { playGameOver } = useGameSounds();

  playGameOver();

  const GameEndText = useMemo(() => {
    let highestScore = Number.MIN_VALUE;
    let winningTeam = null;

    for (let team of lobbyData.teams) {
      if (team.teamScore > highestScore) {
        highestScore = team.teamScore;
        winningTeam = String(team.teamName);
      }
    }

    const sortedTeams = [...lobbyData.teams].sort(
      (a, b) => b.teamScore - a.teamScore
    );

    return (
      <div>
        <div className="winning-text">The winning team is....</div>
        <div className="winner-revel1">with a score of!</div>
        <div className="winner-revel2"> 
        <span style={{ color: 'yellow' }}>{highestScore}  </span> POINTS!!!</div>

        <div className="winner-revel3">{winningTeam} </div>

        <div className="mainTeamContainer">
          {lobbyData.teams
            .sort((a, b) => b.teamScore - a.teamScore)
            .map((team: ITeamData, index: number) => {
              let isCurrentTeam = false;

              if (lobbyData.currentTeamIndex !== undefined) {
                isCurrentTeam = index == lobbyData.currentTeamIndex;
              }

              // override if there's a sudden death
              if (lobbyData.suddenDeathTeamIndex !== undefined) {
                isCurrentTeam = index == lobbyData.suddenDeathTeamIndex;
              }

              return (
                <div className="teamContainer" key={index}>
                  {index === 0 && <div className ="teamText">Congratulations to {team.teamName}</div>}
                  {index === 1 && (<div className ="teamText" style={{ color: 'grey' }}>Better luck next time {team.teamName}</div>)}
                  <div className="team-table">
                    <strong>Final Score: </strong>
                    <strong className="finalScoreBoard">
                      {team.teamScore &&
                        team.teamScore.toString().padStart(4, "0")}
                    </strong>

                    <ul className="player-table">
                      {lobbyData.players
                        .filter(
                          (player: IPlayerData) => player.teamId == team.teamId
                        )
                        .map((player: IPlayerData, index: number) => (
                          <li className="playerNameLi" key={index}>
                            {player.playerName}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }, [lobbyData]);

  return (
    <div>
      <div className="pyro">
        <div className="before"></div>
        <div className="after"></div>
      </div>

      {GameEndText}

      <br />
    </div>
  );
}
