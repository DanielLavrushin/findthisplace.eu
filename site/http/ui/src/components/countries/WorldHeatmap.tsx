import { useMemo, useState } from "react";
import { Box, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
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

// one hue, light to dark, in even steps of lightness (OKLCH L 0.93 → 0.50)
const RAMP = ["#fce3c8", "#f8c696", "#f2a360", "#e47b30", "#cb5a1a", "#a24019"];
// where each shade starts: a country has from one place to over a thousand,
// so each class holds about three times the last
const BREAKS = [1, 3, 11, 31, 101, 301];
const NO_POSTS = "#ededed";
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

function Swatch({ color, label }: Readonly<{ color: string; label: string }>) {
  return (
    <Box
      component="li"
      sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}
    >
      <Box
        sx={{ width: { xs: 46, sm: 56 }, height: 10, borderRadius: "3px", bgcolor: color }}
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
        position: "relative",
        p: { xs: 1.5, sm: 2 },
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
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
            {({ geographies }) =>
              geographies
                .filter((geo) => geo.id !== ANTARCTICA)
                .map((geo) => {
                  const country = byNumId[geo.id];
                  const code = country?.code ?? codeByNumId[geo.id];
                  const name = code ? countryName(code) : geo.properties.name;
                  const fill = country ? RAMP[shadeOf(country.count)] : NO_POSTS;
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
                        stroke="#fff"
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
                            stroke: country ? "#3b1d0a" : "#fff",
                            strokeWidth: (country ? 1.2 : 0.5) / position.zoom,
                            cursor: country ? "pointer" : "default",
                          },
                          pressed: { outline: "none", fill },
                        }}
                      />
                    </Tooltip>
                  );
                })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      <Box
        sx={{
          position: "absolute",
          top: { xs: 8, sm: 12 },
          left: { xs: 8, sm: 12 },
          display: "flex",
          flexDirection: "column",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
          overflow: "hidden",
        }}
      >
        <Tooltip title="Приблизить (или Ctrl + колесо)" placement="right">
          <span>
            <IconButton
              size="small"
              aria-label="Приблизить карту"
              disabled={position.zoom >= MAX_ZOOM}
              onClick={() => zoomBy(1.6)}
              sx={{ borderRadius: 0 }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Отдалить" placement="right">
          <span>
            <IconButton
              size="small"
              aria-label="Отдалить карту"
              disabled={position.zoom <= 1}
              onClick={() => zoomBy(1 / 1.6)}
              sx={{ borderRadius: 0, borderTop: "1px solid", borderColor: "divider" }}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "center",
          columnGap: 2,
          rowGap: 1,
          mt: 1,
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
          <Swatch color={NO_POSTS} label="пока нет" />
        </Box>
      </Box>
    </Paper>
  );
}
