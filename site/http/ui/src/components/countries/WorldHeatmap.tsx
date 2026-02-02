import { useMemo } from "react";
import { Box, Paper, Tooltip, Typography } from "@mui/material";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { scaleLog } from "d3-scale";
import { Country } from "./useCountries";
import geoData from "../../../assets/countries-110m.json";
import alpha2toNum from "../../../assets/alpha2-to-numeric.json";

interface WorldHeatmapProps {
  countries: Country[];
}

export default function WorldHeatmap({ countries }: WorldHeatmapProps) {
  const { countByNumId, nameByNumId, colorScale } = useMemo(() => {
    const cMap: Record<string, number> = {};
    const nMap: Record<string, string> = {};
    const lookup = alpha2toNum as Record<string, string>;
    for (const c of countries) {
      const num = lookup[c.code.toLowerCase()];
      if (num) {
        cMap[num] = c.count;
        nMap[num] = c.country;
      }
    }
    const maxCount = countries.length > 0 ? countries[0].count : 1;
    const scale = scaleLog()
      .domain([1, maxCount])
      .range([0, 1])
      .clamp(true);
    return { countByNumId: cMap, nameByNumId: nMap, colorScale: scale };
  }, [countries]);

  function getFill(numId: string): string {
    const count = countByNumId[numId];
    if (!count) return "#f5f5f5";
    const t = colorScale(count);
    const r = Math.round(255 - t * 50);
    const g = Math.round(243 - t * 140);
    const b = Math.round(224 - t * 200);
    return `rgb(${r},${g},${b})`;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        width: "100%",
        flex: 1,
      }}
    >
      <ComposableMap
        projectionConfig={{ rotate: [-10, 0, 0], scale: 120 }}
        width={800}
        height={380}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup>
          <Geographies geography={geoData}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const numId = geo.id;
                const count = countByNumId[numId];
                const name = nameByNumId[numId] || geo.properties.name;
                return (
                  <Tooltip
                    key={geo.rsmKey}
                    title={count ? `${name}: ${count}` : name}
                    arrow
                  >
                    <Geography
                      geography={geo}
                      fill={getFill(numId)}
                      stroke="#fff"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: {
                          outline: "none",
                          fill: count ? "#f57c00" : "#e0e0e0",
                          cursor: count ? "pointer" : "default",
                        },
                        pressed: { outline: "none" },
                      }}
                    />
                  </Tooltip>
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mt: 1 }}>
        <Typography variant="caption" color="text.secondary">Мало</Typography>
        <Box
          sx={{
            width: 120,
            height: 10,
            borderRadius: 5,
            background: "linear-gradient(90deg, #fff3e0, #e65100)",
          }}
        />
        <Typography variant="caption" color="text.secondary">Много</Typography>
      </Box>
    </Paper>
  );
}
