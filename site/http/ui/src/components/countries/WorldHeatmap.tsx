import { useMemo, useState } from "react";
import { Box, Paper, Tooltip, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Country } from "./useCountries";
import { countryName } from "../posts/cardUtils";
import { plural } from "../../utils/plural";
import geoData from "../../../assets/countries-110m.json";
import alpha2toNum from "../../../assets/alpha2-to-numeric.json";

// the OpenStreetMap tiles' own colours (openstreetmap-carto), so this map
// reads as the same map as the ones the places are pinned on
const OSM_WATER = "#aad3df";
const OSM_LAND = "#f2efe9";
const OSM_BORDER = "#8d618b";

// one hue, light to dark, in even steps of lightness (OKLCH L 0.90 → 0.46):
// the green of OSM's woods, clear of its land and water, and of every tier's
// colour in the bars below (bronze, silver, gold, magenta)
const RAMP = ["#c6eaba", "#a4d494", "#81ba6e", "#649e50", "#4e813b", "#3a652a"];
// where each shade starts: a country has from one place to over a thousand,
// so each class holds about three times the last
const BREAKS = [1, 3, 11, 31, 101, 301];
const ANTARCTICA = "010";

const WIDTH = 800;
const HEIGHT = 400;
const MAX_ZOOM = 8;
const HOME = { coordinates: [10, 15] as [number, number], zoom: 1 };

const codeByNumId = Object.fromEntries(
  Object.entries(alpha2toNum as Record<string, string>).map(([code, num]) => [
    num,
    code,
  ]),
);

function shadeOf(count: number): number {
  let i = 0;
  while (i + 1 < BREAKS.length && count >= BREAKS[i + 1]) i++;
  return i;
}

function shadeLabel(i: number): string {
  const next = BREAKS[i + 1];
  if (next === undefined) return `${BREAKS[i]}+`;
  return next - 1 === BREAKS[i] ? `${BREAKS[i]}` : `${BREAKS[i]}–${next - 1}`;
}

// a plain wheel or a one-finger swipe scrolls the page, as it would anywhere
// else; ctrl + wheel, a pinch, a drag and the buttons move the map
function zoomGesture(event: WheelEvent | MouseEvent | TouchEvent): boolean {
  if (event.type === "wheel") return event.ctrlKey || event.metaKey;
  if (event.type === "touchstart") return (event as TouchEvent).touches.length > 1;
  return !(event as MouseEvent).button;
}

// Leaflet's own zoom buttons, as on the other maps
const zoomButtonSx = {
  display: "block",
  width: 30,
  height: 30,
  p: 0,
  border: 0,
  bgcolor: "#fff",
  color: "#000",
  font: "bold 22px 'Lucida Console', Monaco, monospace",
  lineHeight: "30px",
  textAlign: "center",
  cursor: "pointer",
  "&:hover": { bgcolor: "#f4f4f4" },
  "&:disabled": { bgcolor: "#f4f4f4", color: "#bbb", cursor: "default" },
} as const;

function Swatch({ color, label }: Readonly<{ color: string; label: string }>) {
  return (
    <Box
      component="li"
      sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}
    >
      <Box
        sx={{
          width: { xs: 46, sm: 56 },
          height: 10,
          borderRadius: "3px",
          bgcolor: color,
          // an edge, or the pale land melts into the card
          boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.08)",
        }}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          fontSize: { xs: "0.65rem", sm: "0.75rem" },
          lineHeight: 1,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

interface WorldHeatmapProps {
  countries: Country[];
}

