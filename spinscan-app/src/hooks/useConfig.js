import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import RNFS from 'react-native-fs';

const CONFIG_FILE_PATH = `${RNFS.DocumentDirectoryPath}/spinscan_config.json`;

const DEFAULT_CONFIG = {
  SERVER_IP: '192.168.1.100',
  SERVER_PORT: '5000',
  CAPTURE_COUNT: '8',
  NEXTCLOUD_URL: 'http://localhost:3000/',
  NEXTCLOUD_USER: 'khid',
  NEXTCLOUD_PASS: '',
  NEXTCLOUD_FOLDER: '',
};

const ConfigContext = createContext(null);

export const loadConfig = async () => {
  try {
    const exists = await RNFS.exists(CONFIG_FILE_PATH);
    if (exists) {
      const content = await RNFS.readFile(CONFIG_FILE_PATH, 'utf8');
      const parsed = { ...DEFAULT_CONFIG, ...JSON.parse(content) };
      
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
    await RNFS.writeFile(CONFIG_FILE_PATH, JSON.stringify(config), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to save config:', error);
    return false;
  }
};

export const ConfigProvider = ({ children }) => {
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

  const reloadConfig = useCallback(async () => {
    const loadedConfig = await loadConfig();
    setConfig(loadedConfig);
    return loadedConfig;
  }, []);

  return (
    <ConfigContext.Provider value={{ config, updateConfig, reloadConfig, isLoading }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
