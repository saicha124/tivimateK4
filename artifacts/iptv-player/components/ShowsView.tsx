import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VODItem, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

const SPECIAL_CATS = ["All shows", "My list", "History"];

interface ShowsViewProps {
  onPlayVOD: (url: string, name: string) => void;
}

interface SeriesGroup {
  name: string;
  logo?: string;
  episodes: VODItem[];
  category: string;
}

function groupIntoSeries(shows: VODItem[]): SeriesGroup[] {
  const map: Record<string, SeriesGroup> = {};
  for (const ep of shows) {
    const base = ep.name
      .replace(/\s*[Ss]\d{1,2}[Ee]\d{1,2}.*$/, "")
      .replace(/\s*[-–]\s*[Ss]\d.*$/, "")
      .replace(/\s*\(\d{4}\)\s*$/, "")
      .trim();
    const key = base || ep.name;
    if (!map[key]) {
      map[key] = { name: key, logo: ep.logo, episodes: [], category: ep.category };
    }
    map[key].episodes.push(ep);
  }
  return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
}

function extractSeasonEp(name: string): { season: number; ep: number } | null {
  const m = name.match(/[Ss](\d{1,2})[Ee](\d{1,2})/);
  if (m) return { season: parseInt(m[1]), ep: parseInt(m[2]) };
  return null;
}

function groupEpisodesBySeasons(episodes: VODItem[]): Record<number, VODItem[]> {
  const map: Record<number, VODItem[]> = {};
  for (const ep of episodes) {
    const info = extractSeasonEp(ep.name);
    const season = info?.season ?? 1;
    if (!map[season]) map[season] = [];
    map[season].push(ep);
  }
  for (const s of Object.keys(map)) {
    map[parseInt(s)].sort((a, b) => {
      const ai = extractSeasonEp(a.name)?.ep ?? 0;
      const bi = extractSeasonEp(b.name)?.ep ?? 0;
      return ai - bi;
    });
  }
  return map;
}

function SeriesCard({
  series,
  selected,
  onPress,
}: {
  series: SeriesGroup;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.seriesCard,
        selected && { borderColor: colors.primary, borderWidth: 2 },
      ]}
    >
      {series.logo ? (
        <Image source={{ uri: series.logo }} style={styles.seriesImg} contentFit="cover" />
      ) : (
        <View style={[styles.seriesPlaceholder, { backgroundColor: colors.secondary }]}>
          <Feather name="grid" size={28} color={colors.mutedForeground} />
        </View>
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.88)"]}
        style={styles.seriesGradient}
      />
      <Text style={styles.seriesTitle} numberOfLines={2}>{series.name}</Text>
      <View style={styles.episodeBadge}>
        <Text style={styles.episodeBadgeText}>{series.episodes.length} ep</Text>
      </View>
    </TouchableOpacity>
  );
}

