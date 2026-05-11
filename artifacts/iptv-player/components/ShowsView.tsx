import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useRef, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

// ─── M3U grouping helpers (used for non-Stalker playlists) ────────────────────

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

// ─── Stalker series detail (rich metadata + direct play) ─────────────────────

function StalkerSeriesDetail({
  item,
  isFav,
  onPlay,
  onToggleFav,
}: {
  item: VODItem;
  isFav: boolean;
  onPlay: () => void;
  onToggleFav: () => void;
}) {
  const colors = useColors();

  const yearStr = item.year ? item.year.slice(0, 4) : null;
  const ratingVal = item.rating ? parseFloat(item.rating) : null;

  return (
    <View style={styles.detailRoot}>
      {/* Backdrop banner */}
      <View style={styles.detailBanner}>
        {item.logo ? (
          <Image
            source={{ uri: item.logo }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            blurRadius={Platform.OS === "web" ? 0 : 4}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.secondary }]} />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "rgba(13,13,13,0.97)"]}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.bannerLayout}>
          {/* Poster thumbnail */}
          {item.logo ? (
            <View style={styles.posterWrap}>
              <Image source={{ uri: item.logo }} style={styles.poster} contentFit="cover" />
            </View>
          ) : (
            <View style={[styles.posterWrap, styles.posterPlaceholder, { backgroundColor: colors.secondary }]}>
              <Feather name="grid" size={28} color={colors.mutedForeground} />
            </View>
          )}

          {/* Info column */}
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerTitle} numberOfLines={2}>{item.name}</Text>

            {/* Badges row */}
            <View style={styles.badgeRow}>
              {yearStr && (
                <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{yearStr}</Text>
                </View>
              )}
              {ratingVal !== null && !isNaN(ratingVal) && (
                <View style={[styles.badge, { backgroundColor: "#f5c51820" }]}>
                  <Feather name="star" size={9} color="#f5c518" />
                  <Text style={[styles.badgeText, { color: "#f5c518" }]}>{item.rating} IMDb</Text>
                </View>
              )}
              {item.age && (
                <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{item.age}</Text>
                </View>
              )}
            </View>

            {/* Genres */}
            {item.genres && (
              <Text style={[styles.genresText, { color: colors.primary }]} numberOfLines={1}>
                {item.genres}
              </Text>
            )}

            {/* Action buttons */}
            <View style={styles.bannerActions}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onPlay();
                }}
                style={[styles.playBtn, { backgroundColor: colors.foreground }]}
                activeOpacity={0.85}
              >
                <Feather name="play" size={15} color={colors.background} />
                <Text style={[styles.playBtnText, { color: colors.background }]}>Watch</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onToggleFav(); }}
                style={[styles.favBtn, {
                  backgroundColor: isFav ? `${colors.primary}22` : colors.secondary,
                  borderColor: isFav ? colors.primary : colors.border,
                }]}
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
      </View>

      {/* Metadata section */}
      <ScrollView
        style={styles.metaScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
      >
        {item.description ? (
          <View style={styles.metaBlock}>
            <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>SYNOPSIS</Text>
            <Text style={[styles.metaValue, { color: colors.foreground }]}>{item.description}</Text>
          </View>
        ) : null}

        {item.director && item.director !== "N/A" && (
          <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.metaRowLabel, { color: colors.mutedForeground }]}>Director</Text>
            <Text style={[styles.metaRowValue, { color: colors.foreground }]} numberOfLines={2}>{item.director}</Text>
          </View>
        )}

        {item.actors && item.actors !== "N/A" && (
          <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.metaRowLabel, { color: colors.mutedForeground }]}>Cast</Text>
            <Text style={[styles.metaRowValue, { color: colors.foreground }]} numberOfLines={3}>{item.actors}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── M3U series detail (season/episode list) ──────────────────────────────────

