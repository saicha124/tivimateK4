import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Section, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

interface SidebarItem {
  section: Section;
  icon: keyof typeof Feather.glyphMap;
  label: string;
}

const ITEMS: SidebarItem[] = [
  { section: "TV", icon: "tv", label: "TV" },
  { section: "Movies", icon: "film", label: "Movies" },
  { section: "Shows", icon: "grid", label: "Shows" },
  { section: "Search", icon: "search", label: "Search" },
  { section: "Recordings", icon: "video", label: "Recordings" },
  { section: "My List", icon: "bookmark", label: "My List" },
];

interface SidebarProps {
  onSettings: () => void;
  onSwitchPlaylist: () => void;
}

function getRecordingStatus(startTime: number, endTime: number, now: number) {
  if (endTime < now) return "completed";
  if (startTime <= now) return "recording";
  return "scheduled";
}

export function Sidebar({ onSettings, onSwitchPlaylist }: SidebarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentSection, setCurrentSection, activePlaylist, playlists, recordings } = useIPTV();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const now = Date.now();

  const { activeCount, scheduledCount } = useMemo(() => {
    let activeCount = 0;
    let scheduledCount = 0;
    for (const r of recordings) {
      const s = getRecordingStatus(r.startTime, r.endTime, now);
      if (s === "recording") activeCount++;
      else if (s === "scheduled") scheduledCount++;
    }
    return { activeCount, scheduledCount };
  }, [recordings, now]);

  const recordingsBadge = activeCount > 0 ? activeCount : scheduledCount > 0 ? scheduledCount : 0;
  const recordingsBadgeColor = activeCount > 0 ? "#f44336" : colors.primary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.sidebar,
          paddingTop: topPad + 6,
          paddingBottom: bottomPad + 6,
          borderRightColor: colors.border,
        },
      ]}
    >
      {/* Logo */}
      <View style={styles.logo}>
        <Text style={[styles.logoBlue, { color: colors.primary }]}>tivi</Text>
        <Text style={[styles.logoWhite, { color: colors.foreground }]}>mate</Text>
      </View>

      {/* Active playlist badge — tap to switch */}
      <TouchableOpacity
        onPress={() => {
          Haptics.selectionAsync();
          onSwitchPlaylist();
        }}
        style={[styles.playlistBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        activeOpacity={0.75}
      >
        <View style={styles.playlistBadgeLeft}>
          <View style={[styles.playlistDot, { backgroundColor: activePlaylist ? colors.primary : colors.mutedForeground }]} />
          <Text
            style={[
              styles.playlistName,
              { color: activePlaylist ? colors.foreground : colors.mutedForeground },
            ]}
            numberOfLines={1}
          >
            {activePlaylist?.name ?? "No playlist"}
          </Text>
        </View>
        <Feather name="chevron-down" size={12} color={colors.mutedForeground} />
      </TouchableOpacity>

      {playlists.length > 1 && (
        <Text style={[styles.playlistCount, { color: colors.mutedForeground }]}>
          {playlists.length} playlists
        </Text>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Nav items */}
      <View style={styles.navItems}>
        {ITEMS.map((item) => {
          const active = item.section === currentSection;
          const isRecordings = item.section === "Recordings";
          const badge = isRecordings ? recordingsBadge : 0;

          return (
            <TouchableOpacity
              key={item.section}
              onPress={() => {
                Haptics.selectionAsync();
                setCurrentSection(item.section);
              }}
              style={[
                styles.item,
                active && { backgroundColor: colors.highlight },
              ]}
              activeOpacity={0.7}
            >
              <View style={{ position: "relative" }}>
                <Feather
                  name={item.icon}
                  size={19}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                {badge > 0 && (
                  <View style={[styles.badge, { backgroundColor: recordingsBadgeColor }]}>
                    <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.itemLabel,
                  {
                    color: active ? colors.foreground : colors.mutedForeground,
                    fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                    flex: 1,
                  },
                ]}
              >
                {item.label}
              </Text>
              {active && (
                <View style={[styles.activeBar, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            onSettings();
          }}
          style={styles.item}
          activeOpacity={0.7}
        >
          <Feather name="settings" size={19} color={colors.mutedForeground} />
          <Text style={[styles.itemLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 130,
    borderRightWidth: 1,
    flexDirection: "column",
  },
  logo: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 10,
    alignItems: "center",
  },
  logoBlue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  logoWhite: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  playlistBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 8,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  playlistBadgeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    overflow: "hidden",
  },
  playlistDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  playlistName: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  playlistCount: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 4,
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  navItems: {
    flex: 1,
    gap: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 4,
    marginHorizontal: 4,
    position: "relative",
  },
  itemLabel: {
    fontSize: 12,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -5,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontFamily: "Inter_700Bold",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 6,
    marginTop: 4,
  },
});
