import { useState, useEffect } from "react";
import {
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Avatar,
  Link,
  Paper,
  Divider,
  Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProblematicPost } from "./useProblematicPosts";
import markerIcon from "../../../assets/marker.png";

interface PostEditorProps {
  post: ProblematicPost;
  onClose: () => void;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface CommentUser {
  id: number;
  login: string;
  avatar_url: string | null;
  karma: number;
  deleted: boolean;
}

interface Comment {
  id: number;
  body: string;
  rating: number;
  created: number;
  tree_level: number;
  parent_id: number | null;
  user: CommentUser;
}

interface CommentsResponse {
  comments: Comment[];
}

const customIcon = new L.Icon({
  iconUrl: markerIcon,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Parse lat/lng from string, validate ranges
function parseLatLng(latStr: string, lngStr: string): Coordinates | null {
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

function extractFromQuery(rawUrl: string): Coordinates | null {
  try {
    const parsed = new URL(rawUrl);
    const isYandex = parsed.host.includes("yandex");

    // Yandex uses lng,lat format
    if (isYandex) {
      for (const key of ["ll", "pt", "sll"]) {
        const val = parsed.searchParams.get(key);
        if (val) {
          const parts = val.split(",");
          if (parts.length === 2) {
            return parseLatLng(parts[1], parts[0]); // lat, lng (reversed from val)
          }
        }
      }
    }

    // Google and others use lat,lng format
    for (const key of ["ll", "q", "query"]) {
      const val = parsed.searchParams.get(key);
      if (val) {
        const parts = val.split(",");
        if (parts.length === 2) {
          return parseLatLng(parts[0], parts[1]);
        }
      }
    }
  } catch {
    // Invalid URL, continue with regex extraction
  }
  return null;
}

// Parse coordinates from various map URL formats (mirrors geo.go logic)
function parseMapUrl(rawUrl: string): Coordinates | null {
  if (!rawUrl.trim()) return null;

  // Decode URL-encoded characters first
  let url: string;
  try {
    url = decodeURIComponent(rawUrl);
  } catch {
    url = rawUrl;
  }

  // Try query parameter extraction first (handles encoded URLs properly)
  const fromQuery = extractFromQuery(rawUrl);
  if (fromQuery) return fromQuery;

  // Google Maps: @lat,lng
  const googleAt = url.match(
    /google\.[a-z.]+\/maps[^\s]*@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  );
  if (googleAt) {
    return parseLatLng(googleAt[1], googleAt[2]);
  }

  // Google Maps: !3d{lat}!4d{lng}
  const googleData = url.match(
    /google\.[a-z.]+\/maps[^\s]*!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
  );
  if (googleData) {
    return parseLatLng(googleData[1], googleData[2]);
  }

  // Google Maps search: /search/lat,lng
  const googleSearch = url.match(
    /google\.[a-z.]+\/maps\/search\/(-?\d+\.?\d*),\+?(-?\d+\.?\d*)/,
  );
  if (googleSearch) {
    return parseLatLng(googleSearch[1], googleSearch[2]);
  }

  // Yandex Maps: ll=lng,lat (on decoded URL)
  const yandexLl = url.match(
    /yandex\.[a-z.]+\/maps[^\s]*[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  );
  if (yandexLl) {
    return parseLatLng(yandexLl[2], yandexLl[1]); // Yandex is lng,lat
  }

  // Yandex Maps: pt=lng,lat
  const yandexPt = url.match(
    /yandex\.[a-z.]+\/maps[^\s]*[?&]pt=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  );
  if (yandexPt) {
    return parseLatLng(yandexPt[2], yandexPt[1]); // Yandex is lng,lat
  }

  // Bing Maps: cp=lat~lng
  const bingCp = url.match(
    /bing\.com\/maps[^\s]*[?&]cp=(-?\d+\.?\d*)~(-?\d+\.?\d*)/,
  );
  if (bingCp) {
    return parseLatLng(bingCp[1], bingCp[2]);
  }

  // OpenStreetMap: #map=zoom/lat/lng
  const osmHash = url.match(
    /openstreetmap\.org[^\s]*#map=\d+\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/,
  );
  if (osmHash) {
    return parseLatLng(osmHash[1], osmHash[2]);
  }

  // OpenStreetMap: ?mlat=lat&mlon=lng
  const osmMLat = url.match(/openstreetmap\.org[^\s]*[?&]mlat=(-?\d+\.?\d*)/);
  const osmMLon = url.match(/openstreetmap\.org[^\s]*[?&]mlon=(-?\d+\.?\d*)/);
  if (osmMLat && osmMLon) {
    return parseLatLng(osmMLat[1], osmMLon[1]);
  }

  // Generic fallback: two decimal numbers that look like coordinates
  const genericCoords = url.match(
    /(-?\d{1,3}\.\d{4,})[,\s/]+(-?\d{1,3}\.\d{4,})/,
  );
  if (genericCoords) {
    const num1 = parseFloat(genericCoords[1]);
    const num2 = parseFloat(genericCoords[2]);
    if (Math.abs(num1) <= 90 && Math.abs(num2) <= 180) {
      return { latitude: num1, longitude: num2 };
    }
    if (Math.abs(num2) <= 90 && Math.abs(num1) <= 180) {
      return { latitude: num2, longitude: num1 };
    }
  }

  return null;
}

interface PostUpdateData {
  latitude?: number;
  longitude?: number;
  found_by_id?: number;
  found_date?: number;
}

async function updatePost(id: number, data: PostUpdateData): Promise<void> {
  const res = await fetch(`/api/admin/posts/${id}/edit`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Не удалось сохранить изменения");
  }
}

async function fetchComments(postId: number): Promise<Comment[]> {
  const res = await fetch(
    `https://findthisplace.d3.ru/api/posts/${postId}/comments`,
  );
  if (!res.ok) {
    throw new Error("Не удалось загрузить комментарии");
  }
  const data: CommentsResponse = await res.json();
  return data.comments || [];
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterUpdater({
  lat,
  lng,
}: {
  lat: number | null;
  lng: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null) {
      map.setView([lat, lng], 14);
    }
  }, [map, lat, lng]);
  return null;
}

export default function PostEditor({
  post: initialPost,
  onClose,
}: PostEditorProps) {
  const queryClient = useQueryClient();
  const [post, setPost] = useState<ProblematicPost>(initialPost);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [parseError, setParseError] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);

  useEffect(() => {
    if (!initialPost.title && !initialPost.username) {
      fetch(`/api/posts/${initialPost.id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Не удалось загрузить пост");
          return res.json();
        })
        .then((data: ProblematicPost) => {
          setPost(data);
          if (data.latitude && data.longitude) {
            setLatitude(data.latitude.toString());
            setLongitude(data.longitude.toString());
          }
        })
        .catch(() => {});
    } else {
      setPost(initialPost);
      if (initialPost.latitude && initialPost.longitude) {
        setLatitude(initialPost.latitude.toString());
        setLongitude(initialPost.longitude.toString());
      }
    }
  }, [initialPost]);

  useEffect(() => {
    setLatitude("");
    setLongitude("");
    setMapUrl("");
    setParseError("");
    setSelectedComment(null);
    setCommentsError("");

    // Fetch comments
    setCommentsLoading(true);
    fetchComments(initialPost.id)
      .then(setComments)
      .catch((err) => setCommentsError(err.message))
      .finally(() => setCommentsLoading(false));
  }, [initialPost.id]);

  const mutation = useMutation({
    mutationFn: (data: PostUpdateData) => updatePost(post.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "problematic-posts"],
      });
      onClose();
    },
  });

  const handleParseUrl = () => {
    setParseError("");
    const coords = parseMapUrl(mapUrl);
    if (coords) {
      setLatitude(coords.latitude.toString());
      setLongitude(coords.longitude.toString());
    } else {
      setParseError("Не удалось извлечь координаты из ссылки");
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setLatitude(lat.toFixed(6));
    setLongitude(lng.toFixed(6));
  };

  const handleSave = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return;
    }

    const data: PostUpdateData = { latitude: lat, longitude: lng };
    if (selectedComment) {
      data.found_by_id = selectedComment.user.id;
      data.found_date = selectedComment.created;
    }

    mutation.mutate(data);
  };

  const handleSelectComment = (comment: Comment) => {
    if (selectedComment?.id === comment.id) {
      setSelectedComment(null);
      return;
    }
    setSelectedComment(comment);

    // Try to parse coordinates from comment body
    // Decode HTML entities first (e.g., &amp; -> &)
    const decoded = comment.body
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    // Extract URLs from the comment body (handles both plain text and <a href="...">)
    const urlRegex = /https?:\/\/[^\s<>"]+/g;
    const urls = decoded.match(urlRegex) || [];
    for (const url of urls) {
      const coords = parseMapUrl(url);
      if (coords) {
        setLatitude(coords.latitude.toString());
        setLongitude(coords.longitude.toString());
        break;
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const parsedLat = parseFloat(latitude);
  const parsedLng = parseFloat(longitude);
  const hasValidCoords = !isNaN(parsedLat) && !isNaN(parsedLng);
  const isValid =
    latitude && longitude && hasValidCoords && selectedComment !== null;

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h6">Редактирование поста #{post.id}</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={onClose}>
          Назад к списку
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {/* Left side: Post info and inputs */}
        <Box sx={{ flex: "1 1 300px", minWidth: 280 }}>
          {/* Post info */}
          <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
            {post.main_image_url && (
              <Avatar
                src={post.main_image_url}
                variant="rounded"
                sx={{ width: 80, height: 80 }}
              />
            )}
            <Box sx={{ flex: 1 }}>
              {post.title && (
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {post.title}
                </Typography>
              )}
              {post.username && (
                <Typography variant="body2" color="text.secondary">
                  Автор: {post.username}
                </Typography>
              )}
              <Link
                href={`https://findthisplace.d3.ru/${post.id}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
              >
                Открыть на d3.ru
                <OpenInNewIcon sx={{ fontSize: 14 }} />
              </Link>
            </Box>
          </Box>

          {/* Map URL parser */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Вставьте ссылку на карту
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="https://yandex.ru/maps/... или Google Maps"
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
            />
            <Button
              variant="outlined"
              onClick={handleParseUrl}
              disabled={!mapUrl}
            >
              Извлечь
            </Button>
          </Box>
          {parseError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {parseError}
            </Alert>
          )}

          {/* Coordinate inputs */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Координаты
          </Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <TextField
              label="Широта (Lat)"
              size="small"
              fullWidth
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="53.902443"
              type="number"
              inputProps={{ step: "any" }}
            />
            <TextField
              label="Долгота (Lng)"
              size="small"
              fullWidth
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="27.556216"
              type="number"
              inputProps={{ step: "any" }}
            />
          </Box>

          {mutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(mutation.error as Error).message}
            </Alert>
          )}

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={onClose}>Отмена</Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!isValid || mutation.isPending}
              startIcon={
                mutation.isPending ? <CircularProgress size={16} /> : null
              }
            >
              Сохранить
            </Button>
          </Box>
          {selectedComment && (
            <Alert severity="info" sx={{ mt: 2 }}>
              При сохранении будет установлен:{" "}
              <strong>{selectedComment.user.login}</strong> (ID:{" "}
              {selectedComment.user.id}) как нашедший, дата:{" "}
              <strong>{formatDate(selectedComment.created)}</strong>
            </Alert>
          )}
        </Box>

        {/* Right side: Map */}
        <Box sx={{ flex: "1 1 400px", minWidth: 300 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Карта (кликните для установки координат)
          </Typography>
          <Box
            sx={{
              height: 350,
              borderRadius: 1,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <MapContainer
              key={post.id}
              center={hasValidCoords ? [parsedLat, parsedLng] : [50, 30]}
              zoom={hasValidCoords ? 14 : 4}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler onMapClick={handleMapClick} />
              {hasValidCoords && (
                <>
                  <MapCenterUpdater lat={parsedLat} lng={parsedLng} />
                  <Marker position={[parsedLat, parsedLng]} icon={customIcon} />
                </>
              )}
            </MapContainer>
          </Box>
          {hasValidCoords && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              {parsedLat.toFixed(6)}, {parsedLng.toFixed(6)}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Comments section */}
      <Box sx={{ mt: 3 }}>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
          Комментарии
          {selectedComment && (
            <Chip
              label={`Выбран: ${selectedComment.user.login}`}
              color="primary"
              size="small"
              icon={<CheckCircleIcon />}
              onDelete={() => setSelectedComment(null)}
              sx={{ ml: 2 }}
            />
          )}
        </Typography>

        {commentsLoading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Загрузка комментариев...
            </Typography>
          </Box>
        )}

        {commentsError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {commentsError}
          </Alert>
        )}

        {!commentsLoading && !commentsError && comments.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Комментариев нет
          </Typography>
        )}

        {!commentsLoading && comments.length > 0 && (
          <Paper variant="outlined" sx={{ maxHeight: 400, overflow: "auto" }}>
            {comments.map((comment) => (
              <Box
                key={comment.id}
                onClick={() => handleSelectComment(comment)}
                sx={{
                  p: 1.5,
                  pl: 1.5 + comment.tree_level * 3,
                  cursor: "pointer",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  bgcolor:
                    selectedComment?.id === comment.id
                      ? "action.selected"
                      : "transparent",
                  "&:hover": {
                    bgcolor:
                      selectedComment?.id === comment.id
                        ? "action.selected"
                        : "action.hover",
                  },
                  "&:last-child": {
                    borderBottom: "none",
                  },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Avatar
                    src={comment.user.avatar_url || undefined}
                    sx={{ width: 24, height: 24, fontSize: 12 }}
                  >
                    {comment.user.login[0]?.toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {comment.user.login}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(comment.created)}
                  </Typography>
                  <Chip
                    label={
                      comment.rating > 0 ? `+${comment.rating}` : comment.rating
                    }
                    size="small"
                    color={
                      comment.rating > 0
                        ? "success"
                        : comment.rating < 0
                          ? "error"
                          : "default"
                    }
                    sx={{ height: 20, fontSize: 11 }}
                  />
                  {selectedComment?.id === comment.id && (
                    <CheckCircleIcon
                      color="primary"
                      sx={{ fontSize: 18, ml: "auto" }}
                    />
                  )}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    wordBreak: "break-word",
                    "& img": { maxWidth: 200, maxHeight: 150 },
                  }}
                  dangerouslySetInnerHTML={{ __html: comment.body }}
                />
              </Box>
            ))}
          </Paper>
        )}
      </Box>
    </Box>
  );
}
