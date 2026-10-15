import { useEffect, useContext, useState } from "react";
import { DataContext } from "../providers/DataProvider";
import useGameSounds from "../hooks/useGameSounds";
import Celebration from "./Celebration";
import LoadingButton from "./LoadingButton";

export default function GameEnds() {
  const { lobbyData, isLobbyHost, returnToLobby } = useContext(DataContext);
  const { playGameOver, retryGameOver, stopGameOver, gameOverMusicState } =
    useGameSounds();
  const [celebrationRun, setCelebrationRun] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  useEffect(() => {
    playGameOver();
    return stopGameOver;
  }, [playGameOver, stopGameOver]);
  useEffect(() => {
    if (gameOverMusicState.status === "playing") {
      // A slow download or an autoplay retry should still get the full entrance.
      setCelebrationRun((run) => run + 1);
      setHasStarted(true);
    } else if (gameOverMusicState.status === "loading") {
      setHasStarted(false);
    }
  }, [gameOverMusicState.status]);

  const highestScore = Math.max(
    0,
    ...lobbyData.teams.map((team) => team.teamScore),
  );
  const winningTeams = lobbyData.teams.filter(
    (team) => team.teamScore === highestScore,
  );
  const winningTeam = winningTeams.map((team) => team.teamName).join(" & ");
  const sortedTeams = [...lobbyData.teams].sort(
    (a, b) => b.teamScore - a.teamScore,
  );
  const status = gameOverMusicState.status;

  return (
    <section className="gameFinale" aria-label="Game results">
      <div
        className="finalePresentation"
        key={celebrationRun}
        data-celebration-run={celebrationRun}
        data-finale-started={hasStarted}
      >
        <Celebration intensity="finale" />
        <div className="finaleAnnouncement">
          <div className="finaleTrophy" aria-hidden="true">
            🏆
          </div>
          <div className="finaleRibbon">★ FEUD CHAMPIONS ★</div>
          <div className="winning-text">The winning team is....</div>
          <div className="winner-revel1">with a score of!</div>
          <div className="winner-revel2">
            <span style={{ color: "#ffe548" }}>{highestScore}</span> POINTS!!!
          </div>
          <div className="winner-revel3">{winningTeam} 🎉</div>
        </div>
        <div className="mainTeamContainer">
          {sortedTeams.map((team) => (
            <div className="teamContainer" key={team.teamId}>
              <div
                className={`teamText ${team.teamScore === highestScore ? "" : "runnerUpText"}`}
              >
                {team.teamScore === highestScore
                  ? `Congratulations to ${team.teamName}!`
                  : `A big hand for ${team.teamName}!`}
              </div>
              <div className="team-table">
                <strong>Final Score: </strong>
                <strong className="finalScoreBoard">
                  {team.teamScore.toString().padStart(4, "0")}
                </strong>
                <ul className="player-table">
                  {lobbyData.players
                    .filter((player) => player.teamId === team.teamId)
                    .map((player) => (
                      <li className="playerNameLi" key={player.socketId}>
                        {player.playerName}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="finaleControls">
        <div className="finaleAudio" data-music-status={status}>
          {status === "loading" && (
            <p role="status">Cueing the celebration music…</p>
          )}
          {status === "blocked" && (
            <p role="status">Tap below to start the celebration music.</p>
          )}
          {status === "error" && (
            <p role="status">
              Celebration music could not play. {gameOverMusicState.error}
            </p>
          )}
          {status === "playing" ? (
            <button
              key="stop"
              type="button"
              data-game-audio-control
              onClick={stopGameOver}
            >
              Stop celebration music
            </button>
          ) : (
            <button
              key="play"
              type="button"
              data-game-audio-control
              onClick={retryGameOver}
            >
              {status === "ended"
                ? "Play the victory music again!"
                : "Play celebration music"}
            </button>
          )}
          {!hasStarted && (status === "blocked" || status === "error") && (
            <button
              type="button"
              data-game-audio-control
              onClick={() => {
                stopGameOver();
                setCelebrationRun((run) => run + 1);
                setHasStarted(true);
              }}
            >
              Continue without music
            </button>
          )}
        </div>
        <div className="finaleLobby">
          {isLobbyHost ? (
            <LoadingButton buttonText="Back to lobby" onClick={returnToLobby} />
          ) : (
            <p>Ready for a rematch? Your host can take everyone back to the lobby.</p>
          )}
        </div>
      </div>
    </section>
  );
}
