import type { ReactNode } from "react";
import {
  Avatar,
  Box,
  Button,
  Paper,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Link as RouterLink } from "react-router-dom";

// fixed, so the rows of the cards standing side by side line up
const ROW_HEIGHT = 44;

/**
 * The plain count: a new post's grey pin on the map, a shade lighter so the
 * bars stay quieter than the names. Still dark enough to tell from bronze.
 */
export const COUNT_COLOR = "#767676";

// the top three wear the metals of the post cards' frames (PostCard.css)
const medals = [
  {
    background: "linear-gradient(135deg, #f5e6b8 0%, #d4a843 50%, #c49530 100%)",
    color: "#4a3508",
  },
  {
    background: "linear-gradient(135deg, #e6e9ef 0%, #a8b0bc 50%, #8a929e 100%)",
    color: "#262b33",
  },
  {
    background: "linear-gradient(135deg, #e8c8a0 0%, #c49264 50%, #a87040 100%)",
    color: "#3b220c",
  },
];

export interface LegendItem {
  label: string;
  color: string;
  /** the plain bulk: drawn as dots, so it recedes behind the coloured parts */
  dotted?: boolean;
  /** what the colour stands for, on hover */
  hint?: string;
}

export interface Segment extends LegendItem {
  value: number;
}

// dots run like a route on a map; every whole dot, none cut at the end
function fill({ color, dotted }: LegendItem) {
  return dotted
    ? {
        backgroundImage: `radial-gradient(circle, ${color} 1.5px, transparent 2px)`,
        backgroundSize: "6px 100%",
        backgroundRepeat: "space no-repeat",
      }
    : { bgcolor: color, borderRadius: "3px" };
}

function Swatch({ item }: Readonly<{ item: LegendItem }>) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        width: 12,
        height: 5,
        flexShrink: 0,
        ...fill(item),
      }}
    />
  );
}

function Rank({ rank }: Readonly<{ rank: number }>) {
  const medal = medals[rank - 1];
  return (
    <Box
      sx={{
        width: 24,
        height: 24,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontSize: "0.8rem",
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        ...(medal ?? { color: "text.secondary" }),
      }}
    >
      {rank}
    </Box>
  );
}

/** The value split into its segments, across `share` of the row. */
function Bar({
  segments,
  share,
}: Readonly<{ segments: Segment[]; share: number }>) {
  const shown = segments.filter((s) => s.value > 0);
  return (
    <Box
      aria-hidden
      sx={{
        display: "flex",
        gap: "2px",
        width: `${share * 100}%`,
        height: 5,
        mt: 0.5,
      }}
    >
      {shown.map((s) => (
        <Box
          key={s.label}
          sx={{
            flex: `${s.value} 1 0px`,
            // so a single find still shows
            minWidth: s.dotted ? 6 : 2,
            ...fill(s),
          }}
        />
      ))}
    </Box>
  );
}

/** The segments as a small table, for a row's tooltip. */
export function Breakdown({
  segments,
  note,
}: Readonly<{ segments: Segment[]; note?: string }>) {
  return (
    <Box sx={{ fontSize: "0.8rem" }}>
      <Box
        component="table"
        sx={{
          borderCollapse: "collapse",
          "& td": { p: 0, py: "1px" },
          "& td + td": { pl: 1 },
        }}
      >
        <tbody>
          {segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <tr key={s.label}>
                <td>
                  <Swatch item={s} />
                </td>
                <td>{s.label}</td>
                <Box
                  component="td"
                  sx={{
                    textAlign: "right",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.value}
                </Box>
              </tr>
            ))}
        </tbody>
      </Box>
      {note && <Box sx={{ mt: 0.75, color: "text.secondary" }}>{note}</Box>}
    </Box>
  );
}

