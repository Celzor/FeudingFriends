import React, { useMemo, useEffect, useContext, useState } from "react";

import Confetti from "react-confetti";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import "../scss/buttonAnimation.scss";
import { IPlayerData, ITeamData } from "../../../types";

import { DataContext } from "../providers/DataProvider";

import useGameSounds from "../hooks/useGameSounds";

// shows all teams/players, current turn, etc
export default function TeamsView() {
  const { teamsData, isLobbyHost, lobbyData, prevLobbyData } =
    useContext(DataContext);

  const {
    playWrong,
    playApplause,
    playRandomWrongSound,
    playRandomStealSound,
  } = useGameSounds();
  const [showXmark, setShowXmark] = useState(false);

  const [showConfetti, setShowConfetti] = useState(false);

  // hide the  cutfetti after like 4 seconds
  useEffect(() => {
    if (showConfetti) {
      setTimeout(() => {
        setShowConfetti(false);
      }, 5000);
    }
  }, [showConfetti]);

  // hide x after 2500 ms
  useEffect(() => {
    if (showXmark) {
      setTimeout(() => {
        setShowXmark(false);
      }, 2500);
    }
  }, [showXmark]);

  //// SYNCED SOUND
  // FOR FAIL SOUND/ASNIMIOMAIFGBASEIYUDFGKWERYHJMG KSDFGIKGBHYUFDAESBIKYUGFDAS
  // const [prevLobbyDataThing, setPrevLobbyDataThing] =
  //   useState<ILobbyData | null>(null);

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
          playRandomWrongSound(lobbyData.randomSeed);
          setShowXmark(true);
        }
      });
    }

    // royund end
    if (lobbyData.gameState === "round_end") {
      if (!prevLobbyData) return;

      const lastRoundResult =
        lobbyData.roundResults[lobbyData.roundResults.length - 1];
      if (!lastRoundResult) return;

      // noone won the round
      if (lastRoundResult.result === "incorrect") {
        playWrong();
        setShowXmark(true);
        // return "No one won the round - big sad";
      } else if (lastRoundResult.result === "correct") {
        if (lastRoundResult.type === "steal") {
          playRandomStealSound(lobbyData.randomSeed);
          setShowConfetti(true);
          // return `${lastRoundResult.teamData.teamName} won the round with a steal for ${lastRoundResult.roundPoints} points`;
        } else {
          playApplause();
          setShowConfetti(true);
          // return `${lastRoundResult.teamData.teamName} won the round with ${lastRoundResult.roundPoints} points`;
        }
      }
    }

    // setPrevLobbyDataThing(lobbyData);
  }, [lobbyData]);

  return (
    <div className="teamData">
      {showXmark && <FontAwesomeIcon icon={faXmark} className="xmark" />}
      {showConfetti && (
        <Confetti
          friction={0.99}
          wind={0}
          gravity={0.2}
          recycle={true}
          opacity={0.8}
          numberOfPieces={200}
          // tweenDuration={40000}
        />
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
            className={isCurrentTeam ? "currentTeam" : "otherTeam"}
          >
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
