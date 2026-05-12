import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Recording, useIPTV } from "@/context/IPTVContext";
import { useDeviceRecordingCtx } from "@/context/DeviceRecordingContext";
import { useColors } from "@/hooks/useColors";
import {
  useServerRecordings,
  formatBytes,
  formatElapsed,
} from "@/hooks/useServerRecordings";
import { useDeviceFiles, DeviceFile } from "@/hooks/useDeviceFiles";

function getStatus(r: Recording, now: number): "recording" | "scheduled" | "completed" {
  if (r.endTime < now) return "completed";
  if (r.startTime <= now) return "recording";
  return "scheduled";
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatDuration(start: number, end: number) {
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function openInExternalPlayer(url: string) {
  if (Platform.OS === "android") {
    Linking.openURL(`intent:${url}#Intent;action=android.intent.action.VIEW;type=video/*;end`).catch(() => {
      Linking.openURL(url).catch(() => {});
    });
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

// ─── Play picker sheet ────────────────────────────────────────────────────────

interface PlayPickerSheetProps {
  recording: Recording | null;
  downloadUrl: string | null;
  onClose: () => void;
  onPlayInternal: (url: string, name: string) => void;
}

function PlayPickerSheet({ recording, downloadUrl, onClose, onPlayInternal }: PlayPickerSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!recording) return null;

  const options: {
    icon: React.ComponentProps<typeof Feather>["name"];
    label: string;
    sublabel: string;
    accent: string;
    onPress: () => void;
    disabled?: boolean;
  }[] = [
    {
      icon: "play-circle",
      label: "Play in app",
      sublabel: "Open with the built-in player",
      accent: colors.primary,
      onPress: () => {
        onClose();
        onPlayInternal(recording.url, recording.programTitle);
      },
    },
    {
      icon: "external-link",
      label: "Open in external player",
      sublabel: Platform.OS === "android" ? "MX Player, VLC, Kodi…" : "Opens with system video handler",
      accent: "#4CAF50",
      onPress: () => {
        onClose();
        openInExternalPlayer(recording.url);
      },
    },
    ...(downloadUrl ? [{
      icon: "download" as const,
      label: "Save to device",
      sublabel: Platform.OS !== "web" ? "Download .ts file to device storage" : "Download recording from server",
      accent: "#2196F3",
      onPress: () => {
        onClose();
        if (Platform.OS === "web") {
          Linking.openURL(downloadUrl).catch(() => {});
          return;
        }
        const filename = `${recording.programTitle.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50)}_${new Date(recording.startTime).toISOString().slice(0, 10)}.ts`;
        const destPath = (FileSystem.documentDirectory ?? "") + filename;
        Alert.alert(
          "Save to Device",
          `Download recording to:\n${destPath}`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Download",
              onPress: async () => {
                try {
                  const dl = FileSystem.createDownloadResumable(downloadUrl, destPath, {});
                  const result = await dl.downloadAsync();
                  if (result?.uri) {
                    Alert.alert("Saved", `Recording saved to device storage.\n\n${result.uri}`);
                  }
                } catch (e: any) {
                  Alert.alert("Download failed", e?.message ?? "Could not download recording. Make sure the API Server URL is set correctly in Settings › General › Network.");
                }
              },
            },
          ]
        );
      },
    }] : []),
  ];

  return (
    <Modal visible={!!recording} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sheetStyles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[sheetStyles.sheet, { backgroundColor: "#1e1e1e", paddingBottom: bottomPad + 16 }]}>
              <View style={sheetStyles.handle} />

              <View style={sheetStyles.recordingMeta}>
                <View style={[sheetStyles.metaLogo, { backgroundColor: colors.secondary }]}>
                  {recording.channelLogo ? (
                    <Image source={{ uri: recording.channelLogo }} style={sheetStyles.metaLogoImg} contentFit="contain" />
                  ) : (
                    <Feather name="tv" size={16} color={colors.mutedForeground} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[sheetStyles.metaTitle, { color: "#fff" }]} numberOfLines={2}>
                    {recording.programTitle}
                  </Text>
                  <Text style={[sheetStyles.metaChannel, { color: colors.primary }]} numberOfLines={1}>
                    {recording.channelName}
                  </Text>
                  <Text style={[sheetStyles.metaTime, { color: "rgba(255,255,255,0.45)" }]}>
                    {formatDate(recording.startTime)} · {formatTime(recording.startTime)}–{formatTime(recording.endTime)} · {formatDuration(recording.startTime, recording.endTime)}
                  </Text>
                </View>
              </View>

              <View style={[sheetStyles.divider, { backgroundColor: "rgba(255,255,255,0.08)" }]} />

              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[sheetStyles.optionRow, opt.disabled && { opacity: 0.4 }]}
                  onPress={() => {
                    if (!opt.disabled) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      opt.onPress();
                    }
                  }}
                  activeOpacity={opt.disabled ? 1 : 0.75}
                >
                  <View style={[sheetStyles.optionIconWrap, { backgroundColor: `${opt.accent}18` }]}>
                    <Feather name={opt.icon} size={22} color={opt.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[sheetStyles.optionLabel, { color: "#fff" }]}>{opt.label}</Text>
                    <Text style={[sheetStyles.optionSublabel, { color: "rgba(255,255,255,0.45)" }]}>{opt.sublabel}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Recording card ───────────────────────────────────────────────────────────

function RecordingCard({
  recording,
  now,
  serverFileSize,
  serverElapsed,
  serverAlive,
  onPlayPress,
  onCancel,
}: {
  recording: Recording;
  now: number;
  serverFileSize: number;
  serverElapsed: number;
  serverAlive: boolean;
  onPlayPress: (r: Recording) => void;
  onCancel: (r: Recording) => void;
}) {
  const colors = useColors();
  const status = getStatus(recording, now);

  const scheduledProgress =
    status === "recording"
      ? Math.min(1, (now - recording.startTime) / (recording.endTime - recording.startTime))
      : 0;

  const statusColor =
    status === "recording" ? "#f44336" :
    status === "scheduled" ? colors.primary :
    colors.mutedForeground;

  const statusLabel =
    status === "recording" ? "Recording" :
    status === "scheduled" ? "Scheduled" :
    "Completed";

  const statusIcon: React.ComponentProps<typeof Feather>["name"] =
    status === "recording" ? "circle" :
    status === "scheduled" ? "clock" :
    "check-circle";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: status === "recording" ? `${statusColor}40` : colors.border,
          borderLeftColor: statusColor,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.channelLogo, { backgroundColor: colors.secondary }]}>
          {recording.channelLogo ? (
            <Image source={{ uri: recording.channelLogo }} style={styles.logoImg} contentFit="contain" />
          ) : (
            <Feather name="tv" size={16} color={colors.mutedForeground} />
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={[styles.programTitle, { color: colors.foreground }]} numberOfLines={2}>
            {recording.programTitle}
          </Text>
          <Text style={[styles.channelName, { color: colors.primary }]} numberOfLines={1}>
            {recording.channelName}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
              {formatDate(recording.startTime)}
            </Text>
            <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.timeRangeText, { color: colors.mutedForeground }]}>
              {formatTime(recording.startTime)} – {formatTime(recording.endTime)}
            </Text>
            <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.durationText, { color: colors.mutedForeground }]}>
              {formatDuration(recording.startTime, recording.endTime)}
            </Text>
          </View>

          {/* Live server recording stats */}
          {serverAlive && serverFileSize > 0 && (
            <View style={styles.serverStatsRow}>
              <View style={[styles.recDotLive, { backgroundColor: "#f44336" }]} />
              <Text style={[styles.serverStatText, { color: "#f44336" }]}>
                {formatElapsed(serverElapsed)}
              </Text>
              <Text style={[styles.serverStatSep, { color: colors.mutedForeground }]}>·</Text>
              <Text style={[styles.serverStatText, { color: colors.mutedForeground }]}>
                {formatBytes(serverFileSize)}
              </Text>
            </View>
          )}
          {!serverAlive && serverFileSize > 0 && (
            <View style={styles.serverStatsRow}>
              <Feather name="check-circle" size={11} color={colors.mutedForeground} />
              <Text style={[styles.serverStatText, { color: colors.mutedForeground }]}>
                {formatBytes(serverFileSize)} saved
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}40` }]}>
            <Feather name={statusIcon} size={10} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>

          {status === "completed" && (
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPlayPress(recording); }}
              style={[styles.actionBtn, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }]}
              activeOpacity={0.75}
            >
              <Feather name="play" size={13} color={colors.primary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => onCancel(recording)}
            style={[styles.actionBtn, { backgroundColor: `${colors.destructive}15`, borderColor: `${colors.destructive}30` }]}
            activeOpacity={0.75}
          >
            <Feather
              name={status === "completed" ? "trash-2" : "x"}
              size={13}
              color={colors.destructive}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scheduled-progress bar (time based) */}
      {status === "recording" && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: "#f44336", width: `${scheduledProgress * 100}%` as any },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: "#f44336" }]}>
            {Math.round(scheduledProgress * 100)}%
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Device file card ─────────────────────────────────────────────────────────

function parseChannelFromFilename(name: string): string {
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const withoutDate = withoutExt.replace(/^\d{4}-\d{2}-\d{2}_\d{6}_/, "");
  return withoutDate.replace(/_/g, " ").trim() || withoutExt;
}

function formatFileDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DeviceFileCard({
  file,
  onPlay,
  onDelete,
}: {
  file: DeviceFile;
  onPlay: (path: string, name: string) => void;
  onDelete: (file: DeviceFile) => void;
}) {
  const colors = useColors();
  const channelName = parseChannelFromFilename(file.name);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: colors.primary }]}>
      <View style={styles.cardTop}>
        <View style={[styles.channelLogo, { backgroundColor: colors.secondary }]}>
          <Feather name="film" size={20} color={colors.mutedForeground} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.programTitle, { color: colors.foreground }]} numberOfLines={2}>
            {channelName}
          </Text>
          <View style={styles.metaRow}>
            <Feather name="hard-drive" size={10} color={colors.mutedForeground} />
            <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
              {formatBytes(file.size)}
            </Text>
            <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
            <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
              {formatFileDate(file.modifiedAt)}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: "rgba(255,255,255,0.3)", fontSize: 10 }]} numberOfLines={1}>
            {file.name}
          </Text>
        </View>
        <View style={styles.cardActions}>
          {/* Play button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPlay(file.path, channelName);
            }}
          >
            <Feather name="play" size={14} color={colors.primary} />
          </TouchableOpacity>
          {/* Open with (Android) */}
          {Platform.OS === "android" && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "rgba(76,175,80,0.1)", borderColor: "rgba(76,175,80,0.3)" }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Linking.openURL(`intent:${file.path}#Intent;action=android.intent.action.VIEW;type=video/*;end`).catch(() => {
                  Linking.openURL(file.path).catch(() => {});
                });
              }}
            >
              <Feather name="external-link" size={14} color="#4CAF50" />
            </TouchableOpacity>
          )}
          {/* Delete button */}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "rgba(244,67,54,0.1)", borderColor: "rgba(244,67,54,0.25)" }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onDelete(file);
            }}
          >
            <Feather name="trash-2" size={14} color="#f44336" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Device recordings list ───────────────────────────────────────────────────

