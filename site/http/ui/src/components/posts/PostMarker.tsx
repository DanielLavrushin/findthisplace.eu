import { Box } from "@mui/material";
import { Marker, Popup } from "react-leaflet";
import L, { type LatLngExpression } from "leaflet";
import type { NotFoundPost } from "./useNotFoundPosts";
import PostCard from "./PostCard";
import { tierMarkers } from "./cardUtils";
import "./PostMarker.css";

const tierIcons = tierMarkers.map(
  (iconUrl) =>
    new L.Icon({
      iconUrl,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    }),
);

interface Props {
  post: NotFoundPost;
  position: LatLngExpression;
}

/**
 * A post's pin on the map. It opens onto the post's collectible card, which
 * tilts under the pointer and pops out into the showcase like a grid card.
 * Give the map the `post-map` class: the card sizes itself to the map.
 */
export default function PostMarker({ post, position }: Readonly<Props>) {
  return (
    <Marker position={position} icon={tierIcons[post.tier] ?? tierIcons[0]}>
      <Popup
        className="post-marker-popup"
        // clear of the zoom buttons on the left, room above for the card to
        // lift on hover, and below for its pin
        autoPanPaddingTopLeft={[52, 16]}
        autoPanPaddingBottomRight={[16, 40]}
      >
        {/* the map sets its own type; the card is set in the site's */}
        <Box className="post-marker__card" sx={{ typography: "body1" }}>
          <PostCard post={post} />
        </Box>
      </Popup>
    </Marker>
  );
}
