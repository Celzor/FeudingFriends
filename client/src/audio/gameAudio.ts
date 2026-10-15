const soundFiles = {
  correct: "correct.mp3",
  correct1: "correct1.mp3",
  correct2: "correct2.mp3",
  correct3: "correct3.mp3",
  wrong: "Fail.mp3",
  wrong1: "wrong1.mp3",
  wrong2: "wrong2.mp3",
  tooLong: "wrong3.mp3",
  wrong4: "wrong4.mp3",
  wrong5: "boi mario.mp3",
  applause: "applauseshort.mp3",
  gasp: "gasp.mp3",
  gasp2: "gasp2.mp3",
  endingMusic: "endingMusic.mp3",
} as const;

export type SoundName = keyof typeof soundFiles;
export type SoundOptions = { onStart?: () => void };
export type MusicStatus =
  "idle" | "loading" | "blocked" | "playing" | "ended" | "error";
export type MusicState = { status: MusicStatus; error?: string };
type PreparedSound = { buffer: AudioBuffer; offset: number };
type MusicController = {
  stop: () => void;
  retry: () => void;
  tryStart: () => void;
};

let context: AudioContext | undefined;
let setupError: string | undefined;
let gestureOwners = 0;
let activeMusic: MusicController | undefined;
let musicState: MusicState = { status: "idle" };
let lastStarted: { name: SoundName; time: number; offset: number } | undefined;
const prepared = new Map<SoundName, PreparedSound>();
const pending = new Map<SoundName, Promise<PreparedSound>>();
const failures = new Map<SoundName, string>();

function audioContext() {
  if (!context) {
    const Constructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Constructor)
      throw new Error("This browser does not support game audio.");
    context = new Constructor();
    context.addEventListener("statechange", () => activeMusic?.tryStart());
  }
  return context;
}

// Several original MP3s contain up to a second of silence before their sting.
// Keep those assets intact, but start at their first audible 5 ms window.
function audibleOffset(buffer: AudioBuffer) {
  const windowSize = Math.max(1, Math.floor(buffer.sampleRate * 0.005));
  const limit = Math.min(buffer.length, buffer.sampleRate * 2);
  const channels = Array.from(
    { length: buffer.numberOfChannels },
    (_, channel) => buffer.getChannelData(channel),
  );
  for (let start = 0; start < limit; start += windowSize) {
    for (const channel of channels) {
      let energy = 0;
      const end = Math.min(start + windowSize, channel.length);
      for (let sample = start; sample < end; sample++)
        energy += channel[sample] ** 2;
      if (Math.sqrt(energy / (end - start)) > 0.004)
        return Math.max(0, start / buffer.sampleRate - 0.005);
    }
  }
  return 0;
}

function prepareSound(name: SoundName): Promise<PreparedSound> {
  if (prepared.has(name)) return Promise.resolve(prepared.get(name)!);
  if (!pending.has(name)) {
    const promise = (async () => {
      const audio = audioContext();
      const url = `${import.meta.env.BASE_URL}sounds/${encodeURIComponent(soundFiles[name])}`;
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(
          `Could not load ${soundFiles[name]} (${response.status}).`,
        );
      const buffer = await audio.decodeAudioData(await response.arrayBuffer());
      // The victory track is a timed reveal: retain its intro so the final
      // fanfare still lands on the original seven-second winner cue.
      const value = {
        buffer,
        offset: name === "endingMusic" ? 0 : audibleOffset(buffer),
      };
      prepared.set(name, value);
      failures.delete(name);
      return value;
    })().catch((error) => {
      failures.set(
        name,
        error instanceof Error ? error.message : "Could not load sound.",
      );
      pending.delete(name);
      throw error;
    });
    pending.set(name, promise);
  }
  return pending.get(name)!;
}

export function preloadGameAudio() {
  // Decode once in the lobby, rather than separately for every answer button.
  return Promise.allSettled(
    (Object.keys(soundFiles) as SoundName[]).map(prepareSound),
  );
}

