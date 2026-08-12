import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import base64 from 'base-64';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useConfig } from '../hooks/useConfig';

const SettingsScreen = ({ onBack }) => {
  const { config, updateConfig, isLoading } = useConfig();
  const [formData, setFormData] = useState(config);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderList, setFolderList] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [parentPath, setParentPath] = useState('');

  useEffect(() => {
    if (!isLoading) {
      setFormData(config);
    }
  }, [config, isLoading]);

  const handleSave = async () => {
    if (formData.NEXTCLOUD_URL && !formData.NEXTCLOUD_URL.startsWith('http')) {
      Alert.alert('エラー', 'Nextcloud URLは http:// または https:// で始まる必要があります。');
      return;
    }
    if (!formData.NEXTCLOUD_USER) {
      Alert.alert('エラー', 'Nextcloud ユーザー名を入力してください。');
      return;
    }
    if (!formData.NEXTCLOUD_PASS) {
      Alert.alert('エラー', 'Nextcloud パスワード（またはアプリパスワード）を入力してください。');
      return;
    }
    const result = await updateConfig(formData);
    Alert.alert(
      '保存完了',
      '設定が保存されました。\n\n' +
        `URL: ${result.NEXTCLOUD_URL}\n` +
        `ユーザー: ${result.NEXTCLOUD_USER}\n` +
        `フォルダ: ${result.NEXTCLOUD_FOLDER || 'ルート'}`,
      [{ text: 'OK' }]
    );
  };

  const fetchFolders = async (path = '') => {
    if (!formData.NEXTCLOUD_URL || !formData.NEXTCLOUD_USER || !formData.NEXTCLOUD_PASS) {
      Alert.alert('エラー', 'まず Nextcloud URL、ユーザー名、パスワードを入力してください。');
      return;
    }

    setIsFetching(true);
    setCurrentPath(path);

    try {
      // Nextcloud WebDAV エンドポイントの正規化構築
      const baseUrl = formData.NEXTCLOUD_URL.replace(/\/+$/, '');
      const webdavBase = '/remote.php/dav/files/';
      
      let normalizedBase = baseUrl;
      if (baseUrl.includes(webdavBase)) {
        normalizedBase = baseUrl.substring(0, baseUrl.indexOf(webdavBase) + webdavBase.length);
      } else {
        normalizedBase = `${baseUrl}${webdavBase}`;
      }

      // Webプラットフォームの場合は自前CORSプロキシを経由させる
      let finalBase = normalizedBase;
      if (Platform.OS === 'web') {
        const proxyUrl = 'http://localhost:3000';
        const pathOnly = normalizedBase.replace(/^https?:\/\//, '').replace(/^localhost:3000\/?/, '');
        finalBase = `${proxyUrl}/${pathOnly}`;
      }

      const targetPath = `${finalBase}${formData.NEXTCLOUD_USER}${path ? `/${path}` : ''}/`;
      
      console.log(`[Debug] Fetching folders from: ${targetPath}`);


      const auth = base64.encode(`${formData.NEXTCLOUD_USER}:${formData.NEXTCLOUD_PASS}`);

      const response = await axios({
        method: 'PROPFIND',
        url: targetPath,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/xml',
          'Depth': '1',
        },
        data: '<propfind xmlns="DAV:"><prop><displayname/><resourcetype/><getlastmodified/></prop></propfind>',
        timeout: 10000,
      });

      // XML レスポンスをパース (WebDAV PROPFIND 応答)
      const xmlParser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        isArray: (tagName) => {
          // 複数の response や propstat が来る可能性がある
          return ['response', 'propstat', 'd:response', 'd:propstat'].includes(tagName);
        },
      });
      const parsed = xmlParser.parse(response.data);
      
      // fast-xml-parser は XML の名前空間プレフィックス (d:) をキーとして保持
      let responses = parsed?.['d:multistatus']?.['d:response'] || [];
      if (!Array.isArray(responses)) {
        responses = [responses];
      }
      const folders = [];

      for (const resp of responses) {
        const href = resp?.['d:href']?.['#text'] || resp?.['d:href'];
        if (!href) continue;
        
        // propstat が配列の場合とオブジェクトの場合の両方に対応
        const propstat = resp?.['d:propstat'];
        const propStatsList = Array.isArray(propstat) ? propstat : [propstat];
        let isFolder = false;
        
        for (const ps of propStatsList) {
          // propstat が配列でない場合、d:prop は直接アクセス
          const prop = ps?.['d:prop'] || {};
          const resType = prop?.['d:resourcetype'];
          // resourcetype が空文字列の場合はファイル、オブジェクトの場合はフォルダ
          if (resType && typeof resType === 'object' && 'd:collection' in resType) {
            isFolder = true;
            break;
          }
          // resourcetype が空文字列の場合、d:collection が存在しない場合はファイル
          if (resType === '') {
            isFolder = false;
          }
        }
        
        if (href && href !== targetPath.replace(/\/$/, '') && isFolder) {
          const name = href.split('/').filter(Boolean).pop();
          // path は相対パスとして保存（/remote.php/dav/files/ から始まるパス）
          const webdavBase = '/remote.php/dav/files/';
          const pathStartIndex = href.indexOf(webdavBase);
          const relativePath = pathStartIndex >= 0 ? href.substring(pathStartIndex) : href;
          folders.push({
            name,
            path: relativePath,
            isFolder: true,
          });
        }
      }

      setFolderList(folders);
    } catch (error) {
      console.error('Folder fetch error:', error);
      Alert.alert(
        'フォルダ一覧の取得に失敗しました',
        'Nextcloud の CORS 設定を確認してください。\n\n' +
        'Nextcloud 管理者に以下の CORS ヘッダー追加を依頼してください：\n' +
        'Access-Control-Allow-Origin: *\n' +
        'Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PROPFIND, LIST\n' +
        'Access-Control-Allow-Headers: Authorization, Content-Type, Depth, User-Agent, X-File-Size, X-Requested-With, If_MODIFIED_SINCE, DAV, overwriting, translate, ssl-client-cert\n\n' +
        'エラー詳細: ' + error.message
      );
    } finally {
      setIsFetching(false);
    }
  };

  const openFolderPicker = () => {
    setParentPath(formData.NEXTCLOUD_FOLDER || '');
    fetchFolders(formData.NEXTCLOUD_FOLDER || '');
    setShowFolderPicker(true);
  };

  const handleFolderSelect = (folderPath) => {
    setFormData({ ...formData, NEXTCLOUD_FOLDER: folderPath });
    setShowFolderPicker(false);
  };

  const handleNavigateUp = () => {
    if (currentPath) {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      const newPath = parts.join('/');
      fetchFolders(newPath);
    }
  };

  const handleFolderClick = (folder) => {
    const newPath = currentPath ? `${currentPath}/${folder.name}` : folder.name;
    fetchFolders(newPath);
  };

  const handleTestConnection = async () => {
    if (!formData.NEXTCLOUD_URL || !formData.NEXTCLOUD_USER || !formData.NEXTCLOUD_PASS) {
      Alert.alert('Error', 'Please enter URL, username, and password.');
      return;
    }

    setIsFetching(true);
    try {
      const baseUrl = formData.NEXTCLOUD_URL.replace(/\/+$/, '');
      const webdavBase = '/remote.php/dav/files/';
      
      let normalizedBase = baseUrl;
      if (baseUrl.includes(webdavBase)) {
        normalizedBase = baseUrl.substring(0, baseUrl.indexOf(webdavBase) + webdavBase.length);
      } else {
        normalizedBase = `${baseUrl}${webdavBase}`;
      }

      // Webプラットフォームの場合は自前CORSプロキシを経由させる
      let finalBase = normalizedBase;
      if (Platform.OS === 'web') {
        const proxyUrl = 'http://localhost:3000';
        const pathOnly = normalizedBase.replace(/^https?:\/\//, '').replace(/^localhost:3000\/?/, '');
        finalBase = `${proxyUrl}/${pathOnly}`;
      }

      const targetPath = `${finalBase}${formData.NEXTCLOUD_USER}/`;
      console.log(`[Debug] Testing connection to: ${targetPath}`);

      const auth = base64.encode(`${formData.NEXTCLOUD_USER}:${formData.NEXTCLOUD_PASS}`);

      await axios({
        method: 'PROPFIND',
        url: targetPath,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/xml',
          'Depth': '0',
        },
        data: '<propfind xmlns="DAV:"><prop><displayname/></prop></propfind>',
        timeout: 10000,
      });

      Alert.alert('Success', 'Successfully connected to Nextcloud!');
    } catch (error) {
      console.error('[Test Connection Error]', error);
      let errorMessage = 'Connection failed.';
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Authentication failed. Please check your username or password.';
        } else {
          errorMessage = `Server error occurred (Status: ${error.response.status})`;
        }
      } else {
        errorMessage = `Network error occurred: ${error.message}`;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setIsFetching(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'リセット',
      '設定を初期値に戻しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'リセット',
          style: 'destructive',
          onPress: async () => {
            const resetConfig = {
              ...config,
              SERVER_IP: '192.168.1.100',
              SERVER_PORT: '5000',
              NEXTCLOUD_URL: 'https://your-nextcloud-domain.com/remote.php/dav/files/',
              NEXTCLOUD_USER: '',
              NEXTCLOUD_PASS: '',
              NEXTCLOUD_FOLDER: '',
            };
            await updateConfig(resetConfig);
            setFormData(resetConfig);
            Alert.alert('完了', '設定を初期値に戻しました。');
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text>読み込み中...</Text>
      </View>
    );
  }

  return (
    <>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Nextcloud 設定</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>サーバー設定</Text>
          <Text style={styles.label}>撮影サーバー IP アドレス</Text>
          <TextInput
            style={styles.input}
            value={formData.SERVER_IP}
            onChangeText={(text) => setFormData({ ...formData, SERVER_IP: text })}
            placeholder="192.168.1.100"
            keyboardType="numeric"
          />
          <Text style={styles.label}>ポート番号</Text>
          <TextInput
            style={styles.input}
            value={formData.SERVER_PORT}
            onChangeText={(text) => setFormData({ ...formData, SERVER_PORT: text })}
            placeholder="5000"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nextcloud 設定</Text>
          <Text style={styles.label}>Nextcloud URL</Text>
          <TextInput
            style={styles.input}
            value={formData.NEXTCLOUD_URL}
            onChangeText={(text) => setFormData({ ...formData, NEXTCLOUD_URL: text })}
            placeholder="https://your-domain.com/remote.php/dav/files/"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hint}>
            WebDAV エンドポイント: https://&lt;domain&gt;/remote.php/dav/files/
          </Text>
          <Text style={styles.label}>ユーザー名</Text>
          <TextInput
            style={styles.input}
            value={formData.NEXTCLOUD_USER}
            onChangeText={(text) => setFormData({ ...formData, NEXTCLOUD_USER: text })}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.label}>パスワード（またはアプリパスワード）</Text>
          <TextInput
            style={styles.input}
            value={formData.NEXTCLOUD_PASS}
            onChangeText={(text) => setFormData({ ...formData, NEXTCLOUD_PASS: text })}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hint}>
            Nextcloud 設定 → セキュリティ → デバイスとセッション から「アプリパスワード」を発行
          </Text>
          <Text style={styles.label}>アップロード先フォルダ</Text>
          <View style={styles.folderInputContainer}>
            <TextInput
              style={[styles.input, styles.folderInput]}
              value={formData.NEXTCLOUD_FOLDER}
              onChangeText={(text) => setFormData({ ...formData, NEXTCLOUD_FOLDER: text })}
              placeholder="spinscan-images"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity 
              style={styles.folderPickerButton}
              onPress={openFolderPicker}
            >
              <Text style={styles.folderPickerButtonText}>📁 選択</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            ルートにアップロードする場合は空白のままにしてください
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>現在設定</Text>
          <View style={styles.configDisplay}>
            <Text style={styles.configText}>URL: {formData.NEXTCLOUD_URL || '(未設定)'}</Text>
            <Text style={styles.configText}>ユーザー: {formData.NEXTCLOUD_USER || '(未設定)'}</Text>
            <Text style={styles.configText}>
              フォルダ: {formData.NEXTCLOUD_FOLDER || '(ルート)'}
            </Text>
          </View>
        </View>

        {/* テスト接続ボタン */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={[styles.button, styles.testButton]} 
            onPress={handleTestConnection}
          >
            <Text style={styles.buttonText}>🔗 テスト接続</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            設定した credentials で Nextcloud に接続します
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
          <Text style={styles.buttonText}>保存</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={handleReset}>
          <Text style={[styles.buttonText, styles.resetText]}>リセット</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.backButton]} onPress={onBack}>
          <Text style={styles.buttonText}>戻る</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>

    {/* フォルダ選択モーダル */}
    <FolderPickerModal
      visible={showFolderPicker}
      currentPath={currentPath}
      folderList={folderList}
      isFetching={isFetching}
      onFolderSelect={handleFolderSelect}
      onNavigateUp={handleNavigateUp}
      onFolderClick={handleFolderClick}
      onClose={() => setShowFolderPicker(false)}
    />
  </>
  );
};