export function UserAvatar({
  src,
  login,
}: Readonly<{ src?: string; login: string }>) {
  return (
    <Avatar
      src={src}
      alt=""
      sx={{
        width: 28,
        height: 28,
        fontSize: "0.85rem",
        bgcolor: "grey.200",
        color: "text.secondary",
      }}
    >
      {login.charAt(0).toUpperCase()}
    </Avatar>
  );
}

const rowSx = {
  display: "grid",
  gridTemplateColumns: "24px 28px minmax(0, 1fr)",
  columnGap: 1.25,
  alignItems: "center",
  height: ROW_HEIGHT,
  px: 1,
  mx: -1,
  borderRadius: 2,
  color: "inherit",
  textDecoration: "none",
} as const;

interface LeaderboardRowProps {
  rank: number;
  avatar: ReactNode;
  name: string;
  value: number;
  /**
   * the leader's value, to draw the bar as long as the value against it;
   * without it every bar fills the row and shows only the split
   */
  max?: number;
  segments: Segment[];
  to?: string;
  details?: ReactNode;
}

export function LeaderboardRow({
  rank,
  avatar,
  name,
  value,
  max,
  segments,
  to,
  details,
}: Readonly<LeaderboardRowProps>) {
  const content = (
    <>
      <Rank rank={rank} />
      {avatar}
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: "0.9rem" }}>
            {name}
          </Typography>
          <Typography
            sx={{
              fontSize: "0.95rem",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </Typography>
        </Box>
        <Bar segments={segments} share={max ? value / max : 1} />
      </Box>
    </>
  );

  const row = to ? (
    <Box
      component={RouterLink}
      to={to}
      sx={{
        ...rowSx,
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": {
          outline: (theme) => `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
      }}
    >
      {content}
    </Box>
  ) : (
    <Box sx={rowSx}>{content}</Box>
  );

  return (
    <li>
      {details ? (
        <Tooltip
          title={details}
          placement="top-end"
          enterDelay={300}
          enterNextDelay={300}
          slotProps={{
            tooltip: {
              sx: {
                bgcolor: "background.paper",
                color: "text.primary",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: 3,
                p: 1.25,
              },
            },
          }}
        >
          {row}
        </Tooltip>
      ) : (
        row
      )}
    </li>
  );
}

function Legend({ items }: Readonly<{ items: LegendItem[] }>) {
  return (
    <Box
      component="ul"
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        mt: 1.5,
        display: "flex",
        flexWrap: "wrap",
        columnGap: 1.5,
        rowGap: 0.5,
      }}
    >
      {items.map((item) => (
        <Tooltip key={item.label} title={item.hint ?? ""} arrow>
          <Box
            component="li"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              fontSize: "0.75rem",
              color: "text.secondary",
            }}
          >
            <Swatch item={item} />
            {item.label}
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

interface LeaderboardCardProps {
  title: string;
  /** what the number in each row counts */
  subtitle: string;
  legend?: LegendItem[];
  viewAllLink: string;
  viewAllLabel: string;
  loading: boolean;
  size?: number;
  children: ReactNode;
}

export function LeaderboardCard({
  title,
  subtitle,
  legend,
  viewAllLink,
  viewAllLabel,
  loading,
  size = 10,
  children,
}: Readonly<LeaderboardCardProps>) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Typography component="h2" sx={{ fontSize: "1.25rem", fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" noWrap sx={{ mb: 1.5 }}>
        {subtitle}
      </Typography>

      <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {loading
          ? Array.from({ length: size }, (_, i) => (
              <li key={i}>
                <Skeleton
                  variant="rounded"
                  height={ROW_HEIGHT - 12}
                  sx={{ my: "6px" }}
                />
              </li>
            ))
          : children}
      </Box>

      {legend && <Legend items={legend} />}

      <Box sx={{ mt: "auto", pt: 2, textAlign: "center" }}>
        <Button
          component={RouterLink}
          to={viewAllLink}
          endIcon={<ArrowForwardIcon />}
        >
          {viewAllLabel}
        </Button>
      </Box>
    </Paper>
  );
}
