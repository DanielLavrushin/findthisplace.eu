import { useMemo } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useUserDetail } from "../components/users/useUserDetail";
import PostCard from "../components/posts/PostCard";
import { formatDuration } from "../utils/formatDuration";
import markerIcon from "../../assets/marker.png";
import tire0marker from "../../assets/tire0marker.png";
import tire1marker from "../../assets/tire1marker.png";
import tire2marker from "../../assets/tire2marker.png";
import tire3marker from "../../assets/tire3marker.png";
import tire4marker from "../../assets/tire4marker.png";

const tierIcons = [tire0marker, tire1marker, tire2marker, tire3marker, tire4marker];
const tierLabels = ["< 6 мес", "6м–1г", "1–2г", "2–5л", "5+ лет"];
const tierColors = ["#666666", "#B87333", "#A8A8A8", "#F5A623", "#B044AA"];

export default function SearcherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id) || 0;
  const { data: user, isLoading, error } = useUserDetail(userId);

  const foundPosts = useMemo(
    () => user?.posts.filter((p) => p.role === "finder") ?? [],
    [user],
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !user) {
    return (
      <Typography color="error" sx={{ py: 4 }}>
        Сыщик не найден
      </Typography>
    );
  }

  const tiers = [
    user.found_tier0,
    user.found_tier1,
    user.found_tier2,
    user.found_tier3,
    user.found_tier4,
  ];

  return (
    <Box>
      <Typography
        component={RouterLink}
        to="/searchers"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          mb: 2,
          color: "text.secondary",
          textDecoration: "none",
          fontSize: "0.875rem",
          "&:hover": { color: "text.primary" },
        }}
      >
        <ArrowBackIcon sx={{ fontSize: 16 }} />
        Сыщики
      </Typography>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mb: 2,
          }}
        >
          <Avatar
            src={user.avatar_url}
            alt={user.login}
            sx={{ width: 56, height: 56 }}
          />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {user.login}
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            mt: 2,
            alignItems: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <img src={markerIcon} alt="" width={18} height={18} />
            <Typography sx={{ fontWeight: 700 }}>
              {user.found_tiers_total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              находок
            </Typography>
          </Box>

          {tiers.map((count, ti) => {
            if (count === 0) return null;
            return (
              <Tooltip key={ti} title={tierLabels[ti]} arrow>
                <Chip
                  size="small"
                  icon={<img src={tierIcons[ti]} alt="" width={14} height={14} />}
                  label={count}
                  sx={{
                    height: 24,
                    bgcolor: `${tierColors[ti]}18`,
                    border: `1px solid ${tierColors[ti]}40`,
                    color: tierColors[ti],
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    "& .MuiChip-icon": { ml: 0.5 },
                    "& .MuiChip-label": { px: 0.5 },
                  }}
                />
              </Tooltip>
            );
          })}

          {user.avg_search_time > 0 && (
            <Chip
              size="small"
              icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
              label={formatDuration(user.avg_search_time)}
              variant="outlined"
              sx={{
                height: 24,
                fontSize: "0.8rem",
                color: "text.secondary",
                borderColor: "divider",
              }}
            />
          )}
        </Box>
      </Paper>

      {foundPosts.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Находки
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(auto-fill, minmax(180px, 1fr))",
                sm: "repeat(auto-fill, minmax(220px, 1fr))",
                md: "repeat(4, 1fr)",
              },
              gap: 3,
            }}
          >
            {foundPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
