import { useMemo, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Link,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { MapContainer, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCountries } from "../components/countries/useCountries";
import Flag from "../components/countries/Flag";
import { useTagDetail } from "../components/tags/useTagDetail";
import TagFacts from "../components/tags/TagFacts";
import { TagAuthors, TagSearchers } from "../components/tags/TagLeaders";
import PostsByYear from "../components/tags/PostsByYear";
import RelatedTags from "../components/tags/RelatedTags";
import { tagName } from "../components/tags/tagName";
import PostCard from "../components/posts/PostCard";
import PostMarker from "../components/posts/PostMarker";
import { tierMarkers } from "../components/posts/cardUtils";
import { TIERS } from "../components/leaderboard/Leaderboard";
import { formatDuration } from "../utils/formatDuration";
import { plural } from "../utils/plural";
import markerIcon from "../../assets/marker.png";

const PAGE_SIZE = 24;

function hasCoords(p: { latitude?: number; longitude?: number }) {
  return (
    !!p.latitude &&
    !!p.longitude &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}

/**
 * Where most of the places are, not all of them: one mistyped coordinate
 * (lat and lng swapped, a place tagged with the wrong country) would
 * otherwise zoom the map out to the whole world.
 */
function coreBounds(points: [number, number][]): L.LatLngBounds {
  if (points.length < 20) return L.latLngBounds(points);
  const lats = points.map((p) => p[0]).sort((a, b) => a - b);
  const lngs = points.map((p) => p[1]).sort((a, b) => a - b);
  const at = (sorted: number[], q: number) =>
    sorted[Math.round(q * (sorted.length - 1))];
  return L.latLngBounds(
    [at(lats, 0.02), at(lngs, 0.02)],
    [at(lats, 0.98), at(lngs, 0.98)],
  );
}

const crumbSx = {
  display: "inline-flex",
  alignItems: "center",
  gap: 0.5,
  color: "text.secondary",
  textDecoration: "none",
  "&:hover": { color: "text.primary" },
} as const;

/** A country, a city or any other tag: its places, and who set and found them. */
export default function TagDetailPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  // a fresh page for each tag: the map takes its bounds only once
  return <TagProfile key={slug} slug={slug} />;
}

function TagProfile({ slug }: Readonly<{ slug: string }>) {
  const { data: tag, isLoading, error } = useTagDetail(slug);
  const { data: countries = [] } = useCountries();
  const [activeTier, setActiveTier] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const posts = useMemo(() => tag?.posts ?? [], [tag]);

  const tierCounts = useMemo(() => {
    const counts = TIERS.map(() => 0);
    for (const p of posts) counts[p.tier] = (counts[p.tier] ?? 0) + 1;
    return counts;
  }, [posts]);

  // the rarest first, as on an author's page; the latest find first within a tier
  const shown = useMemo(
    () =>
      posts
        .filter((p) => activeTier === null || p.tier === activeTier)
        .sort((a, b) => b.tier - a.tier),
    [posts, activeTier],
  );

  const bounds = useMemo(() => {
    const points = posts
      .filter(hasCoords)
      .map((p) => [p.latitude!, p.longitude!] as [number, number]);
    return points.length > 0 ? coreBounds(points) : null;
  }, [posts]);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !tag) {
    return (
      <Typography color="error" sx={{ py: 4 }}>
        Такой метки нет
      </Typography>
    );
  }

  const rank = tag.code ? countries.findIndex((c) => c.slug === tag.slug) + 1 : 0;
  const timed = posts.filter((p) => p.found_date && p.created_date);
  const avgWait =
    timed.length > 0
      ? timed.reduce(
          (sum, p) =>
            sum +
            (new Date(p.found_date!).getTime() -
              new Date(p.created_date).getTime()) /
              1000,
          0,
        ) / timed.length
      : 0;

  const chooseTier = (tier: number | null) => {
    setActiveTier(tier);
    setLimit(PAGE_SIZE);
  };

  return (
    <Box>
      <Breadcrumbs aria-label="Навигационная цепочка" sx={{ mb: 2, fontSize: "0.875rem" }}>
        <Link component={RouterLink} to="/tags" sx={crumbSx}>
          <ArrowBackIcon sx={{ fontSize: 16 }} />
          Страны
        </Link>
        {tag.parent && (
          <Link component={RouterLink} to={`/tags/${tag.parent.slug}`} sx={crumbSx}>
            {tagName(tag.parent.tag, tag.parent.code)}
          </Link>
        )}
      </Breadcrumbs>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          mb: 3,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 3,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            {tag.code ? (
              <Flag code={tag.code} width={64} />
            ) : (
              <Box
                aria-hidden
                sx={{
                  width: 64,
                  height: 48,
                  borderRadius: "6px",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "action.hover",
                  color: "text.secondary",
                }}
              >
                {tag.parent ? (
                  <PlaceOutlinedIcon fontSize="large" />
                ) : (
                  <LocalOfferOutlinedIcon fontSize="large" />
                )}
              </Box>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {tagName(tag.tag, tag.code)}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
              >
                {tag.code ? (
                  <>
                    {tag.country}
                    {rank > 0 && ` · ${rank}-е место из ${countries.length}`}
                  </>
                ) : tag.parent?.code ? (
                  <>
                    <Flag code={tag.parent.code} width={18} />
                    {tagName(tag.parent.tag, tag.parent.code)}
                  </>
                ) : (
                  "метка"
                )}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1.5,
              alignItems: "center",
            }}
          >
            <Box
              component="button"
              type="button"
              onClick={() => chooseTier(null)}
              disabled={activeTier === null}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                p: 0,
                border: 0,
                background: "none",
                font: "inherit",
                color: "inherit",
                cursor: activeTier === null ? "default" : "pointer",
                opacity: activeTier === null ? 1 : 0.5,
                transition: "opacity 0.2s",
                "&:hover": activeTier === null ? {} : { opacity: 0.8 },
              }}
            >
              <img src={markerIcon} alt="" width={18} height={18} />
              <Typography sx={{ fontWeight: 700 }}>{posts.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                {plural(posts.length, "место", true)}
              </Typography>
            </Box>

            {TIERS.map((tier, t) => {
              if (tierCounts[t] === 0) return null;
              const isActive = activeTier === t;
              return (
                <Tooltip key={tier.label} title={tier.hint} arrow describeChild>
                  <Chip
                    size="small"
                    icon={<img src={tierMarkers[t]} alt="" width={14} height={14} />}
                    label={`${tier.label} ${tierCounts[t]}`}
                    onClick={() => chooseTier(isActive ? null : t)}
                    aria-pressed={isActive}
                    sx={{
                      height: 24,
                      bgcolor: isActive ? `${tier.color}38` : `${tier.color}18`,
                      border: `1px solid ${isActive ? tier.color : `${tier.color}50`}`,
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      opacity: activeTier !== null && !isActive ? 0.45 : 1,
                      transition:
                        "opacity 0.2s, border-color 0.2s, background-color 0.2s",
                      "& .MuiChip-icon": { ml: 0.5 },
                    }}
                  />
                </Tooltip>
              );
            })}

            {avgWait > 0 && (
              <Tooltip title="Сколько в среднем искали место" arrow>
                <Chip
                  size="small"
                  icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                  label={`в среднем ${formatDuration(avgWait)}`}
                  variant="outlined"
                  sx={{
                    height: 24,
                    fontSize: "0.8rem",
                    color: "text.secondary",
                    borderColor: "divider",
                  }}
                />
              </Tooltip>
            )}
          </Box>
        </Box>

        <PostsByYear posts={posts} sx={{ flex: "0 1 360px", minWidth: 220 }} />
      </Paper>

      {posts.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2 }}>
          Здесь пока не нашли ни одного места. Загадайте первое!
        </Typography>
      ) : (
        <>
          <RelatedTags
            title={tag.code ? "Города и другие метки" : "Другие метки"}
            // the country a city is in has the crumb above; every place is in it
            tags={tag.related.filter((r) => r.slug !== tag.parent?.slug)}
          />

          <TagFacts posts={posts} />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              gap: 3,
              mb: 4,
            }}
          >
            <TagSearchers users={tag.searchers} />
            <TagAuthors users={tag.authors} />
          </Box>

          {bounds && (
            <>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Места на карте
              </Typography>
              <Box
                sx={{
                  height: 420,
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  mb: 4,
                }}
              >
                <MapContainer
                  className="post-map"
                  bounds={bounds}
                  boundsOptions={{ padding: [30, 30] }}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {shown.filter(hasCoords).map((post) => (
                    <PostMarker
                      key={post.id}
                      post={post}
                      position={[post.latitude!, post.longitude!]}
                    />
                  ))}
                </MapContainer>
              </Box>
            </>
          )}

          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            {activeTier === null ? "Места" : `Места: ${TIERS[activeTier].label}`}{" "}
            <Typography
              component="span"
              color="text.secondary"
              sx={{ fontWeight: 400, ml: 1 }}
            >
              {shown.length}
            </Typography>
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
            {shown.slice(0, limit).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </Box>

          {shown.length > limit && (
            <Box sx={{ textAlign: "center", mt: 4 }}>
              <Button variant="outlined" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                Показать ещё
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                показано {limit} из {shown.length}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
