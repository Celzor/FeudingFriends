import React, { useMemo, useEffect, useContext, useState } from "react";

import LoadingButton from "../components/LoadingButton";
import RenderQuestion from "../components/RenderQuestion";

import { DataContext } from "../providers/DataProvider";
import GameEnds from "../components/GameEnds";
import "../scss/buttonAnimation.scss";

export default function RoundEndStats() {
  const { lobbyData, startGame, hostEndGame, hostEndRound, isLobbyHost } =
    useContext(DataContext);

  // should be a string like "team1 won the round with a steal for 25 points" or
  //"team 4 won the round for 55 points"
  // if it is a lightning round, it should say "Team X won the lightning round"
  const roundResult = useMemo(() => {
    const lastRoundResult =
      lobbyData.roundResults[lobbyData.roundResults.length - 1];
    if (!lastRoundResult) return "No round results yet";

    // noone won the round
    if (lastRoundResult.result === "incorrect") {
      return "No one won the round - big sad";
    } else if (lastRoundResult.result === "correct") {
      if (lastRoundResult.type === "steal") {
        return `${lastRoundResult.teamData.teamName} won the round with a steal for ${lastRoundResult.roundPoints} points`;
      } else {
        return `${lastRoundResult.teamData.teamName} won the round with ${lastRoundResult.roundPoints} points`;
      }
    }
  }, [lobbyData.roundResults]);

  return (
    <div>
      Round Ended
      <h2>{roundResult}</h2>
      <RenderQuestion roundEnd={true} />
      <br />
      {isLobbyHost &&
        (lobbyData.gameState === "game_end" ? (
          <LoadingButton
           onClick={() => hostEndGame()}
           buttonText="End Game"
           />
           
        ) : (
          <LoadingButton
            onClick={async () => hostEndRound()}
            buttonText="Next Round"
          />
        ))}
      {/* <pre>{JSON.stringify(lobbyData.roundResults, null, 2)}</pre> */}
    </div>
  );
}
