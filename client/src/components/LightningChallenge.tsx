import React, { useContext, useEffect, useState } from "react";
import { DataContext } from "../providers/DataProvider";
import { socket } from "../socket";
import { challengeTarget } from "../../../shared/challenge";
export default function LightningChallenge() {
  const { lobbyData, teamBuzzIn } = useContext(DataContext);
  const challenge = lobbyData.lightningChallenge;
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(id);
  }, []);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let active = true;
    void (async () => {
      const start = Date.now();
      try {
        const r = await socket
          .timeout(5000)
          .emitWithAck("message", { type: "ping" });
        if (active) setOffset(r.data.time - (start + Date.now()) / 2);
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);
  if (!challenge) return null;
  const elapsed = now + offset - challenge.startedAt;
  const step =
    challenge.mode === "reaction"
      ? 0
      : Math.max(
          0,
          Math.floor(elapsed / (challenge.mode === "moles" ? 1100 : 900)),
        );
  const target = challengeTarget(challenge.seed, step);
  const ready =
    elapsed >= 0 &&
    (challenge.mode !== "reaction" ||
      elapsed >= 1800 + (challenge.seed % 2200));
  const titles = {
    chase: "Catch the buzzer!",
    moles: "Whack the buzzer!",
    reaction: "Wait for green… then GO!",
  };
  const tap = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await teamBuzzIn({ step, target });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className={`lightningChallenge challenge-${challenge.mode}`}
      aria-label={titles[challenge.mode]}
    >
      <h2>{titles[challenge.mode]}</h2>
      <p>
        {elapsed < 0
          ? "Get ready…"
          : challenge.mode === "moles"
            ? "Hit the glowing hole before it moves."
            : challenge.mode === "chase"
              ? "It won’t stay still. Catch it!"
              : "Keep your nerve. First valid buzz wins."}
      </p>
      <div
        className="challengeArena"
        tabIndex={0}
        role="group"
        aria-label="Buzzer arena; press Space or Enter to catch the active target"
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            (event.key === " " || event.key === "Enter")
          ) {
            event.preventDefault();
            void tap();
          }
        }}
      >
        {challenge.mode === "moles" ? (
          <div className="moleGrid">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                className={`moleHole ${i === target && ready ? "activeHole" : ""}`}
                key={i}
              >
                {i === target && (
                  <button
                    aria-label="Buzzer"
                    className="challengeTarget"
                    disabled={!ready || busy}
                    onClick={tap}
                  >
                    {ready ? "⚡" : "…"}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <button
            aria-label="Buzzer"
            className={`challengeTarget ${challenge.mode === "reaction" ? "reactionTarget" : ""}`}
            style={
              challenge.mode === "chase"
                ? {
                    left: `${8 + (target % 3) * 32}%`,
                    top: `${8 + Math.floor(target / 3) * 30}%`,
                  }
                : undefined
            }
            disabled={!ready || busy}
            onClick={tap}
          >
            {ready
              ? challenge.mode === "reaction"
                ? "GO!"
                : "⚡ BUZZ!"
              : "WAIT"}
          </button>
        )}
      </div>
      <small>
        Touch, click, or focus the arena and press Space. First team in gets the
        question.
      </small>
    </section>
  );
}
