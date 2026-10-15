import React, { useMemo, useEffect, useContext, useState } from "react";

import { useSound } from "use-sound";

const correctSfx = `${import.meta.env.BASE_URL}sounds/correct.mp3`;
const correct1Sfx = `${import.meta.env.BASE_URL}sounds/correct1.mp3`;
const correct2Sfx = `${import.meta.env.BASE_URL}sounds/correct2.mp3`;
const correct3Sfx = `${import.meta.env.BASE_URL}sounds/correct3.mp3`;

const wrongSfx = `${import.meta.env.BASE_URL}sounds/Fail.mp3`;
const wrong1Sfx = `${import.meta.env.BASE_URL}sounds/wrong1.mp3`;
const wrong2Sfx = `${import.meta.env.BASE_URL}sounds/wrong2.mp3`;
const tooLongWwrong3Sfx = `${import.meta.env.BASE_URL}sounds/wrong3.mp3`;
const wrong4Sfx = `${import.meta.env.BASE_URL}sounds/wrong4.mp3`;
const wrong5Sfx = `${import.meta.env.BASE_URL}sounds/boi mario.mp3`;

const applauseshortSfx = `${import.meta.env.BASE_URL}sounds/applauseshort.mp3`;
const gaspSfx = `${import.meta.env.BASE_URL}sounds/gasp.mp3`;
const gasp2Sfx = `${import.meta.env.BASE_URL}sounds/gasp2.mp3`;
const endingMusicSfx = `${import.meta.env.BASE_URL}sounds/endingMusic.mp3`;

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
