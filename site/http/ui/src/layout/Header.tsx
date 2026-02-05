import { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    logout();
    navigate("/map");
    setMobileOpen(false);
  };

  const drawer = (
    <Box sx={{ width: 250 }}>
      <List>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={location.pathname === item.path}
              onClick={handleDrawerToggle}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
        {isAdmin && (
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              to="/admin"
              selected={location.pathname === "/admin"}
              onClick={handleDrawerToggle}
            >
              <ListItemText primary="Админка" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
      <Divider />
      <List>
        {user ? (
          <>
            <ListItem>
              <ListItemText primary={user.username} secondary="Вы вошли" />
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout}>
                <ListItemText primary="Выйти" />
              </ListItemButton>
            </ListItem>
          </>
        ) : (
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              to="/login"
              onClick={handleDrawerToggle}
            >
              <ListItemText primary="Войти" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          {/* Mobile menu button */}
          <IconButton
            color="inherit"
            aria-label="open menu"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <Box
            component={Link}
            to="/"
            sx={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              color: "inherit",
              mr: { xs: 0, md: 4 },
              flexGrow: { xs: 1, md: 0 },
            }}
          >
            <Box
              component="img"
              src={logo}
              alt="FindThisPlace"
              sx={{ height: 36, mr: 1 }}
            />
            <Typography
              variant="h6"
              fontWeight="bold"
              noWrap
              sx={{ display: { sm: "block" } }}
            >
              FindThisPlace
            </Typography>
          </Box>

          {/* Desktop navigation */}
          <Box
            sx={{ display: { xs: "none", md: "flex" }, gap: 1, flexGrow: 1 }}
          >
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

          {/* Desktop auth */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 1,
            }}
          >
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

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: 250 },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
}
