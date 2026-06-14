import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/core/navigation/RootNavigator';
import { theme } from './src/core/theme/theme';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useHistoryStore } from './src/features/history/presentation/state/useHistoryStore';
import { NetworkManager } from './src/core/sync/NetworkManager';

export default function App() {
  const isLoading = useHistoryStore((state) => state.isLoading);

  useEffect(() => {
    useHistoryStore.getState().fetchData();
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NetworkManager />
      <View style={styles.container}>
        <RootNavigator />
        <StatusBar style="light"/>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
