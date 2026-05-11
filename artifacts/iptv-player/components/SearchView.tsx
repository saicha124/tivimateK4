import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Channel, EPGProgram, VODItem, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

const MAX_PER_SECTION = 30;

interface EpgResult {
  channel: Channel;
  program: EPGProgram;
}

interface Props {
  onPlayChannel: (channel: Channel) => void;
  onPlayVOD: (url: string, name: string) => void;
}

export function SearchView({ onPlayChannel, onPlayVOD }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activePlaylist } = useIPTV();
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const channels = activePlaylist?.channels ?? [];
  const movies = activePlaylist?.movies ?? [];
  const shows = activePlaylist?.shows ?? [];

  const q = query.trim().toLowerCase();

  const channelResults = useMemo(() => {
    if (!q) return [];
    return channels
      .filter((c) => c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
      .slice(0, MAX_PER_SECTION);
  }, [q, channels]);

  const movieResults = useMemo(() => {
    if (!q) return [];
    return movies.filter((m) => m.name.toLowerCase().includes(q)).slice(0, MAX_PER_SECTION);
  }, [q, movies]);

  const showResults = useMemo(() => {
    if (!q) return [];
    return shows.filter((s) => s.name.toLowerCase().includes(q)).slice(0, MAX_PER_SECTION);
  }, [q, shows]);

  const epgResults = useMemo((): EpgResult[] => {
    if (!q) return [];
    const results: EpgResult[] = [];
    for (const channel of channels) {
      if (!channel.epg) continue;
      for (const program of channel.epg) {
        if (program.title.toLowerCase().includes(q)) {
          results.push({ channel, program });
          if (results.length >= MAX_PER_SECTION) return results;
        }
      }
    }
    return results;
  }, [q, channels]);

  const hasResults =
    channelResults.length > 0 ||
    movieResults.length > 0 ||
    showResults.length > 0 ||
    epgResults.length > 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Search header */}
      <View
        style={[
          styles.searchHeader,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.sidebar,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={20} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search channels, movies, shows, programs…"
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      <ScrollView
        style={styles.results}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottomPad + 16, flexGrow: 1 }}
      >
        {!q ? (
          <View style={styles.emptyState}>
            <Feather
              name="search"
              size={44}
              color={colors.mutedForeground}
              style={{ marginBottom: 14 }}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Search everything
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Find channels, movies, shows and EPG programs all in one place
            </Text>
          </View>
        ) : !hasResults ? (
          <View style={styles.emptyState}>
            <Feather
              name="search"
              size={44}
              color={colors.mutedForeground}
              style={{ marginBottom: 14 }}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No results for "{query}"
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Try a different search term
            </Text>
          </View>
        ) : (
          <>
            {channelResults.length > 0 && (
              <ResultSection label="Channels" count={channelResults.length} colors={colors}>
                {channelResults.map((ch) => (
                  <ChannelCard
                    key={ch.id}
                    channel={ch}
                    colors={colors}
                    onPress={() => onPlayChannel(ch)}
                  />
                ))}
              </ResultSection>
            )}

            {movieResults.length > 0 && (
              <ResultSection label="Movies" count={movieResults.length} colors={colors}>
                {movieResults.map((m) => (
                  <VODCard
                    key={m.id}
                    item={m}
                    colors={colors}
                    onPress={() => onPlayVOD(m.url, m.name)}
                  />
                ))}
              </ResultSection>
            )}

            {showResults.length > 0 && (
              <ResultSection label="TV Shows" count={showResults.length} colors={colors}>
                {showResults.map((s) => (
                  <VODCard
                    key={s.id}
                    item={s}
                    colors={colors}
                    onPress={() => onPlayVOD(s.url, s.name)}
                  />
                ))}
              </ResultSection>
            )}

            {epgResults.length > 0 && (
              <View style={[styles.section, { borderTopColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                    PROGRAMS
                  </Text>
                  <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
                    {epgResults.length} results
                  </Text>
                </View>
                {epgResults.map(({ channel, program }, i) => (
                  <EpgRow
                    key={`${channel.id}-${program.startTime}-${i}`}
                    channel={channel}
                    program={program}
                    colors={colors}
                    onPress={() => onPlayChannel(channel)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ResultSection({
  label,
  count,
  colors,
  children,
}: {
  label: string;
  count: number;
  colors: any;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { borderTopColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {label.toUpperCase()}
        </Text>
        <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
          {count} results
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingBottom: 6 }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function ChannelCard({
  channel,
  colors,
  onPress,
}: {
  channel: Channel;
  colors: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.channelCard}>
      <View
        style={[
          styles.channelLogo,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        {channel.logo ? (
          <Image
            source={{ uri: channel.logo }}
            style={styles.channelLogoImg}
            contentFit="contain"
          />
        ) : (
          <Feather name="tv" size={22} color={colors.mutedForeground} />
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          style={styles.channelGrad}
        />
        <View style={[styles.channelPlayBtn, { backgroundColor: colors.primary }]}>
          <Feather name="play" size={9} color="#fff" />
        </View>
      </View>
      <Text style={[styles.channelName, { color: colors.foreground }]} numberOfLines={2}>
        {channel.name}
      </Text>
      <Text style={[styles.channelGroup, { color: colors.mutedForeground }]} numberOfLines={1}>
        {channel.group}
      </Text>
    </TouchableOpacity>
  );
}

function VODCard({
  item,
  colors,
  onPress,
}: {
  item: VODItem;
  colors: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.vodCard}>
      <View style={[styles.vodPoster, { backgroundColor: colors.secondary }]}>
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={styles.vodPosterImg} contentFit="cover" />
        ) : (
          <Feather name="film" size={28} color={colors.mutedForeground} />
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.65)"]}
          style={styles.vodGrad}
        />
        {item.year && (
          <View style={styles.yearBadge}>
            <Text style={styles.yearText}>{item.year.slice(0, 4)}</Text>
          </View>
        )}
        <View style={[styles.vodPlayBtn, { backgroundColor: colors.primary }]}>
          <Feather name="play" size={9} color="#fff" />
        </View>
      </View>
      <Text style={[styles.vodName, { color: colors.foreground }]} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
}

function EpgRow({
  channel,
  program,
  colors,
  onPress,
}: {
  channel: Channel;
  program: EPGProgram;
  colors: any;
  onPress: () => void;
}) {
  const start = new Date(program.startTime);
  const end = new Date(program.endTime);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const timeStr = `${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;
  const now = Date.now();
  const isLive = program.startTime <= now && now < program.endTime;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.epgRow, { borderBottomColor: colors.border }]}
    >
      <View style={[styles.epgLogo, { backgroundColor: colors.secondary }]}>
        {channel.logo ? (
          <Image
            source={{ uri: channel.logo }}
            style={styles.epgLogoImg}
            contentFit="contain"
          />
        ) : (
          <Feather name="tv" size={16} color={colors.mutedForeground} />
        )}
      </View>
      <View style={styles.epgInfo}>
        <Text style={[styles.epgTitle, { color: colors.foreground }]} numberOfLines={1}>
          {program.title}
        </Text>
        <Text style={[styles.epgMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {channel.name} · {timeStr}
        </Text>
      </View>
      {isLive && (
        <View style={[styles.liveBadge, { backgroundColor: "#e53935" }]}>
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      )}
      <View style={[styles.epgPlayBtn, { backgroundColor: colors.primary }]}>
        <Feather name="play" size={11} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  results: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  section: {
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },
  sectionCount: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  // Channel card
  channelCard: {
    width: 118,
  },
  channelLogo: {
    width: 118,
    height: 76,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    position: "relative",
  },
  channelLogoImg: {
    width: 118,
    height: 76,
  },
  channelGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 38,
  },
  channelPlayBtn: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  channelName: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 6,
    lineHeight: 15,
  },
  channelGroup: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  // VOD card
  vodCard: {
    width: 100,
  },
  vodPoster: {
    width: 100,
    height: 145,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  vodPosterImg: {
    width: 100,
    height: 145,
  },
  vodGrad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 55,
  },
  yearBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  yearText: {
    fontSize: 9,
    color: "#ddd",
    fontFamily: "Inter_600SemiBold",
  },
  vodPlayBtn: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  vodName: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 6,
    lineHeight: 15,
  },
  // EPG row
  epgRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  epgLogo: {
    width: 54,
    height: 36,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  epgLogoImg: {
    width: 54,
    height: 36,
  },
  epgInfo: {
    flex: 1,
    gap: 3,
  },
  epgTitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  epgMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  liveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  liveBadgeText: {
    fontSize: 9,
    color: "#fff",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  epgPlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
});
