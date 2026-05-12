import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { FloatingPiPPlayer } from "@/components/FloatingPiPPlayer";
import { FloatingRecordingIndicator } from "@/components/FloatingRecordingIndicator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { IPTVProvider } from "@/context/IPTVContext";
import { ParentalProvider } from "@/context/ParentalContext";
import { PiPProvider } from "@/context/PiPContext";
import { DeviceRecordingProvider } from "@/context/DeviceRecordingContext";

SplashScreen.preventAutoHideAsync();

if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const msg: string =
      (event.reason instanceof Error ? event.reason.message : null) ??
      String(event.reason?.message ?? event.reason ?? "");
    const isNetworkNoise =
      msg.includes("network error") ||
      msg.includes("Network error") ||
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("Load failed") ||
      msg.includes("The network connection was lost");
    if (isNetworkNoise) {
      console.warn("[background network error suppressed]", msg);
      event.preventDefault();
    }
  });
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="player" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ParentalProvider>
                <IPTVProvider>
                  <DeviceRecordingProvider>
                    <PiPProvider>
                      <RootLayoutNav />
                      <FloatingPiPPlayer />
                      <FloatingRecordingIndicator />
                    </PiPProvider>
                  </DeviceRecordingProvider>
                </IPTVProvider>
              </ParentalProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
