import React, {
  useEffect,
  useLayoutEffect,
  useContext,
  useRef,
  useState,
} from "react";
import ConfettiExplosion from "react-confetti-explosion";
import "../scss/buttonAnimation.scss";
import type { IAnswerType } from "../../../types";

import { DataContext } from "../providers/DataProvider";

import useGameSounds from "../hooks/useGameSounds";

const animations = [
  "green-wipe",
  "rainbow-1",
  "rainbow-2",
  "rainbow-3",
  "rainbow-4",
  "rainbow-5",
  "pulse",
];

type IAnswerButtonProps = {
  answer: IAnswerType;
  onClick: () => void;
  index: number;
  roundEnd: boolean;
};

export function AnswerButton({
  answer,
  onClick,
  index,
  roundEnd,
}: IAnswerButtonProps) {
  const { lobbyData, isLobbyHost } = useContext(DataContext);

  const [isExploding, setIsExploding] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [animation, setAnimation] = useState("");

  const { playRandomCorrectSound } = useGameSounds();
  const previouslySelected = useRef(Boolean(answer.answerSelected));
  const soundSeed = useRef(lobbyData.randomSeed);

  useLayoutEffect(() => {
    // Start audio after the animated button and confetti have committed;
    // generating the confetti before that commit can otherwise delay visuals.
    if (isClicked) playRandomCorrectSound(soundSeed.current);
  }, [isClicked]);

  useEffect(() => {
    const newlySelected = answer.answerSelected && !previouslySelected.current;
    previouslySelected.current = Boolean(answer.answerSelected);
    if (roundEnd || !newlySelected) return;
    soundSeed.current = lobbyData.randomSeed;
    setIsExploding(
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    setAnimation(
      animations[Math.floor(lobbyData.randomSeed * animations.length)] ||
        animations[0],
    );
    setIsClicked(true);
    const timer = setTimeout(() => {
      setAnimation("");
      setIsClicked(false);
      setIsExploding(false);
    }, 1400);
    return () => clearTimeout(timer);
  }, [answer.answerSelected, roundEnd]);

  const buttonDisabled = !isLobbyHost || answer.answerSelected || roundEnd;

  const displayQuestion = roundEnd || answer.answerSelected || isLobbyHost;
  const buttonBackgroundColor = answer.answerSelected
    ? "green"
    : buttonDisabled
      ? "gray"
      : "#c498ff";

  return (
    <button
      className={`answerButton ${animation} ${isClicked ? "clicked" : ""}`}
      disabled={buttonDisabled}
      onClick={onClick}
      style={{
        backgroundColor: buttonBackgroundColor,
      }}
    >
      {isExploding && (
        <ConfettiExplosion
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 100,
            pointerEvents: "none",
          }}
          particleCount={120}
          particleSize={5}
          force={0.6}
        />
      )}
      <span className="indexCircle">{index + 1}</span>
      <span className="text">
        {displayQuestion && `${answer.answerText} `}
        {!displayQuestion && `❓ ❓ ❓`}
        {answer.answerSelected && "✔️🥳"}
      </span>
      <span className="score">
        {displayQuestion &&
          answer.answerScore != null &&
          `${answer?.answerScore?.toString().padStart(2, "0")}`}
      </span>
    </button>
  );
}

export function WrongAnswerButton({ onClick, roundEnd }) {
  const { isLobbyHost } = useContext(DataContext);

  return (
    <div className="wrongAnswerButtonContainer">
      {isLobbyHost && (
        <button className="wrongAnswerButton" onClick={onClick}>
          ❌WRONG ANSWER❌
        </button>
      )}
    </div>
  );
}