function DeviceRecordingsList({ onPlay }: { onPlay: (url: string, name: string) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { recordingSettings } = useIPTV();
  const { isRecording } = useDeviceRecordingCtx();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { files, loading, error, refresh, effectiveFolder } = useDeviceFiles(
    recordingSettings.deviceRecordingsFolder ?? ""
  );

  // Refresh when a recording just stopped
  const [prevRecording, setPrevRecording] = useState(isRecording);
  if (prevRecording !== isRecording) {
    setPrevRecording(isRecording);
    if (!isRecording) refresh();
  }

  const handleDelete = (file: DeviceFile) => {
    Alert.alert(
      "Delete recording?",
      `Delete "${file.name}" from your device?\n(${formatBytes(file.size)})`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await FileSystem.deleteAsync(file.path, { idempotent: true });
              refresh();
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Could not delete file.");
            }
          },
        },
      ]
    );
  };

  if (Platform.OS === "web") {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="monitor" size={36} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Not available on web</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Device recordings are only available on Android and iOS.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground, marginTop: 12 }]}>
          Scanning recordings folder…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="alert-circle" size={36} color="#f44336" />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Cannot read folder</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{error}</Text>
        <TouchableOpacity
          onPress={refresh}
          style={[{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 }]}
        >
          <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (files.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="smartphone" size={36} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No device recordings yet</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Tap ● in the player while watching a live channel to start recording directly to this device.
          {"\n\n"}Saving to: {effectiveFolder}
        </Text>
        <TouchableOpacity
          onPress={refresh}
          style={[{ backgroundColor: colors.secondary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginTop: 8 }]}
        >
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={files}
      keyExtractor={(f) => f.path}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 16 }]}
      ListHeaderComponent={
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }} numberOfLines={1}>
            {effectiveFolder}
          </Text>
          <TouchableOpacity onPress={refresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => (
        <DeviceFileCard
          file={item}
          onPlay={(path, name) => onPlay(path, name)}
          onDelete={handleDelete}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
    />
  );
}

