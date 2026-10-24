import ReactCountryFlag from "react-country-flag";

/** A country's flag in its 4:3 frame, `width` pixels across. */
export default function Flag({
  code,
  width = 32,
}: Readonly<{ code: string; width?: number }>) {
  return (
    <ReactCountryFlag
      countryCode={code.toUpperCase()}
      svg
      alt=""
      style={{
        display: "block",
        width,
        height: (width * 3) / 4,
        borderRadius: Math.max(3, Math.round(width / 12)),
        // an edge, or white stripes melt into the card
        boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.12)",
      }}
    />
  );
}
