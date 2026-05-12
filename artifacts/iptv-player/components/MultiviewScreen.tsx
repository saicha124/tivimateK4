import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ResizeMode, Video } from "expo-av";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

interface StreamSlot {
  id: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  paused: boolean;
}

interface MultiviewScreenProps {
  visible: boolean;
  initialChannelId?: string;
  initialChannelName?: string;
  initialChannelUrl?: string;
  onClose: () => void;
}

const MAX_STREAMS = 9;

function getGridLayout(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 };
}

function ChannelPickerModal({
  visible,
  title,
  onClose,
  onSelect,
  colors,
  topPad,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect: (id: string, name: string, url: string) => void;
  colors: ReturnType<typeof useColors>;
  topPad: number;
}) {
  const { activePlaylist } = useIPTV();
  const allChannels = activePlaylist?.channels ?? [];
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const searchRef = useRef<TextInput>(null);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const ch of allChannels) {
      if (!seen.has(ch.group)) { seen.add(ch.group); out.push(ch.group); }
    }
    return out;
  }, [allChannels]);

  const filtered = useMemo(() => {
    let list = allChannels;
    if (selectedGroup) list = list.filter((c) => c.group === selectedGroup);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [allChannels, selectedGroup, searchQuery]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[pickerStyles.container, { backgroundColor: colors.background }]}>
        <View style={[pickerStyles.header, { paddingTop: topPad + 8, backgroundColor: colors.sidebar, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={pickerStyles.hBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[pickerStyles.title, { color: colors.foreground }]}>{title}</Text>
          <View style={pickerStyles.hBtn} />
        </View>

        <View style={[pickerStyles.searchRow, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            ref={searchRef}
            style={[pickerStyles.searchInput, { color: colors.foreground }]}
            placeholder="Search channels…"
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={[pickerStyles.groupSidebar, { backgroundColor: colors.card, borderRightColor: colors.border }]}>
            <TouchableOpacity
              style={[pickerStyles.groupItem, !selectedGroup && { backgroundColor: colors.highlight }]}
              onPress={() => { Haptics.selectionAsync(); setSelectedGroup(null); }}
            >
              {!selectedGroup && <View style={[pickerStyles.groupStripe, { backgroundColor: colors.primary }]} />}
              <Text style={[pickerStyles.groupText, { color: !selectedGroup ? colors.primary : colors.secondaryForeground, fontFamily: !selectedGroup ? "Inter_600SemiBold" : "Inter_400Regular" }]} numberOfLines={2}>
                All
              </Text>
            </TouchableOpacity>
            {groups.map((g) => {
              const active = selectedGroup === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={[pickerStyles.groupItem, active && { backgroundColor: colors.highlight }]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedGroup(g); setSearchQuery(""); }}
                >
                  {active && <View style={[pickerStyles.groupStripe, { backgroundColor: colors.primary }]} />}
                  <Text style={[pickerStyles.groupText, { color: active ? colors.primary : colors.secondaryForeground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]} numberOfLines={2}>
                    {g}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            style={{ flex: 1 }}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item: ch }) => (
              <TouchableOpacity
                style={[pickerStyles.chRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelect(ch.id, ch.name, ch.url);
                }}
                activeOpacity={0.7}
              >
                <View style={[pickerStyles.chIconWrap, { backgroundColor: colors.secondary }]}>
                  <Feather name="tv" size={14} color={colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[pickerStyles.chName, { color: colors.foreground }]} numberOfLines={1}>{ch.name}</Text>
                  <Text style={[pickerStyles.chGroup, { color: colors.mutedForeground }]} numberOfLines={1}>{ch.group}</Text>
                </View>
                <Feather name="plus" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={pickerStyles.emptyList}>
                <Text style={[pickerStyles.emptyListText, { color: colors.mutedForeground }]}>No channels found</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

export function MultiviewScreen({
  visible,
  initialChannelId,
  initialChannelName,
  initialChannelUrl,
  onClose,
}: MultiviewScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [streams, setStreams] = useState<StreamSlot[]>(() => {
    if (initialChannelUrl && initialChannelName && initialChannelId) {
      return [{ id: "s0", channelId: initialChannelId, channelName: initialChannelName, channelUrl: initialChannelUrl, paused: false }];
    }
    return [];
  });

  const [audioSlot, setAudioSlot] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [showSlotMenu, setShowSlotMenu] = useState(false);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [channelPickerMode, setChannelPickerMode] = useState<"add" | "change">("add");
  const [channelPickerForSlot, setChannelPickerForSlot] = useState<number | null>(null);
  const [enlargedSlot, setEnlargedSlot] = useState<number | null>(null);
  const [fullscreenSlot, setFullscreenSlot] = useState<number | null>(null);

  const { width: screenW, height: screenH } = Dimensions.get("window");
  const contentH = screenH - topPad - bottomPad - 56;

  const activeCount = streams.length;
  const showEmptySlot = activeCount < MAX_STREAMS;

  const slots: (StreamSlot | null)[] = [
    ...streams,
    ...(showEmptySlot ? [null as null] : []),
  ];

  const { cols, rows } = getGridLayout(slots.length);
  const paneW = screenW / cols;
  const paneH = contentH / rows;

  const addStream = useCallback((slotIndex: number, channelId: string, channelName: string, channelUrl: string) => {
    setStreams((prev) => {
      const next = [...prev];
      if (slotIndex < next.length) {
        next[slotIndex] = { id: `s${Date.now()}`, channelId, channelName, channelUrl, paused: false };
      } else {
        next.push({ id: `s${Date.now()}`, channelId, channelName, channelUrl, paused: false });
      }
      return next;
    });
    setShowChannelPicker(false);
    setChannelPickerForSlot(null);
  }, []);

  const replaceStream = useCallback((slotIndex: number, channelId: string, channelName: string, channelUrl: string) => {
    setStreams((prev) => {
      const next = [...prev];
      if (slotIndex < next.length) {
        next[slotIndex] = { ...next[slotIndex], channelId, channelName, channelUrl };
      }
      return next;
    });
    setShowChannelPicker(false);
    setChannelPickerForSlot(null);
  }, []);

  const removeStream = useCallback((slotIndex: number) => {
    setStreams((prev) => {
      const next = prev.filter((_, i) => i !== slotIndex);
      return next;
    });
    setShowSlotMenu(false);
    setSelectedSlot(null);
    if (enlargedSlot === slotIndex) setEnlargedSlot(null);
    if (fullscreenSlot === slotIndex) setFullscreenSlot(null);
    setAudioSlot((prev) => {
      if (prev === slotIndex) return 0;
      if (prev > slotIndex) return prev - 1;
      return prev;
    });
  }, [enlargedSlot, fullscreenSlot]);

  const togglePause = useCallback((slotIndex: number) => {
    setStreams((prev) =>
      prev.map((s, i) => (i === slotIndex ? { ...s, paused: !s.paused } : s))
    );
    setShowSlotMenu(false);
  }, []);

  const openSlotMenu = useCallback((slotIndex: number) => {
    Haptics.selectionAsync();
    setSelectedSlot(slotIndex);
    setShowSlotMenu(true);
  }, []);

  const openChannelPicker = useCallback((slotIndex: number, mode: "add" | "change" = "add") => {
    Haptics.selectionAsync();
    setChannelPickerForSlot(slotIndex);
    setChannelPickerMode(mode);
    setShowChannelPicker(true);
  }, []);

  const handleChannelSelect = useCallback((id: string, name: string, url: string) => {
    if (channelPickerForSlot === null) return;
    if (channelPickerMode === "change") {
      replaceStream(channelPickerForSlot, id, name, url);
    } else {
      addStream(channelPickerForSlot, id, name, url);
    }
  }, [channelPickerForSlot, channelPickerMode, addStream, replaceStream]);

  const selectedStream = selectedSlot !== null && selectedSlot < streams.length ? streams[selectedSlot] : null;

  const renderPane = (slot: StreamSlot | null, index: number, w: number, h: number) => {
    const isAudio = audioSlot === index && slot !== null;
    const isEnlarged = enlargedSlot === index;

    if (!slot) {
      return (
        <TouchableOpacity
          key={`empty-${index}`}
          style={[paneStyles.pane, { width: w, height: h }]}
          onPress={() => openChannelPicker(index, "add")}
          activeOpacity={0.8}
        >
          <View style={paneStyles.emptyPane}>
            <View style={[paneStyles.addCircle, { borderColor: "rgba(255,255,255,0.25)" }]}>
              <Feather name="plus" size={22} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={paneStyles.addScreenText}>Add screen</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={slot.id}
        style={[
          paneStyles.pane,
          { width: w, height: h },
          isAudio && { borderColor: "#fff", borderWidth: 2.5 },
          isEnlarged && !isAudio && { borderColor: colors.primary, borderWidth: 2 },
        ]}
        onPress={() => openSlotMenu(index)}
        activeOpacity={0.9}
      >
        {slot.paused ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0a0a0a", justifyContent: "center", alignItems: "center" }]}>
            <Feather name="pause-circle" size={32} color="rgba(255,255,255,0.25)" />
          </View>
        ) : (
          <Video
            source={{ uri: slot.channelUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            shouldPlay={!slot.paused}
            useNativeControls={false}
            isMuted={!isAudio}
          />
        )}

        <View style={paneStyles.paneFooter}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {isAudio ? (
              <View style={paneStyles.audioPill}>
                <Feather name="volume-2" size={9} color="#fff" />
                <Text style={paneStyles.audioPillText}>AUDIO</Text>
              </View>
            ) : (
              <View style={paneStyles.livePill}>
                <View style={paneStyles.liveDot} />
                <Text style={paneStyles.liveTxt}>LIVE</Text>
              </View>
            )}
            {slot.paused && (
              <View style={paneStyles.pausedPill}>
                <Feather name="pause" size={8} color="rgba(255,255,255,0.8)" />
                <Text style={paneStyles.pausedPillText}>PAUSED</Text>
              </View>
            )}
          </View>
          <Text style={paneStyles.paneChannelName} numberOfLines={1}>{slot.channelName}</Text>
        </View>

        {isAudio && (
          <View style={[paneStyles.audioCornerBadge, { backgroundColor: "rgba(255,255,255,0.95)" }]}>
            <Feather name="volume-2" size={11} color="#000" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderGrid = () => {
    if (fullscreenSlot !== null && fullscreenSlot < streams.length) {
      const slot = streams[fullscreenSlot];
      return (
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, paneStyles.pane]}
          onPress={() => openSlotMenu(fullscreenSlot)}
          activeOpacity={0.9}
        >
          <Video
            source={{ uri: slot.channelUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            useNativeControls={false}
            isMuted={audioSlot !== fullscreenSlot}
          />
          <View style={paneStyles.paneFooter}>
            <View style={paneStyles.livePill}>
              <View style={paneStyles.liveDot} />
              <Text style={paneStyles.liveTxt}>LIVE</Text>
            </View>
            <Text style={paneStyles.paneChannelName}>{slot.channelName}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (enlargedSlot !== null && enlargedSlot < streams.length) {
      const mainH = contentH * 0.68;
      const thumbH = contentH * 0.32;
      const thumbW = screenW / Math.max(1, streams.length - 1);
      const others = streams.map((s, i) => ({ slot: s, realIdx: i })).filter(({ realIdx }) => realIdx !== enlargedSlot);
      return (
        <View style={{ flex: 1 }}>
          {renderPane(streams[enlargedSlot], enlargedSlot, screenW, mainH)}
          <View style={{ flexDirection: "row", height: thumbH }}>
            {others.map(({ slot, realIdx }) => renderPane(slot, realIdx, thumbW, thumbH))}
            {showEmptySlot && renderPane(null, streams.length, thumbW, thumbH)}
          </View>
        </View>
      );
    }

    const gridRows: (StreamSlot | null)[][] = [];
    for (let r = 0; r < rows; r++) {
      gridRows.push(slots.slice(r * cols, (r + 1) * cols));
    }

    return (
      <View style={{ flex: 1 }}>
        {gridRows.map((row, rIdx) => (
          <View key={rIdx} style={{ flexDirection: "row", height: paneH }}>
            {row.map((slot, cIdx) => {
              const realIdx = rIdx * cols + cIdx;
              return renderPane(slot, realIdx, paneW, paneH);
            })}
          </View>
        ))}
      </View>
    );
  };

  const menuItems = useMemo(() => {
    if (!selectedStream || selectedSlot === null) return [];
    const isAudio = audioSlot === selectedSlot;
    return [
      {
        icon: "plus-circle" as const,
        label: "Add screen",
        action: () => {
          setShowSlotMenu(false);
          openChannelPicker(streams.length, "add");
        },
        disabled: streams.length >= MAX_STREAMS,
      },
      {
        icon: "search" as const,
        label: "Search and add",
        action: () => {
          setShowSlotMenu(false);
          openChannelPicker(streams.length, "add");
        },
        disabled: streams.length >= MAX_STREAMS,
      },
      {
        icon: "refresh-cw" as const,
        label: "Change channel",
        action: () => {
          setShowSlotMenu(false);
          if (selectedSlot !== null) openChannelPicker(selectedSlot, "change");
        },
      },
      {
        icon: (selectedStream.paused ? "play" : "pause") as keyof typeof Feather.glyphMap,
        label: selectedStream.paused ? "Resume" : "Pause",
        action: () => {
          if (selectedSlot !== null) togglePause(selectedSlot);
        },
      },
      ...(isAudio ? [] : [{
        icon: "volume-2" as const,
        label: "Move audio here",
        action: () => {
          setAudioSlot(selectedSlot);
          setShowSlotMenu(false);
        },
      }]),
      {
        icon: "maximize-2" as const,
        label: "Enlarge screen",
        action: () => {
          setEnlargedSlot(selectedSlot);
          setFullscreenSlot(null);
          setShowSlotMenu(false);
        },
      },
      {
        icon: "maximize" as const,
        label: "Full screen",
        action: () => {
          setFullscreenSlot(selectedSlot);
          setEnlargedSlot(null);
          setShowSlotMenu(false);
        },
      },
      {
        icon: "x-circle" as const,
        label: "Remove screen",
        destructive: true,
        action: () => {
          if (selectedSlot !== null) removeStream(selectedSlot);
        },
      },
    ];
  }, [selectedStream, selectedSlot, audioSlot, streams.length, openChannelPicker, togglePause, removeStream]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        <View style={[styles.header, { paddingTop: topPad + 6 }]}>
          <TouchableOpacity onPress={onClose} style={styles.hBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Feather name="layout" size={14} color={colors.primary} />
            <Text style={styles.headerTitle}>Multiview</Text>
            <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.countText, { color: colors.primary }]}>{activeCount}/{MAX_STREAMS}</Text>
            </View>
          </View>
          {(enlargedSlot !== null || fullscreenSlot !== null) ? (
            <TouchableOpacity
              onPress={() => { setEnlargedSlot(null); setFullscreenSlot(null); }}
              style={styles.hBtn}
            >
              <Feather name="grid" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.hBtn} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          {activeCount === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="layout" size={52} color="rgba(255,255,255,0.12)" />
              <Text style={styles.emptyTitle}>Multiview</Text>
              <Text style={styles.emptyDesc}>Watch up to {MAX_STREAMS} channels at once</Text>
              <TouchableOpacity
                style={[styles.addFirstBtn, { backgroundColor: colors.primary }]}
                onPress={() => openChannelPicker(0, "add")}
              >
                <Feather name="plus" size={18} color="#fff" />
                <Text style={styles.addFirstBtnText}>Add first screen</Text>
              </TouchableOpacity>
            </View>
          ) : renderGrid()}
        </View>

        <View style={[styles.bottomBar, { paddingBottom: bottomPad + 4 }]}>
          <TouchableOpacity
            style={[styles.bbBtn, activeCount >= MAX_STREAMS && styles.bbBtnDisabled]}
            onPress={() => { if (activeCount < MAX_STREAMS) openChannelPicker(streams.length, "add"); }}
          >
            <Feather name="plus-circle" size={16} color={colors.primary} />
            <Text style={[styles.bbBtnText, { color: colors.primary }]}>Add screen</Text>
          </TouchableOpacity>

          <View style={styles.bbSep} />

          <TouchableOpacity
            style={styles.bbBtn}
            onPress={() => {
              const allPaused = streams.every((s) => s.paused);
              setStreams((prev) => prev.map((s) => ({ ...s, paused: !allPaused })));
            }}
          >
            <Feather name="pause" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={[styles.bbBtnText, { color: "rgba(255,255,255,0.7)" }]}>
              {streams.every((s) => s.paused) ? "Resume all" : "Pause all"}
            </Text>
          </TouchableOpacity>

          <View style={styles.bbSep} />

          <TouchableOpacity
            style={styles.bbBtn}
            onPress={() => {
              setEnlargedSlot(null);
              setFullscreenSlot(null);
              setStreams([]);
              setAudioSlot(0);
              onClose();
            }}
          >
            <Feather name="x-circle" size={16} color="rgba(255,255,255,0.45)" />
            <Text style={[styles.bbBtnText, { color: "rgba(255,255,255,0.45)" }]}>Close all</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          {activeCount > 0 && (
            <View style={styles.audioInfo}>
              <Feather name="volume-2" size={12} color="rgba(255,255,255,0.5)" />
              <Text style={styles.audioInfoText} numberOfLines={1}>
                {streams[Math.min(audioSlot, streams.length - 1)]?.channelName ?? "—"}
              </Text>
            </View>
          )}
        </View>

        <Modal visible={showSlotMenu} transparent animationType="fade" onRequestClose={() => setShowSlotMenu(false)}>
          <TouchableWithoutFeedback onPress={() => setShowSlotMenu(false)}>
            <View style={styles.menuOverlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.menuSheet, { backgroundColor: "#1e1e1e" }]}>
                  <View style={styles.menuTitleRow}>
                    <Feather name="tv" size={14} color={colors.primary} />
                    <Text style={[styles.menuTitle, { color: colors.primary }]} numberOfLines={1}>
                      {selectedStream?.channelName ?? "Screen"}
                    </Text>
                    {selectedSlot !== null && audioSlot === selectedSlot && (
                      <View style={[styles.audioMenuBadge, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                        <Feather name="volume-2" size={11} color="#fff" />
                        <Text style={styles.audioMenuBadgeText}>Audio</Text>
                      </View>
                    )}
                  </View>

                  {menuItems.map((item, i, arr) => (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.menuRow,
                        i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.08)" },
                        (item as any).disabled && { opacity: 0.35 },
                      ]}
                      onPress={() => {
                        if (!(item as any).disabled) {
                          Haptics.selectionAsync();
                          item.action();
                        }
                      }}
                      activeOpacity={(item as any).disabled ? 1 : 0.7}
                    >
                      <Feather
                        name={item.icon}
                        size={18}
                        color={
                          (item as any).destructive ? "#f44336"
                            : item.label === "Move audio here" ? "#4CAF50"
                              : "#fff"
                        }
                      />
                      <Text style={[
                        styles.menuLabel,
                        {
                          color: (item as any).destructive ? "#f44336"
                            : item.label === "Move audio here" ? "#4CAF50"
                              : "#fff"
                        },
                      ]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <ChannelPickerModal
          visible={showChannelPicker}
          title={channelPickerMode === "change" ? "Change channel" : "Add screen"}
          onClose={() => setShowChannelPicker(false)}
          onSelect={handleChannelSelect}
          colors={colors}
          topPad={topPad}
        />
      </View>
    </Modal>
  );
}

const paneStyles = StyleSheet.create({
  pane: {
    overflow: "hidden",
    backgroundColor: "#0a0a0a",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
    position: "relative",
  },
  paneFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 5,
    backgroundColor: "rgba(0,0,0,0.72)",
    gap: 2,
  },
  livePill: { flexDirection: "row", alignItems: "center", gap: 3 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#f44336" },
  liveTxt: { color: "#f44336", fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  audioPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  audioPillText: { color: "#fff", fontSize: 7, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  pausedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pausedPillText: { color: "rgba(255,255,255,0.7)", fontSize: 7, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  paneChannelName: { color: "#fff", fontSize: 9, fontFamily: "Inter_600SemiBold" },
  emptyPane: { flex: 1, justifyContent: "center", alignItems: "center", gap: 6 },
  addCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  addScreenText: { color: "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "Inter_400Regular" },
  audioCornerBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "rgba(0,0,0,0.9)",
    gap: 8,
    zIndex: 10,
  },
  hBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  headerTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, paddingHorizontal: 40 },
  emptyTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  emptyDesc: { color: "rgba(255,255,255,0.4)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  addFirstBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 10, marginTop: 8 },
  addFirstBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.9)",
    paddingTop: 8,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  bbBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 7, paddingHorizontal: 10 },
  bbBtnDisabled: { opacity: 0.35 },
  bbBtnText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  bbSep: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: "rgba(255,255,255,0.15)" },
  audioInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingRight: 8,
    maxWidth: 140,
  },
  audioInfoText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  menuSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  menuTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  menuTitle: { fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 },
  audioMenuBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  audioMenuBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14 },
  menuLabel: { fontSize: 15, fontFamily: "Inter_400Regular", flex: 1 },
});

const pickerStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  hBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  title: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  groupSidebar: {
    width: 110,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  groupItem: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    position: "relative",
    overflow: "hidden",
  },
  groupStripe: {
    position: "absolute",
    left: 0,
    top: 5,
    bottom: 5,
    width: 3,
    borderRadius: 2,
  },
  groupText: {
    fontSize: 11,
    paddingLeft: 6,
  },
  chRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  chName: { fontSize: 13, fontFamily: "Inter_500Medium" },
  chGroup: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  emptyList: { flex: 1, paddingTop: 40, alignItems: "center" },
  emptyListText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
