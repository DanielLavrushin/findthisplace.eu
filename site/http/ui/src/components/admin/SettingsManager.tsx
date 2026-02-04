import { useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip,
  Chip,
  Button,
  Divider,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import LockIcon from "@mui/icons-material/Lock";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useSettings, useUpdateSetting, Setting } from "./useSettings";

const PROTECTED_ADMIN_ID = 25377;

const GRABBER_SETTINGS = ["last_grabber_time", "last_grabber_status"];

const SETTING_LABELS: Record<string, string> = {
  hidden_not_found_posts: "Скрытые ненайденные посты",
  hidden_tags: "Скрытые теги",
  admin_ids: "ID администраторов",
};

function formatValue(name: string, value: unknown): string {
  if (value === null || value === undefined) return "—";

  if (name === "last_grabber_time" && typeof value === "string") {
    try {
      return new Date(value).toLocaleString("ru-RU");
    } catch {
      return String(value);
    }
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return String(value);
}

function parseValue(name: string, input: string): unknown {
  if (name === "hidden_not_found_posts" || name === "admin_ids") {
    if (!input.trim()) return [];
    return input
      .split(/[\s,]+/) // Split by commas, spaces, or newlines
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  }
  if (name === "hidden_tags") {
    if (!input.trim()) return [];
    return input
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return input;
}

interface SettingRowProps {
  setting: Setting;
  onSave: (setting: Setting) => void;
  isSaving: boolean;
}

function SettingRow({ setting, onSave, isSaving }: SettingRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleEdit = () => {
    const formatted = Array.isArray(setting.value)
      ? setting.value.join(", ")
      : String(setting.value ?? "");
    setEditValue(formatted);
    setIsEditing(true);
  };

  const handleSave = () => {
    const parsed = parseValue(setting.name, editValue);
    onSave({ name: setting.name, value: parsed });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const label = SETTING_LABELS[setting.name] || setting.name;

  return (
    <TableRow hover>
      <TableCell>
        <Tooltip title={setting.name} arrow>
          <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
        </Tooltip>
        <Typography variant="caption" color="text.secondary">
          {setting.name}
        </Typography>
      </TableCell>
      <TableCell>
        {isEditing ? (
          <TextField
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            multiline={setting.name === "hidden_not_found_posts" || setting.name === "hidden_tags"}
            rows={setting.name === "hidden_not_found_posts" || setting.name === "hidden_tags" ? 4 : undefined}
            placeholder={
              setting.name.includes("ids") || setting.name.includes("posts")
                ? "Через запятую: 1, 2, 3"
                : setting.name === "hidden_tags"
                  ? "Через запятую: технический, модераторское"
                  : ""
            }
            helperText={
              setting.name === "admin_ids"
                ? `ID ${PROTECTED_ADMIN_ID} обязателен`
                : undefined
            }
          />
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {Array.isArray(setting.value) ? (
              setting.value.length > 0 ? (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(setting.value as (number | string)[]).slice(0, 10).map((item, idx) => {
                    const isProtected =
                      setting.name === "admin_ids" && item === PROTECTED_ADMIN_ID;
                    return (
                      <Tooltip
                        key={`${item}-${idx}`}
                        title={isProtected ? "Cупер admin" : ""}
                        arrow
                      >
                        <Chip
                          label={item}
                          size="small"
                          variant={isProtected ? "filled" : "outlined"}
                          color={isProtected ? "primary" : "default"}
                          icon={
                            isProtected ? (
                              <LockIcon sx={{ fontSize: 14 }} />
                            ) : undefined
                          }
                        />
                      </Tooltip>
                    );
                  })}
                  {setting.value.length > 10 && (
                    <Chip
                      label={`+${setting.value.length - 10}`}
                      size="small"
                      color="primary"
                    />
                  )}
                </Box>
              ) : (
                <Typography color="text.secondary">Пусто</Typography>
              )
            ) : (
              <Typography>
                {formatValue(setting.name, setting.value)}
              </Typography>
            )}
          </Box>
        )}
      </TableCell>
      <TableCell align="right">
        {isEditing ? (
          <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
            <Tooltip title="Сохранить">
              <IconButton
                size="small"
                color="primary"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Отмена">
              <IconButton size="small" onClick={handleCancel}>
                <CancelIcon />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Tooltip title="Редактировать">
            <IconButton size="small" onClick={handleEdit}>
              <EditIcon />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}

interface GrabberStatusProps {
  settings: Setting[];
  onTrigger: () => void;
  isTriggering: boolean;
}

function GrabberStatus({
  settings,
  onTrigger,
  isTriggering,
}: GrabberStatusProps) {
  const lastTime = settings.find((s) => s.name === "last_grabber_time")?.value;
  const lastStatus = settings.find(
    (s) => s.name === "last_grabber_status",
  )?.value;

  const formattedTime = lastTime
    ? new Date(lastTime as string).toLocaleString("ru-RU")
    : "—";

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
        Граббер
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            Последний запуск
          </Typography>
          <Typography>{formattedTime}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Статус
          </Typography>
          <Typography>{lastStatus ? String(lastStatus) : "—"}</Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={
            isTriggering ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <PlayArrowIcon />
            )
          }
          onClick={onTrigger}
          disabled={isTriggering}
        >
          Запустить обновление
        </Button>
      </Box>
    </Box>
  );
}

export default function SettingsManager() {
  const { data: settings, isLoading, error, refetch } = useSettings();
  const updateMutation = useUpdateSetting();
  const [isTriggering, setIsTriggering] = useState(false);

  const handleSave = (setting: Setting) => {
    updateMutation.mutate(setting);
  };

  const handleTriggerGrabber = async () => {
    setIsTriggering(true);
    try {
      await Promise.all([
        updateMutation.mutateAsync({ name: "last_grabber_time", value: null }),
        updateMutation.mutateAsync({ name: "last_grabber_status", value: "" }),
      ]);
      refetch();
    } finally {
      setIsTriggering(false);
    }
  };

  // Ensure all known editable settings are shown, even if they don't exist in DB yet
  const existingSettings = settings?.filter(
    (s) => !GRABBER_SETTINGS.includes(s.name),
  ) ?? [];
  const existingNames = new Set(existingSettings.map((s) => s.name));
  const missingSettings: Setting[] = Object.keys(SETTING_LABELS)
    .filter((name) => !existingNames.has(name))
    .map((name) => ({ name, value: [] }));
  const regularSettings = [...existingSettings, ...missingSettings];

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Ошибка загрузки настроек: {(error as Error).message}
      </Alert>
    );
  }

  return (
    <Box>
      {updateMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Ошибка сохранения: {(updateMutation.error as Error).message}
        </Alert>
      )}

      {updateMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Настройка сохранена
        </Alert>
      )}

      {settings && settings.length > 0 && (
        <GrabberStatus
          settings={settings}
          onTrigger={handleTriggerGrabber}
          isTriggering={isTriggering}
        />
      )}

      <Divider sx={{ my: 2 }} />

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: "30%" }}>
                Название
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Значение</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 100 }} align="right">
                Действия
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {regularSettings?.map((setting) => (
              <SettingRow
                key={setting.name}
                setting={setting}
                onSave={handleSave}
                isSaving={updateMutation.isPending}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {(!regularSettings || regularSettings.length === 0) && (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          Нет настроек
        </Typography>
      )}
    </Box>
  );
}
