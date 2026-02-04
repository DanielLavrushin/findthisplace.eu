import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/ftp-logo.png";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { label: "Не найдено", path: "/not-found" },
  { label: "Карта", path: "/map" },
  { label: "Авторы", path: "/authors" },
  { label: "Сыщики", path: "/searchers" },
  { label: "Метки", path: "/tags" },
];

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/map");
  };

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Box
          component={Link}
          to="/"
          sx={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            color: "inherit",
            mr: 4,
          }}
        >
          <Box
            component="img"
            src={logo}
            alt="FindThisPlace"
            sx={{ height: 36, mr: 1 }}
          />
          <Typography variant="h6" fontWeight="bold" noWrap>
            FindThisPlace
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexGrow: 1 }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={Link}
              to={item.path}
              color={location.pathname === item.path ? "primary" : "inherit"}
              variant={location.pathname === item.path ? "outlined" : "text"}
            >
              {item.label}
            </Button>
          ))}
          {isAdmin && (
            <Button
              component={Link}
              to="/admin"
              color={location.pathname === "/admin" ? "primary" : "inherit"}
              variant={location.pathname === "/admin" ? "outlined" : "text"}
            >
              Админка
            </Button>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {user ? (
            <>
              <Typography variant="body2" color="text.secondary">
                {user.username}
              </Typography>
              <Button color="inherit" onClick={handleLogout}>
                Выйти
              </Button>
            </>
          ) : (
            <Button
              component={Link}
              to="/login"
              color={location.pathname === "/login" ? "primary" : "inherit"}
              variant={location.pathname === "/login" ? "outlined" : "text"}
            >
              Войти
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
