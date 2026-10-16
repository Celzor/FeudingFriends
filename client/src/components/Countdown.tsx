import React, { useContext } from "react";
import { DataContext } from "../providers/DataProvider";
import { QUESTION_READING_MS } from "../../../shared/timing";
export default function Countdown() {
  const {
    roundSecondsLeft, lobbyData, questionReadSecondsLeft, isQuestionReading,
    isTimerPaused, isLobbyHost, pauseTimer, resumeTimer,
  } = useContext(DataContext);
  if (!isQuestionReading && roundSecondsLeft == null) return null;
  const remaining = isQuestionReading ? questionReadSecondsLeft : roundSecondsLeft;
  const ratio = Math.min(
    1,
    Math.max(0, remaining / (isQuestionReading ? QUESTION_READING_MS : lobbyData.config.timerSeconds * 1000)),
  );
  const color = isQuestionReading ? "#ffe548" : `hsl(${Math.round(ratio * 120)} 75% 58%)`;
  return (
    <div className={`countdownWell ${isLobbyHost ? "countdownWithControls" : ""}`}>
      <div className="countdownDisplay">
        <div
          role="timer"
          aria-label={`${Math.ceil(remaining / 1000)} seconds ${isQuestionReading ? "to read the question" : "remaining"}${isTimerPaused ? ", paused" : ""}`}
          data-testid="countdown"
          data-timer-phase={isQuestionReading ? "reading" : "answer"}
          className={`countdown ${!isQuestionReading && ratio <= 0.25 ? "countdownUrgent" : ""}`}
          style={{
            color,
            transform: `scale(${isQuestionReading ? 1 : 1 + (1 - ratio) * 0.65})`,
          }}
        >
          <span className="countdownDigits">
            {Math.ceil(remaining / 1000)}
          </span>
          <span className="countdownUnit">s</span>
        </div>
      </div>
      <span className="countdownLabel">
        {isTimerPaused ? "Paused" : isQuestionReading ? "Read the question" : remaining === 0 ? "Time’s up!" : "Make it count!"}
      </span>
      <div className="countdownTrack">
        <div
          style={{
            width: `${ratio * 100}%`,
            background: color,
          }}
        />
      </div>
      {isLobbyHost && (
        <button
          type="button"
          className="timerToggle"
          disabled={!isTimerPaused && !isQuestionReading && remaining === 0}
          aria-label={isTimerPaused ? "Resume timer" : "Pause timer"}
          onClick={isTimerPaused ? resumeTimer : pauseTimer}
        >
          {isTimerPaused ? "Resume" : "Pause"}
        </button>
      )}
    </div>
  );
}
