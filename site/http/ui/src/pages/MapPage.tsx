import { useEffect, useState } from "react";
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import SearchersList from "../components/searchers/SearchersList";
import AuthorsList from "../components/authors/AuthorsList";
import CountriesList from "../components/countries/CountriesList";
import PostMarker from "../components/posts/PostMarker";
import type { NotFoundPost } from "../components/posts/useNotFoundPosts";

type MapPost = NotFoundPost & { latitude: number; longitude: number };

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
          className="post-map"
          center={[50, 30]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds posts={posts} />
          {posts.map((post) => (
            <PostMarker
              key={post.id}
              post={post}
              position={[post.latitude, post.longitude]}
            />
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
