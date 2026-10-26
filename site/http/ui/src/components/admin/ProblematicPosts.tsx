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
  Avatar,
  IconButton,
  Tooltip,
  TextField,
  Button,
  Chip,
  type ChipProps,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditIcon from "@mui/icons-material/Edit";
import {
  useProblematicPosts,
  type ProblematicPost,
  type ProblemReason,
} from "./useProblematicPosts";
import PostEditor from "./PostEditor";
import { plural } from "../../utils/plural";

// what each reason means and where it gets fixed, in the order the filter shows them
const REASONS: Record<
  ProblemReason,
  { label: string; hint: string; color: ChipProps["color"] }
> = {
  no_coords: {
    label: "Нет координат",
    hint: "Отмечены [НАЙДЕНО], но без точки на карте. Координаты ставятся здесь, в редакторе.",
    color: "error",
  },
  no_place_tags: {
    label: "Нет тегов места",
    hint: "Найдены, но без тегов страны и города, поэтому их нет на страницах стран и городов. Теги ставят модераторы на d3.ru.",
    color: "warning",
  },
  stale_not_found: {
    label: "Найден, но «не найдено»",
    hint: "Отмечены [НАЙДЕНО], но тег «не найдено» не снят. Снимите его на d3.ru.",
    color: "warning",
  },
  no_status_tag: {
    label: "Нет тега «не найдено»",
    hint: "Не найдены, но без тега «не найдено», поэтому их нет среди загадок, которые ждут своего часа. Тег ставят модераторы на d3.ru.",
    color: "info",
  },
};
const REASON_ORDER = Object.keys(REASONS) as ProblemReason[];

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
  const [reason, setReason] = useState<ProblemReason | null>(null);

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

  const counts = useMemo(() => {
    const c: Partial<Record<ProblemReason, number>> = {};
    for (const p of posts ?? []) {
      for (const r of p.reasons ?? []) c[r] = (c[r] ?? 0) + 1;
    }
    return c;
  }, [posts]);
  const shown = useMemo(
    () =>
      reason ? (posts ?? []).filter((p) => p.reasons?.includes(reason)) : posts ?? [],
    [posts, reason],
  );

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
        Проблемных постов: {posts.length}
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
        <Chip
          label={`Все · ${posts.length}`}
          color={reason === null ? "primary" : "default"}
          variant={reason === null ? "filled" : "outlined"}
          onClick={() => setReason(null)}
        />
        {REASON_ORDER.filter((r) => counts[r]).map((r) => (
          <Chip
            key={r}
            label={`${REASONS[r].label} · ${counts[r]}`}
            color={reason === r ? REASONS[r].color : "default"}
            variant={reason === r ? "filled" : "outlined"}
            onClick={() => setReason(r)}
          />
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {reason
          ? `${plural(shown.length, "пост")}. ${REASONS[reason].hint}`
          : "Посты, у которых не сходятся отметка о находке, координаты или теги. Причина указана у каждого."}
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
              <TableCell sx={{ fontWeight: 700 }}>Причина</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Автор</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Дата</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((post) => (
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
                      maxWidth: 280,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={post.title}
                  >
                    {post.title || "Без названия"}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", maxWidth: 280 }}
                  >
                    {post.tags?.length ? post.tags.join(", ") : "без тегов"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(post.reasons ?? []).map((r) => (
                      <Chip
                        key={r}
                        size="small"
                        variant="outlined"
                        color={REASONS[r]?.color ?? "default"}
                        label={REASONS[r]?.label ?? r}
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={post.username}
                  >
                    {post.username}
                  </Typography>
                </TableCell>
                <TableCell>{formatDate(post.created_date)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Открыть на d3.ru">
                    <IconButton
                      size="small"
                      component="a"
                      href={`https://findthisplace.d3.ru/${post.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <OpenInNewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Открыть в редакторе">
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
