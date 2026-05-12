import { useCallback, useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export interface DeviceRecordingState {
  isRecording: boolean;
  filePath: string | null;
  fileName: string | null;
  bytesWritten: number;
  elapsedMs: number;
  startTime: number | null;
  error: string | null;
}

const INITIAL_STATE: DeviceRecordingState = {
  isRecording: false,
  filePath: null,
  fileName: null,
  bytesWritten: 0,
  elapsedMs: 0,
  startTime: null,
  error: null,
};

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

export { formatBytes, formatElapsed };

export function useDeviceRecording() {
  const [state, setState] = useState<DeviceRecordingState>(INITIAL_STATE);
  const downloadRef = useRef<FileSystem.DownloadResumable | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const start = useCallback(async (
    streamUrl: string,
    channelName: string,
    deviceFolder: string,
  ) => {
    if (Platform.OS === "web") {
      setState((s) => ({ ...s, error: "Device recording is not available in web mode. Use the server recording feature instead." }));
      return false;
    }

    try {
      const dt = new Date();
      const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      const timeStr = `${String(dt.getHours()).padStart(2, "0")}${String(dt.getMinutes()).padStart(2, "0")}${String(dt.getSeconds()).padStart(2, "0")}`;
      const safeName = channelName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      const fileName = `${dateStr}_${timeStr}_${safeName}.ts`;

      const folder = deviceFolder
        ? (deviceFolder.endsWith("/") ? deviceFolder : deviceFolder + "/")
        : ((FileSystem.documentDirectory ?? "") + "recordings/");
      try {
        await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
      } catch {
      }

      const filePath = folder + fileName;

      const dl = FileSystem.createDownloadResumable(
        streamUrl,
        filePath,
        {},
        (progress) => {
          setState((s) => ({ ...s, bytesWritten: progress.totalBytesWritten }));
        },
      );

      downloadRef.current = dl;
      startTimeRef.current = Date.now();

      setState({
        isRecording: true,
        filePath,
        fileName,
        bytesWritten: 0,
        elapsedMs: 0,
        startTime: Date.now(),
        error: null,
      });

      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setState((s) => ({ ...s, elapsedMs: Date.now() - startTimeRef.current! }));
        }
      }, 1000);

      dl.downloadAsync().catch(() => {
      });

      return true;
    } catch (e: any) {
      setState((s) => ({ ...s, error: e?.message ?? "Failed to start recording" }));
      return false;
    }
  }, []);

  const stop = useCallback(async (): Promise<string | null> => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    let savedPath: string | null = null;
    if (downloadRef.current) {
      try {
        await downloadRef.current.pauseAsync();
      } catch {
      }
      savedPath = state.filePath;
      downloadRef.current = null;
    }

    startTimeRef.current = null;
    setState((s) => ({ ...s, isRecording: false }));
    return savedPath;
  }, [state.filePath]);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (downloadRef.current) {
        downloadRef.current.pauseAsync().catch(() => {});
        downloadRef.current = null;
      }
    };
  }, []);

  return { ...state, start, stop, clearError };
}
