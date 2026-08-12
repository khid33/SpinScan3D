import axios from 'axios';
import { loadConfig } from '../hooks/useConfig';

let currentConfig = null;

const loadAndApplyConfig = async () => {
  if (!currentConfig) {
    currentConfig = await loadConfig();
  }
  return currentConfig;
};

const api = axios.create({
  timeout: 5000,
});

export const shootPhoto = async () => {
  const config = await loadAndApplyConfig();
  try {
    const response = await api.post(
      `http://${config.SERVER_IP}:${config.SERVER_PORT}/capture`,
      {},
      { timeout: 10000 }
    );
    return response.data;
  } catch (error) {
    console.error('Capture Error:', error);
    throw error;
  }
};

export const uploadToNextcloud = async (fileName, fileData) => {
  const config = await loadAndApplyConfig();
  try {
    const auth = btoa(`${config.NEXTCLOUD_USER}:${config.NEXTCLOUD_PASS}`);
    
    // WebDAV エンドポイントの構築
    const webdavBase = '/remote.php/dav/files/';
    let webdavUrl;
    
    if (config.NEXTCLOUD_URL.includes(webdavBase)) {
      // URL に WebDAV パスが既に含まれている場合
      webdavUrl = config.NEXTCLOUD_URL;
    } else {
      // 基本 URL のみ — WebDAV エンドポイントを付加
      webdavUrl = `${config.NEXTCLOUD_URL}${webdavBase}${config.NEXTCLOUD_USER}/`;
    }
    
    const folderPath = config.NEXTCLOUD_FOLDER ? `${config.NEXTCLOUD_FOLDER}/` : '';
    
    // Base64データをBufferに変換
    let body;
    if (typeof fileData === 'string') {
      // Base64文字列の場合
      body = Buffer.from(fileData, 'base64');
    } else {
      // BlobまたはBufferの場合
      body = fileData;
    }
    
    const response = await axios.put(
      `${webdavUrl}${folderPath}${fileName}`,
      body,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/octet-stream',
        },
        timeout: 30000,
      }
    );
    return response.data;
  } catch (error) {
    console.error('Nextcloud Upload Error:', error);
    throw error;
  }
};
