import React, { useMemo, useEffect, useContext, useState } from "react";
import ConfettiExplosion from "react-confetti-explosion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import "../scss/buttonAnimation.scss";
import {
  IAnswerType,
  IPlayerData,
  IQuestionType,
  ITeamData,
} from "../../../types";

import { DataContext } from "../providers/DataProvider";

import useGameSounds from "../hooks/useGameSounds";

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

  const [isExploding, setIsExploding] = React.useState(false);

  const [isClicked, setIsClicked] = useState(false);
  const [animation, setAnimation] = useState("");

  //const animations = ["rainbow-1", "rainbow-2", "rainbow-3"];

  const { playRandomCorrectSound } = useGameSounds();

  const animations = [
    "animate-spin",
    "green-wipe",
    "rainbow-1",
    "rainbow-2",
    "rainbow-3",
    "rainbow-4",
    "rainbow-5",
    "fill",
    "pulse",
    "close",
    "raise",
    "up",
  ];

  const handleClick = () => {
    const randomAnimation =
      animations[Math.floor(Math.random() * animations.length)];
    setAnimation(randomAnimation);
    setTimeout(() => setAnimation(""), 1000); // Reset after 1 second
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 1000); // Reset after 700ms
    onClick();
  };

  useEffect(() => {
    if (!roundEnd && answer.answerSelected) {
      playRandomCorrectSound(lobbyData.randomSeed);

      setIsExploding(true);

      const randomAnimation =
        animations[Math.floor(Math.random() * animations.length)];

      setAnimation(randomAnimation);
      setTimeout(() => setAnimation(""), 1000); // Reset after 1 second

      setIsClicked(true);
      setTimeout(() => setIsClicked(false), 1000); // Reset after 700ms
    }
  }, [answer.answerSelected]);

  const buttonDisabled = !isLobbyHost || answer.answerSelected || roundEnd;

  const displayQuestion = useMemo<boolean>(() => {
    if (roundEnd) return true;

    if (answer.answerSelected) {
      return true;
    }

    if (isLobbyHost) {
      return true;
    }

    return false;
  }, [answer.answerSelected, isLobbyHost, roundEnd]);

  const buttonBackgroundColor = useMemo<string>(() => {
    //  backgroundColor: buttonDisabled
    // ? "gray"
    // : answer.answerSelected
    // ? "green"
    // : "#c498ff",

    if (answer.answerSelected) return "green";
    if (buttonDisabled) return "gray";
    return "#c498ff";
  }, [answer.answerSelected, isLobbyHost, roundEnd]);

  return (
    <button
      className={`answerButton ${animation} ${isClicked ? "clicked" : ""}`}
      disabled={buttonDisabled}
      onClick={handleClick}
      style={{
        backgroundColor: buttonBackgroundColor,
      }}
    >
      {isExploding && (
        <ConfettiExplosion
          style={{
            // this should be centered on the button
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 100,
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
          answer?.answerScore &&
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
