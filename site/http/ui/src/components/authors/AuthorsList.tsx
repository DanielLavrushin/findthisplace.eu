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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Author, useAuthors } from "./useAuthors";
import { formatDuration } from "../../utils/formatDuration";
import markerIcon from "../../../assets/marker.png";

const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

const ROW_HEIGHT = 56;
const VIRTUALIZE_THRESHOLD = 50;

interface AuthorsListProps {
  limit?: number;
  title?: string;
}

function AuthorRow({ a, i }: { a: Author; i: number }) {
  const solvedPct =
    a.author_posts_total > 0
      ? Math.round((a.author_posts_found / a.author_posts_total) * 100)
      : 0;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "28px 32px 1fr auto auto auto",
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
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: i < 3 ? "1.25rem" : "1rem",
          textAlign: "center",
          color: i < 3 ? medalColors[i] : "text.disabled",
        }}
      >
        {i + 1}
      </Typography>

      <Avatar
        src={a.avatar_url}
        alt={a.login}
        sx={{
          width: 32,
          height: 32,
          border: i < 3 ? `2px solid ${medalColors[i]}` : "2px solid",
          borderColor: i < 3 ? undefined : "divider",
        }}
      />

      <Typography
        noWrap
        sx={{
          fontWeight: i < 3 ? 700 : 400,
          fontSize: "0.9rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {a.login}
      </Typography>

      <Tooltip title="Всего постов" arrow>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <img src={markerIcon} alt="" width={16} height={16} />
          <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
            {a.author_posts_total}
          </Typography>
        </Box>
      </Tooltip>

      <Tooltip
        title={`Разгадано ${a.author_posts_found} из ${a.author_posts_total}`}
        arrow
      >
        <Chip
          size="small"
          icon={<CheckCircleIcon sx={{ fontSize: 13 }} />}
          label={`${solvedPct}%`}
          sx={{
            height: 22,
            bgcolor:
              solvedPct >= 75
                ? "#4caf5018"
                : solvedPct >= 50
                  ? "#ff980018"
                  : "#f4433618",
            border: `1px solid ${solvedPct >= 75 ? "#4caf5040" : solvedPct >= 50 ? "#ff980040" : "#f4433640"}`,
            color:
              solvedPct >= 85
                ? "#4caf50"
                : solvedPct >= 65
                  ? "#ff9800"
                  : "#f44336",
            fontWeight: 700,
            fontSize: "0.75rem",
            width: 64,
            justifyContent: "center",
            "& .MuiChip-label": { px: 0.5 },
          }}
        />
      </Tooltip>

      <Tooltip title="Среднее время разгадки" arrow>
        <Chip
          size="small"
          icon={<AccessTimeIcon sx={{ fontSize: 13 }} />}
          label={
            a.avg_author_time > 0 ? formatDuration(a.avg_author_time) : "—"
          }
          variant="outlined"
          sx={{
            height: 22,
            justifySelf: "end",
            color: "text.secondary",
            borderColor: "divider",
            fontSize: "0.75rem",
            "& .MuiChip-label": { px: 0.5 },
          }}
        />
      </Tooltip>
    </Box>
  );
}

function VirtualizedList({ authors }: { authors: Author[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useWindowVirtualizer({
    count: authors.length,
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
        const a = authors[virtualRow.index];
        return (
          <Box
            key={a.id}
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start - (listRef.current?.offsetTop ?? 0)}px)`,
            }}
          >
            <AuthorRow a={a} i={virtualRow.index} />
          </Box>
        );
      })}
    </Box>
  );
}

export default function AuthorsList({ limit, title }: AuthorsListProps) {
  const { data: authors = [] } = useAuthors(limit);

  if (authors.length === 0) return null;

  const useVirtual = authors.length > VIRTUALIZE_THRESHOLD;

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
        <VirtualizedList authors={authors} />
      ) : (
        <Stack spacing={0.5}>
          {authors.map((a, i) => (
            <AuthorRow key={a.id} a={a} i={i} />
          ))}
        </Stack>
      )}
    </Paper>
  );
}
