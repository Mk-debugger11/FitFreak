import { useEffect } from 'react';
import { ActivityIndicator, LogBox, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useHistoryStore } from '../store/historyStore';
import { theme } from '../theme';
import { NetworkListener } from './NetworkListener';
import { RootNavigator } from './Navigation';

// Ignore noisy upstream dev-only warnings from @react-three/fiber and expo-gl.
LogBox.ignoreLogs([
  'THREE.Clock: This module has been deprecated',
  'EXGL: gl.pixelStorei() doesn\'t support this parameter yet!',
]);

/** Root application component handling store hydration and navigation setup. */
export default function App() {
  const isLoading = useHistoryStore((state) => state.isLoading);

  useEffect(() => {
    if (useHistoryStore.persist.hasHydrated()) {
      useHistoryStore.getState().fetchData();
      return;
    }

    return useHistoryStore.persist.onFinishHydration(() => {
      useHistoryStore.getState().fetchData();
    });
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NetworkListener />
      <View style={styles.container}>
        <RootNavigator />
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
