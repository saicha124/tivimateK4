import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VODItem, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

const SPECIAL_CATS = ["All movies", "My list", "History"];

interface MoviesViewProps {
  onPlayVOD: (url: string, name: string) => void;
}

function PosterCard({
  item,
  selected,
  onPress,
}: {
  item: VODItem;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.posterCard,
        selected && { borderColor: colors.primary, borderWidth: 2 },
      ]}
    >
      {item.logo ? (
        <Image
          source={{ uri: item.logo }}
          style={styles.posterImg}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.posterPlaceholder, { backgroundColor: colors.secondary }]}>
          <Feather name="film" size={28} color={colors.mutedForeground} />
        </View>
      )}
      {selected && (
        <View style={[styles.selectedOverlay, { backgroundColor: `${colors.primary}30` }]} />
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.posterGradient}
      />
      <Text style={styles.posterTitle} numberOfLines={2}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );
}

function DetailPane({
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

  return (
    <View style={styles.detailPane}>
      {item.logo ? (
        <Image
          source={{ uri: item.logo }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          blurRadius={Platform.OS === "web" ? 0 : 2}
        />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.secondary }]} />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.35)", "rgba(17,17,17,0.97)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.detailContent}>
        <Text style={styles.detailTitle} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.detailCategory, { color: colors.primary }]}>
          {item.category}
        </Text>
        {item.description ? (
          <Text style={[styles.detailDesc, { color: colors.secondaryForeground }]} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.detailActions}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPlay(); }}
            style={[styles.playBtn, { backgroundColor: colors.foreground }]}
            activeOpacity={0.85}
          >
            <Feather name="play" size={16} color={colors.background} />
            <Text style={[styles.playBtnText, { color: colors.background }]}>Play</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); onToggleFav(); }}
            style={[styles.favBtn, { backgroundColor: isFav ? `${colors.primary}25` : colors.secondary, borderColor: isFav ? colors.primary : colors.border }]}
            activeOpacity={0.8}
          >
            <Feather name="bookmark" size={15} color={isFav ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.favBtnText, { color: isFav ? colors.primary : colors.mutedForeground }]}>
              {isFav ? "Saved" : "My List"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export function MoviesView({ onPlayVOD }: MoviesViewProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activePlaylist, favorites, toggleFavorite, watchHistory } = useIPTV();

  const movies = activePlaylist?.movies ?? [];

  const categories = useMemo(() => {
    const cats = Array.from(new Set(movies.map((m) => m.category))).sort();
    return [...SPECIAL_CATS, ...cats];
  }, [movies]);

  const [selectedCat, setSelectedCat] = useState<string>("All movies");
  const [selectedMovie, setSelectedMovie] = useState<VODItem | null>(movies[0] ?? null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const filteredMovies = useMemo(() => {
    if (selectedCat === "All movies") return movies;
    if (selectedCat === "My list") return movies.filter((m) => favorites.includes(m.id));
    if (selectedCat === "History") {
      const historyIds = new Set(watchHistory.map((h) => h.channelId));
      return movies.filter((m) => historyIds.has(m.id));
    }
    return movies.filter((m) => m.category === selectedCat);
  }, [selectedCat, movies, favorites, watchHistory]);

  const catGroups = useMemo(() => {
    if (selectedCat !== "All movies") return null;
    const map: Record<string, VODItem[]> = {};
    for (const m of movies) {
      if (!map[m.category]) map[m.category] = [];
      map[m.category].push(m);
    }
    return map;
  }, [selectedCat, movies]);

  const groupedCats = catGroups ? Object.keys(catGroups).sort() : null;

  if (movies.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <Feather name="film" size={52} color={colors.mutedForeground} style={{ marginBottom: 14 }} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No movies available</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Movies from your playlist will appear here
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Left category sidebar */}
      <View style={[styles.catSidebar, { backgroundColor: colors.sidebar, borderRightColor: colors.border, paddingTop: topPad + 8 }]}>
        <Text style={[styles.catHeader, { color: colors.mutedForeground }]}>MOVIES</Text>
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
                  setSelectedMovie(null);
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

      {/* Right content */}
      <View style={styles.content}>
        {/* Detail pane for selected movie */}
        {selectedMovie && (
          <DetailPane
            item={selectedMovie}
            isFav={favorites.includes(selectedMovie.id)}
            onPlay={() => onPlayVOD(selectedMovie.url, selectedMovie.name)}
            onToggleFav={() => toggleFavorite(selectedMovie.id)}
          />
        )}

        {/* Movie grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad + 16, paddingTop: 8 }}
        >
          {groupedCats ? (
            groupedCats.map((cat) => (
              <View key={cat} style={styles.catGroup}>
                <View style={styles.catGroupHeader}>
                  <Text style={[styles.catGroupLabel, { color: colors.foreground }]}>{cat}</Text>
                  <Text style={[styles.catGroupCount, { color: colors.mutedForeground }]}>
                    {catGroups![cat].length}
                  </Text>
                  <TouchableOpacity
                    onPress={() => { Haptics.selectionAsync(); setSelectedCat(cat); }}
                    style={styles.seeAll}
                  >
                    <Text style={[styles.seeAllText, { color: colors.primary }]}>See all</Text>
                    <Feather name="chevron-right" size={13} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
                  {catGroups![cat].slice(0, 20).map((item) => (
                    <PosterCard
                      key={item.id}
                      item={item}
                      selected={selectedMovie?.id === item.id}
                      onPress={() => { Haptics.selectionAsync(); setSelectedMovie(item); }}
                    />
                  ))}
                </ScrollView>
              </View>
            ))
          ) : (
            <View style={styles.flatGrid}>
              {filteredMovies.length === 0 ? (
                <View style={styles.emptyFilter}>
                  <Feather name="film" size={36} color={colors.mutedForeground} style={{ marginBottom: 10 }} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No movies here</Text>
                </View>
              ) : (
                <View style={styles.posterGrid}>
                  {filteredMovies.map((item) => (
                    <PosterCard
                      key={item.id}
                      item={item}
                      selected={selectedMovie?.id === item.id}
                      onPress={() => { Haptics.selectionAsync(); setSelectedMovie(item); }}
                    />
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const POSTER_W = 110;
const POSTER_H = 160;

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
  detailPane: {
    height: 210,
    overflow: "hidden",
    position: "relative",
  },
  detailContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 32,
  },
  detailTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 3,
  },
  detailCategory: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
  },
  detailDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 10,
  },
  detailActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
  },
  favBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  catGroup: {
    marginBottom: 20,
  },
  catGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  catGroupLabel: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  catGroupCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  flatGrid: {
    flex: 1,
  },
  posterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    gap: 8,
  },
  posterCard: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  posterImg: {
    width: POSTER_W,
    height: POSTER_H,
  },
  posterPlaceholder: {
    width: POSTER_W,
    height: POSTER_H,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  posterGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  posterTitle: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  emptyFilter: {
    paddingVertical: 60,
    alignItems: "center",
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
