import { useState } from "react";
import { Box, Button, Chip, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import Flag from "../countries/Flag";
import type { TagRef } from "./useTagDetail";
import { tagName } from "./tagName";

// about two rows on a wide screen; the rest wait behind a button
const SHOWN = 24;

/** The other tags on a tag's places, each a way on to its own page. */
export default function RelatedTags({
  title,
  tags,
}: Readonly<{ title: string; tags: TagRef[] }>) {
  const [expanded, setExpanded] = useState(false);
  if (tags.length === 0) return null;

  const shown = expanded ? tags : tags.slice(0, SHOWN);

  return (
    <Box component="nav" aria-label={title} sx={{ mb: 3 }}>
      <Typography
        variant="subtitle2"
        component="h2"
        sx={{
          mb: 1.5,
          color: "text.secondary",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontSize: "0.7rem",
        }}
      >
        {title}
      </Typography>
      <Box
        component="ul"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 1,
          listStyle: "none",
          m: 0,
          p: 0,
        }}
      >
        {shown.map((t) => (
          <li key={t.slug}>
            <Chip
              component={RouterLink}
              to={`/tags/${t.slug}`}
              clickable
              variant="outlined"
              icon={t.code ? <Flag code={t.code} width={18} /> : undefined}
              label={
                <>
                  {tagName(t.tag, t.code)}
                  <Box
                    component="span"
                    sx={{
                      ml: 0.75,
                      color: "text.secondary",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {t.count}
                  </Box>
                </>
              }
              sx={{
                height: 28,
                bgcolor: "background.paper",
                fontSize: "0.85rem",
                "& .MuiChip-icon": { ml: 1, mr: -0.25 },
              }}
            />
          </li>
        ))}
        {tags.length > SHOWN && (
          <li>
            <Button size="small" onClick={() => setExpanded((e) => !e)}>
              {expanded ? "Свернуть" : `Ещё ${tags.length - SHOWN}`}
            </Button>
          </li>
        )}
      </Box>
    </Box>
  );
}
