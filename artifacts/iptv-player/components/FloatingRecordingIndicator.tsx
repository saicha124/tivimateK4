import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated as RNAnimated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDeviceRecordingCtx } from "@/context/DeviceRecordingContext";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function FloatingRecordingIndicator() {
  const { isRecording, channelName, bytesWritten, elapsedMs, stop } = useDeviceRecordingCtx();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    if (!isRecording) return;
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isRecording, pulseAnim]);

  if (!isRecording) return null;

  const handleStop = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const saved = await stop();
    Alert.alert(
      "Recording saved",
      saved
        ? `Saved to:\n${saved}\n\n${formatBytes(bytesWritten)} captured`
        : "Recording stopped.",
      [{ text: "OK" }],
    );
  };

  const topOffset = Platform.OS === "web" ? 72 : insets.top + 8;

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(250)}
      style={[styles.container, { top: topOffset }]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        {/* Pulsing red dot */}
        <RNAnimated.View style={[styles.dot, { opacity: pulseAnim }]} />

        {/* Channel name + elapsed + size */}
        <View style={styles.textGroup}>
          <Text style={styles.recLabel} numberOfLines={1}>
            REC {formatElapsed(elapsedMs)}
          </Text>
          {!!channelName && (
            <Text style={styles.channelLabel} numberOfLines={1}>
              {channelName}
            </Text>
          )}
          <Text style={styles.sizeLabel}>{formatBytes(bytesWritten)}</Text>
        </View>

        {/* Stop button */}
        <TouchableOpacity onPress={handleStop} style={styles.stopBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
          <Feather name="square" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 12,
    zIndex: 9000,
    alignItems: "flex-end",
    pointerEvents: "box-none",
  } as any,
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,0,0,0.88)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: "#e53935",
    gap: 8,
    shadowColor: "#e53935",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e53935",
  },
  textGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recLabel: {
    color: "#e53935",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  channelLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    maxWidth: 120,
  },
  sizeLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  stopBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#e53935",
    alignItems: "center",
    justifyContent: "center",
  },
});
