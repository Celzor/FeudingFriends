import { useCallback, useEffect, useRef, useState } from "react";
import {
  initializeGameAudio,
  playGameSound,
  requestGameOverMusic,
  unlockGameAudio,
  type MusicState,
  type SoundName,
  type SoundOptions,
} from "../audio/gameAudio";

export function useGameAudioPreload() {
  useEffect(initializeGameAudio, []);
}

const playWrong = (options?: SoundOptions) => playGameSound("wrong", options);
const playApplause = (options?: SoundOptions) =>
  playGameSound("applause", options);
const playTooLongWwrong3 = (options?: SoundOptions) =>
  playGameSound("tooLong", options);
const pickSound = (
  names: SoundName[],
  seed: number,
  options?: SoundOptions,
) => {
  const index = Math.min(
    names.length - 1,
    Math.max(0, Math.floor((Number.isFinite(seed) ? seed : 0) * names.length)),
  );
  return playGameSound(names[index], options);
};
const playRandomCorrectSound = (seed: number, options?: SoundOptions) =>
  pickSound(["correct", "correct1", "correct2", "correct3"], seed, options);
const playRandomWrongSound = (seed: number, options?: SoundOptions) =>
  pickSound(["wrong", "wrong1", "wrong2", "wrong4", "wrong5"], seed, options);
const playRandomStealSound = (seed: number, options?: SoundOptions) =>
  pickSound(["gasp", "gasp2"], seed, options);

export default function useGameSounds() {
  const music = useRef<ReturnType<typeof requestGameOverMusic> | null>(null);
  const [gameOverMusicState, setGameOverMusicState] = useState<MusicState>({
    status: "idle",
  });
  const playGameOver = useCallback(() => {
    if (!music.current)
      music.current = requestGameOverMusic(setGameOverMusicState);
    else music.current.retry();
  }, []);
  const retryGameOver = useCallback(() => {
    if (music.current) music.current.retry();
    else {
      music.current = requestGameOverMusic(setGameOverMusicState);
      // A deliberate Play after Stop must also unlock a suspended context.
      unlockGameAudio();
    }
  }, []);
  const stopGameOver = useCallback(() => {
    music.current?.stop();
    music.current = null;
    setGameOverMusicState({ status: "idle" });
  }, []);
  useEffect(
    () => () => {
      music.current?.stop();
      music.current = null;
    },
    [],
  );

  return {
    playWrong,
    playApplause,
    playRandomCorrectSound,
    playRandomWrongSound,
    playRandomStealSound,
    playGameOver,
    retryGameOver,
    stopGameOver,
    gameOverMusicState,
    playTooLongWwrong3,
  };
}
