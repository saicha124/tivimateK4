import { Feather } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Channel, EPGProgram, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDur(start: number, end: number) {
  const m = Math.round((end - start) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60 > 0 ? `${m % 60}m` : ""}`.trim();
}

function progressPct(start: number, end: number) {
  return Math.min(1, Math.max(0, (Date.now() - start) / (end - start)));
}

interface MiniPlayerProps {
  onFullscreen: (channel: Channel) => void;
}

export function MiniPlayer({ onFullscreen }: MiniPlayerProps) {
  const colors = useColors();
  const { selectedChannel, activePlaylist, stalkerEpgData, resolveStalkerStreamUrl } = useIPTV();

  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const videoRef = useRef<Video>(null);
  const lastChannelId = useRef<string | null>(null);

  // EPG for selected channel
  const now = Date.now();
  const epg: EPGProgram[] = selectedChannel
    ? (activePlaylist?.type === "StalkerPortal" && stalkerEpgData[selectedChannel.id]?.length
        ? stalkerEpgData[selectedChannel.id]
        : selectedChannel.epg ?? [])
    : [];
  const currentProg = epg.find((p) => p.startTime <= now && p.endTime >= now);
  const nextProg = epg.filter((p) => p.startTime > now).sort((a, b) => a.startTime - b.startTime)[0];
  const pct = currentProg ? progressPct(currentProg.startTime, currentProg.endTime) : 0;

  const resolveAndPlay = useCallback(async (channel: Channel) => {
    setError(false);
    setStreamUrl(null);
    setIsBuffering(false);

    const url = channel.url;

    if (activePlaylist?.type === "StalkerPortal" && url.startsWith("stalker-")) {
      setResolving(true);
      try {
        const resolved = await resolveStalkerStreamUrl(activePlaylist, url);
        setStreamUrl(resolved);
      } catch {
        setError(true);
      } finally {
        setResolving(false);
      }
    } else if (url.startsWith("stalker-")) {
      setError(true);
    } else {
      setStreamUrl(url);
    }
  }, [activePlaylist, resolveStalkerStreamUrl]);

  useEffect(() => {
    if (!selectedChannel) {
      setStreamUrl(null);
      setError(false);
      setResolving(false);
      lastChannelId.current = null;
      return;
    }
    if (selectedChannel.id === lastChannelId.current) return;
    lastChannelId.current = selectedChannel.id;
    resolveAndPlay(selectedChannel);
  }, [selectedChannel?.id]);

  if (!selectedChannel) return null;

  const handleFullscreen = () => {
    onFullscreen(selectedChannel);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      {/* Video panel */}
      <View style={[styles.videoPanelWrap, { backgroundColor: "#000" }]}>
        {/* Thumbnail backdrop */}
        {selectedChannel.logo ? (
          <Image
            source={{ uri: selectedChannel.logo }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            blurRadius={8}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]} />

        {/* Video player */}
        {streamUrl && !error ? (
          <Video
            ref={videoRef}
            source={{ uri: streamUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isMuted={isMuted}
            onLoadStart={() => setIsBuffering(true)}
            onLoad={() => setIsBuffering(false)}
            onError={() => { setError(true); setIsBuffering(false); }}
            onPlaybackStatusUpdate={(s) => {
              if (s.isLoaded) setIsBuffering(s.isBuffering);
            }}
          />
        ) : null}

        {/* Loading / resolving overlay */}
        {(resolving || isBuffering) && !error && (
          <View style={styles.overlay}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.overlayText}>{resolving ? "Resolving…" : "Buffering…"}</Text>
          </View>
        )}

        {/* Error state */}
        {error && !resolving && (
          <View style={styles.overlay}>
            <Feather name="wifi-off" size={20} color={colors.mutedForeground} />
            <Text style={styles.overlayText}>Stream unavailable</Text>
          </View>
        )}

        {/* Channel logo centered when no video yet */}
        {!streamUrl && !resolving && !error && selectedChannel.logo && (
          <Image source={{ uri: selectedChannel.logo }} style={styles.centerLogo} contentFit="contain" />
        )}

        {/* Bottom controls bar */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={styles.controlsGrad}
        >
          <TouchableOpacity
            onPress={() => setIsMuted((m) => !m)}
            style={styles.muteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name={isMuted ? "volume-x" : "volume-2"} size={13} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleFullscreen}
            style={[styles.fullscreenBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Feather name="maximize-2" size={11} color="#fff" />
            <Text style={styles.fullscreenText}>Full screen</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Info panel */}
      <View style={styles.infoPanel}>
        {/* Channel name + section */}
        <View style={styles.channelRow}>
          <Text style={[styles.channelName, { color: colors.foreground }]} numberOfLines={1}>
            {selectedChannel.name}
          </Text>
          <Text style={[styles.channelGroup, { color: colors.mutedForeground }]} numberOfLines={1}>
            {selectedChannel.group}
          </Text>
        </View>

        {/* Now playing */}
        {currentProg ? (
          <View style={styles.epgBlock}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>LIVE</Text>
            </View>
            <Text style={[styles.programTitle, { color: colors.foreground }]} numberOfLines={2}>
              {currentProg.title}
            </Text>
            <Text style={[styles.programTime, { color: colors.mutedForeground }]}>
              {fmt(currentProg.startTime)} — {fmt(currentProg.endTime)} · {fmtDur(currentProg.startTime, currentProg.endTime)}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.progressBg }]}>
              <LinearGradient
                colors={[colors.primary, `${colors.primary}aa`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${pct * 100}%` as any }]}
              />
            </View>
            {nextProg && (
              <Text style={[styles.nextText, { color: colors.mutedForeground }]} numberOfLines={1}>
                Next: {nextProg.title} · {fmt(nextProg.startTime)}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.epgBlock}>
            <Text style={[styles.noEpg, { color: colors.mutedForeground }]}>No EPG info</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    height: 130,
  },
  videoPanelWrap: {
    width: 195,
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
  },
  centerLogo: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  overlayText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  controlsGrad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingBottom: 6,
    gap: 6,
  },
  muteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    marginLeft: "auto",
  },
  fullscreenText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  infoPanel: {
    flex: 1,
    padding: 10,
    gap: 6,
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  channelName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  channelGroup: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    flexShrink: 1,
  },
  epgBlock: {
    flex: 1,
    gap: 3,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#4ade8018",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 20,
    marginBottom: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#4ade80",
  },
  liveLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#4ade80",
    letterSpacing: 0.8,
  },
  programTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 16,
  },
  programTime: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  nextText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  noEpg: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    marginTop: 4,
  },
});
