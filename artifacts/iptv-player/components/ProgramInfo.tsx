import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Channel, EPGProgram, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(start: number, end: number) {
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}m` : ""}`.trim();
}

function progressPct(start: number, end: number) {
  return Math.min(1, Math.max(0, (Date.now() - start) / (end - start)));
}

interface ProgramInfoProps {
  onPlay: (channel: Channel) => void;
}

export function ProgramInfo({ onPlay }: ProgramInfoProps) {
  const colors = useColors();
  const { selectedChannel, activePlaylist, stalkerEpgData, favorites, toggleFavorite } = useIPTV();

  if (!selectedChannel) return null;

  const now = Date.now();

  const epgSource: EPGProgram[] =
    (activePlaylist?.type === "StalkerPortal" && stalkerEpgData[selectedChannel.id]?.length)
      ? stalkerEpgData[selectedChannel.id]
      : (selectedChannel.epg ?? []);

  const currentProg = epgSource.find((p) => p.startTime <= now && p.endTime >= now);
  const nextProg = epgSource
    .filter((p) => p.startTime > now)
    .sort((a, b) => a.startTime - b.startTime)[0];

  const isFav = favorites.includes(selectedChannel.id);
  const pct = currentProg ? progressPct(currentProg.startTime, currentProg.endTime) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      {/* Channel logo */}
      <View style={[styles.thumbnail, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        {selectedChannel.logo ? (
          <Image source={{ uri: selectedChannel.logo }} style={styles.logo} contentFit="contain" />
        ) : (
          <Feather name="tv" size={28} color={colors.mutedForeground} />
        )}
        {currentProg && (
          <View style={styles.progressOverlay}>
            <LinearGradient
              colors={[colors.primary, `${colors.primary}aa`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressBar, { width: `${pct * 100}%` as any }]}
            />
          </View>
        )}
      </View>

      {/* Details */}
      <View style={styles.details}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {currentProg?.title ?? selectedChannel.name}
          </Text>
          <TouchableOpacity
            onPress={() => toggleFavorite(selectedChannel.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="star" size={17} color={isFav ? "#fbbf24" : colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.channel, { color: colors.mutedForeground }]} numberOfLines={1}>
          {selectedChannel.group} · {selectedChannel.name}
        </Text>

        {currentProg && (
          <View style={styles.timeRow}>
            <View style={[styles.livePill, { backgroundColor: "#4ade8020" }]}>
              <View style={styles.liveDot} />
              <Text style={[styles.liveText, { color: "#4ade80" }]}>LIVE</Text>
            </View>
            <Text style={[styles.time, { color: colors.primary }]}>
              {formatTime(currentProg.startTime)} — {formatTime(currentProg.endTime)}
            </Text>
            <Text style={[styles.duration, { color: colors.mutedForeground }]}>
              {formatDuration(currentProg.startTime, currentProg.endTime)}
            </Text>
          </View>
        )}

        {currentProg?.description ? (
          <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
            {currentProg.description}
          </Text>
        ) : nextProg ? (
          <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={1}>
            <Text style={{ fontFamily: "Inter_500Medium" }}>Up next: </Text>
            {nextProg.title} · {formatTime(nextProg.startTime)}
          </Text>
        ) : null}
      </View>

      {/* Play button */}
      <TouchableOpacity
        onPress={() => onPlay(selectedChannel)}
        style={[styles.playButton, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
      >
        <Feather name="play" size={17} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  thumbnail: {
    width: 104,
    height: 66,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    position: "relative",
  },
  logo: {
    width: 104,
    height: 66,
  },
  progressOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  progressBar: {
    height: 3,
    borderRadius: 0,
  },
  details: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  channel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#4ade80",
  },
  liveText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  duration: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  description: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 15,
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
});
