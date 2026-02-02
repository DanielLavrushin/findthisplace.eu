import { Box, Chip, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import type { UserPost } from "./useUserDetail";

export default function PostRow({ post }: Readonly<{ post: UserPost }>) {
  const created = post.created_date
    ? new Date(post.created_date).toLocaleDateString("ru-RU")
    : "";

  return (
    <Box
      component="a"
      href={`https://findthisplace.d3.ru/${post.id}`}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: "grid",
        gridTemplateColumns: "48px 1fr auto auto",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        textDecoration: "none",
        color: "inherit",
        transition: "background 0.15s",
        "&:hover": { background: "action.hover" },
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "grey.100",
          flexShrink: 0,
        }}
      >
        {post.main_image_url && (
          <img
            src={post.main_image_url}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </Box>

      <Box sx={{ overflow: "hidden" }}>
        <Typography noWrap sx={{ fontSize: "0.9rem", fontWeight: 500 }}>
          {post.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {created}
        </Typography>
      </Box>

      <Chip
        size="small"
        icon={
          post.is_found ? (
            <CheckCircleIcon sx={{ fontSize: 13 }} />
          ) : (
            <CancelIcon sx={{ fontSize: 13 }} />
          )
        }
        label={post.is_found ? "Найдено" : "Не найдено"}
        sx={{
          height: 22,
          fontSize: "0.75rem",
          fontWeight: 600,
          bgcolor: post.is_found ? "#4caf5018" : "#f4433618",
          border: `1px solid ${post.is_found ? "#4caf5040" : "#f4433640"}`,
          color: post.is_found ? "#4caf50" : "#f44336",
          "& .MuiChip-label": { px: 0.5 },
        }}
      />

      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ minWidth: 50, textAlign: "right" }}
      >
        #{post.id}
      </Typography>
    </Box>
  );
}