// フォルダ選択モーダル
const FolderPickerModal = ({ visible, currentPath, folderList, isFetching, onFolderSelect, onNavigateUp, onFolderClick, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>フォルダ選択</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalDoneButton}>
              <Text style={styles.modalDoneButtonText}>完了</Text>
            </TouchableOpacity>
          </View>

          {/* パス表示 */}
          <View style={styles.pathDisplay}>
            <TouchableOpacity onPress={onNavigateUp} style={styles.pathItem}>
              <Text style={styles.pathText}>📁 ...</Text>
            </TouchableOpacity>
            {currentPath.split('/').filter(Boolean).map((part, index) => (
              <Text key={index} style={styles.pathSeparator}> / </Text>
            ))}
            {currentPath ? (
              <Text style={styles.pathCurrent}>{decodeURIComponent(currentPath.split('/').pop() || '')}</Text>
            ) : null}
          </View>

          {/* フォルダ一覧 */}
          {isFetching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>フォルダ一覧を読み込み中...</Text>
            </View>
          ) : folderList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>フォルダがありません</Text>
            </View>
          ) : (
            <ScrollView style={styles.folderList}>
              {folderList.map((folder, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.folderItem}
                  onPress={() => onFolderClick(folder)}
                >
                  <Text style={styles.folderIcon}>📁</Text>
                  <Text style={styles.folderName}>{decodeURIComponent(folder.name)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* 選択ボタン */}
          {currentPath && (
            <TouchableOpacity
              style={[styles.button, styles.selectButton]}
              onPress={() => onFolderSelect(currentPath)}
            >
              <Text style={styles.buttonText}>このフォルダを選択</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    marginBottom: 8,
  },
  configDisplay: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  configText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  testButton: {
    backgroundColor: '#34C759',
    marginBottom: 8,
  },
  resetButton: {
    backgroundColor: '#ff3b30',
  },
  backButton: {
    backgroundColor: '#8e8e93',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetText: {
    color: '#fff',
  },
  folderInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folderInput: {
    flex: 1,
  },
  folderPickerButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  folderPickerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#8e8e93',
  },
  modalDoneButton: {
    padding: 8,
  },
  modalDoneButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  pathDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pathItem: {
    padding: 4,
  },
  pathText: {
    fontSize: 14,
    color: '#007AFF',
  },
  pathSeparator: {
    fontSize: 14,
    color: '#888',
  },
  pathCurrent: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
  },
  folderList: {
    maxHeight: 400,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  folderIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  folderName: {
    fontSize: 16,
    color: '#333',
  },
  selectButton: {
    backgroundColor: '#007AFF',
    margin: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
});

export default SettingsScreen;
