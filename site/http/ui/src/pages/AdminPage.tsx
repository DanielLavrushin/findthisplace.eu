import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Alert, Tabs, Tab, Paper } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import WarningIcon from "@mui/icons-material/Warning";
import { useAuth } from "../contexts/AuthContext";
import { SettingsManager, ProblematicPosts } from "../components/admin";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  if (value !== index) return null;
  return <Box sx={{ py: 2 }}>{children}</Box>;
}

export default function AdminPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  // Redirect if not logged in
  if (!user && !isLoading) {
    navigate("/login", { replace: true });
    return null;
  }

  // Show access denied if not admin
  if (!isAdmin && !isLoading) {
    return (
      <Box sx={{ p: 3, maxWidth: 600, mx: "auto" }}>
        <Alert severity="error">У вас нет доступа к этой странице</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Панель администратора
        </Typography>
        <Typography color="text.secondary">
          {user?.username} (UID: {user?.uid})
        </Typography>
      </Box>

      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            px: 2,
          }}
        >
          <Tab icon={<SettingsIcon />} iconPosition="start" label="Настройки" />
          <Tab icon={<WarningIcon />} iconPosition="start" label="Проблемные посты" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          <TabPanel value={tab} index={0}>
            <SettingsManager />
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <ProblematicPosts />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}