function M3USeriesDetail({
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
          <View style={styles.badgeRow}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{series.category}</Text>
            <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
              · {seasons.length} {seasons.length === 1 ? "Season" : "Seasons"}
            </Text>
            <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
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
              style={[styles.favBtn, {
                backgroundColor: isFav ? `${colors.primary}25` : colors.secondary,
                borderColor: isFav ? colors.primary : colors.border,
              }]}
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
                  active ? { backgroundColor: colors.primary } : { backgroundColor: colors.secondary },
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
                <Text style={[styles.epTitle, { color: colors.foreground }]} numberOfLines={2}>{ep.name}</Text>
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

// ─── Series thumbnail card ────────────────────────────────────────────────────

function SeriesCard({
  name,
  logo,
  badge,
  selected,
  onPress,
}: {
  name: string;
  logo?: string;
  badge?: string;
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
      {logo ? (
        <Image source={{ uri: logo }} style={styles.seriesImg} contentFit="cover" />
      ) : (
        <View style={[styles.seriesPlaceholder, { backgroundColor: colors.secondary }]}>
          <Feather name="grid" size={28} color={colors.mutedForeground} />
        </View>
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.88)"]}
        style={styles.seriesGradient}
      />
      <Text style={styles.seriesTitle} numberOfLines={2}>{name}</Text>
      {badge && (
        <View style={styles.episodeBadge}>
          <Text style={styles.episodeBadgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main ShowsView ───────────────────────────────────────────────────────────

export function ShowsView({ onPlayVOD }: ShowsViewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activePlaylist, favorites, toggleFavorite, watchHistory, addToWatchHistory } = useIPTV();

  const shows = activePlaylist?.shows ?? [];
  const isStalker = activePlaylist?.type === "StalkerPortal";

  const categories = useMemo(() => {
    const cats = Array.from(new Set(shows.map((s) => s.category))).sort();
    return [...SPECIAL_CATS, ...cats];
  }, [shows]);

  const [selectedCat, setSelectedCat] = useState("All shows");
  // For Stalker: selected VODItem id. For M3U: selected SeriesGroup name.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

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

  // Stalker: work directly with VODItems
  const stalkerItems = filteredShows;

  // Search filtering (searches across ALL shows regardless of category)
  const searchActive = query.trim().length > 0;
  const displayStalkerItems = useMemo(() => {
    if (!searchActive) return stalkerItems;
    const q = query.trim().toLowerCase();
    return shows.filter((s) => s.name.toLowerCase().includes(q));
  }, [searchActive, query, stalkerItems, shows]);

  const currentStalkerItem = useMemo(() => {
    if (!isStalker) return null;
    return displayStalkerItems.find((s) => s.id === selectedId) ?? displayStalkerItems[0] ?? null;
  }, [isStalker, displayStalkerItems, selectedId]);

  // M3U: group by name pattern
  const seriesList = useMemo(() => (isStalker ? [] : groupIntoSeries(filteredShows)), [isStalker, filteredShows]);

  const displaySeriesList = useMemo(() => {
    if (!searchActive) return seriesList;
    const q = query.trim().toLowerCase();
    return seriesList.filter((s) => s.name.toLowerCase().includes(q));
  }, [searchActive, query, seriesList]);

  const currentSeries = useMemo(() => {
    if (isStalker) return null;
    return displaySeriesList.find((s) => s.name === selectedId) ?? displaySeriesList[0] ?? null;
  }, [isStalker, displaySeriesList, selectedId]);

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
                  setSelectedId(null);
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

      {/* Right: detail + strip */}
      <View style={styles.content}>
        {isStalker ? (
          <>
            {currentStalkerItem && (
              <StalkerSeriesDetail
                item={currentStalkerItem}
                isFav={favorites.includes(currentStalkerItem.id)}
                onPlay={() => {
                  addToWatchHistory({
                    channelId: currentStalkerItem.id,
                    channelName: currentStalkerItem.name,
                    channelGroup: currentStalkerItem.category,
                    channelLogo: currentStalkerItem.logo,
                    channelUrl: currentStalkerItem.url,
                    type: "show",
                  });
                  onPlayVOD(currentStalkerItem.url, currentStalkerItem.name);
                }}
                onToggleFav={() => toggleFavorite(currentStalkerItem.id)}
              />
            )}
            <View style={[styles.seriesStrip, { borderTopColor: colors.border }]}>
              {/* Search bar */}
              <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="search" size={14} color={colors.mutedForeground} />
                <TextInput
                  ref={inputRef}
                  style={[styles.searchInput, { color: colors.foreground }]}
                  placeholder="Search shows…"
                  placeholderTextColor={colors.mutedForeground}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  clearButtonMode="never"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {query.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { setQuery(""); inputRef.current?.blur(); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              {displayStalkerItems.length === 0 ? (
                <View style={styles.stripEmpty}>
                  <Text style={[styles.stripEmptyText, { color: colors.mutedForeground }]}>
                    No results for "{query}"
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.stripHeader, { color: colors.mutedForeground }]}>
                    {searchActive
                      ? `${displayStalkerItems.length} ${displayStalkerItems.length === 1 ? "RESULT" : "RESULTS"}`
                      : `${displayStalkerItems.length} SERIES`}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: bottomPad + 8 }}
                  >
                    {displayStalkerItems.map((item) => (
                      <SeriesCard
                        key={item.id}
                        name={item.name}
                        logo={item.logo}
                        badge={item.year ? item.year.slice(0, 4) : undefined}
                        selected={currentStalkerItem?.id === item.id}
                        onPress={() => { Haptics.selectionAsync(); setSelectedId(item.id); }}
                      />
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          </>
        ) : (
          <>
            {currentSeries && (
              <M3USeriesDetail
                series={currentSeries}
                isFav={currentSeries.episodes[0] ? favorites.includes(currentSeries.episodes[0].id) : false}
                onPlayEp={(ep) => {
                  addToWatchHistory({
                    channelId: ep.id,
                    channelName: ep.name,
                    channelGroup: ep.category,
                    channelLogo: ep.logo,
                    channelUrl: ep.url,
                    type: "show",
                  });
                  onPlayVOD(ep.url, ep.name);
                }}
                onToggleFav={() => {
                  if (currentSeries.episodes[0]) toggleFavorite(currentSeries.episodes[0].id);
                }}
              />
            )}
            <View style={[styles.seriesStrip, { borderTopColor: colors.border }]}>
              {/* Search bar */}
              <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Feather name="search" size={14} color={colors.mutedForeground} />
                <TextInput
                  ref={inputRef}
                  style={[styles.searchInput, { color: colors.foreground }]}
                  placeholder="Search shows…"
                  placeholderTextColor={colors.mutedForeground}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  clearButtonMode="never"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {query.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { setQuery(""); inputRef.current?.blur(); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              {displaySeriesList.length === 0 ? (
                <View style={styles.stripEmpty}>
                  <Text style={[styles.stripEmptyText, { color: colors.mutedForeground }]}>
                    No results for "{query}"
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.stripHeader, { color: colors.mutedForeground }]}>
                    {searchActive
                      ? `${displaySeriesList.length} ${displaySeriesList.length === 1 ? "RESULT" : "RESULTS"}`
                      : `${displaySeriesList.length} SERIES`}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: bottomPad + 8 }}
                  >
                    {displaySeriesList.map((s) => (
                      <SeriesCard
                        key={s.name}
                        name={s.name}
                        logo={s.logo}
                        badge={`${s.episodes.length} ep`}
                        selected={currentSeries?.name === s.name}
                        onPress={() => { Haptics.selectionAsync(); setSelectedId(s.name); }}
                      />
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          </>
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
  // ── detail root ──
  detailRoot: {
    flex: 1,
  },
  detailBanner: {
    height: 220,
    position: "relative",
    overflow: "hidden",
  },
  // ── Stalker banner layout ──
  bannerLayout: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 14,
    gap: 14,
  },
  posterWrap: {
    width: 90,
    height: 130,
    borderRadius: 6,
    overflow: "hidden",
    flexShrink: 0,
  },
  posterPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  poster: {
    width: 90,
    height: 130,
  },
  bannerInfo: {
    flex: 1,
    gap: 4,
  },
  bannerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  genresText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  bannerActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 4,
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
  // ── metadata section ──
  metaScroll: {
    flex: 1,
  },
  metaBlock: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  metaLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  metaValue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  metaRowLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    width: 58,
    flexShrink: 0,
    marginTop: 1,
  },
  metaRowValue: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 17,
  },
  // ── M3U banner (legacy) ──
  bannerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingTop: 28,
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
  // ── search bar ──
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  stripEmpty: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stripEmptyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  // ── series strip ──
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
  // ── empty state ──
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
