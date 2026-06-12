import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/core/navigation/RootNavigator';
import { theme } from './src/core/theme/theme';
import { View, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { useHistoryStore } from './src/features/history/presentation/state/useHistoryStore';

export default function App() {
  useEffect(() => {
    useHistoryStore.getState().fetchData();
  }, []);
  return (
    <SafeAreaProvider>
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
