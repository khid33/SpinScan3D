import axios from 'axios';
import { loadConfig } from '../hooks/useConfig';
import { Buffer } from 'buffer';
import { encode as btoa } from 'base-64';

let currentConfig = null;

const loadAndApplyConfig = async () => {
// ... (以下、変更なし)
  if (!currentConfig) {
    currentConfig = await loadConfig();
  }
  return currentConfig;
};

const api = axios.create({
  timeout: 5000,
});

export const shootPhoto = async () => {
  // 撮影はスマホ側で行うため、サーバーへのリクエストは不要
  return { success: true, message: 'Photo capture triggered on device' };
};

export const homeTurntable = async () => {
  const config = await loadAndApplyConfig();
  try {
    const response = await api.get(`http://${config.SERVER_IP}:${config.SERVER_PORT}/home`);
    return response.data;
  } catch (error) {
    console.error('Home Error:', error);
    throw error;
  }
};

export const moveTurntable = async (angle) => {
  const config = await loadAndApplyConfig();
  try {
    const response = await api.get(`http://${config.SERVER_IP}:${config.SERVER_PORT}/move?angle=${angle}`);
    return response.data;
  } catch (error) {
    console.error('Move Error:', error);
    throw error;
  }
};


export const uploadToNextcloud = async (fileName, fileData) => {
  const config = await loadAndApplyConfig();
  try {
    console.log('Starting upload for:', fileName);
    const auth = btoa(`${config.NEXTCLOUD_USER}:${config.NEXTCLOUD_PASS}`);
    
    const webdavBase = '/remote.php/dav/files/';
    let webdavUrl;
    
    if (config.NEXTCLOUD_URL.includes(webdavBase)) {
      webdavUrl = config.NEXTCLOUD_URL;
    } else {
      webdavUrl = `${config.NEXTCLOUD_URL}${webdavBase}${config.NEXTCLOUD_USER}/`;
    }
    
    const folderPath = config.NEXTCLOUD_FOLDER ? `${config.NEXTCLOUD_FOLDER}/` : '';
    const fullUrl = `${webdavUrl}${folderPath}${fileName}`;
    console.log('Uploading to URL:', fullUrl);
    
    let body;
    if (typeof fileData === 'string') {
      console.log('Converting Base64 data to Buffer...');
      try {
        body = Buffer.from(fileData, 'base64');
      } catch (bErr) {
        console.error('Buffer conversion failed:', bErr);
        throw bErr;
      }
    } else {
      body = fileData;
    }
    
    console.log('Sending PUT request...');
    const response = await axios.put(
      fullUrl,
      body,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/octet-stream',
        },
        timeout: 60000, // タイムアウトを60秒に延長
      }
    );
    console.log('Upload response status:', response.status);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Nextcloud Upload Error - Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
    } else if (error.request) {
      console.error('Nextcloud Upload Error - No Response:', error.request);
    } else {
      console.error('Nextcloud Upload Error - Request Setup:', error.message);
    }
    throw error;
  }
};
