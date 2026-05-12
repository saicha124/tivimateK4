import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export interface DeviceRecordingState {
  isRecording: boolean;
  channelName: string | null;
  filePath: string | null;
  fileName: string | null;
  bytesWritten: number;
  elapsedMs: number;
  startTime: number | null;
  error: string | null;
}

interface DeviceRecordingContextValue extends DeviceRecordingState {
  start: (streamUrl: string, channelName: string, deviceFolder: string) => Promise<boolean>;
  stop: () => Promise<string | null>;
  clearError: () => void;
}

const INITIAL: DeviceRecordingState = {
  isRecording: false,
  channelName: null,
  filePath: null,
  fileName: null,
  bytesWritten: 0,
  elapsedMs: 0,
  startTime: null,
  error: null,
};

const DeviceRecordingContext = createContext<DeviceRecordingContextValue | null>(null);

export function DeviceRecordingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DeviceRecordingState>(INITIAL);
  const downloadRef = useRef<FileSystem.DownloadResumable | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const start = useCallback(async (
    streamUrl: string,
    name: string,
    deviceFolder: string,
  ): Promise<boolean> => {
    if (Platform.OS === "web") {
      setState((s) => ({ ...s, error: "Device recording is not available in web mode. Use server recording instead." }));
      return false;
    }

    if (downloadRef.current) {
      try { await downloadRef.current.pauseAsync(); } catch {}
      downloadRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const dt = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const dateStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
      const timeStr = `${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`;
      const safeName = name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      const fileName = `${dateStr}_${timeStr}_${safeName}.ts`;

      const folder = deviceFolder
        ? (deviceFolder.endsWith("/") ? deviceFolder : deviceFolder + "/")
        : ((FileSystem.documentDirectory ?? "") + "recordings/");

      try { await FileSystem.makeDirectoryAsync(folder, { intermediates: true }); } catch {}

      const filePath = folder + fileName;
      const now = Date.now();
      startTimeRef.current = now;

      const dl = FileSystem.createDownloadResumable(
        streamUrl,
        filePath,
        {},
        (progress) => {
          setState((s) => ({ ...s, bytesWritten: progress.totalBytesWritten }));
        },
      );
      downloadRef.current = dl;

      setState({
        isRecording: true,
        channelName: name,
        filePath,
        fileName,
        bytesWritten: 0,
        elapsedMs: 0,
        startTime: now,
        error: null,
      });

      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setState((s) => ({ ...s, elapsedMs: Date.now() - startTimeRef.current! }));
        }
      }, 1000);

      dl.downloadAsync().catch(() => {});
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
      try { await downloadRef.current.pauseAsync(); } catch {}
      savedPath = state.filePath;
      downloadRef.current = null;
    } else {
      savedPath = state.filePath;
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

  return (
    <DeviceRecordingContext.Provider value={{ ...state, start, stop, clearError }}>
      {children}
    </DeviceRecordingContext.Provider>
  );
}

export function useDeviceRecordingCtx() {
  const ctx = useContext(DeviceRecordingContext);
  if (!ctx) throw new Error("useDeviceRecordingCtx must be used within DeviceRecordingProvider");
  return ctx;
}
