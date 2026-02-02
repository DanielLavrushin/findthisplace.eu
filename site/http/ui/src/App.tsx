import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const queryClient = new QueryClient();
import theme from "./design/theme";
import Layout from "./layout/Layout";
import NotFoundPage from "./pages/NotFoundPage";
import MapPage from "./pages/MapPage";
import AuthorsPage from "./pages/AuthorsPage";
import TagsPage from "./pages/TagsPage";
import SearchersPage from "./pages/SearchersPage";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          <CssBaseline />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/not-found" element={<NotFoundPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/authors" element={<AuthorsPage />} />
              <Route path="/searchers" element={<SearchersPage />} />
              <Route path="/tags" element={<TagsPage />} />
              <Route path="*" element={<Navigate to="/map" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
