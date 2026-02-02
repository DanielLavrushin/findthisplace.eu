import { Box, CircularProgress, Typography } from "@mui/material";
import PostCard from "./PostCard";
import { useNotFoundPosts } from "./useNotFoundPosts";
import { plural } from "../../utils/plural";

export default function PostCardList() {
  const { data: posts, isLoading, error } = useNotFoundPosts();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" sx={{ py: 4 }}>
        Не удалось загрузить загадки
      </Typography>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4 }}>
        Нет ненайденных загадок
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        У нас тут {plural(posts.length, "загадка")}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        и мы пока не знаем, где это
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
        py: 2,
      }}
    >
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </Box>
    </Box>
  );
}
