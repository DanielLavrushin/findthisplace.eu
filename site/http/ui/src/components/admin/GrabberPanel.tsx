import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Link,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SyncIcon from "@mui/icons-material/Sync";
import {
  useGrabberStatus,
  useTriggerGrabber,
  type GrabberPhase,
  type GrabberRun,
  type GrabberStatus,
} from "./useGrabber";

const PHASES: { key: GrabberPhase; label: string; detail: string }[] = [
  { key: "fetch", label: "d3.ru", detail: "Загрузка постов и комментариев с d3.ru" },
  { key: "save", label: "Сохранение", detail: "Сохранение в базу" },
  { key: "comments", label: "Комментарии", detail: "Поиск координат в комментариях" },
  { key: "posts", label: "Посты", detail: "Обновление постов" },
  { key: "users", label: "Пользователи", detail: "Пересчёт статистики пользователей" },
];

function formatTime(iso?: string): string {
  return iso ? new Date(iso).toLocaleString("ru-RU") : "—";
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// Ticks so elapsed times move between server updates.
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function nextRunText(status: GrabberStatus, now: number): string {
  const kind = status.next_run_full ? "полное обновление" : "последние посты";
  const at = Date.parse(status.next_run_at);
  if (at <= now) return `в ближайшие 5 минут, ${kind}`;
  const time = new Date(at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `≈ ${time}, ${kind}`;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="div">{children}</Typography>
    </Box>
  );
}

function StateChip({ status }: { status: GrabberStatus }) {
  if (status.running) {
    return (
      <Chip
        size="small"
        color="primary"
        icon={<CircularProgress size={12} color="inherit" />}
        label="Работает"
      />
    );
  }
  if (status.queued) {
    return <Chip size="small" color="primary" variant="outlined" label="Запускается…" />;
  }
  return <Chip size="small" variant="outlined" label="Ожидает" />;
}

function RunView({ run, now }: { run: GrabberRun; now: number }) {
  const finished = Boolean(run.finished_at);
  const failed = run.result === "fail";
  const elapsed = (finished ? Date.parse(run.finished_at!) : now) - Date.parse(run.started_at);
  const activeIndex = PHASES.findIndex((p) => p.key === run.phase);
  const phase = PHASES[activeIndex];
  const percent = run.total > 0 ? Math.min(100, (run.done / run.total) * 100) : undefined;

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
      <Box
        sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mb: 2 }}
      >
        <Typography sx={{ fontWeight: 600 }}>
          {finished ? "Последний запуск" : "Текущий запуск"}:{" "}
          {run.full ? "полное обновление" : "последние посты"},{" "}
          {run.manual ? "вручную" : "по расписанию"}
        </Typography>
        <Typography color="text.secondary">
          {formatTime(run.started_at)} · {finished ? "длился" : "идёт"} {formatDuration(elapsed)}
        </Typography>
      </Box>

      <Stepper alternativeLabel activeStep={finished ? -1 : activeIndex} sx={{ mb: 2 }}>
        {PHASES.map((p, i) => {
          const seen = run.phases.find((x) => x.name === p.key);
          const brokeHere = finished && failed && i === activeIndex;
          const took = seen
            ? (seen.finished_at ? Date.parse(seen.finished_at) : now) - Date.parse(seen.started_at)
            : undefined;
          return (
            <Step key={p.key} completed={Boolean(seen?.finished_at) && !brokeHere}>
              <StepLabel
                error={brokeHere}
                optional={
                  took !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDuration(took)}
                    </Typography>
                  )
                }
              >
                {p.label}
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>

      {!finished && phase && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
            <Typography variant="body2">{phase.detail}</Typography>
            {run.total > 0 && (
              <Typography variant="body2" color="text.secondary">
                {run.done.toLocaleString("ru-RU")} / {run.total.toLocaleString("ru-RU")}
              </Typography>
            )}
          </Box>
          <LinearProgress
            variant={percent === undefined ? "indeterminate" : "determinate"}
            value={percent}
          />
          {run.current && (
            <Typography variant="caption" color="text.secondary" noWrap component="div" sx={{ mt: 0.5 }}>
              {run.current}
            </Typography>
          )}
        </Box>
      )}

      {finished && failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {run.error}
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary">
        Загружено постов: {run.posts.toLocaleString("ru-RU")} · комментариев:{" "}
        {run.comments.toLocaleString("ru-RU")} · ошибок: {run.error_count}
      </Typography>

      {run.errors.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Ошибки
            {run.error_count > run.errors.length &&
              ` (последние ${run.errors.length} из ${run.error_count})`}
          </Typography>
          {[...run.errors].reverse().map((e, i) => (
            <Typography
              key={i}
              variant="caption"
              component="div"
              sx={{ fontFamily: "monospace", wordBreak: "break-word" }}
            >
              {new Date(e.time).toLocaleTimeString("ru-RU")}{" "}
              {e.post_id !== undefined && (
                <Link
                  href={`https://findthisplace.d3.ru/${e.post_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  #{e.post_id}
                </Link>
              )}{" "}
              {e.message}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function GrabberPanel() {
  const { status, connected, closed } = useGrabberStatus();
  const trigger = useTriggerGrabber();
  const now = useNow(status?.running ? 1000 : 30000);

  if (!status) {
    return closed ? (
      <Alert severity="error">Не удалось подключиться к грабберу</Alert>
    ) : (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const busy = status.running || status.queued || trigger.isPending;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Граббер
        </Typography>
        <StateChip status={status} />
        {!connected && (
          <Chip size="small" color="warning" variant="outlined" label="Нет связи, переподключение…" />
        )}
      </Box>

      <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", mb: 2 }}>
        <Fact label="Последний запуск">
          {formatTime(status.last_run_at)}
          {status.last_result && ` · ${status.last_result}`}
        </Fact>
        <Fact label="Последнее полное обновление">{formatTime(status.last_full_run_at)}</Fact>
        {!status.running && <Fact label="Следующий запуск">{nextRunText(status, now)}</Fact>}
      </Box>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowIcon />}
          disabled={busy}
          onClick={() => trigger.mutate(false)}
        >
          Обновить последние
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<SyncIcon />}
          disabled={busy}
          onClick={() => trigger.mutate(true)}
        >
          Полное обновление
        </Button>
      </Box>

      {trigger.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(trigger.error as Error).message}
        </Alert>
      )}

      {status.run && <RunView run={status.run} now={now} />}
    </Box>
  );
}
