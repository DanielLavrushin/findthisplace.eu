import { useMemo } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useUserDetail } from "../components/users/useUserDetail";
import PostCard from "../components/posts/PostCard";
import { formatDuration } from "../utils/formatDuration";
import markerIcon from "../../assets/marker.png";

export default function AuthorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id) || 0;
  const { data: user, isLoading, error } = useUserDetail(userId);

  const unsolvedPosts = useMemo(
    () =>
      (
        user?.posts.filter((p) => p.role === "author" && !p.is_found) ?? []
      ).sort((a, b) => b.tier - a.tier),
    [user],
  );

  const solvedPosts = useMemo(
    () =>
      (user?.posts.filter((p) => p.role === "author" && p.is_found) ?? []).sort(
        (a, b) => b.tier - a.tier,
      ),
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
        Автор не найден
      </Typography>
    );
  }

  const solvedPct =
    user.author_posts_total > 0
      ? Math.round((user.author_posts_found / user.author_posts_total) * 100)
      : 0;

  return (
    <Box>
      <Typography
        component={RouterLink}
        to="/authors"
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
        Авторы
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
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <img src={markerIcon} alt="" width={18} height={18} />
            <Typography sx={{ fontWeight: 700 }}>
              {user.author_posts_total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              постов
            </Typography>
          </Box>

          <Chip
            size="small"
            icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
            label={`${solvedPct}% разгадано`}
            sx={{
              height: 24,
              fontWeight: 700,
              fontSize: "0.8rem",
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
            }}
          />

          {user.avg_author_time > 0 && (
            <Chip
              size="small"
              icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
              label={formatDuration(user.avg_author_time)}
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

      {unsolvedPosts.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Не разгаданы
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
              mb: 4,
            }}
          >
            {unsolvedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </Box>
        </>
      )}

      {solvedPosts.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Разгаданы
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
            {solvedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
