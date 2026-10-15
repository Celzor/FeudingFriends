import React, { useMemo, useEffect, useContext, useState } from "react";

import { useSound } from "use-sound";

import correctSfx from "../../public/sounds/correct.mp3";
import correct1Sfx from "../../public/sounds/correct1.mp3";
import correct2Sfx from "../../public/sounds/correct2.mp3";
import correct3Sfx from "../../public/sounds/correct3.mp3";

import wrongSfx from "../../public/sounds/Fail.mp3";
import wrong1Sfx from "../../public/sounds/wrong1.mp3";
import wrong2Sfx from "../../public/sounds/wrong2.mp3";
import tooLongWwrong3Sfx from "../../public/sounds/wrong3.mp3";
import wrong4Sfx from "../../public/sounds/wrong4.mp3";
import wrong5Sfx from "../../public/sounds/boi mario.mp3";

import applauseshortSfx from "../../public/sounds/applauseshort.mp3";
import gaspSfx from "../../public/sounds/gasp.mp3";
import gasp2Sfx from "../../public/sounds/gasp2.mp3";
import endingMusicSfx from "../../public/sounds/endingMusic.mp3";

export default function useGameSounds() {
  const [playCorrect] = useSound(correctSfx, { volume: 0.4 });
  const [playCorrect1] = useSound(correct1Sfx, { volume: 0.4 });
  const [playCorrect2] = useSound(correct2Sfx, { volume: 0.4 });
  const [playCorrect3] = useSound(correct3Sfx, { volume: 0.4 });

  const [playWrong] = useSound(wrongSfx, { volume: 0.2 });
  const [playWrong1] = useSound(wrong1Sfx, { volume: 0.2 });
  const [playWrong2] = useSound(wrong2Sfx, { volume: 0.2 });
  const [playTooLongWwrong3] = useSound(tooLongWwrong3Sfx, { volume: 0.2 });
  const [playWrong4] = useSound(wrong4Sfx, { volume: 0.2 });
  const [playWrong5] = useSound(wrong5Sfx, { volume: 0.2 });

  const [playApplause] = useSound(applauseshortSfx, { volume: 0.2 });

  const [playGasp] = useSound(gaspSfx, { volume: 0.2 });
  const [playGasp2] = useSound(gasp2Sfx, { volume: 0.2 });

  const [playGameOver] = useSound(endingMusicSfx, { volume: 0.4 });

  // for random sound
  const playRandomCorrectSound = function (randSeed: number) {
    const soundFuncs = [playCorrect, playCorrect1, playCorrect2, playCorrect3];

    const selectedSound = soundFuncs[Math.floor(randSeed * soundFuncs.length)];

    selectedSound();
  };

  const playRandomWrongSound = function (randSeed: number) {
    const soundFuncs = [
      playWrong,
      playWrong1,
      playWrong2,
      // playWrong3,
      playWrong4,
      playWrong5,
    ];

    const selectedSound = soundFuncs[Math.floor(randSeed * soundFuncs.length)];

    selectedSound();
  };

  const playRandomStealSound = function (randSeed: number) {
    const soundFuncs = [playGasp, playGasp2];

    const selectedSound = soundFuncs[Math.floor(randSeed * soundFuncs.length)];

    selectedSound();
  };

  return {
    playWrong,
    playApplause,
    playRandomCorrectSound,
    playRandomWrongSound,
    playRandomStealSound,
    playGameOver,
    playTooLongWwrong3,
  };
}
