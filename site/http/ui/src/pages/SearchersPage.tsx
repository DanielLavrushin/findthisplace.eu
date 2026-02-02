import { Box, Typography } from "@mui/material";
import SearchersList from "../components/searchers/SearchersList";

export default function SearchersPage() {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Сыщики
      </Typography>
      <SearchersList />
    </Box>
  );
}
