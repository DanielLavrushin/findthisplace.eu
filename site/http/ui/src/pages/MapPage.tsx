import { useEffect, useState } from "react";
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import tire0marker from "../../assets/tire0marker.png";
import tire1marker from "../../assets/tire1marker.png";
import tire2marker from "../../assets/tire2marker.png";
import tire3marker from "../../assets/tire3marker.png";
import tire4marker from "../../assets/tire4marker.png";
import SearchersList from "../components/searchers/SearchersList";
import AuthorsList from "../components/authors/AuthorsList";
import CountriesList from "../components/countries/CountriesList";

interface MapPost {
  id: number;
  title: string;
  longitude: number;
  latitude: number;
  username: string;
  main_image_url: string;
  found_date: string;
  tier: number;
}

const periods = [
  { value: "7d", label: "за неделю" },
  { value: "30d", label: "за месяц" },
  { value: "1y", label: "за год" },
] as const;

function FitBounds({ posts }: { posts: MapPost[] }) {
  const map = useMap();
  useEffect(() => {
    if (posts.length === 0) return;
    const bounds = L.latLngBounds(posts.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, posts]);
  return null;
}

const tierIcons = [
  tire0marker,
  tire1marker,
  tire2marker,
  tire3marker,
  tire4marker,
];

const tierLeafletIcons = tierIcons.map(
  (icon) =>
    new L.Icon({
      iconUrl: icon,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    }),
);

export default function MapPage() {
  const [posts, setPosts] = useState<MapPost[]>([]);
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    fetch(`/api/map/posts/${period}`)
      .then((res) => res.json())
      .then((data) => setPosts(data ?? []))
      .catch(console.error);
  }, [period]);

  return (
    <Box>
      <Box
        sx={{
          height: "40vh",
          minHeight: 300,
          width: "100%",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <MapContainer
          center={[50, 30]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds posts={posts} />
          {posts.map((post) => (
            <Marker
              key={post.id}
              position={[post.latitude, post.longitude]}
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
                  {post.username && (
                    <Typography variant="caption" color="text.secondary">
                      {post.username}
                    </Typography>
                  )}
                  {post.found_date && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {new Date(post.found_date).toLocaleDateString("ru-RU")}
                    </Typography>
                  )}
                </Box>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", mt: 2 }}>
        <ToggleButtonGroup
          value={period}
          exclusive
          onChange={(_, v) => {
            if (v) setPeriod(v);
          }}
        >
          {periods.map((p) => (
            <ToggleButton key={p.value} value={p.value}>
              {p.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary" sx={{ ml: "auto" }}>
          Отображается маркеров: {posts.length}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 3, mt: 4, flexWrap: "wrap", alignItems: "stretch" }}>
        <Box sx={{ flex: 1, minWidth: 300, display: "flex" }}>
          <SearchersList limit={10} title="Top 10 Сыщиков" viewAllLink="/searchers" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 300, display: "flex" }}>
          <AuthorsList limit={10} title="Top 10 Авторов" viewAllLink="/authors" />
        </Box>
        <Box sx={{ flex: "0 1 280px", minWidth: 240, display: "flex" }}>
          <CountriesList limit={10} title="ТОП 10 Стран" viewAllLink="/tags" />
        </Box>
      </Box>
    </Box>
  );
}
