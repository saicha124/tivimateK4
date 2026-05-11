import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChannelContextMenu } from "@/components/ChannelContextMenu";
import { Channel, EPGProgram, VODItem, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

function nowProgram(channel: Channel, stalkerEpg?: EPGProgram[]) {
  const now = Date.now();
  const epg = stalkerEpg?.length ? stalkerEpg : (channel.epg ?? []);
  return epg.find((p) => p.startTime <= now && p.endTime >= now);
}

function nextProgram(channel: Channel, stalkerEpg?: EPGProgram[]) {
  const now = Date.now();
  const epg = stalkerEpg?.length ? stalkerEpg : (channel.epg ?? []);
  return epg.filter((p) => p.startTime > now).sort((a, b) => a.startTime - b.startTime)[0];
}

function progress(channel: Channel, stalkerEpg?: EPGProgram[]) {
  const prog = nowProgram(channel, stalkerEpg);
  if (!prog) return 0;
  const dur = prog.endTime - prog.startTime;
  const elapsed = Date.now() - prog.startTime;
  return Math.min(1, Math.max(0, elapsed / dur));
}

export function ChannelList({
  onPlayChannel,
  onCatchUp,
  manageFavoritesMode = false,
  onExitManageFavorites,
}: {
  onPlayChannel: (channel: Channel) => void;
  onCatchUp: (channel: Channel, program: EPGProgram) => void;
  manageFavoritesMode?: boolean;
  onExitManageFavorites?: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    activePlaylist,
    currentSection,
    selectedGroup,
    selectedChannel,
    setSelectedChannel,
    favorites,
    toggleFavorite,
    blockedChannels,
    hiddenChannels,
    favoritesOnlyGroups,
    stalkerEpgData,
  } = useIPTV();

  const [contextChannel, setContextChannel] = useState<Channel | null>(null);

  const channels = activePlaylist?.channels ?? [];
  const movies = activePlaylist?.movies ?? [];
  const shows = activePlaylist?.shows ?? [];

  const items = useMemo(() => {
    if (currentSection === "TV") {
      let list = channels.filter((c) => !hiddenChannels.includes(c.id));
      if (!selectedGroup) list = list.slice(0, 100);
      else {
        list = list.filter((c) => c.group === selectedGroup);
        if (favoritesOnlyGroups.includes(selectedGroup) && !manageFavoritesMode) {
          list = list.filter((c) => favorites.includes(c.id));
        }
      }
      return list;
    }
    if (currentSection === "Movies") {
      const vod = selectedGroup ? movies.filter((m) => m.category === selectedGroup) : movies.slice(0, 100);
      return vod.map((v) => ({
        id: v.id,
        name: v.name,
        group: v.category,
        logo: v.logo,
        url: v.url,
      } as Channel));
    }
    if (currentSection === "Shows") {
      const vod = selectedGroup ? shows.filter((s) => s.category === selectedGroup) : shows.slice(0, 100);
      return vod.map((v) => ({
        id: v.id,
        name: v.name,
        group: v.category,
        logo: v.logo,
        url: v.url,
      } as Channel));
    }
    if (currentSection === "My List") {
      return channels.filter((c) => favorites.includes(c.id) && !hiddenChannels.includes(c.id));
    }
    return [];
  }, [currentSection, selectedGroup, channels, movies, shows, favorites, hiddenChannels, favoritesOnlyGroups, manageFavoritesMode]);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLongPress = (channel: Channel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setContextChannel(channel);
  };

  return (
    <>
      {manageFavoritesMode && (
        <View style={[styles.manageBanner, { backgroundColor: colors.highlight, borderBottomColor: colors.primary }]}>
          <Feather name="star" size={14} color="#fbbf24" />
          <Text style={[styles.manageBannerText, { color: colors.foreground }]}>
            Manage Favorites — tap a star to add or remove
          </Text>
          <TouchableOpacity
            onPress={onExitManageFavorites}
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={items.length > 0}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 8 }}
        renderItem={({ item: channel, index }) => {
          const active = selectedChannel?.id === channel.id;
          const stalkerEpg = activePlaylist?.type === "StalkerPortal" ? stalkerEpgData[channel.id] : undefined;
          const now = nowProgram(channel, stalkerEpg);
          const prog = progress(channel, stalkerEpg);
          const isFav = favorites.includes(channel.id);
          const isBlocked = blockedChannels.includes(channel.id);

          if (manageFavoritesMode) {
            return (
              <View
                style={[
                  styles.manageItem,
                  { borderBottomColor: colors.border },
                  isBlocked && { opacity: 0.4 },
                ]}
              >
                <View style={styles.indexContainer}>
                  <Text style={[styles.index, { color: colors.mutedForeground }]}>{index + 1}</Text>
                </View>
                <View style={[styles.logo, { backgroundColor: colors.secondary }]}>
                  {channel.logo ? (
                    <Image source={{ uri: channel.logo }} style={styles.logoImg} contentFit="contain" />
                  ) : (
                    <Feather name="tv" size={18} color={colors.mutedForeground} />
                  )}
                </View>
                <TouchableOpacity
                  style={styles.starColumn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    toggleFavorite(channel.id);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather
                    name="star"
                    size={22}
                    color={isFav ? "#fbbf24" : colors.mutedForeground}
                    style={isFav ? { opacity: 1 } : { opacity: 0.35 }}
                  />
                </TouchableOpacity>
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                    {channel.name}
                  </Text>
                  <Text style={[styles.program, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {now ? now.title : channel.group}
                  </Text>
                </View>
              </View>
            );
          }

          return (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedChannel(channel);
              }}
              onLongPress={() => handleLongPress(channel)}
              style={[
                styles.item,
                active && { backgroundColor: colors.highlight },
                isBlocked && { opacity: 0.4 },
                { borderBottomColor: colors.border },
              ]}
              activeOpacity={0.75}
            >
              {active && (
                <View style={[styles.activeStripe, { backgroundColor: colors.primary }]} />
              )}
              <View style={styles.indexContainer}>
                <Text style={[styles.index, { color: colors.mutedForeground }]}>{index + 1}</Text>
              </View>
              <View style={[styles.logo, { backgroundColor: colors.secondary, borderColor: active ? `${colors.primary}40` : colors.border }]}>
                {channel.logo ? (
                  <Image source={{ uri: channel.logo }} style={styles.logoImg} contentFit="contain" />
                ) : (
                  <Feather name="tv" size={18} color={colors.mutedForeground} />
                )}
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text
                    style={[
                      styles.name,
                      { color: active ? colors.primary : isBlocked ? colors.destructive : colors.foreground },
                    ]}
                    numberOfLines={1}
                  >
                    {channel.name}
                  </Text>
                  {isBlocked && (
                    <View style={[styles.badge, { backgroundColor: `${colors.destructive}20` }]}>
                      <Text style={[styles.badgeText, { color: colors.destructive }]}>BLOCKED</Text>
                    </View>
                  )}
                </View>
                {now ? (
                  <>
                    <View style={styles.programRow}>
                      <View style={styles.liveDot} />
                      <Text style={[styles.program, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {now.title}
                      </Text>
                    </View>
                    <View style={[styles.progressBar, { backgroundColor: colors.progressBg }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { backgroundColor: active ? colors.primary : `${colors.primary}80`, width: `${prog * 100}%` as any },
                        ]}
                      />
                    </View>
                  </>
                ) : (
                  <Text style={[styles.program, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {channel.group}
                  </Text>
                )}
              </View>
              {active && (
                <TouchableOpacity
                  onPress={() => onPlayChannel(channel)}
                  style={[styles.playBtn, { backgroundColor: colors.primary }]}
                  activeOpacity={0.85}
                >
                  <Feather name="play" size={13} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  toggleFavorite(channel.id);
                }}
                style={styles.favBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="star" size={15} color={isFav ? "#fbbf24" : colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleLongPress(channel)}
                style={styles.moreBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="more-vertical" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="tv" size={38} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No channels</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {manageFavoritesMode
                ? "No channels in this group"
                : "Select a group or add a playlist"}
            </Text>
          </View>
        }
      />

      <ChannelContextMenu
        channel={contextChannel}
        visible={!!contextChannel}
        onClose={() => setContextChannel(null)}
        onPlay={onPlayChannel}
        onCatchUp={onCatchUp}
      />
    </>
  );
}

const styles = StyleSheet.create({
  manageBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 2,
  },
  manageBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  doneBtnText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  manageItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  starColumn: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
    position: "relative",
    overflow: "hidden",
  },
  activeStripe: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  indexContainer: {
    width: 24,
    alignItems: "center",
  },
  index: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  logo: {
    width: 50,
    height: 34,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  logoImg: {
    width: 50,
    height: 34,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  programRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#4ade80",
    flexShrink: 0,
  },
  program: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  favBtn: {
    padding: 4,
  },
  moreBtn: {
    padding: 4,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
});
