import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import theme from "./design/theme";
import Layout from "./layout/Layout";
import NotFoundPage from "./pages/NotFoundPage";
import MapPage from "./pages/MapPage";
import AuthorsPage from "./pages/AuthorsPage";
import DetectivesPage from "./pages/DetectivesPage";
import TagsPage from "./pages/TagsPage";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <CssBaseline />
        <Routes>
        <Route element={<Layout />}>
          <Route path="/not-found" element={<NotFoundPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/authors" element={<AuthorsPage />} />
          <Route path="/detectives" element={<DetectivesPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Route>
      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
