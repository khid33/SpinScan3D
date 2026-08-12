import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { shootPhoto, uploadToNextcloud } from '../api/client';
import SettingsScreen from './SettingsScreen';
import { CameraView, useCameraPermissions } from 'expo-camera';
import RNFS from 'react-native-fs';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const HomeScreen = () => {
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const cameraRef = useRef(null);

  const handleCapture = async () => {
    setLoading(true);
    try {
      const result = await shootPhoto();
      Alert.alert('成功', '撮影が完了しました！');
    } catch (error) {
      Alert.alert('エラー', '撮影に失敗しました。サーバー接続を確認してください。');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCapture = async () => {
    setManualLoading(true);
    try {
      const capturedUris = [];
      
      console.log('連続撮影を開始します。3秒後に1枚目を撮影します...');
      await sleep(3000);
      
      for (let i = 0; i < 3; i++) {
        console.log(`撮影 ${i + 1}/3 開始...`);
        
        // カメラプレビューを一時停止して撮影
        const camera = cameraRef.current;
        if (!camera) {
          throw new Error('カメラが初期化されていません');
        }
        
        // タイムアウト付きで撮影（10秒）
        const photo = await Promise.race([
          camera.takePictureAsync({
            quality: 0.8,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('撮影がタイムアウトしました。エミュレーターではカメラが正常に機能しない場合があります。実機でお試しください。')), 10000)
          )
        ]);
        
        if (!photo || !photo.uri) {
          throw new Error('撮影が失敗しました');
        }
        
        console.log(`撮影 ${i + 1}/3 完了`);
        capturedUris.push(photo.uri);
        
        if (i < 2) {
          console.log(`次の撮影まで3秒待機します...`);
          await sleep(3000);
        }
      }

      console.log('全撮影が完了しました。アップロードを開始します...');
      
      // すべての撮影完了後にまとめてアップロード
      for (let i = 0; i < capturedUris.length; i++) {
        const uri = capturedUris[i];
        console.log(`アップロード中 ${i + 1}/${capturedUris.length}...`);
        
        const fileName = `manual_capture_${Date.now()}_${i + 1}.jpg`;
        
        // URIからファイルを読み込み、Base64で送信
        const base64Data = await RNFS.readFile(uri, 'base64');
        
        await uploadToNextcloud(fileName, base64Data);
        console.log(`アップロード完了 ${i + 1}/${capturedUris.length}`);
      }

      Alert.alert('成功', '3枚の撮影とアップロードがすべて完了しました！');
    } catch (error) {
      console.error('Manual Capture Sequence Error:', error);
      Alert.alert('エラー', `処理中にエラーが発生しました: ${error.message}`);
    } finally {
      setManualLoading(false);
    }
  };

  const handleBackFromSettings = () => {
    setShowSettings(false);
  };

  if (showSettings) {
    return <SettingsScreen onBack={handleBackFromSettings} />;
  }

  return (
    <View style={styles.container}>
      {/* カメラプレビュー（撮影時に使用） */}
      <CameraView
        ref={cameraRef}
        style={styles.cameraView}
        facing="back"
        pointerEvents="none"
      />
      
      <View style={styles.content}>
        <Text style={styles.title}>SpinScan Controller</Text>
      
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleCapture}
          disabled={loading || manualLoading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>サーバー撮影 📸</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.manualButton, manualLoading && styles.buttonDisabled]} 
          onPress={handleManualCapture}
          disabled={loading || manualLoading}
        >
          {manualLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>手動撮影 (3回) 🕒</Text>
          )}
        </TouchableOpacity>
      
        <TouchableOpacity 
          style={[styles.button, styles.settingsButton]} 
          onPress={() => setShowSettings(true)}
          disabled={loading || manualLoading}
        >
          <Text style={styles.buttonText}>⚙️ 設定</Text>
        </TouchableOpacity>
      
        <Text style={styles.footer}>Nextcloud 自動同期有効</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 50,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#a0caff',
  },
  manualButton: {
    backgroundColor: '#34C759',
  },
  cameraView: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  settingsButton: {
    marginTop: 16,
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    marginTop: 20,
    fontSize: 12,
    color: '#888',
  },
});

export default HomeScreen;

