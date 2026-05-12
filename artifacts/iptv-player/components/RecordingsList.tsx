import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
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
import { useColors } from "@/hooks/useColors";

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

function sanitizeFilename(title: string): string {
  return title.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80);
}

function buildFilePath(folder: string, programTitle: string, channelName: string, startTime: number): string {
  const dt = new Date(startTime);
  const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const time = `${String(dt.getHours()).padStart(2, "0")}${String(dt.getMinutes()).padStart(2, "0")}`;
  const base = sanitizeFilename(`${date}_${time}_${channelName}_${programTitle}`);
  return `${folder}/${base}.ts`;
}

function openInExternalPlayer(url: string) {
  if (Platform.OS === "android") {
    const intentUrl = `intent:${url}#Intent;action=android.intent.action.VIEW;type=video/*;end`;
    Linking.openURL(intentUrl).catch(() => {
      Linking.openURL(url).catch(() => {});
    });
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

interface PlayPickerSheetProps {
  recording: Recording | null;
  filePath: string;
  onClose: () => void;
  onPlayInternal: (url: string, name: string) => void;
}

function PlayPickerSheet({ recording, filePath, onClose, onPlayInternal }: PlayPickerSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!recording) return null;

  const options: {
    icon: React.ComponentProps<typeof Feather>["name"];
    label: string;
    sublabel: string;
    accent?: string;
    onPress: () => void;
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
      sublabel: Platform.OS === "android"
        ? "MX Player, VLC, Kodi…"
        : "Opens with default video handler",
      accent: "#4CAF50",
      onPress: () => {
        onClose();
        openInExternalPlayer(recording.url);
      },
    },
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
                  style={sheetStyles.optionRow}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); opt.onPress(); }}
                  activeOpacity={0.75}
                >
                  <View style={[sheetStyles.optionIconWrap, { backgroundColor: `${opt.accent}18` }]}>
                    <Feather name={opt.icon} size={22} color={opt.accent ?? "#fff"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[sheetStyles.optionLabel, { color: "#fff" }]}>{opt.label}</Text>
                    <Text style={[sheetStyles.optionSublabel, { color: "rgba(255,255,255,0.45)" }]}>{opt.sublabel}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.25)" />
                </TouchableOpacity>
              ))}

              <View style={[sheetStyles.filePathBox, { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }]}>
                <View style={sheetStyles.filePathHeader}>
                  <Feather name="folder" size={12} color="rgba(255,255,255,0.35)" />
                  <Text style={[sheetStyles.filePathLabel, { color: "rgba(255,255,255,0.35)" }]}>
                    Recording file location
                  </Text>
                </View>
                <Text style={[sheetStyles.filePathText, { color: "rgba(255,255,255,0.5)" }]} selectable>
                  {filePath}
                </Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function RecordingCard({
  recording,
  now,
  onPlayPress,
  onCancel,
}: {
  recording: Recording;
  now: number;
  onPlayPress: (r: Recording) => void;
  onCancel: (r: Recording) => void;
}) {
  const colors = useColors();
  const status = getStatus(recording, now);
  const progress =
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

      {status === "recording" && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: "#f44336", width: `${progress * 100}%` as any },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: "#f44336" }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      )}
    </View>
  );
}

type SectionItem =
  | { type: "header"; label: string; count: number }
  | { type: "recording"; recording: Recording };

export function RecordingsList({ onPlay }: { onPlay: (url: string, name: string) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { recordings, cancelRecording, recordingSettings } = useIPTV();
  const [now] = useState(() => Date.now());
  const [pickerRecording, setPickerRecording] = useState<Recording | null>(null);

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

  const pickerFilePath = useMemo(() => {
    if (!pickerRecording) return "";
    return buildFilePath(
      recordingSettings.recordingsFolder,
      pickerRecording.programTitle,
      pickerRecording.channelName,
      pickerRecording.startTime,
    );
  }, [pickerRecording, recordingSettings.recordingsFolder]);

  if (recordings.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="video" size={36} color={colors.mutedForeground} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No recordings yet</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Long-press any channel or program and tap Record to schedule a recording.
        </Text>
      </View>
    );
  }

  return (
    <>
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
          return (
            <RecordingCard
              recording={item.recording}
              now={now}
              onPlayPress={(r) => setPickerRecording(r)}
              onCancel={handleCancel}
            />
          );
        }}
      />

      <PlayPickerSheet
        recording={pickerRecording}
        filePath={pickerFilePath}
        onClose={() => setPickerRecording(null)}
        onPlayInternal={(url, name) => {
          setPickerRecording(null);
          onPlay(url, name);
        }}
      />
    </>
  );
}

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
    gap: 0,
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
  metaTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
    marginBottom: 2,
  },
  metaChannel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  metaTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
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
  optionLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  optionSublabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  filePathBox: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  filePathHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  filePathLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  filePathText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
});

const styles = StyleSheet.create({
  list: {
    padding: 12,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    flex: 1,
  },
  sectionCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionCountText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 12,
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  channelLogo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  logoImg: {
    width: 44,
    height: 44,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  programTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  channelName: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  dateText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  dot: {
    fontSize: 11,
  },
  timeRangeText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  durationText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  cardActions: {
    alignItems: "flex-end",
    gap: 6,
    flexShrink: 0,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    width: 32,
    textAlign: "right",
  },
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
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
