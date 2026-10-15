import type { CSSProperties } from "react";
import "../scss/celebration.scss";

type PartyStyle = CSSProperties & Record<`--${string}`, string | number>;
const colors = ["#ffe548", "#d5a0ff", "#ff83ca", "#91f5df", "#fff5c2"];

export default function Celebration({
  intensity = "round",
}: {
  intensity?: "round" | "finale";
}) {
  const finale = intensity === "finale";
  const burstCount = finale ? 12 : 6;
  const confettiCount = finale ? 96 : 48;
  return (
    <div
      className={`celebration celebration--${intensity}`}
      aria-hidden="true"
      data-celebration={intensity}
    >
      {finale && <div className="celebrationSpotlight" />}
      {finale && (
        <div className="celebrationExplosion">
          {Array.from({ length: 180 }, (_, piece) => {
            // Two cannons send a full-screen volley across the winner reveal.
            const fromLeft = piece % 2 === 0;
            const distance = 18 + ((piece * 17) % 83);
            const height = 32 + ((piece * 29) % 64);
            return (
              <i
                className="celebrationExplosionParticle"
                key={piece}
                style={
                  {
                    left: fromLeft ? "0%" : "100%",
                    backgroundColor: colors[piece % colors.length],
                    borderRadius: piece % 4 === 0 ? "50%" : "1px",
                    "--launch-x": `${fromLeft ? distance : -distance}vw`,
                    "--launch-y": `${-height}vh`,
                    "--launch-turn": `${piece % 2 ? "-" : ""}${540 + (piece % 7) * 180}deg`,
                    "--launch-duration": `${3.8 + (piece % 11) * 0.16}s`,
                    "--piece-width": `${7 + (piece % 5) * 2}px`,
                  } as PartyStyle
                }
              />
            );
          })}
        </div>
      )}
      {Array.from({ length: burstCount }, (_, burst) => (
        <div
          className="celebrationFirework"
          key={`burst-${burst}`}
          style={
            {
              left: `${10 + ((burst * 37) % 81)}%`,
              top: `${8 + ((burst * 23) % 59)}%`,
              "--burst-delay": `${-burst * 0.43}s`,
              "--party-color": colors[burst % colors.length],
            } as PartyStyle
          }
        >
          {Array.from({ length: 16 }, (_, spark) => {
            const angle = (spark / 16) * Math.PI * 2;
            const distance = 9 + (burst % 3) * 3;
            return (
              <i
                key={spark}
                style={
                  {
                    "--spark-x": `${Math.cos(angle) * distance}vmin`,
                    "--spark-y": `${Math.sin(angle) * distance}vmin`,
                  } as PartyStyle
                }
              />
            );
          })}
        </div>
      ))}
      {Array.from({ length: confettiCount }, (_, piece) => (
        <i
          className="celebrationConfetti"
          key={`confetti-${piece}`}
          style={
            {
              left: `${(piece * 31.7) % 100}%`,
              backgroundColor: colors[piece % colors.length],
              borderRadius: piece % 3 === 0 ? "50%" : "1px",
              "--fall-duration": `${3.5 + (piece % 9) * 0.27}s`,
              "--fall-delay": `${-(piece % 17) * 0.37}s`,
              "--confetti-drift": `${((piece % 7) - 3) * 3}vw`,
              "--confetti-turn": `${piece % 2 ? "-" : ""}${360 + (piece % 5) * 180}deg`,
            } as PartyStyle
          }
        />
      ))}
      {finale &&
        Array.from({ length: 10 }, (_, index) => (
          <span
            className="celebrationFloater"
            key={`trophy-${index}`}
            style={
              {
                left: `${4 + index * 10}%`,
                "--float-delay": `${-index * 0.81}s`,
              } as PartyStyle
            }
          >
            {["🏆", "⭐", "🎉", "👑", "💛"][index % 5]}
          </span>
        ))}
    </div>
  );
}
