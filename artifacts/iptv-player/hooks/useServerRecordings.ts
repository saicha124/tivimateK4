import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { type Recording } from "@/context/IPTVContext";

export interface ServerRecordingStatus {
  id: string;
  filename: string;
  outputPath: string;
  fileSize: number;
  elapsedMs: number;
  alive: boolean;
  recentLog: string;
  downloadUrl: string;
  startAttempted: boolean;
}

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api` : "/api";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildFilename(r: Recording): string {
  const dt = new Date(r.startTime);
  const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const time = `${String(dt.getHours()).padStart(2, "0")}${String(dt.getMinutes()).padStart(2, "0")}`;
  const title = r.programTitle.replace(/[^a-zA-Z0-9 _-]/g, "_").slice(0, 60);
  const ch = r.channelName.replace(/[^a-zA-Z0-9 _-]/g, "_").slice(0, 30);
  return `${date}_${time}_${ch}_${title}.ts`;
}

export { formatBytes, formatElapsed };

export function useServerRecordings(recordings: Recording[]) {
  const [statuses, setStatuses] = useState<Record<string, ServerRecordingStatus>>({});
  const attemptedRef = useRef<Set<string>>(new Set());
  const stoppedRef = useRef<Set<string>>(new Set());

  const apiBase = getApiBase();

  async function startRecording(r: Recording): Promise<void> {
    if (attemptedRef.current.has(r.id)) return;
    attemptedRef.current.add(r.id);
    const filename = buildFilename(r);
    try {
      const resp = await fetch(`${apiBase}/recordings/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, url: r.url, filename }),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = await resp.json() as {
        id: string; filename: string; outputPath: string; startedAt: number; alive: boolean;
      };
      setStatuses((prev) => ({
        ...prev,
        [r.id]: {
          id: r.id,
          filename: data.filename,
          outputPath: data.outputPath,
          fileSize: 0,
          elapsedMs: 0,
          alive: data.alive,
          recentLog: "",
          downloadUrl: `${apiBase}/recordings/download/${r.id}`,
          startAttempted: true,
        },
      }));
    } catch {
      // Remove from attempted so it can be retried next tick
      attemptedRef.current.delete(r.id);
    }
  }

  async function stopRecording(id: string): Promise<void> {
    if (stoppedRef.current.has(id)) return;
    stoppedRef.current.add(id);
    try {
      await fetch(`${apiBase}/recordings/stop/${id}`, { method: "POST" });
    } catch {
      stoppedRef.current.delete(id);
    }
  }

  async function pollStatus(id: string): Promise<void> {
    try {
      const resp = await fetch(`${apiBase}/recordings/status/${id}`);
      if (!resp.ok) return;
      const data = await resp.json() as {
        id: string; filename: string; outputPath: string;
        fileSize: number; elapsedMs: number; alive: boolean; recentLog: string;
      };
      setStatuses((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] ?? {}),
          ...data,
          downloadUrl: `${apiBase}/recordings/download/${id}`,
          startAttempted: true,
        },
      }));
    } catch {
      // ignore poll failures
    }
  }

  // Auto-start / auto-stop loop — runs every 15 seconds
  useEffect(() => {
    const tick = async () => {
      const now = Date.now();
      for (const r of recordings) {
        const isActive = r.startTime <= now && r.endTime > now;
        const isPast = r.endTime <= now;
        const status = statuses[r.id];

        if (isActive && !attemptedRef.current.has(r.id)) {
          await startRecording(r);
        }

        if (isPast && status?.alive && !stoppedRef.current.has(r.id)) {
          await stopRecording(r.id);
        }
      }
    };

    tick();
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, [recordings]);

  // Polling loop for alive recordings — every 5 seconds
  useEffect(() => {
    const poll = async () => {
      const aliveIds = Object.values(statuses)
        .filter((s) => s.alive)
        .map((s) => s.id);
      await Promise.all(aliveIds.map((id) => pollStatus(id)));
    };

    poll();
    const timer = setInterval(poll, 5_000);
    return () => clearInterval(timer);
  }, [statuses]);

  // On unmount: stop all alive recordings
  useEffect(() => {
    return () => {
      Object.values(statuses).forEach((s) => {
        if (s.alive) stopRecording(s.id);
      });
    };
  }, []);

  return { statuses, startRecording, stopRecording };
}