export default function WorldHeatmap({ countries }: Readonly<WorldHeatmapProps>) {
  const navigate = useNavigate();
  const [position, setPosition] = useState(HOME);

  const byNumId = useMemo(() => {
    const lookup = alpha2toNum as Record<string, string>;
    const map: Record<string, Country> = {};
    for (const c of countries) {
      const num = lookup[c.code.toLowerCase()];
      if (num) map[num] = c;
    }
    return map;
  }, [countries]);

  const zoomBy = (factor: number) =>
    setPosition((p) => {
      const zoom = Math.min(MAX_ZOOM, p.zoom * factor);
      // all the way out is home again, give or take a float's rounding
      return zoom < 1.01 ? HOME : { ...p, zoom };
    });

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        sx={{
          position: "relative",
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: OSM_WATER,
        }}
      >
        {/* the list of countries below says all the map does, in words */}
        <ComposableMap
          aria-hidden
          projectionConfig={{ rotate: [-10, 0, 0], scale: 155, center: [0, 12] }}
          width={WIDTH}
          height={HEIGHT}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <ZoomableGroup
            center={position.coordinates}
            zoom={position.zoom}
            maxZoom={MAX_ZOOM}
            translateExtent={[
              [0, 0],
              [WIDTH, HEIGHT],
            ]}
            filterZoomEvent={zoomGesture}
            onMoveEnd={setPosition}
          >
            <Geographies geography={geoData}>
              {({ geographies, borders }) => (
                <>
                  {geographies
                    .filter((geo) => geo.id !== ANTARCTICA)
                    .map((geo) => {
                      const country = byNumId[geo.id];
                      const code = country?.code ?? codeByNumId[geo.id];
                      const name = code ? countryName(code) : geo.properties.name;
                      const fill = country ? RAMP[shadeOf(country.count)] : OSM_LAND;
                      return (
                        <Tooltip
                          key={geo.rsmKey}
                          title={
                            country
                              ? `${name} · ${plural(country.count, "место")}`
                              : `${name} · пока ни одного места`
                          }
                          followCursor
                        >
                          <Geography
                            geography={geo}
                            fill={fill}
                            // in its own colour: closes the hairline seams
                            // neighbours leave, which would show the sea through
                            stroke={fill}
                            strokeWidth={0.5 / position.zoom}
                            onClick={
                              country
                                ? () => navigate(`/tags/${country.slug}`)
                                : undefined
                            }
                            style={{
                              default: { outline: "none" },
                              hover: {
                                outline: "none",
                                fill,
                                stroke: country ? "#3d2a3c" : fill,
                                strokeWidth: (country ? 1.2 : 0.5) / position.zoom,
                                cursor: country ? "pointer" : "default",
                              },
                              pressed: { outline: "none", fill },
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  {/* land borders only, as OSM draws them: coasts get no line */}
                  {borders && (
                    <path
                      d={borders.svgPath}
                      fill="none"
                      stroke={OSM_BORDER}
                      strokeOpacity={0.6}
                      strokeWidth={0.6 / position.zoom}
                      strokeLinejoin="round"
                      pointerEvents="none"
                    />
                  )}
                </>
              )}
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            border: "2px solid rgba(0, 0, 0, 0.2)",
            borderRadius: "4px",
            backgroundClip: "padding-box",
            overflow: "hidden",
          }}
        >
          <Box
            component="button"
            type="button"
            title="Приблизить (или Ctrl + колесо)"
            aria-label="Приблизить карту"
            disabled={position.zoom >= MAX_ZOOM}
            onClick={() => zoomBy(1.6)}
            sx={{ ...zoomButtonSx, borderBottom: "1px solid #ccc" }}
          >
            +
          </Box>
          <Box
            component="button"
            type="button"
            title="Отдалить"
            aria-label="Отдалить карту"
            disabled={position.zoom <= 1}
            onClick={() => zoomBy(1 / 1.6)}
            sx={zoomButtonSx}
          >
            −
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "center",
          columnGap: 2,
          rowGap: 1,
          mt: 1.5,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Найдено мест
        </Typography>
        <Box
          component="ul"
          sx={{ display: "flex", gap: "2px", listStyle: "none", m: 0, p: 0 }}
        >
          {RAMP.map((color, i) => (
            <Swatch key={color} color={color} label={shadeLabel(i)} />
          ))}
        </Box>
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
          <Swatch color={OSM_LAND} label="пока нет" />
        </Box>
      </Box>
    </Paper>
  );
}
