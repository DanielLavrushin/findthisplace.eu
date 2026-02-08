import { useRef } from "react";
import {
  Avatar,
  Box,
  Chip,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Link as RouterLink } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Button from "@mui/material/Button";
import markerIcon from "../../../assets/marker.png";
import tire0marker from "../../../assets/tire0marker.png";
import tire1marker from "../../../assets/tire1marker.png";
import tire2marker from "../../../assets/tire2marker.png";
import tire3marker from "../../../assets/tire3marker.png";
import tire4marker from "../../../assets/tire4marker.png";
import { useSearchers } from "./useSearchers";
import { formatDuration } from "../../utils/formatDuration";

const tierIcons = [
  tire0marker,
  tire1marker,
  tire2marker,
  tire3marker,
  tire4marker,
];
const tierLabels = ["< 6 мес", "6м–1г", "1–2г", "2–5л", "5+ лет"];

const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
const tierColors = ["#666666", "#B87333", "#A8A8A8", "#F5A623", "#B044AA"];

const ROW_HEIGHT = 56;
const VIRTUALIZE_THRESHOLD = 50;

interface SearchersListProps {
  limit?: number;
  title?: string;
  viewAllLink?: string;
}

function SearcherRow({
  s,
  i,
}: Readonly<{
  s: ReturnType<typeof useSearchers>["data"] extends (infer T)[] | undefined
    ? T
    : never;
  i: number;
}>) {
  const tierBadges = tierIcons.map((icon, ti) => {
    const count = [
      s.found_tier0,
      s.found_tier1,
      s.found_tier2,
      s.found_tier3,
      s.found_tier4,
    ][ti];
    if (count === 0) return null;
    return (
      <Tooltip key={icon} title={tierLabels[ti]} arrow>
        <Chip
          size="small"
          icon={<img src={icon} alt="" width={12} height={12} />}
          label={count}
          sx={{
            height: 20,
            bgcolor: `${tierColors[ti]}18`,
            border: `1px solid ${tierColors[ti]}40`,
            color: tierColors[ti],
            fontWeight: 700,
            fontSize: "0.7rem",
            "& .MuiChip-icon": { ml: 0.5 },
            "& .MuiChip-label": { px: 0.5 },
          }}
        />
      </Tooltip>
    );
  });

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 0.75,
        borderRadius: 2,
        background:
          i < 3
            ? `linear-gradient(90deg, ${medalColors[i]}18 0%, transparent 60%)`
            : "transparent",
        borderLeft:
          i < 3 ? `4px solid ${medalColors[i]}` : "4px solid transparent",
        transition: "background 0.15s",
        "&:hover": { background: "action.hover" },
      }}
    >
      {/* Rank */}
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: i < 3 ? "1.1rem" : "0.95rem",
          width: 24,
          textAlign: "center",
          color: i < 3 ? medalColors[i] : "text.disabled",
          flexShrink: 0,
          alignSelf: { xs: "flex-start", sm: "center" },
          mt: { xs: 0.5, sm: 0 },
        }}
      >
        {i + 1}
      </Typography>

      {/* Avatar */}
      <Avatar
        src={s.avatar_url}
        alt={s.login}
        sx={{
          width: 32,
          height: 32,
          border: i < 3 ? `2px solid ${medalColors[i]}` : "2px solid",
          borderColor: i < 3 ? undefined : "divider",
          flexShrink: 0,
          alignSelf: { xs: "flex-start", sm: "center" },
          mt: { xs: 0.25, sm: 0 },
        }}
      />

      {/* Main content - responsive layout */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Desktop: single line */}
        <Box
          sx={{
            display: { xs: "none", sm: "flex" },
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Typography
            component={RouterLink}
            to={`/searchers/${s.id}`}
            noWrap
            sx={{
              fontWeight: i < 3 ? 700 : 400,
              fontSize: "0.9rem",
              textDecoration: "none",
              color: "inherit",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {s.login}
          </Typography>

          <Tooltip title="Всего находок" arrow>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <img src={markerIcon} alt="" width={16} height={16} />
              <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
                {s.found_tiers_total}
              </Typography>
            </Box>
          </Tooltip>

          {tierBadges}

          <Tooltip title="Среднее время поиска" arrow>
            <Chip
              size="small"
              icon={<AccessTimeIcon sx={{ fontSize: 12 }} />}
              label={formatDuration(s.avg_search_time)}
              variant="outlined"
              sx={{
                height: 20,
                ml: "auto",
                color: "text.secondary",
                borderColor: "divider",
                fontSize: "0.7rem",
                "& .MuiChip-label": { px: 0.5 },
              }}
            />
          </Tooltip>
        </Box>

        {/* Mobile: two lines */}
        <Box sx={{ display: { xs: "block", sm: "none" } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              component={RouterLink}
              to={`/searchers/${s.id}`}
              noWrap
              sx={{
                fontWeight: i < 3 ? 700 : 400,
                fontSize: "0.9rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textDecoration: "none",
                color: "inherit",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {s.login}
            </Typography>

            <Tooltip title="Всего находок" arrow>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                <img src={markerIcon} alt="" width={16} height={16} />
                <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
                  {s.found_tiers_total}
                </Typography>
              </Box>
            </Tooltip>

            <Tooltip title="Среднее время поиска" arrow>
              <Chip
                size="small"
                icon={<AccessTimeIcon sx={{ fontSize: 12 }} />}
                label={formatDuration(s.avg_search_time)}
                variant="outlined"
                sx={{
                  height: 20,
                  ml: "auto",
                  color: "text.secondary",
                  borderColor: "divider",
                  fontSize: "0.7rem",
                  flexShrink: 0,
                  "& .MuiChip-label": { px: 0.5 },
                }}
              />
            </Tooltip>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
            {tierBadges}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function VirtualizedList({
  searchers,
}: Readonly<{
  searchers: NonNullable<ReturnType<typeof useSearchers>["data"]>;
}>) {
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: searchers.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  return (
    <Box
      ref={listRef}
      sx={{
        height: virtualizer.getTotalSize(),
        position: "relative",
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const s = searchers[virtualRow.index];
        return (
          <Box
            key={s.id}
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start - (listRef.current?.offsetTop ?? 0)}px)`,
            }}
          >
            <SearcherRow s={s} i={virtualRow.index} />
          </Box>
        );
      })}
    </Box>
  );
}

export default function SearchersList({
  limit,
  title,
  viewAllLink,
}: Readonly<SearchersListProps>) {
  const { data: searchers = [] } = useSearchers(limit);

  if (searchers.length === 0) return null;

  const useVirtual = searchers.length > VIRTUALIZE_THRESHOLD;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        width: "100%",
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {title && (
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            mb: 3,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {title}
        </Typography>
      )}

      {useVirtual ? (
        <VirtualizedList searchers={searchers} />
      ) : (
        <Stack spacing={0.5}>
          {searchers.map((s, i) => (
            <SearcherRow key={s.id} s={s} i={i} />
          ))}
        </Stack>
      )}

      {viewAllLink && (
        <Button
          component={RouterLink}
          to={viewAllLink}
          endIcon={<ArrowForwardIcon />}
          sx={{ mt: "auto", pt: 2, display: "flex", mx: "auto" }}
        >
          Смотреть всех
        </Button>
      )}
    </Paper>
  );
}
