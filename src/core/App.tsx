import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useHistoryStore } from '../store/historyStore';
import { theme } from '../theme';
import { NetworkListener } from './NetworkListener';
import { RootNavigator } from './Navigation';

export default function App() {
  const isLoading = useHistoryStore((state) => state.isLoading);

  useEffect(() => {
    useHistoryStore.getState().fetchData();
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
