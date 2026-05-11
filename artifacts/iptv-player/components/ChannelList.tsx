import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChannelContextMenu } from "@/components/ChannelContextMenu";
import { Channel, EPGProgram, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

type ViewLayout = "list" | "grid";
type SortOrder = "default" | "name-asc" | "name-desc";

const GRID_ITEM_MIN_WIDTH = 110;
const GRID_ASPECT = 9 / 16;
const GRID_GAP = 4;
const GRID_PADDING = 4;
const LAYOUT_STORAGE_KEY = "channelListViewLayout";
const SORT_STORAGE_KEY = "channelListSortOrder";

const SORT_CYCLE: SortOrder[] = ["default", "name-asc", "name-desc"];
const SORT_ICON: Record<SortOrder, React.ComponentProps<typeof Feather>["name"]> = {
  default: "list",
  "name-asc": "arrow-up",
  "name-desc": "arrow-down",
};
const SORT_LABEL: Record<SortOrder, string> = {
  default: "Default",
  "name-asc": "A → Z",
  "name-desc": "Z → A",
};

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
  const [viewLayout, setViewLayout] = useState<ViewLayout>("list");
  const [containerWidth, setContainerWidth] = useState(0);
  const [filterQuery, setFilterQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");

  useEffect(() => {
    AsyncStorage.getItem(LAYOUT_STORAGE_KEY)
      .then((v) => { if (v === "grid" || v === "list") setViewLayout(v); })
      .catch(() => {});
    AsyncStorage.getItem(SORT_STORAGE_KEY)
      .then((v) => { if (v === "default" || v === "name-asc" || v === "name-desc") setSortOrder(v); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setFilterQuery("");
  }, [selectedGroup, currentSection]);

  const switchLayout = (next: ViewLayout) => {
    Haptics.selectionAsync();
    setViewLayout(next);
    AsyncStorage.setItem(LAYOUT_STORAGE_KEY, next);
  };

  const cycleSortOrder = () => {
    Haptics.selectionAsync();
    const next = SORT_CYCLE[(SORT_CYCLE.indexOf(sortOrder) + 1) % SORT_CYCLE.length];
    setSortOrder(next);
    AsyncStorage.setItem(SORT_STORAGE_KEY, next);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  const numColumns = useMemo(() => {
    if (viewLayout === "list" || containerWidth === 0) return 1;
    const available = containerWidth - GRID_PADDING * 2;
    const cols = Math.floor(available / GRID_ITEM_MIN_WIDTH);
    return Math.max(2, cols);
  }, [viewLayout, containerWidth]);

  const gridItemWidth = useMemo(() => {
    if (containerWidth === 0 || numColumns === 1) return 0;
    const available = containerWidth - GRID_PADDING * 2 - GRID_GAP * (numColumns - 1);
    return Math.floor(available / numColumns);
  }, [containerWidth, numColumns]);

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

  const filteredItems = useMemo(() => {
    let list = items;
    if (filterQuery.trim()) {
      const q = filterQuery.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (sortOrder === "name-asc") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === "name-desc") {
      list = [...list].sort((a, b) => b.name.localeCompare(a.name));
    }
    return list;
  }, [items, filterQuery, sortOrder]);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleLongPress = (channel: Channel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setContextChannel(channel);
  };

  const renderListItem = ({ item: channel, index }: { item: Channel; index: number }) => {
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
  };

  const renderGridItem = ({ item: channel }: { item: Channel }) => {
    const active = selectedChannel?.id === channel.id;
    const stalkerEpg = activePlaylist?.type === "StalkerPortal" ? stalkerEpgData[channel.id] : undefined;
    const now = nowProgram(channel, stalkerEpg);
    const isFav = favorites.includes(channel.id);
    const isBlocked = blockedChannels.includes(channel.id);
    const thumbHeight = Math.round(gridItemWidth * GRID_ASPECT) + 20;

    return (
      <TouchableOpacity
        onPress={() => {
          Haptics.selectionAsync();
          setSelectedChannel(channel);
        }}
        onLongPress={() => handleLongPress(channel)}
        activeOpacity={0.75}
        style={[
          styles.gridCell,
          {
            width: gridItemWidth,
            opacity: isBlocked ? 0.4 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.gridThumb,
            {
              width: gridItemWidth,
              height: thumbHeight,
              backgroundColor: colors.secondary,
              borderColor: active ? colors.primary : colors.border,
              borderWidth: active ? 2 : StyleSheet.hairlineWidth,
            },
          ]}
        >
          {channel.logo ? (
            <Image
              source={{ uri: channel.logo }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
            />
          ) : (
            <Feather name="tv" size={28} color={colors.mutedForeground} />
          )}

          {now && (
            <View style={[styles.gridLiveBadge, { backgroundColor: `${colors.card}cc` }]}>
              <View style={styles.liveDot} />
              <Text style={[styles.gridLiveText, { color: colors.foreground }]} numberOfLines={1}>
                {now.title}
              </Text>
            </View>
          )}

          {active && (
            <View style={[styles.gridPlayOverlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
              <TouchableOpacity
                onPress={() => onPlayChannel(channel)}
                style={[styles.gridPlayBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
              >
                <Feather name="play" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              toggleFavorite(channel.id);
            }}
            style={styles.gridStar}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather
              name="star"
              size={13}
              color={isFav ? "#fbbf24" : "rgba(255,255,255,0.5)"}
            />
          </TouchableOpacity>
        </View>

        <Text
          style={[
            styles.gridName,
            { color: active ? colors.primary : colors.foreground },
          ]}
          numberOfLines={2}
        >
          {channel.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root} onLayout={onLayout}>
      {!manageFavoritesMode && (
        <>
        <View style={[styles.toolbar, { borderBottomColor: colors.border, backgroundColor: colors.sidebar }]}>
          <Text style={[styles.toolbarCount, { color: colors.mutedForeground }]}>
            {filterQuery.trim()
              ? `${filteredItems.length} / ${items.length}`
              : `${items.length} ${items.length === 1 ? "channel" : "channels"}`}
          </Text>
          <View style={styles.toolbarRight}>
            <TouchableOpacity
              onPress={cycleSortOrder}
              style={[
                styles.sortBtn,
                {
                  backgroundColor: sortOrder !== "default" ? colors.primary : colors.secondary,
                  borderColor: sortOrder !== "default" ? colors.primary : colors.border,
                },
              ]}
              activeOpacity={0.7}
              accessibilityLabel={`Sort: ${SORT_LABEL[sortOrder]}`}
            >
              <Feather
                name={SORT_ICON[sortOrder]}
                size={12}
                color={sortOrder !== "default" ? "#fff" : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.sortBtnLabel,
                  { color: sortOrder !== "default" ? "#fff" : colors.mutedForeground },
                ]}
              >
                {SORT_LABEL[sortOrder]}
              </Text>
            </TouchableOpacity>

            <View style={[styles.layoutToggle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => switchLayout("list")}
                style={[
                  styles.layoutBtn,
                  viewLayout === "list" && { backgroundColor: colors.primary },
                ]}
                activeOpacity={0.7}
              >
                <Feather
                  name="list"
                  size={14}
                  color={viewLayout === "list" ? "#fff" : colors.mutedForeground}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => switchLayout("grid")}
                style={[
                  styles.layoutBtn,
                  viewLayout === "grid" && { backgroundColor: colors.primary },
                ]}
                activeOpacity={0.7}
              >
                <Feather
                  name="grid"
                  size={14}
                  color={viewLayout === "grid" ? "#fff" : colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
          <Feather name="search" size={14} color={colors.mutedForeground} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Filter channels…"
            placeholderTextColor={colors.mutedForeground}
            value={filterQuery}
            onChangeText={setFilterQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
            returnKeyType="search"
          />
          {filterQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setFilterQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.searchClear}
            >
              <Feather name="x" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
        </>
      )}

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

      {viewLayout === "grid" && !manageFavoritesMode ? (
        <FlatList
          key={`grid-${numColumns}`}
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          scrollEnabled={!!items.length}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: GRID_PADDING,
            paddingTop: GRID_GAP,
            paddingBottom: bottomPad + 8,
            gap: GRID_GAP,
          }}
          columnWrapperStyle={numColumns > 1 ? { gap: GRID_GAP } : undefined}
          renderItem={renderGridItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="tv" size={38} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No channels</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Select a group or add a playlist
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          key="list-1"
          data={filteredItems}
          keyExtractor={(item) => item.id}
          scrollEnabled={!!items.length}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad + 8 }}
          renderItem={renderListItem}
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
      )}

      <ChannelContextMenu
        channel={contextChannel}
        visible={!!contextChannel}
        onClose={() => setContextChannel(null)}
        onPlay={onPlayChannel}
        onCatchUp={onCatchUp}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    paddingVertical: Platform.OS === "ios" ? 4 : 2,
    height: 28,
  },
  searchClear: {
    padding: 2,
    flexShrink: 0,
  },
  toolbarCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  toolbarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sortBtnLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  layoutToggle: {
    flexDirection: "row",
    borderRadius: 6,
    padding: 2,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  layoutBtn: {
    width: 28,
    height: 24,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
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
  gridCell: {
    flexDirection: "column",
    marginBottom: 2,
  },
  gridThumb: {
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  gridLiveBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  gridLiveText: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  gridPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  gridPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  gridStar: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  gridName: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
    paddingHorizontal: 1,
    lineHeight: 13,
  },
});
