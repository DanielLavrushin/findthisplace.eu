const TILE = 256;
const ZOOM = 13;

interface Props {
  latitude: number;
  longitude: number;
  /** marker image placed on the spot */
  pin: string;
}

/**
 * A small static map: a 3×3 block of OpenStreetMap tiles around the point,
 * shifted so the point lands in the middle of the panel, with a pin on it.
 * Covers panels up to 512px on a side.
 */
export default function MiniMap({ latitude, longitude, pin }: Readonly<Props>) {
  const n = 2 ** ZOOM;
  const lat = (latitude * Math.PI) / 180;
  // the point in tile units (Web Mercator)
  const x = ((longitude + 180) / 360) * n;
  const y = ((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2) * n;
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);

  const tiles = [];
  for (let dy = -1; dy <= 1; dy++) {
    const ty = tileY + dy;
    if (ty < 0 || ty >= n) continue;
    for (let dx = -1; dx <= 1; dx++) {
      const tx = (((tileX + dx) % n) + n) % n;
      tiles.push(
        <img
          key={`${dx},${dy}`}
          src={`https://tile.openstreetmap.org/${ZOOM}/${tx}/${ty}.png`}
          alt=""
          draggable={false}
          style={{ left: (dx + 1) * TILE, top: (dy + 1) * TILE }}
        />,
      );
    }
  }

  // where the point sits inside the 3×3 block
  const offsetX = (x - tileX + 1) * TILE;
  const offsetY = (y - tileY + 1) * TILE;

  return (
    <div className="post-card__map">
      <div
        className="post-card__map-tiles"
        style={{
          left: `calc(50% - ${offsetX.toFixed(1)}px)`,
          top: `calc(50% - ${offsetY.toFixed(1)}px)`,
        }}
      >
        {tiles}
      </div>
      <img className="post-card__map-pin" src={pin} alt="" />
      <span className="post-card__map-credit">© OpenStreetMap</span>
    </div>
  );
}
