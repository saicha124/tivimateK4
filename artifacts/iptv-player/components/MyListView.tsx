import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Channel, EPGProgram, ProgramReminder, WatchHistoryItem, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

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
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

type SubSection = "recent" | "tv" | "reminders" | "movies" | "shows";

const SUB_SECTIONS: { key: SubSection; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "recent", label: "Recently watched", icon: "clock" },
  { key: "tv", label: "My TV programs", icon: "tv" },
  { key: "reminders", label: "My reminders", icon: "bell" },
  { key: "movies", label: "My movies", icon: "film" },
  { key: "shows", label: "My shows", icon: "grid" },
];

function SectionHeader({ label, count }: { label: string; count: number }) {
  const colors = useColors();
  return (
    <View style={[sectionStyles.header, { borderBottomColor: colors.border }]}>
      <Text style={[sectionStyles.label, { color: colors.mutedForeground }]}>{label.toUpperCase()}</Text>
      {count > 0 && (
        <View style={[sectionStyles.countBadge, { backgroundColor: colors.secondary }]}>
          <Text style={[sectionStyles.countText, { color: colors.mutedForeground }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});

function FavoriteChannelRow({
  channel,
  onPlay,
}: {
  channel: Channel;
  onPlay: (channel: Channel) => void;
}) {
  const colors = useColors();
  const now = Date.now();
  const nowProg = channel.epg?.find((p) => p.startTime <= now && p.endTime >= now);

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        onPlay(channel);
      }}
      style={[rowStyles.row, { borderBottomColor: colors.border }]}
      activeOpacity={0.8}
    >
      <View style={[rowStyles.logo, { backgroundColor: colors.secondary }]}>
        {channel.logo ? (
          <Image source={{ uri: channel.logo }} style={rowStyles.logoImg} contentFit="contain" />
        ) : (
          <Feather name="tv" size={18} color={colors.mutedForeground} />
        )}
      </View>
      <View style={rowStyles.info}>
        <Text style={[rowStyles.name, { color: colors.foreground }]} numberOfLines={1}>
          {channel.name}
        </Text>
        {nowProg ? (
          <Text style={[rowStyles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {nowProg.title}
          </Text>
        ) : (
          <Text style={[rowStyles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {channel.group}
          </Text>
        )}
      </View>
      <View style={[rowStyles.playBtn, { backgroundColor: colors.primary }]}>
        <Feather name="play" size={14} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

function ReminderRow({
  reminder,
  onDelete,
}: {
  reminder: ProgramReminder;
  onDelete: (id: string) => void;
}) {
  const colors = useColors();
  const isFuture = reminder.startTime > Date.now();

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === "web") {
      onDelete(reminder.id);
      return;
    }
    Alert.alert("Delete reminder?", `Remove reminder for "${reminder.programTitle}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(reminder.id) },
    ]);
  };

  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[rowStyles.logo, { backgroundColor: colors.secondary }]}>
        {reminder.channelLogo ? (
          <Image source={{ uri: reminder.channelLogo }} style={rowStyles.logoImg} contentFit="contain" />
        ) : (
          <Feather name="tv" size={18} color={colors.mutedForeground} />
        )}
      </View>
      <View style={rowStyles.info}>
        <Text style={[rowStyles.name, { color: colors.foreground }]} numberOfLines={1}>
          {reminder.programTitle}
        </Text>
        <Text style={[rowStyles.sub, { color: colors.primary }]} numberOfLines={1}>
          {reminder.channelName}
        </Text>
        <Text style={[rowStyles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {formatDate(reminder.startTime)} · {formatTime(reminder.startTime)} – {formatTime(reminder.endTime)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {isFuture && (
          <View style={[rowStyles.futureBadge, { backgroundColor: `${colors.primary}20` }]}>
            <Feather name="bell" size={10} color={colors.primary} />
          </View>
        )}
        <TouchableOpacity
          onPress={handleDelete}
          style={[rowStyles.deleteBtn, { backgroundColor: `${colors.destructive}15` }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={14} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RecentRow({
  item,
  onPlay,
}: {
  item: WatchHistoryItem;
  onPlay: (url: string, name: string) => void;
}) {
  const colors = useColors();

  const typeIcon: keyof typeof Feather.glyphMap =
    item.type === "movie" ? "film" : item.type === "show" ? "grid" : "tv";
  const typeLabel =
    item.type === "movie" ? "Movie" : item.type === "show" ? "Series" : item.channelGroup;

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        onPlay(item.channelUrl, item.channelName);
      }}
      style={[rowStyles.row, { borderBottomColor: colors.border }]}
      activeOpacity={0.8}
    >
      <View style={[rowStyles.logo, { backgroundColor: colors.secondary }]}>
        {item.channelLogo ? (
          <Image source={{ uri: item.channelLogo }} style={rowStyles.logoImg} contentFit="contain" />
        ) : (
          <Feather name={typeIcon} size={18} color={colors.mutedForeground} />
        )}
      </View>
      <View style={rowStyles.info}>
        <Text style={[rowStyles.name, { color: colors.foreground }]} numberOfLines={1}>
          {item.channelName}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={[recentStyles.typePill, { backgroundColor: colors.secondary }]}>
            <Feather name={typeIcon} size={9} color={colors.mutedForeground} />
            <Text style={[recentStyles.typePillText, { color: colors.mutedForeground }]}>{typeLabel}</Text>
          </View>
          <Text style={[rowStyles.sub, { color: colors.mutedForeground }]}>
            {formatDate(item.watchedAt)} · {formatTime(item.watchedAt)}
          </Text>
        </View>
      </View>
      <View style={[rowStyles.playBtn, { backgroundColor: colors.primary }]}>
        <Feather name="play" size={14} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

const recentStyles = StyleSheet.create({
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typePillText: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
  },
});

function HistoryRow({
  item,
  onPlay,
}: {
  item: WatchHistoryItem;
  onPlay: (url: string, name: string) => void;
}) {
  const colors = useColors();
  const channel: Channel = {
    id: item.channelId,
    name: item.channelName,
    group: item.channelGroup,
    logo: item.channelLogo,
    url: item.channelUrl,
  };

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.selectionAsync();
        onPlay(item.channelUrl, item.channelName);
      }}
      style={[rowStyles.row, { borderBottomColor: colors.border }]}
      activeOpacity={0.8}
    >
      <View style={[rowStyles.logo, { backgroundColor: colors.secondary }]}>
        {item.channelLogo ? (
          <Image source={{ uri: item.channelLogo }} style={rowStyles.logoImg} contentFit="contain" />
        ) : (
          <Feather name="tv" size={18} color={colors.mutedForeground} />
        )}
      </View>
      <View style={rowStyles.info}>
        <Text style={[rowStyles.name, { color: colors.foreground }]} numberOfLines={1}>
          {item.channelName}
        </Text>
        <Text style={[rowStyles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {formatDate(item.watchedAt)} · {formatTime(item.watchedAt)}
        </Text>
      </View>
      <View style={[rowStyles.playBtn, { backgroundColor: colors.primary }]}>
        <Feather name="play" size={14} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  logo: {
    width: 44,
    height: 32,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  logoImg: {
    width: 44,
    height: 32,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  sub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  futureBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
});

interface MyListViewProps {
  onPlayChannel: (channel: Channel) => void;
  onPlayVOD: (url: string, name: string) => void;
}

export function MyListView({ onPlayChannel, onPlayVOD }: MyListViewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    activePlaylist,
    favorites,
    hiddenChannels,
    programReminders,
    removeProgramReminder,
    watchHistory,
    clearWatchHistory,
  } = useIPTV();

  const [activeSubSection, setActiveSubSection] = useState<SubSection>("recent");

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const favoriteChannels = (activePlaylist?.channels ?? []).filter(
    (c) => favorites.includes(c.id) && !hiddenChannels.includes(c.id)
  );

  const favoriteMovies = (activePlaylist?.movies ?? []).filter((m) =>
    favorites.includes(m.id)
  );

  const favoriteShows = (activePlaylist?.shows ?? []).filter((s) =>
    favorites.includes(s.id)
  );

  const todayReminders = programReminders.filter((r) => {
    const d = new Date(r.startTime);
    return d.toDateString() === new Date().toDateString();
  });

  const otherReminders = programReminders.filter((r) => {
    const d = new Date(r.startTime);
    return d.toDateString() !== new Date().toDateString();
  });

  const recentlyWatched = watchHistory.slice(0, 20);

  const renderContent = () => {
    if (activeSubSection === "recent") {
      if (recentlyWatched.length === 0) {
        return (
          <View style={styles.empty}>
            <Feather name="clock" size={40} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing watched yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Channels, movies and shows you play will appear here
            </Text>
          </View>
        );
      }

      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad + 16 }}>
          <View style={[sectionStyles.header, { borderBottomColor: colors.border }]}>
            <Text style={[sectionStyles.label, { color: colors.mutedForeground }]}>RECENTLY WATCHED</Text>
            <TouchableOpacity onPress={() => {
              Haptics.selectionAsync();
              if (Platform.OS === "web") { clearWatchHistory(); return; }
              Alert.alert("Clear History", "Remove all recently watched?", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: clearWatchHistory },
              ]);
            }}>
              <Text style={[{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium" }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          {recentlyWatched.map((item) => (
            <RecentRow
              key={`${item.channelId}-${item.watchedAt}`}
              item={item}
              onPlay={onPlayVOD}
            />
          ))}
        </ScrollView>
      );
    }

    if (activeSubSection === "tv") {
      if (favoriteChannels.length === 0 && watchHistory.length === 0) {
        return (
          <View style={styles.empty}>
            <Feather name="tv" size={40} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No TV programs saved</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add channels to favorites or watch history will appear here
            </Text>
          </View>
        );
      }

      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad + 16 }}>
          {favoriteChannels.length > 0 && (
            <>
              <SectionHeader label="Favorites" count={favoriteChannels.length} />
              {favoriteChannels.map((ch) => (
                <FavoriteChannelRow key={ch.id} channel={ch} onPlay={onPlayChannel} />
              ))}
            </>
          )}
          {watchHistory.length > 0 && (
            <>
              <View style={[sectionStyles.header, { borderBottomColor: colors.border }]}>
                <Text style={[sectionStyles.label, { color: colors.mutedForeground }]}>WATCH HISTORY</Text>
                <TouchableOpacity onPress={() => {
                  Haptics.selectionAsync();
                  if (Platform.OS === "web") { clearWatchHistory(); return; }
                  Alert.alert("Clear History", "Remove all watch history?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Clear", style: "destructive", onPress: clearWatchHistory },
                  ]);
                }}>
                  <Text style={[{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium" }]}>Clear</Text>
                </TouchableOpacity>
              </View>
              {watchHistory.slice(0, 20).map((item) => (
                <HistoryRow key={`${item.channelId}-${item.watchedAt}`} item={item} onPlay={onPlayVOD} />
              ))}
            </>
          )}
        </ScrollView>
      );
    }

    if (activeSubSection === "reminders") {
      if (programReminders.length === 0) {
        return (
          <View style={styles.empty}>
            <Feather name="bell" size={40} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No reminders</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Set reminders from any program in the TV Guide
            </Text>
          </View>
        );
      }

      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad + 16 }}>
          {todayReminders.length > 0 && (
            <>
              <SectionHeader label="Today" count={todayReminders.length} />
              {todayReminders.map((r) => (
                <ReminderRow key={r.id} reminder={r} onDelete={removeProgramReminder} />
              ))}
            </>
          )}
          {otherReminders.length > 0 && (
            <>
              <SectionHeader label="Upcoming" count={otherReminders.length} />
              {otherReminders.map((r) => (
                <ReminderRow key={r.id} reminder={r} onDelete={removeProgramReminder} />
              ))}
            </>
          )}
        </ScrollView>
      );
    }

    if (activeSubSection === "movies") {
      if (favoriteMovies.length === 0) {
        return (
          <View style={styles.empty}>
            <Feather name="film" size={40} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No movies saved</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add movies to favorites to see them here
            </Text>
          </View>
        );
      }

      return (
        <FlatList
          data={favoriteMovies}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad + 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                onPlayVOD(item.url, item.name);
              }}
              style={[rowStyles.row, { borderBottomColor: colors.border }]}
              activeOpacity={0.8}
            >
              <View style={[rowStyles.logo, { backgroundColor: colors.secondary }]}>
                {item.logo ? (
                  <Image source={{ uri: item.logo }} style={rowStyles.logoImg} contentFit="contain" />
                ) : (
                  <Feather name="film" size={18} color={colors.mutedForeground} />
                )}
              </View>
              <View style={rowStyles.info}>
                <Text style={[rowStyles.name, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[rowStyles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.category}</Text>
              </View>
              <View style={[rowStyles.playBtn, { backgroundColor: colors.primary }]}>
                <Feather name="play" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        />
      );
    }

    if (activeSubSection === "shows") {
      if (favoriteShows.length === 0) {
        return (
          <View style={styles.empty}>
            <Feather name="grid" size={40} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No shows saved</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add shows to favorites to see them here
            </Text>
          </View>
        );
      }

      return (
        <FlatList
          data={favoriteShows}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad + 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                onPlayVOD(item.url, item.name);
              }}
              style={[rowStyles.row, { borderBottomColor: colors.border }]}
              activeOpacity={0.8}
            >
              <View style={[rowStyles.logo, { backgroundColor: colors.secondary }]}>
                {item.logo ? (
                  <Image source={{ uri: item.logo }} style={rowStyles.logoImg} contentFit="contain" />
                ) : (
                  <Feather name="grid" size={18} color={colors.mutedForeground} />
                )}
              </View>
              <View style={rowStyles.info}>
                <Text style={[rowStyles.name, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[rowStyles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.category}</Text>
              </View>
              <View style={[rowStyles.playBtn, { backgroundColor: colors.primary }]}>
                <Feather name="play" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        />
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.subNav, { backgroundColor: colors.sidebar, borderBottomColor: colors.border, paddingTop: topPad + 8 }]}>
        {SUB_SECTIONS.map((sub) => {
          const active = activeSubSection === sub.key;
          const badgeCount =
            sub.key === "recent" ? recentlyWatched.length :
            sub.key === "reminders" ? programReminders.length :
            sub.key === "tv" ? favoriteChannels.length :
            sub.key === "movies" ? favoriteMovies.length :
            favoriteShows.length;

          return (
            <TouchableOpacity
              key={sub.key}
              onPress={() => { Haptics.selectionAsync(); setActiveSubSection(sub.key); }}
              style={[styles.subNavItem, active && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              activeOpacity={0.7}
            >
              <Feather name={sub.icon} size={14} color={active ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.subNavLabel, { color: active ? colors.primary : colors.mutedForeground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {sub.label}
              </Text>
              {badgeCount > 0 && (
                <View style={[styles.badge, { backgroundColor: active ? colors.primary : colors.secondary }]}>
                  <Text style={[styles.badgeText, { color: active ? "#fff" : colors.mutedForeground }]}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  subNav: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 4,
  },
  subNavItem: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  subNavLabel: {
    fontSize: 10,
    textAlign: "center",
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 18,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  content: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
