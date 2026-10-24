import type { ReactNode } from "react";
import {
  Box,
  Typography,
  useTheme,
  type Breakpoint,
  type SxProps,
  type Theme,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export interface StatCardProps {
  icon: ReactNode;
  value: string;
  label: string;
  sublabel?: string;
  gradient: string;
  /** where the card leads, if anywhere */
  to?: string;
}

export function StatCard({
  icon,
  value,
  label,
  sublabel,
  gradient,
  to,
}: Readonly<StatCardProps>) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const sx = {
    position: "relative",
    display: "block",
    p: 2,
    borderRadius: 3,
    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.7)",
    backdropFilter: "blur(10px)",
    border: "1px solid",
    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    color: "inherit",
    textDecoration: "none",
    overflow: "hidden",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: isDark
        ? "0 8px 32px rgba(0,0,0,0.3)"
        : "0 8px 32px rgba(0,0,0,0.08)",
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    "&::before": {
      content: '""',
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: gradient,
    },
  } as const;

  const content = (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
      <Box sx={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: "1.1rem",
            fontWeight: 800,
            lineHeight: 1.2,
            background: gradient,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {value}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            color: "text.secondary",
            fontWeight: 500,
            mt: 0.25,
            lineHeight: 1.2,
          }}
        >
          {label}
        </Typography>
        {sublabel && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "text.disabled",
              fontSize: "0.7rem",
              lineHeight: 1.2,
            }}
          >
            {sublabel}
          </Typography>
        )}
      </Box>
    </Box>
  );

  return to ? (
    <Box component={RouterLink} to={to} sx={sx}>
      {content}
    </Box>
  ) : (
    <Box sx={sx}>{content}</Box>
  );
}

const COLUMNS: Partial<Record<Breakpoint, string>> = {
  xs: "repeat(2, 1fr)",
  sm: "repeat(3, 1fr)",
  md: "repeat(4, 1fr)",
  lg: "repeat(5, 1fr)",
};

/** A titled grid of fact cards; nothing at all when there are none. */
export default function StatCards({
  title,
  cards,
  columns = COLUMNS,
  sx,
}: Readonly<{
  title: string;
  cards: StatCardProps[];
  columns?: Partial<Record<Breakpoint, string>>;
  sx?: SxProps<Theme>;
}>) {
  if (cards.length === 0) return null;

  return (
    <Box sx={[{ mb: 3 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Typography
        variant="subtitle2"
        sx={{
          mb: 1.5,
          color: "text.secondary",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontSize: "0.7rem",
        }}
      >
        {title}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: columns, gap: 2 }}>
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </Box>
    </Box>
  );
}
