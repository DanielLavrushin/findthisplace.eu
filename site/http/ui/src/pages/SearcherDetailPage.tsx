import { useMemo, useState } from "react";
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
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useUserDetail } from "../components/users/useUserDetail";
import SearcherStats from "../components/users/SearcherStats";
import PostCard from "../components/posts/PostCard";
import markerIcon from "../../assets/marker.png";
import tire0marker from "../../assets/tire0marker.png";
import tire1marker from "../../assets/tire1marker.png";
import tire2marker from "../../assets/tire2marker.png";
import tire3marker from "../../assets/tire3marker.png";
import tire4marker from "../../assets/tire4marker.png";

const tierIcons = [
  tire0marker,
  tire1marker,
  tire2marker,
  tire3marker,
  tire4marker,
];
const tierLabels = ["< 6 мес", "6м–1г", "1–2г", "2–5л", "5+ лет"];
const tierColors = ["#666666", "#B87333", "#A8A8A8", "#F5A623", "#B044AA"];

const tierLeafletIcons = tierIcons.map(
  (icon) =>
    new L.Icon({
      iconUrl: icon,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    }),
);

export default function SearcherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id) || 0;
  const { data: user, isLoading, error } = useUserDetail(userId);
  const [activeTier, setActiveTier] = useState<number | null>(null);

  const foundPosts = useMemo(() => {
    const all = (user?.posts.filter((p) => p.role === "finder") ?? []).map(
      (p) => ({ ...p, found_by: user?.login }),
    );
    if (activeTier === null) return all;
    return all.filter((p) => p.tier === activeTier);
  }, [user, activeTier]);

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
    { id: "tier0", tier: 0, count: user.found_tier0 },
    { id: "tier1", tier: 1, count: user.found_tier1 },
    { id: "tier2", tier: 2, count: user.found_tier2 },
    { id: "tier3", tier: 3, count: user.found_tier3 },
    { id: "tier4", tier: 4, count: user.found_tier4 },
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              cursor: activeTier === null ? "default" : "pointer",
              opacity: activeTier === null ? 1 : 0.5,
              transition: "opacity 0.2s",
              "&:hover": activeTier === null ? {} : { opacity: 0.8 },
            }}
            onClick={() => setActiveTier(null)}
          >
            <img src={markerIcon} alt="" width={18} height={18} />
            <Typography sx={{ fontWeight: 700 }}>
              {user.found_tiers_total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              находок
            </Typography>
          </Box>

          {tiers.map(({ id, tier, count }) => {
            if (count === 0) return null;
            const isActive = activeTier === tier;
            const isDimmed = activeTier !== null && !isActive;
            return (
              <Tooltip key={id} title={tierLabels[tier]} arrow>
                <Chip
                  size="small"
                  icon={
                    <img src={tierIcons[tier]} alt="" width={14} height={14} />
                  }
                  label={count}
                  onClick={() => setActiveTier(isActive ? null : tier)}
                  sx={{
                    height: 24,
                    bgcolor: isActive
                      ? `${tierColors[tier]}30`
                      : `${tierColors[tier]}18`,
                    border: `1px solid ${isActive ? tierColors[tier] : `${tierColors[tier]}40`}`,
                    color: tierColors[tier],
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    opacity: isDimmed ? 0.4 : 1,
                    cursor: "pointer",
                    transition:
                      "opacity 0.2s, border-color 0.2s, background-color 0.2s",
                    "& .MuiChip-icon": { ml: 0.5 },
                    "& .MuiChip-label": { px: 0.5 },
                  }}
                />
              </Tooltip>
            );
          })}

        </Box>
      </Paper>

      <SearcherStats posts={user.posts} avgSearchTime={user.avg_search_time} />

      {foundPosts.length > 0 && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Найденные локации
          </Typography>

          {(() => {
            const postsWithCoords = foundPosts.filter(
              (p) =>
                p.latitude !== undefined &&
                p.longitude !== undefined &&
                p.latitude !== 0 &&
                p.longitude !== 0,
            );
            if (postsWithCoords.length === 0) return null;

            const bounds = L.latLngBounds(
              postsWithCoords.map((p) => [p.latitude!, p.longitude!]),
            );

            return (
              <Box
                sx={{
                  height: 350,
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  mb: 3,
                }}
              >
                <MapContainer
                  bounds={bounds}
                  boundsOptions={{ padding: [30, 30] }}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {postsWithCoords.map((post) => (
                    <Marker
                      key={post.id}
                      position={[post.latitude!, post.longitude!]}
                      icon={tierLeafletIcons[post.tier] ?? tierLeafletIcons[0]}
                    >
                      <Popup>
                        <Box sx={{ minWidth: 150 }}>
                          {post.main_image_url && (
                            <img
                              src={post.main_image_url}
                              alt=""
                              style={{
                                width: "100%",
                                maxHeight: 100,
                                objectFit: "cover",
                                borderRadius: 4,
                                marginBottom: 8,
                              }}
                            />
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {post.title || `Пост #${post.id}`}
                          </Typography>
                          {post.found_date && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {new Date(post.found_date).toLocaleDateString(
                                "ru-RU",
                              )}
                            </Typography>
                          )}
                        </Box>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </Box>
            );
          })()}

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
