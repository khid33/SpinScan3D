import { Buffer } from 'buffer';
global.Buffer = Buffer;
import React from 'react';
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import { ConfigProvider } from './src/hooks/useConfig';

export default function App() {
  return (
    <ConfigProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <HomeScreen />
      </SafeAreaView>
    </ConfigProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
