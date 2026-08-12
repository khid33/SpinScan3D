import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CONFIG_KEY = 'spinscan_config';

const DEFAULT_CONFIG = {
  SERVER_IP: '192.168.1.100',
  SERVER_PORT: '5000',
  NEXTCLOUD_URL: 'https://your-nextcloud-domain.com/remote.php/dav/files/',
  NEXTCLOUD_USER: '',
  NEXTCLOUD_PASS: '',
  NEXTCLOUD_FOLDER: '',
};

const getStorage = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return true;
    }
    await SecureStore.setItemAsync(key, value);
    return true;
  },
};

export const loadConfig = async () => {
  try {
    const saved = await getStorage.getItem(CONFIG_KEY);
    if (saved) {
      const parsed = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      
      if (parsed.NEXTCLOUD_FOLDER && parsed.NEXTCLOUD_FOLDER.startsWith('/home/')) {
        console.warn('Invalid NEXTCLOUD_FOLDER detected (Linux absolute path). Resetting to empty.');
        parsed.NEXTCLOUD_FOLDER = '';
      }
      
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  return { ...DEFAULT_CONFIG };
};

export const saveConfig = async (config) => {
  try {
    await getStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('Failed to save config:', error);
    return false;
  }
};

export const useConfig = () => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConfig().then((loadedConfig) => {
      setConfig(loadedConfig);
      setIsLoading(false);
    });
  }, []);

  const updateConfig = useCallback(async (updates) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    await saveConfig(newConfig);
    return newConfig;
  }, [config]);

  return {
    config,
    updateConfig,
    isLoading,
  };
};