function SeriesDetail({
  series,
  isFav,
  onPlayEp,
  onToggleFav,
}: {
  series: SeriesGroup;
  isFav: boolean;
  onPlayEp: (ep: VODItem) => void;
  onToggleFav: () => void;
}) {
  const colors = useColors();
  const seasonMap = useMemo(() => groupEpisodesBySeasons(series.episodes), [series]);
  const seasons = Object.keys(seasonMap).map(Number).sort((a, b) => a - b);
  const [activeSeason, setActiveSeason] = useState(seasons[0] ?? 1);

  const eps = seasonMap[activeSeason] ?? [];

  return (
    <View style={styles.detailRoot}>
      {/* Backdrop */}
      <View style={styles.detailBanner}>
        {series.logo ? (
          <Image
            source={{ uri: series.logo }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={Platform.OS === "web" ? 0 : 3}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.secondary }]} />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.25)", "rgba(17,17,17,0.98)"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle} numberOfLines={2}>{series.name}</Text>
          <View style={styles.bannerMeta}>
            <Text style={[styles.bannerMetaText, { color: colors.primary }]}>{series.category}</Text>
            <Text style={[styles.bannerMetaText, { color: colors.mutedForeground }]}>
              · {seasons.length} {seasons.length === 1 ? "Season" : "Seasons"}
            </Text>
            <Text style={[styles.bannerMetaText, { color: colors.mutedForeground }]}>
              · {series.episodes.length} Episodes
            </Text>
          </View>
          <View style={styles.bannerActions}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (eps[0]) onPlayEp(eps[0]);
              }}
              style={[styles.playBtn, { backgroundColor: colors.foreground }]}
              activeOpacity={0.85}
            >
              <Feather name="play" size={15} color={colors.background} />
              <Text style={[styles.playBtnText, { color: colors.background }]}>
                Play S{activeSeason} E1
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); onToggleFav(); }}
              style={[styles.favBtn, { backgroundColor: isFav ? `${colors.primary}25` : colors.secondary, borderColor: isFav ? colors.primary : colors.border }]}
              activeOpacity={0.8}
            >
              <Feather name="bookmark" size={14} color={isFav ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.favBtnText, { color: isFav ? colors.primary : colors.mutedForeground }]}>
                {isFav ? "Saved" : "My List"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Season tabs */}
      {seasons.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.seasonTabs, { backgroundColor: colors.sidebar, borderBottomColor: colors.border }]}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 4 }}
        >
          {seasons.map((s) => {
            const active = s === activeSeason;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => { Haptics.selectionAsync(); setActiveSeason(s); }}
                style={[
                  styles.seasonTab,
                  active && { backgroundColor: colors.primary },
                  !active && { backgroundColor: colors.secondary },
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.seasonTabText, { color: active ? "#fff" : colors.mutedForeground }]}>
                  Season {s}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Episodes */}
      <FlatList
        data={eps}
        keyExtractor={(ep) => ep.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20, paddingTop: 4 }}
        renderItem={({ item: ep, index }) => {
          const info = extractSeasonEp(ep.name);
          const epNum = info?.ep ?? index + 1;
          return (
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); onPlayEp(ep); }}
              style={[styles.epRow, { borderBottomColor: colors.border }]}
              activeOpacity={0.8}
            >
              <View style={[styles.epNumBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.epNum, { color: colors.mutedForeground }]}>{epNum}</Text>
              </View>
              <View style={[styles.epThumb, { backgroundColor: colors.secondary }]}>
                {ep.logo ? (
                  <Image source={{ uri: ep.logo }} style={styles.epThumbImg} contentFit="cover" />
                ) : (
                  <Feather name="film" size={18} color={colors.mutedForeground} />
                )}
              </View>
              <View style={styles.epInfo}>
                <Text style={[styles.epTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {ep.name}
                </Text>
              </View>
              <View style={[styles.epPlayBtn, { backgroundColor: colors.primary }]}>
                <Feather name="play" size={13} color="#fff" />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

export function ShowsView({ onPlayVOD }: ShowsViewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activePlaylist, favorites, toggleFavorite, watchHistory } = useIPTV();

  const shows = activePlaylist?.shows ?? [];

  const categories = useMemo(() => {
    const cats = Array.from(new Set(shows.map((s) => s.category))).sort();
    return [...SPECIAL_CATS, ...cats];
  }, [shows]);

  const [selectedCat, setSelectedCat] = useState("All shows");
  const [selectedSeries, setSelectedSeries] = useState<SeriesGroup | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const filteredShows = useMemo(() => {
    if (selectedCat === "All shows") return shows;
    if (selectedCat === "My list") return shows.filter((s) => favorites.includes(s.id));
    if (selectedCat === "History") {
      const ids = new Set(watchHistory.map((h) => h.channelId));
      return shows.filter((s) => ids.has(s.id));
    }
    return shows.filter((s) => s.category === selectedCat);
  }, [selectedCat, shows, favorites, watchHistory]);

  const seriesList = useMemo(() => groupIntoSeries(filteredShows), [filteredShows]);

  const currentSeries = selectedSeries ?? seriesList[0] ?? null;

  const firstEpId = currentSeries?.episodes[0]?.id ?? null;
  const isFav = firstEpId ? favorites.includes(firstEpId) : false;

  if (shows.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Feather name="grid" size={52} color={colors.mutedForeground} style={{ marginBottom: 14 }} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No shows available</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Shows and series from your playlist will appear here
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Left category sidebar */}
      <View style={[styles.catSidebar, { backgroundColor: colors.sidebar, borderRightColor: colors.border, paddingTop: topPad + 8 }]}>
        <Text style={[styles.catHeader, { color: colors.mutedForeground }]}>SHOWS</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad + 16 }}>
          {categories.map((cat) => {
            const active = cat === selectedCat;
            const isSpecial = SPECIAL_CATS.includes(cat);
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCat(cat);
                  setSelectedSeries(null);
                }}
                style={[styles.catItem, active && { backgroundColor: colors.highlight }]}
                activeOpacity={0.7}
              >
                {isSpecial && (
                  <Feather
                    name={cat === "My list" ? "bookmark" : cat === "History" ? "clock" : "grid"}
                    size={13}
                    color={active ? colors.primary : colors.mutedForeground}
                    style={{ marginRight: 6 }}
                  />
                )}
                <Text
                  style={[
                    styles.catLabel,
                    {
                      color: active ? colors.foreground : colors.mutedForeground,
                      fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {cat}
                </Text>
                {active && <View style={[styles.catActiveBar, { backgroundColor: colors.primary }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Right: Series list + detail */}
      <View style={styles.content}>
        {/* Series detail panel */}
        {currentSeries && (
          <SeriesDetail
            series={currentSeries}
            isFav={isFav}
            onPlayEp={(ep) => onPlayVOD(ep.url, ep.name)}
            onToggleFav={() => {
              if (currentSeries.episodes[0]) toggleFavorite(currentSeries.episodes[0].id);
            }}
          />
        )}

        {/* Series horizontal scroll */}
        {seriesList.length > 0 && (
          <View style={[styles.seriesStrip, { borderTopColor: colors.border }]}>
            <Text style={[styles.stripHeader, { color: colors.mutedForeground }]}>
              {seriesList.length} {seriesList.length === 1 ? "SERIES" : "SERIES"}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: bottomPad + 8 }}
            >
              {seriesList.map((s) => (
                <SeriesCard
                  key={s.name}
                  series={s}
                  selected={currentSeries?.name === s.name}
                  onPress={() => { Haptics.selectionAsync(); setSelectedSeries(s); }}
                />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

const CARD_W = 110;
const CARD_H = 155;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
  },
  catSidebar: {
    width: 160,
    borderRightWidth: 1,
    paddingHorizontal: 4,
  },
  catHeader: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  catItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 4,
    marginHorizontal: 2,
    position: "relative",
  },
  catLabel: {
    fontSize: 12,
    flex: 1,
  },
  catActiveBar: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  content: {
    flex: 1,
  },
  detailRoot: {
    flex: 1,
  },
  detailBanner: {
    height: 200,
    position: "relative",
    overflow: "hidden",
  },
  bannerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingTop: 28,
  },
  bannerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 4,
  },
  bannerMeta: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  bannerMetaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  bannerActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  playBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  favBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  favBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  seasonTabs: {
    height: 40,
    borderBottomWidth: 1,
  },
  seasonTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginVertical: 6,
  },
  seasonTabText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  epRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  epNumBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  epNum: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  epThumb: {
    width: 64,
    height: 40,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  epThumbImg: {
    width: 64,
    height: 40,
  },
  epInfo: {
    flex: 1,
    gap: 2,
  },
  epTitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  epPlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  seriesStrip: {
    borderTopWidth: 1,
    paddingTop: 10,
  },
  stripHeader: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  seriesCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  seriesImg: {
    width: CARD_W,
    height: CARD_H,
  },
  seriesPlaceholder: {
    width: CARD_W,
    height: CARD_H,
    justifyContent: "center",
    alignItems: "center",
  },
  seriesGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  seriesTitle: {
    position: "absolute",
    bottom: 18,
    left: 6,
    right: 6,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  episodeBadge: {
    position: "absolute",
    bottom: 5,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  episodeBadgeText: {
    fontSize: 9,
    color: "#ccc",
    fontFamily: "Inter_500Medium",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
