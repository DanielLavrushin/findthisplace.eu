import { useId } from "react";
import "./Postmark.css";

interface Props {
  /** when the place was found (ISO date) */
  date: string;
  /** country name for the lower arc */
  place?: string;
  /** varies the angle and the ink wear from card to card */
  seed: number;
}

const WAVE_ROWS = [30, 40, 50, 60, 70];

// eight sine-like humps from the left edge up to the ring
function wave(y: number) {
  return `M 2 ${y} q 6.5 -6 13 0 t 13 0 t 13 0 t 13 0 t 13 0 t 13 0 t 13 0 t 13 0`;
}

/**
 * Cancellation postmark over the stamp of a solved card: a date ring with
 * wavy lines running onto the photo, printed in worn ink.
 */
export default function Postmark({ date, place, seed }: Readonly<Props>) {
  const id = `pm${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const label = place?.toUpperCase();
  // hand-stamped: every card gets its own slight angle and wear
  const tilt = ((seed * 37) % 19) - 12;
  const style = {
    "--postmark-tilt": `${tilt}deg`,
    "--wear-x": `${(seed * 53) % 90}px`,
    "--wear-y": `${(seed * 29) % 90}px`,
  } as React.CSSProperties;

  return (
    <svg
      className="post-card__postmark"
      viewBox="0 0 200 100"
      aria-hidden="true"
      style={style}
    >
      <defs>
        <path id={`${id}top`} d="M 116 50 A 34 34 0 0 1 184 50" />
        <path id={`${id}bottom`} d="M 109 50 A 41 41 0 0 0 191 50" />
      </defs>
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        {WAVE_ROWS.map((y) => (
          <path key={y} d={wave(y)} strokeWidth="2.2" />
        ))}
        <circle cx="150" cy="50" r="45" strokeWidth="2.6" />
        <circle cx="150" cy="50" r="27" strokeWidth="1.4" />
      </g>
      <g fill="currentColor">
        <text fontSize="10.5" letterSpacing="1.6">
          <textPath href={`#${id}top`} startOffset="50%" textAnchor="middle">
            НАЙДЕНО
          </textPath>
        </text>
        {label && (
          <text fontSize="8.5" letterSpacing="1">
            <textPath
              href={`#${id}bottom`}
              startOffset="50%"
              textAnchor="middle"
              {...(label.length > 16
                ? { textLength: 116, lengthAdjust: "spacingAndGlyphs" }
                : {})}
            >
              {label}
            </textPath>
          </text>
        )}
        <text x="150" y="51" fontSize="15" fontWeight="700" textAnchor="middle">
          {day}·{month}
        </text>
        <text x="150" y="65" fontSize="10" textAnchor="middle">
          {d.getFullYear()}
        </text>
      </g>
    </svg>
  );
}
