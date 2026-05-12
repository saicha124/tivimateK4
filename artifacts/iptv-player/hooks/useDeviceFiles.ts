import { useCallback, useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export interface DeviceFile {
  name: string;
  path: string;
  size: number;
  modifiedAt: number;
}

function parseFilenameDate(name: string): number {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return 0;
  return new Date(
    parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
    parseInt(m[4]), parseInt(m[5]), parseInt(m[6]),
  ).getTime();
}

export function useDeviceFiles(folder: string) {
  const [files, setFiles] = useState<DeviceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveFolder = folder
    ? (folder.endsWith("/") ? folder : folder + "/")
    : ((FileSystem.documentDirectory ?? "") + "recordings/");

  const refresh = useCallback(async () => {
    if (Platform.OS === "web") {
      setFiles([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const info = await FileSystem.getInfoAsync(effectiveFolder);
      if (!info.exists) {
        setFiles([]);
        setLoading(false);
        return;
      }
      const names = await FileSystem.readDirectoryAsync(effectiveFolder);
      const tsFiles = names.filter((n) => n.endsWith(".ts") || n.endsWith(".mp4") || n.endsWith(".mkv") || n.endsWith(".avi"));

      const detailed = await Promise.all(
        tsFiles.map(async (name) => {
          const path = effectiveFolder + name;
          try {
            const info = await FileSystem.getInfoAsync(path);
            return {
              name,
              path,
              size: (info as any).size ?? 0,
              modifiedAt: (info as any).modificationTime
                ? (info as any).modificationTime * 1000
                : parseFilenameDate(name) || Date.now(),
            } as DeviceFile;
          } catch {
            return { name, path, size: 0, modifiedAt: parseFilenameDate(name) || Date.now() } as DeviceFile;
          }
        })
      );

      detailed.sort((a, b) => b.modifiedAt - a.modifiedAt);
      setFiles(detailed);
    } catch (e: any) {
      setError(e?.message ?? "Could not read folder");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveFolder]);

  const deleteFile = useCallback(async (path: string) => {
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
      setFiles((prev) => prev.filter((f) => f.path !== path));
    } catch (e: any) {
      setError(e?.message ?? "Could not delete file");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { files, loading, error, refresh, effectiveFolder };
}