// ─── Main list ────────────────────────────────────────────────────────────────

type SectionItem =
  | { type: "header"; label: string; count: number }
  | { type: "recording"; recording: Recording };

type RecordingsTab = "server" | "device";

export function RecordingsList({ onPlay }: { onPlay: (url: string, name: string) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { recordings, cancelRecording } = useIPTV();
  const [now] = useState(() => Date.now());
  const [pickerRecording, setPickerRecording] = useState<Recording | null>(null);
  const [activeTab, setActiveTab] = useState<RecordingsTab>("server");

  const { statuses } = useServerRecordings(recordings);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { active, scheduled, completed } = useMemo(() => {
    const active: Recording[] = [];
    const scheduled: Recording[] = [];
    const completed: Recording[] = [];
    for (const r of recordings) {
      const s = getStatus(r, now);
      if (s === "recording") active.push(r);
      else if (s === "scheduled") scheduled.push(r);
      else completed.push(r);
    }
    active.sort((a, b) => a.startTime - b.startTime);
    scheduled.sort((a, b) => a.startTime - b.startTime);
    completed.sort((a, b) => b.startTime - a.startTime);
    return { active, scheduled, completed };
  }, [recordings, now]);

  const listData = useMemo((): SectionItem[] => {
    const items: SectionItem[] = [];
    if (active.length > 0) {
      items.push({ type: "header", label: "Now Recording", count: active.length });
      active.forEach((r) => items.push({ type: "recording", recording: r }));
    }
    if (scheduled.length > 0) {
      items.push({ type: "header", label: "Scheduled", count: scheduled.length });
      scheduled.forEach((r) => items.push({ type: "recording", recording: r }));
    }
    if (completed.length > 0) {
      items.push({ type: "header", label: "Completed", count: completed.length });
      completed.forEach((r) => items.push({ type: "recording", recording: r }));
    }
    return items;
  }, [active, scheduled, completed]);

  const handleCancel = (r: Recording) => {
    const status = getStatus(r, now);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      cancelRecording(r.id);
      return;
    }
    Alert.alert(
      status === "completed" ? "Delete recording?" : "Cancel recording?",
      status === "completed"
        ? `Remove "${r.programTitle}" from your recordings list?`
        : `Cancel the scheduled recording of "${r.programTitle}"?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: status === "completed" ? "Delete" : "Cancel recording",
          style: "destructive",
          onPress: () => cancelRecording(r.id),
        },
      ]
    );
  };

  const pickerDownloadUrl = pickerRecording
    ? (statuses[pickerRecording.id]?.downloadUrl ?? null)
    : null;

  const TabBar = (
    <View style={[tabStyles.bar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      {(["server", "device"] as RecordingsTab[]).map((tab) => {
        const active = activeTab === tab;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => { Haptics.selectionAsync(); setActiveTab(tab); }}
            style={[tabStyles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          >
            <Feather
              name={tab === "server" ? "server" : "smartphone"}
              size={14}
              color={active ? colors.primary : colors.mutedForeground}
              style={{ marginRight: 6 }}
            />
            <Text style={[tabStyles.label, { color: active ? colors.primary : colors.mutedForeground }]}>
              {tab === "server" ? "Server" : "Device"}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (activeTab === "device") {
    return (
      <View style={{ flex: 1 }}>
        {TabBar}
        <DeviceRecordingsList onPlay={onPlay} />
      </View>
    );
  }

  if (recordings.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        {TabBar}
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="video" size={36} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No server recordings yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Long-press any channel or program and tap Record to schedule a server recording.{"\n\n"}
            Switch to the Device tab to see recordings saved directly on this device.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {TabBar}
      <FlatList
        data={listData}
        keyExtractor={(item, i) =>
          item.type === "header" ? `header-${item.label}` : `rec-${item.recording.id}-${i}`
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 16 }]}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return (
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, {
                  backgroundColor:
                    item.label === "Now Recording" ? "#f44336" :
                    item.label === "Scheduled" ? colors.primary :
                    colors.mutedForeground,
                }]} />
                <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                  {item.label}
                </Text>
                <View style={[styles.sectionCount, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.sectionCountText, { color: colors.mutedForeground }]}>
                    {item.count}
                  </Text>
                </View>
              </View>
            );
          }
          const s = statuses[item.recording.id];
          return (
            <RecordingCard
              recording={item.recording}
              now={now}
              serverFileSize={s?.fileSize ?? 0}
              serverElapsed={s?.elapsedMs ?? 0}
              serverAlive={s?.alive ?? false}
              onPlayPress={(r) => setPickerRecording(r)}
              onCancel={handleCancel}
            />
          );
        }}
      />

      <PlayPickerSheet
        recording={pickerRecording}
        downloadUrl={pickerDownloadUrl}
        onClose={() => setPickerRecording(null)}
        onPlayInternal={(url, name) => {
          setPickerRecording(null);
          onPlay(url, name);
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  recordingMeta: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  metaLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  metaLogoImg: { width: 48, height: 48 },
  metaTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 20, marginBottom: 2 },
  metaChannel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 2 },
  metaTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  optionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  optionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  optionSublabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
});

const styles = StyleSheet.create({
  list: { padding: 12, gap: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    flex: 1,
  },
  sectionCount: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  sectionCountText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 12,
    gap: 10,
  },
  cardTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  channelLogo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  logoImg: { width: 44, height: 44 },
  cardInfo: { flex: 1, gap: 3 },
  programTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  channelName: { fontSize: 11, fontFamily: "Inter_500Medium" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  dot: { fontSize: 11 },
  timeRangeText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  durationText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  serverStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  recDotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  serverStatText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  serverStatSep: { fontSize: 11 },
  cardActions: { alignItems: "flex-end", gap: 6, flexShrink: 0 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  progressContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: { fontSize: 10, fontFamily: "Inter_600SemiBold", width: 32, textAlign: "right" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 14,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
