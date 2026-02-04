import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const queryClient = new QueryClient();
import theme from "./design/theme";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./layout/Layout";
import NotFoundPage from "./pages/NotFoundPage";
import MapPage from "./pages/MapPage";
import AuthorsPage from "./pages/AuthorsPage";
import AuthorDetailPage from "./pages/AuthorDetailPage";
import TagsPage from "./pages/TagsPage";
import SearchersPage from "./pages/SearchersPage";
import SearcherDetailPage from "./pages/SearcherDetailPage";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <BrowserRouter>
            <CssBaseline />
            <Routes>
              <Route element={<Layout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/not-found" element={<NotFoundPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/authors" element={<AuthorsPage />} />
                <Route path="/authors/:id" element={<AuthorDetailPage />} />
                <Route path="/searchers" element={<SearchersPage />} />
                <Route path="/searchers/:id" element={<SearcherDetailPage />} />
                <Route path="/tags" element={<TagsPage />} />
                <Route path="*" element={<Navigate to="/map" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
