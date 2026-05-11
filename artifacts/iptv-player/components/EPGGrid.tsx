import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChannelContextMenu } from "@/components/ChannelContextMenu";
import { ProgramDetailsSheet } from "@/components/ProgramDetailsSheet";
import { Channel, EPGProgram, useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";
import {
  ensureEPG,
  formatDayShort,
  getDayEnd,
  getDayStart,
} from "@/utils/mockEPG";

const SLOT_WIDTH = 120;
const CHANNEL_COL_WIDTH = 100;
const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 36;
const DAY_BAR_HEIGHT = 48;
const MINS_PER_SLOT = 30;
const SLOTS_PER_DAY = 48; // 24h × 2 slots/h

const DAY_OFFSETS = [-2, -1, 0, 1, 2, 3]; // yesterday-2 through tomorrow+3

function msToSlotOffset(ms: number, refTime: number): number {
  return ((ms - refTime) / (MINS_PER_SLOT * 60 * 1000)) * SLOT_WIDTH;
}

function formatHour(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

type ProgramState = "past" | "current" | "future";

function getProgramState(program: EPGProgram, now: number): ProgramState {
  if (program.endTime < now) return "past";
  if (program.startTime > now) return "future";
  return "current";
}

interface ProgramBlockProps {
  program: EPGProgram;
  refTime: number;
  isSelected: boolean;
  state: ProgramState;
  isRecording?: boolean;
  onPress: () => void;
}

function ProgramBlock({ program, refTime, isSelected, state, isRecording, onPress }: ProgramBlockProps) {
  const colors = useColors();
  const left = msToSlotOffset(program.startTime, refTime);
  const width = msToSlotOffset(program.endTime, refTime) - left - 2;

  if (width < 4) return null;

  const bg = isSelected
    ? colors.primary
    : state === "past"
    ? "#1a1a1a"
    : state === "current"
    ? colors.highlight
    : colors.secondary;

  const titleColor = isSelected
    ? "#fff"
    : state === "past"
    ? colors.mutedForeground
    : state === "current"
    ? colors.foreground
    : colors.secondaryForeground;

  const borderColor = isSelected
    ? colors.primary
    : state === "current"
    ? `${colors.primary}60`
    : colors.border;

  const progress =
    state === "current"
      ? clamp((Date.now() - program.startTime) / (program.endTime - program.startTime), 0, 1)
      : 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.programBlock,
        { left, width, backgroundColor: bg, borderColor },
      ]}
    >
      {state === "current" && progress > 0 && (
        <View
          style={[
            styles.progressOverlay,
            { width: `${progress * 100}%` as any, backgroundColor: `${colors.primary}30` },
          ]}
        />
      )}
      <View style={styles.programTitleRow}>
        <Text style={[styles.programTitle, { color: titleColor, flex: 1 }]} numberOfLines={1}>
          {program.title}
        </Text>
        {isRecording && (
          <View style={styles.recDot} />
        )}
      </View>
      {width > 80 && (
        <View style={styles.programMeta}>
          {state === "past" && (
            <Feather name="rotate-ccw" size={9} color={colors.mutedForeground} />
          )}
          {state === "current" && (
            <View style={styles.liveIndicator} />
          )}
          <Text style={[styles.programTime, { color: isSelected ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
            {formatHour(program.startTime)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

interface EPGGridProps {
  onPlayChannel: (channel: Channel) => void;
  onCatchUp: (channel: Channel, program: EPGProgram) => void;
  onGoToRecordings?: () => void;
}

export function EPGGrid({ onPlayChannel, onCatchUp, onGoToRecordings }: EPGGridProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    activePlaylist,
    selectedGroup,
    selectedChannel,
    setSelectedChannel,
    recordings,
    stalkerEpgData,
    stalkerEpgLoading,
    loadStalkerEPG,
  } = useIPTV();

  const now = Date.now();
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);

  // refTime = midnight of the selected day
  const refTime = useMemo(() => getDayStart(selectedDayOffset), [selectedDayOffset]);
  const dayEnd = useMemo(() => getDayEnd(selectedDayOffset), [selectedDayOffset]);
  const isToday = selectedDayOffset === 0;

  const totalSlots = SLOTS_PER_DAY;
  const totalWidth = totalSlots * SLOT_WIDTH;

  const timeSlots = useMemo(
    () => Array.from({ length: totalSlots }, (_, i) => refTime + i * MINS_PER_SLOT * 60 * 1000),
    [refTime]
  );

  const nowOffset = msToSlotOffset(now, refTime);
  // For today: scroll to 1 slot before now; for other days: scroll to 6am
  const initialX = useMemo(() => {
    if (isToday) return clamp(nowOffset - SLOT_WIDTH, 0, totalWidth);
    const sixAm = refTime + 6 * 60 * 60 * 1000;
    return clamp(msToSlotOffset(sixAm, refTime), 0, totalWidth);
  }, [isToday, nowOffset, refTime, totalWidth]);

  // Auto-load Stalker EPG when EPG grid is opened for a Stalker playlist
  useEffect(() => {
    if (
      activePlaylist?.type === "StalkerPortal" &&
      Object.keys(stalkerEpgData).length === 0 &&
      !stalkerEpgLoading
    ) {
      loadStalkerEPG(activePlaylist);
    }
  }, [activePlaylist?.id]);

  const rawChannels = useMemo(() => {
    if (!activePlaylist) return [];
    const all = activePlaylist.channels;
    const filtered = selectedGroup ? all.filter((c) => c.group === selectedGroup) : all.slice(0, 50);
    return filtered.slice(0, 60);
  }, [activePlaylist, selectedGroup]);

  // Merge real Stalker EPG data into channels; fall back to mock for channels without real EPG
  const channels = useMemo(() => {
    const withRealEpg = rawChannels.map((ch) => {
      const realEpg = stalkerEpgData[ch.id];
      return realEpg && realEpg.length > 0 ? { ...ch, epg: realEpg } : ch;
    });
    return ensureEPG(withRealEpg, 2, 3);
  }, [rawChannels, stalkerEpgData]);

  // Synchronized horizontal scroll
  const headerScrollRef = useRef<ScrollView>(null);
  const rowScrollRefs = useRef<Map<string, ScrollView | null>>(new Map());
  const isScrolling = useRef(false);
  const scrollXRef = useRef(initialX);

  // Reset scroll position when day changes
  useEffect(() => {
    const x = isToday
      ? clamp(nowOffset - SLOT_WIDTH, 0, totalWidth)
      : clamp(msToSlotOffset(refTime + 6 * 60 * 60 * 1000, refTime), 0, totalWidth);

    scrollXRef.current = x;
    headerScrollRef.current?.scrollTo({ x, animated: true });
    rowScrollRefs.current.forEach((ref) => ref?.scrollTo({ x, animated: true }));
  }, [selectedDayOffset]);

  const [sheetChannel, setSheetChannel] = useState<Channel | null>(null);
  const [sheetProgram, setSheetProgram] = useState<EPGProgram | null>(null);
  const [contextMenuChannel, setContextMenuChannel] = useState<Channel | null>(null);

  const syncScroll = useCallback((x: number, sourceId: string) => {
    if (isScrolling.current) return;
    isScrolling.current = true;
    scrollXRef.current = x;
    headerScrollRef.current?.scrollTo({ x, animated: false });
    rowScrollRefs.current.forEach((ref, id) => {
      if (id !== sourceId && ref) ref.scrollTo({ x, animated: false });
    });
    setTimeout(() => { isScrolling.current = false; }, 30);
  }, []);

  const onRowScroll = useCallback((channelId: string) => (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncScroll(e.nativeEvent.contentOffset.x, channelId);
  }, [syncScroll]);

  const onHeaderScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncScroll(e.nativeEvent.contentOffset.x, "header");
  }, [syncScroll]);

  const handleProgramPress = useCallback((channel: Channel, program: EPGProgram) => {
    Haptics.selectionAsync();
    setSelectedChannel(channel);
    setSheetChannel(channel);
    setSheetProgram(program);
  }, [setSelectedChannel]);

  const handleSelectDay = useCallback((offset: number) => {
    Haptics.selectionAsync();
    setSelectedDayOffset(offset);
  }, []);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const renderRow = useCallback(({ item: channel, index }: { item: Channel; index: number }) => {
    const isActive = selectedChannel?.id === channel.id;
    const chanNum = /^\d+$/.test(channel.id) ? channel.id : String(index + 1);
    const dayPrograms = (channel.epg ?? []).filter(
      (p) => p.endTime > refTime && p.startTime < dayEnd
    );

    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.channelCell,
            {
              backgroundColor: isActive ? colors.highlight : colors.sidebar,
              borderRightColor: colors.border,
            },
          ]}
          onPress={() => { Haptics.selectionAsync(); setSelectedChannel(channel); }}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setContextMenuChannel(channel);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.channelNum, { color: isActive ? colors.primary : colors.mutedForeground }]}>
            {chanNum}
          </Text>
          <View style={styles.channelCellRight}>
            <View style={[styles.logoContainer, { backgroundColor: colors.secondary }]}>
              {channel.logo ? (
                <Image source={{ uri: channel.logo }} style={styles.logo} contentFit="contain" />
              ) : (
                <Feather name="tv" size={13} color={colors.mutedForeground} />
              )}
            </View>
            <Text
              style={[styles.channelName, { color: isActive ? colors.primary : colors.mutedForeground }]}
              numberOfLines={2}
            >
              {channel.name}
            </Text>
          </View>
        </TouchableOpacity>

        <ScrollView
          ref={(ref) => rowScrollRefs.current.set(channel.id, ref)}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onRowScroll(channel.id)}
          contentOffset={{ x: initialX, y: 0 }}
          style={styles.programsScroll}
          contentContainerStyle={{ width: totalWidth, height: ROW_HEIGHT }}
        >
          {/* Past dim overlay — only for today */}
          {isToday && (
            <View
              style={[
                styles.pastOverlay,
                { width: nowOffset, backgroundColor: "rgba(0,0,0,0.35)" },
              ]}
              pointerEvents="none"
            />
          )}

          {dayPrograms.map((program, idx) => {
            const isRec = recordings.some(
              (r) =>
                r.channelId === channel.id &&
                r.startTime <= program.startTime &&
                r.endTime >= program.endTime
            );
            return (
              <ProgramBlock
                key={idx}
                program={program}
                refTime={refTime}
                isSelected={
                  sheetChannel?.id === channel.id &&
                  sheetProgram?.startTime === program.startTime
                }
                state={getProgramState(program, now)}
                isRecording={isRec}
                onPress={() => handleProgramPress(channel, program)}
              />
            );
          })}

          {/* Current time line — only for today */}
          {isToday && (
            <>
              <View
                style={[styles.nowLine, { left: nowOffset, backgroundColor: colors.primary }]}
                pointerEvents="none"
              />
              <View
                style={[styles.nowTriangle, { left: nowOffset - 5, borderTopColor: colors.primary }]}
                pointerEvents="none"
              />
            </>
          )}
        </ScrollView>
      </View>
    );
  }, [selectedChannel, sheetChannel, sheetProgram, colors, now, refTime, dayEnd, totalWidth, nowOffset, initialX, isToday, onRowScroll, handleProgramPress, onPlayChannel, recordings]);

  if (!activePlaylist || channels.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="grid" size={40} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No channels</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Select a group to view the TV guide
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Day picker bar ── */}
      <View style={[styles.dayBar, { backgroundColor: colors.sidebar, borderBottomColor: colors.border }]}>
        <View style={[styles.channelHeaderCell, { borderRightColor: colors.border, backgroundColor: colors.sidebar }]}>
          <Feather name="calendar" size={13} color={colors.mutedForeground} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayBarScroll}
        >
          {DAY_OFFSETS.map((offset) => {
            const { weekday, date } = formatDayShort(offset);
            const active = offset === selectedDayOffset;
            const isNow = offset === 0;
            return (
              <TouchableOpacity
                key={offset}
                onPress={() => handleSelectDay(offset)}
                style={[
                  styles.dayChip,
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  !active && { borderColor: colors.border },
                ]}
                activeOpacity={0.75}
              >
                {isNow && !active && (
                  <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />
                )}
                <Text
                  style={[
                    styles.dayChipWeekday,
                    { color: active ? "#fff" : isNow ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {isNow ? "Today" : weekday}
                </Text>
                {!isNow && (
                  <Text style={[styles.dayChipDate, { color: active ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>
                    {date}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}

          {/* EPG loading badge — shown while real guide data is being fetched */}
          {stalkerEpgLoading && (
            <View style={[styles.epgLoadingBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} style={{ transform: [{ scale: 0.65 }] }} />
              <Text style={[styles.epgLoadingText, { color: colors.mutedForeground }]}>Loading guide…</Text>
            </View>
          )}

          {/* EPG loaded badge — briefly shown after real data arrives */}
          {!stalkerEpgLoading && Object.keys(stalkerEpgData).length > 0 && (
            <View style={[styles.epgLoadingBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="check-circle" size={11} color="#4caf50" />
              <Text style={[styles.epgLoadingText, { color: colors.mutedForeground }]}>
                {Object.keys(stalkerEpgData).length} channels
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* ── Time ruler header ── */}
      <View style={[styles.headerRow, { backgroundColor: colors.muted, borderBottomColor: colors.border }]}>
        <View style={[styles.channelHeaderCell, { borderRightColor: colors.border, backgroundColor: colors.muted }]}>
          <Feather name="tv" size={12} color={colors.mutedForeground} />
        </View>
        <ScrollView
          ref={headerScrollRef}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          onScroll={onHeaderScroll}
          scrollEventThrottle={16}
          contentOffset={{ x: initialX, y: 0 }}
          style={styles.headerScroll}
          contentContainerStyle={{ width: totalWidth, height: HEADER_HEIGHT }}
        >
          {isToday && (
            <View
              style={[styles.pastOverlay, { width: nowOffset, backgroundColor: "rgba(0,0,0,0.2)" }]}
              pointerEvents="none"
            />
          )}
          {timeSlots.map((slot, i) => {
            const isPastSlot = isToday && slot + MINS_PER_SLOT * 60 * 1000 < now;
            return (
              <View key={i} style={[styles.timeSlot, { left: i * SLOT_WIDTH, borderRightColor: colors.border }]}>
                <Text style={[styles.timeText, { color: isPastSlot ? colors.mutedForeground : colors.foreground }]}>
                  {formatHour(slot)}
                </Text>
              </View>
            );
          })}
          {isToday && (
            <View style={[styles.nowMarker, { left: nowOffset, backgroundColor: colors.primary }]} />
          )}
        </ScrollView>
      </View>

      {/* ── Channel rows ── */}
      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 8 }}
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT + StyleSheet.hairlineWidth,
          offset: (ROW_HEIGHT + StyleSheet.hairlineWidth) * index,
          index,
        })}
      />

      <ProgramDetailsSheet
        visible={!!sheetProgram}
        channel={sheetChannel}
        program={sheetProgram}
        onClose={() => { setSheetProgram(null); setSheetChannel(null); }}
        onWatchLive={onPlayChannel}
        onWatchCatchUp={onCatchUp}
      />

      <ChannelContextMenu
        channel={contextMenuChannel}
        visible={!!contextMenuChannel}
        onClose={() => setContextMenuChannel(null)}
        onPlay={onPlayChannel}
        onCatchUp={onCatchUp}
        onGoToRecordings={onGoToRecordings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  dayBar: {
    flexDirection: "row",
    height: DAY_BAR_HEIGHT,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  dayBarScroll: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 6,
  },
  dayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dayChipWeekday: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  dayChipDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  epgLoadingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginLeft: 4,
  },
  epgLoadingText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  headerRow: {
    flexDirection: "row",
    height: HEADER_HEIGHT,
    borderBottomWidth: 1,
  },
  channelHeaderCell: {
    width: CHANNEL_COL_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
  },
  headerScroll: { flex: 1 },
  timeSlot: {
    position: "absolute",
    width: SLOT_WIDTH,
    height: HEADER_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  timeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  nowMarker: {
    position: "absolute",
    top: 0,
    width: 2,
    height: HEADER_HEIGHT,
  },

  row: {
    flexDirection: "row",
    height: ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  channelCell: {
    width: CHANNEL_COL_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 3,
    gap: 4,
    borderRightWidth: 1,
  },
  channelNum: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    width: 20,
    textAlign: "right",
    flexShrink: 0,
  },
  channelCellRight: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  logoContainer: {
    width: 36,
    height: 24,
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logo: { width: 36, height: 24 },
  channelName: {
    fontSize: 8,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 11,
  },

  programsScroll: {
    flex: 1,
    overflow: "hidden",
  },
  programBlock: {
    position: "absolute",
    top: 5,
    height: ROW_HEIGHT - 10,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "hidden",
  },
  progressOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 3,
  },
  programTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  programTitle: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#f44336",
    flexShrink: 0,
  },
  programMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  programTime: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  liveIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#4caf50",
  },
  pastOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 1,
    pointerEvents: "none",
  },
  nowLine: {
    position: "absolute",
    top: 0,
    width: 2,
    height: ROW_HEIGHT,
    zIndex: 10,
  },
  nowTriangle: {
    position: "absolute",
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    zIndex: 10,
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
