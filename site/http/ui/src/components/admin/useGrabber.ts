import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

export type GrabberPhase = "fetch" | "save" | "comments" | "posts" | "users";

export interface GrabberRunPhase {
  name: GrabberPhase;
  started_at: string;
  finished_at?: string;
}

export interface GrabberRunError {
  time: string;
  post_id?: number;
  message: string;
}

export interface GrabberRun {
  full: boolean;
  manual: boolean;
  started_at: string;
  finished_at?: string;
  result?: "success" | "fail";
  error?: string;
  phase: GrabberPhase | "";
  done: number;
  total: number;
  current?: string;
  posts: number;
  comments: number;
  phases: GrabberRunPhase[];
  errors: GrabberRunError[];
  error_count: number;
}

export interface GrabberStatus {
  running: boolean;
  queued: boolean;
  run?: GrabberRun;
  last_run_at?: string;
  last_result?: string;
  last_full_run_at?: string;
  next_run_at: string;
  next_run_full: boolean;
}

// The server writes at least every 15s.
const STALE_MS = 40_000;

// Follows the grabber over server-sent events.
export function useGrabberStatus() {
  const [status, setStatus] = useState<GrabberStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let source: EventSource;
    let heardAt = Date.now();

    const open = () => {
      source = new EventSource("/api/admin/grabber/events");
      source.onmessage = (e) => {
        heardAt = Date.now();
        setStatus(JSON.parse(e.data));
        setConnected(true);
        setClosed(false);
      };
      source.onerror = () => {
        setConnected(false);
        setClosed(source.readyState === EventSource.CLOSED);
      };
    };
    open();

    // A stream quiet for longer than the heartbeat is dead even when a proxy
    // keeps it open, and one refused outright (a 502 while the server
    // restarts) is never retried by the browser: start over in both cases.
    const watchdog = setInterval(() => {
      if (Date.now() - heardAt < STALE_MS) return;
      source.close();
      setConnected(false);
      heardAt = Date.now();
      open();
    }, 5_000);

    return () => {
      clearInterval(watchdog);
      source.close();
    };
  }, []);

  return { status, connected, closed };
}

async function triggerGrabber(full: boolean): Promise<void> {
  const res = await fetch("/api/admin/grabber/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full }),
  });
  if (res.status === 409) throw new Error("Граббер уже работает");
  if (!res.ok) throw new Error(`Не удалось запустить граббер: ${res.status}`);
}

export function useTriggerGrabber() {
  return useMutation({ mutationFn: triggerGrabber });
}