export function unlockGameAudio() {
  try {
    const audio = audioContext();
    if (audio.state !== "running") {
      // Resume is invoked directly in the trusted pointer/keyboard event stack.
      void audio
        .resume()
        .then(() => activeMusic?.tryStart())
        .catch(() => {});
      const silent = audio.createBufferSource();
      silent.buffer = audio.createBuffer(1, 1, audio.sampleRate);
      silent.connect(audio.destination);
      silent.onended = () => silent.disconnect();
      silent.start();
    } else activeMusic?.tryStart();
  } catch (error) {
    setupError =
      error instanceof Error
        ? error.message
        : "Could not initialize game audio.";
  }
}

function unlockOnGesture(event: Event) {
  // These buttons unlock explicitly in onClick. Resuming here could change a
  // Play button into Stop between pointerdown and click, cancelling that tap.
  if (
    event
      .composedPath()
      .some(
        (node) =>
          node instanceof Element &&
          node.hasAttribute("data-game-audio-control"),
      )
  )
    return;
  unlockGameAudio();
}

export function initializeGameAudio() {
  const events = ["pointerdown", "touchend", "keydown"] as const;
  if (gestureOwners++ === 0) {
    for (const event of events)
      document.addEventListener(event, unlockOnGesture, {
        capture: true,
        passive: true,
      });
  }
  void preloadGameAudio();
  return () => {
    if (--gestureOwners === 0)
      for (const event of events)
        document.removeEventListener(event, unlockOnGesture, true);
  };
}

function startSource(name: SoundName, value: PreparedSound, volume: number) {
  const audio = audioContext();
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  source.buffer = value.buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(audio.destination);
  source.addEventListener(
    "ended",
    () => {
      source.disconnect();
      gain.disconnect();
    },
    { once: true },
  );
  source.start(0, value.offset);
  lastStarted = { name, time: performance.now(), offset: value.offset };
  return source;
}

export function playGameSound(name: SoundName, options: SoundOptions = {}) {
  let played = false;
  try {
    const value = prepared.get(name);
    if (value && context?.state === "running") {
      startSource(
        name,
        value,
        ["correct", "correct1", "correct2", "correct3"].includes(name)
          ? 0.4
          : 0.2,
      );
      played = true;
    }
  } catch {
    /* A blocked sting must never postpone the matching visual. */
  }
  // Exactly once, including the silent fallback. Never queue stale SFX.
  options.onStart?.();
  return played;
}

export function requestGameOverMusic(onState: (state: MusicState) => void) {
  activeMusic?.stop();
  let stopped = false;
  let source: AudioBufferSourceNode | undefined;
  let value: PreparedSound | undefined;
  const update = (state: MusicState) => {
    if (stopped) return;
    musicState = state;
    onState(state);
  };
  const controller: MusicController = {
    tryStart() {
      if (stopped || source || !value) return;
      if (context?.state !== "running") {
        update({ status: "blocked" });
        return;
      }
      try {
        source = startSource("endingMusic", value, 0.4);
        const playingSource = source;
        source.addEventListener(
          "ended",
          () => {
            if (source === playingSource) update({ status: "ended" });
          },
          { once: true },
        );
        update({ status: "playing" });
      } catch (error) {
        update({
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Could not play celebration music.",
        });
      }
    },
    retry() {
      if (stopped) return;
      if (source) {
        const previous = source;
        source = undefined;
        previous.stop();
      }
      update({ status: "loading" });
      // Called directly by the retry button, so autoplay restrictions can clear.
      unlockGameAudio();
      void prepareSound("endingMusic")
        .then((sound) => {
          value = sound;
          controller.tryStart();
        })
        .catch((error) =>
          update({
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Could not load celebration music.",
          }),
        );
    },
    stop() {
      stopped = true;
      source?.stop();
      source = undefined;
      if (activeMusic === controller) {
        activeMusic = undefined;
        musicState = { status: "idle" };
      }
    },
  };
  activeMusic = controller;
  update({ status: "loading" });
  void prepareSound("endingMusic")
    .then((sound) => {
      value = sound;
      controller.tryStart();
    })
    .catch((error) =>
      update({
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Could not load celebration music.",
      }),
    );
  return controller;
}

// Inspect readiness and actual playback without starting a clip.
export function getGameAudioState() {
  return {
    context: context?.state || "uninitialized",
    ready: [...prepared.keys()],
    failures: Object.fromEntries(failures),
    setupError,
    music: musicState,
    lastStarted,
  };
}
