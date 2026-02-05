import { Box, Typography, Link, Chip, Stack } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { useQuery } from "@tanstack/react-query";

interface FooterInfo {
  lastTime: Date | null;
  status: string | null;
  version: string | null;
}

function useFooterInfo(): FooterInfo {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return [];
      return (await res.json()) ?? [];
    },
    staleTime: 60000,
  });

  const { data: versionData } = useQuery({
    queryKey: ["version"],
    queryFn: async () => {
      const res = await fetch("/api/version");
      if (!res.ok) return null;
      return await res.json();
    },
    staleTime: Infinity,
  });

  const settingsArr = settings as Array<{ name: string; value: unknown }> | undefined;
  const timeSetting = settingsArr?.find((s) => s.name === "last_grabber_time");
  const statusSetting = settingsArr?.find((s) => s.name === "last_grabber_status");

  return {
    lastTime: timeSetting?.value ? new Date(timeSetting.value as string) : null,
    status: statusSetting?.value as string | null,
    version: versionData?.version ?? null,
  };
}

function formatRussianDate(date: Date): string {
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const day = date.getDate().toString().padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${year} г. в ${hours}:${minutes}`;
}

export default function Footer() {
  const { lastTime, status, version } = useFooterInfo();

  return (
    <Box
      component="footer"
      sx={{
        py: 2,
        px: 3,
        textAlign: "center",
        borderTop: 1,
        borderColor: "divider",
      }}
    >
      <Stack spacing={1} alignItems="center">
        {lastTime && (
          <Typography variant="body2" color="text.secondary">
            Последнее обновление: {formatRussianDate(lastTime)}
            {status && (
              <Chip
                size="small"
                icon={status === "success" ? <CheckCircleIcon /> : <ErrorIcon />}
                label={status === "success" ? "OK" : "Ошибка"}
                color={status === "success" ? "success" : "error"}
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          © {new Date().getFullYear()} - Findthisplace.eu {version ? `v${version}` : ""} |{" "}
          <Link
            href="https://findthisplace.d3.ru"
            target="_blank"
            rel="noopener noreferrer"
            color="inherit"
          >
            findthisplace.d3.ru
          </Link>
        </Typography>
        <Link
          href="https://github.com/daniellavrushin/findthisplace.eu"
          target="_blank"
          rel="noopener noreferrer"
          color="text.secondary"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
        >
          <GitHubIcon fontSize="small" />
          <Typography variant="body2">GitHub</Typography>
        </Link>
      </Stack>
    </Box>
  );
}
