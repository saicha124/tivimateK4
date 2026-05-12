import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIPTV } from "@/context/IPTVContext";
import { useColors } from "@/hooks/useColors";

interface GroupContextMenuProps {
  group: string | null;
  visible: boolean;
  onClose: () => void;
  onManageFavorites: (group: string) => void;
  onGroupOptions?: (group: string) => void;
}

export function GroupContextMenu({ group, visible, onClose, onManageFavorites, onGroupOptions }: GroupContextMenuProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { hiddenGroups, toggleHideGroup } = useIPTV();

  if (!group) return null;

  const isHidden = hiddenGroups.includes(group);

  const options = [
    {
      label: "Manage Favorites",
      icon: "star" as const,
      color: "#FFC107",
      action: () => {
        onClose();
        onManageFavorites(group);
      },
    },
    {
      label: "Manage blocking",
      icon: "slash" as const,
      action: () => { onClose(); },
      dividerBefore: true,
    },
    {
      label: "Manage visibility",
      icon: "eye" as const,
      action: () => { onClose(); },
    },
    {
      label: "Reorder channels",
      icon: "list" as const,
      action: () => { onClose(); },
    },
    {
      label: "Copy channels",
      icon: "copy" as const,
      action: () => { onClose(); },
      dividerBefore: true,
    },
    {
      label: "Create group",
      icon: "folder-plus" as const,
      action: () => { onClose(); },
    },
    {
      label: "Block group",
      icon: "lock" as const,
      color: colors.destructive,
      action: () => { onClose(); },
      dividerBefore: true,
    },
    {
      label: isHidden ? "Show group" : "Hide group",
      icon: (isHidden ? "eye" : "eye-off") as "eye" | "eye-off",
      action: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggleHideGroup(group);
        onClose();
      },
    },
    {
      label: "Group options",
      icon: "settings" as const,
      action: () => {
        onClose();
        if (group) onGroupOptions?.(group);
      },
    },
  ];

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: bottomPad + 8 }]}>
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Text style={[styles.groupTitle, { color: colors.primary }]} numberOfLines={1}>
                  {group}
                </Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {options.map((opt) => (
                  <React.Fragment key={opt.label}>
                    {opt.dividerBefore && (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    )}
                    <TouchableOpacity
                      onPress={opt.action}
                      style={styles.option}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name={opt.icon}
                        size={18}
                        color={opt.color ?? colors.foreground}
                        style={styles.optionIcon}
                      />
                      <Text style={[styles.optionLabel, { color: opt.color ?? colors.foreground }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
    marginHorizontal: 20,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 16,
  },
  optionIcon: {
    width: 22,
    textAlign: "center",
  },
  optionLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
