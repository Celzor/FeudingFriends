import React, { useContext } from "react";
import { DataContext } from "../providers/DataProvider";
export default function Countdown() {
  const { roundSecondsLeft, lobbyData } = useContext(DataContext);
  if (roundSecondsLeft == null || !lobbyData.config.timerSeconds) return null;
  const ratio = Math.min(
    1,
    Math.max(0, roundSecondsLeft / (lobbyData.config.timerSeconds * 1000)),
  );
  return (
    <div className="countdownWell">
      <div
        role="timer"
        aria-label={`${Math.ceil(roundSecondsLeft / 1000)} seconds remaining`}
        data-testid="countdown"
        className={`countdown ${ratio <= 0.25 ? "countdownUrgent" : ""}`}
        style={{
          color: `hsl(${Math.round(ratio * 120)} 75% 58%)`,
          transform: `scale(${1 + (1 - ratio) * 0.65})`,
        }}
      >
        {Math.ceil(roundSecondsLeft / 1000)}
        <span className="countdownUnit">s</span>
      </div>
      <span className="countdownLabel">
        {roundSecondsLeft === 0 ? "Time’s up!" : "Make it count!"}
      </span>
      <div className="countdownTrack">
        <div
          style={{
            width: `${ratio * 100}%`,
            background: `hsl(${Math.round(ratio * 120)} 75% 58%)`,
          }}
        />
      </div>
    </div>
  );
}
