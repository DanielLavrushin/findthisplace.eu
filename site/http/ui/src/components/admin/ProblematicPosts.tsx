import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Link,
  Avatar,
  IconButton,
  Tooltip,
  TextField,
  Button,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditIcon from "@mui/icons-material/Edit";
import { useProblematicPosts, type ProblematicPost } from "./useProblematicPosts";
import PostEditor from "./PostEditor";

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("ru-RU");
  } catch {
    return dateStr;
  }
}

export default function ProblematicPosts() {
  const { data: posts, isLoading, error } = useProblematicPosts();
  const navigate = useNavigate();
  const { id: idParam } = useParams();
  const [manualPostId, setManualPostId] = useState("");

  const handleEditManualPost = () => {
    const id = parseInt(manualPostId, 10);
    if (isNaN(id) || id <= 0) return;
    setManualPostId("");
    navigate(`/admin/posts/${id}`);
  };

  // Editor view — driven by the URL so it's deep-linkable and persistent.
  // Prefer the post from the list (full data); otherwise build a minimal
  // object — PostEditor fetches the rest from /api/posts/{id}. Memoized so a
  // background refetch doesn't hand PostEditor a new object and reset edits.
  const editingId = idParam ? parseInt(idParam, 10) : null;
  const editingPost = useMemo<ProblematicPost | null>(() => {
    if (editingId === null || isNaN(editingId)) return null;
    return (
      posts?.find((p) => p.id === editingId) ?? {
        id: editingId,
        title: "",
        main_image_url: "",
        username: "",
        gender: "",
        created_date: "",
        is_found: false,
        tier: 0,
      }
    );
  }, [editingId, posts]);

  if (editingPost) {
    return (
      <PostEditor post={editingPost} onClose={() => navigate("/admin/posts")} />
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Ошибка загрузки: {(error as Error).message}
      </Alert>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <Alert severity="success" sx={{ mb: 2 }}>
        Нет проблемных постов
      </Alert>
    );
  }

  // Show table view
  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
        Найдено {posts.length}{" "}
        {posts.length === 1 ? "пост" : posts.length < 5 ? "поста" : "постов"}{" "}
        без координат
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Эти посты отмечены как найденные, но у них отсутствуют координаты.
        Что-то где-то пошло не так.
      </Typography>

      <Box sx={{ display: "flex", gap: 1, mb: 2, alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="ID поста"
          value={manualPostId}
          onChange={(e) => setManualPostId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEditManualPost()}
          sx={{ width: 150 }}
          type="number"
        />
        <Button
          variant="outlined"
          size="small"
          onClick={handleEditManualPost}
          disabled={!manualPostId}
        >
          Открыть
        </Button>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Изображение</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Название</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Автор</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Дата</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Ссылка</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {posts.map((post) => (
              <TableRow
                key={post.id}
                hover
                sx={{ cursor: "pointer" }}
                onClick={() => navigate(`/admin/posts/${post.id}`)}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {post.id}
                  </Typography>
                </TableCell>
                <TableCell>
                  {post.main_image_url ? (
                    <Avatar
                      src={post.main_image_url}
                      alt={post.title}
                      variant="rounded"
                      sx={{ width: 48, height: 48 }}
                    />
                  ) : (
                    <Avatar variant="rounded" sx={{ width: 48, height: 48 }}>
                      ?
                    </Avatar>
                  )}
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      maxWidth: 300,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={post.title}
                  >
                    {post.title || "Без названия"}
                  </Typography>
                </TableCell>
                <TableCell>{post.username}</TableCell>
                <TableCell>{formatDate(post.created_date)}</TableCell>
                <TableCell>
                  <Link
                    href={`https://findthisplace.d3.ru/${post.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    d3.ru
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </Link>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Редактировать координаты">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/posts/${post.id}`);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
