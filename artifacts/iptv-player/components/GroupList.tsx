import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GroupContextMenu } from "@/components/GroupContextMenu";
import { GroupOptionsSheet } from "@/components/GroupOptionsSheet";
import { PinPad } from "@/components/PinPad";
import { Channel, Playlist, VODItem, useIPTV } from "@/context/IPTVContext";
import { useParental } from "@/context/ParentalContext";
import { useColors } from "@/hooks/useColors";

function getGroupsForPlaylist(
  section: string,
  playlist: Playlist,
  hiddenGroups: string[]
): string[] {
  if (section === "My List") return ["Favorites"];
  let groups: string[] = [];
  if (section === "Movies") groups = Array.from(new Set(playlist.movies.map((m) => m.category))).sort();
  else if (section === "Shows") groups = Array.from(new Set(playlist.shows.map((s) => s.category))).sort();
  else if (section === "TV") groups = Array.from(new Set(playlist.channels.map((c) => c.group))).sort();
  return groups.filter((g) => !hiddenGroups.includes(g));
}

function PlaylistHeader({
  playlist,
  isActive,
  isCollapsed,
  onToggle,
}: {
  playlist: Playlist;
  isActive: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  const rotation = useRef(new Animated.Value(isCollapsed ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: isCollapsed ? 0 : 1,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [isCollapsed]);

  const rotateZ = rotation.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] });

  // Derive a short display label from the playlist name or server
  const label = playlist.name || playlist.serverAddress || playlist.url || "Playlist";

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
      style={[
        styles.playlistHeader,
        { borderColor: isActive ? `${colors.primary}40` : colors.border },
        isActive && { backgroundColor: `${colors.primary}10` },
      ]}
      activeOpacity={0.7}
    >
      <View style={[styles.playlistTypeTag, { backgroundColor: isActive ? colors.primary : colors.secondary }]}>
        <Text style={[styles.playlistTypeText, { color: isActive ? "#fff" : colors.mutedForeground }]}>
          {playlist.type === "StalkerPortal" ? "STK" : playlist.type === "XtreamCodes" ? "XC" : "M3U"}
        </Text>
      </View>
      <Text
        style={[styles.playlistHeaderLabel, { color: isActive ? colors.foreground : colors.mutedForeground }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Animated.View style={{ transform: [{ rotate: rotateZ }] }}>
        <Feather name="chevron-down" size={13} color={isActive ? colors.primary : colors.mutedForeground} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export function GroupList({
  onManageFavorites,
}: {
  onManageFavorites?: (group: string) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    playlists,
    activePlaylist,
    setActivePlaylist,
    currentSection,
    selectedGroup,
    setSelectedGroup,
    setSelectedChannel,
    favorites,
    hiddenGroups,
    favoritesOnlyGroups,
  } = useIPTV();
  const { isGroupLocked, unlockForSession, verifyPin } = useParental();

  const [pendingGroup, setPendingGroup] = useState<string | null>(null);
  const [pendingPlaylist, setPendingPlaylist] = useState<Playlist | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [contextGroup, setContextGroup] = useState<string | null>(null);
  const [groupOptionsGroup, setGroupOptionsGroup] = useState<string | null>(null);

  // Track which playlists are collapsed
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    const collapsed = new Set<string>();
    // All except active playlist start collapsed
    return collapsed;
  });

  // Initialize collapsed state once playlists are loaded
  useEffect(() => {
    if (playlists.length > 0 && activePlaylist) {
      setCollapsedIds(new Set(playlists.filter(p => p.id !== activePlaylist.id).map(p => p.id)));
    }
  }, [playlists.length > 0]); // Only run once when playlists first arrive

  const hasFavorites = favorites.length > 0 && currentSection === "TV";

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const toggleCollapse = (playlistId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playlistId)) next.delete(playlistId);
      else next.add(playlistId);
      return next;
    });
  };

  const handleSelect = (group: string, playlist: Playlist) => {
    if (isGroupLocked(group)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setPendingGroup(group);
      setPendingPlaylist(playlist);
      setShowPin(true);
    } else {
      Haptics.selectionAsync();
      if (playlist.id !== activePlaylist?.id) {
        setActivePlaylist(playlist);
      }
      setSelectedGroup(group);
      setSelectedChannel(null);
    }
  };

  const handleLongPress = (group: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setContextGroup(group);
  };

  const handlePinSuccess = () => {
    if (pendingGroup && pendingPlaylist) {
      unlockForSession(pendingGroup);
      if (pendingPlaylist.id !== activePlaylist?.id) {
        setActivePlaylist(pendingPlaylist);
      }
      setSelectedGroup(pendingGroup);
      setSelectedChannel(null);
    }
    setShowPin(false);
    setPendingGroup(null);
    setPendingPlaylist(null);
  };

  // For non-TV sections: show groups from the active playlist only (flat list, old behavior)
  const singleModeGroups = useMemo(() => {
    if (currentSection === "TV" || !activePlaylist) return [];
    if (currentSection === "My List") return ["Favorites"];
    return getGroupsForPlaylist(currentSection, activePlaylist, hiddenGroups);
  }, [currentSection, activePlaylist, hiddenGroups]);

  // For TV section: group by playlist
  const multiModeData = useMemo(() => {
    if (currentSection !== "TV") return [];
    return playlists.map((pl) => ({
      playlist: pl,
      groups: getGroupsForPlaylist("TV", pl, hiddenGroups),
    }));
  }, [currentSection, playlists, hiddenGroups]);

  const isTV = currentSection === "TV";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderRightColor: colors.border,
          paddingTop: topPad + 8,
        },
      ]}
    >
      <Text style={[styles.header, { color: colors.mutedForeground }]}>
        {currentSection.toUpperCase()}
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 8, paddingHorizontal: 6 }}
      >
        {isTV ? (
          // Multi-playlist collapsible mode
          <>
            {hasFavorites && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  if (activePlaylist) {
                    setSelectedGroup("__favorites__");
                    setSelectedChannel(null);
                  }
                }}
                style={[
                  styles.groupItem,
                  { borderColor: "transparent" },
                  selectedGroup === "__favorites__" && { backgroundColor: colors.highlight, borderColor: `${colors.primary}30` },
                ]}
                activeOpacity={0.7}
              >
                {selectedGroup === "__favorites__" && (
                  <View style={[styles.activeStripe, { backgroundColor: "#fbbf24" }]} />
                )}
                <Feather name="star" size={11} color="#fbbf24" style={{ marginRight: 3 }} />
                <Text
                  style={[
                    styles.groupText,
                    {
                      color: selectedGroup === "__favorites__" ? colors.foreground : colors.foreground,
                      fontFamily: selectedGroup === "__favorites__" ? "Inter_600SemiBold" : "Inter_500Medium",
                      flex: 1,
                    },
                  ]}
                >
                  Favorites
                </Text>
              </TouchableOpacity>
            )}

            {multiModeData.map(({ playlist, groups }) => {
              const isActive = playlist.id === activePlaylist?.id;
              const isCollapsed = collapsedIds.has(playlist.id);

              return (
                <View key={playlist.id} style={styles.playlistSection}>
                  <PlaylistHeader
                    playlist={playlist}
                    isActive={isActive}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleCollapse(playlist.id)}
                  />

                  {!isCollapsed && groups.map((group) => {
                    const active = isActive && selectedGroup === group;
                    const locked = isGroupLocked(group);
                    const favOnly = favoritesOnlyGroups.includes(group);

                    return (
                      <TouchableOpacity
                        key={group}
                        onPress={() => handleSelect(group, playlist)}
                        onLongPress={() => handleLongPress(group)}
                        style={[
                          styles.groupItem,
                          { borderColor: "transparent" },
                          active && { backgroundColor: colors.highlight, borderColor: `${colors.primary}30` },
                        ]}
                        activeOpacity={0.7}
                      >
                        {active && <View style={[styles.activeStripe, { backgroundColor: colors.primary }]} />}
                        <Text
                          style={[
                            styles.groupText,
                            {
                              color: active ? colors.foreground : locked ? colors.mutedForeground : colors.secondaryForeground,
                              fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                              flex: 1,
                              paddingLeft: 8,
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {group}
                        </Text>
                        {favOnly && <Feather name="star" size={10} color="#fbbf24" style={{ marginLeft: 2 }} />}
                        {locked && <Feather name="lock" size={11} color={colors.destructive} style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}

                  {!isCollapsed && groups.length === 0 && (
                    <Text style={[styles.emptyText, { color: colors.mutedForeground, paddingLeft: 16 }]}>
                      No channels
                    </Text>
                  )}
                </View>
              );
            })}
          </>
        ) : (
          // Single-playlist flat list (Movies / Shows / My List)
          <>
            {singleModeGroups.map((group) => {
              const active = selectedGroup === group;
              const locked = isGroupLocked(group);
              const favOnly = favoritesOnlyGroups.includes(group);
              const isFavHeader = group === "Favorites";

              return (
                <TouchableOpacity
                  key={group}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedGroup(group);
                    setSelectedChannel(null);
                  }}
                  onLongPress={isFavHeader ? undefined : () => handleLongPress(group)}
                  style={[
                    styles.groupItem,
                    { borderColor: "transparent" },
                    active && { backgroundColor: colors.highlight, borderColor: `${colors.primary}30` },
                  ]}
                  activeOpacity={0.7}
                >
                  {active && <View style={[styles.activeStripe, { backgroundColor: isFavHeader ? "#fbbf24" : colors.primary }]} />}
                  {isFavHeader && <Feather name="star" size={11} color="#fbbf24" style={{ marginRight: 3 }} />}
                  <Text
                    style={[
                      styles.groupText,
                      {
                        color: active ? colors.foreground : locked ? colors.mutedForeground : colors.secondaryForeground,
                        fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                        flex: 1,
                        paddingLeft: isFavHeader ? 0 : 6,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {group}
                  </Text>
                  {favOnly && <Feather name="star" size={10} color="#fbbf24" style={{ marginLeft: 2 }} />}
                  {locked && <Feather name="lock" size={11} color={colors.destructive} style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              );
            })}

            {singleModeGroups.length === 0 && (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No groups</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <PinPad
        visible={showPin}
        title="Group Locked"
        subtitle={pendingGroup ? `Enter PIN to access\n"${pendingGroup}"` : undefined}
        onSuccess={handlePinSuccess}
        onCancel={() => { setShowPin(false); setPendingGroup(null); setPendingPlaylist(null); }}
        onVerify={verifyPin}
      />

      <GroupContextMenu
        group={contextGroup}
        visible={!!contextGroup}
        onClose={() => setContextGroup(null)}
        onManageFavorites={(g) => { onManageFavorites?.(g); }}
        onGroupOptions={(g) => setGroupOptionsGroup(g)}
      />

      <GroupOptionsSheet
        group={groupOptionsGroup}
        visible={!!groupOptionsGroup}
        onClose={() => setGroupOptionsGroup(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 200,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  header: {
    fontSize: 9,
    letterSpacing: 1.8,
    paddingHorizontal: 14,
    paddingBottom: 10,
    fontFamily: "Inter_700Bold",
  },
  playlistSection: {
    marginBottom: 4,
  },
  playlistHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  playlistTypeTag: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    flexShrink: 0,
  },
  playlistTypeText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  playlistHeaderLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  groupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 1,
    borderWidth: StyleSheet.hairlineWidth,
    position: "relative",
    overflow: "hidden",
  },
  activeStripe: {
    position: "absolute",
    left: 0,
    top: 5,
    bottom: 5,
    width: 3,
    borderRadius: 2,
  },
  groupText: {
    fontSize: 12,
  },
  empty: { padding: 16 },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", paddingVertical: 6 },
});
