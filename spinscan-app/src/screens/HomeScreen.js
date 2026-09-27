import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { shootPhoto, homeTurntable, moveTurntable, uploadToNextcloud } from '../api/client';
import SettingsScreen from './SettingsScreen';
import { CameraView, useCameraPermissions } from 'expo-camera';
import RNFS from 'react-native-fs';
import { useConfig, loadConfig } from '../hooks/useConfig';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const HomeScreen = () => {
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [captureCount, setCaptureCount] = useState(8);
  const { config, updateConfig } = useConfig();
  const cameraRef = useRef(null);

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    setLogs(prev => {
      const updated = [...prev, `[${timestamp}] ${message}`];
      return updated.slice(-12);
    });
  };

  // 撮影枚数に応じた角度プリセット
  const anglePresets = {
    4: [0, 90, 180, 270],
    8: [0, 45, 90, 135, 180, 225, 270, 315],
    16: [0, 22, 45, 68, 90, 113, 135, 158, 180, 203, 225, 248, 270, 293, 315, 338],
    24: [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345],
  };

  // captureCount が変更されたら angles を更新
  const angles = anglePresets[captureCount] || anglePresets[8];

  // config の CAPTURE_COUNT を監視して state に反映（ファイルから読み込み）
  useEffect(() => {
    loadConfig().then((loadedConfig) => {
      const count = parseInt(loadedConfig.CAPTURE_COUNT || '8', 10);
      if (count !== captureCount) {
        setCaptureCount(count);
      }
    });
  }, [config.CAPTURE_COUNT]);

  const handleCapture = async () => {
    setLoading(true);
    setLogs([]);
    
    // ファイルから最新の設定を読み込む
    const currentConfig = await loadConfig();
    const savedCount = parseInt(currentConfig.CAPTURE_COUNT || '8', 10);
    
    addLog('撮影開始');

    // 撮影開始時の最新の captureCount に基づいて角度リストを確定させる
    const currentAngles = anglePresets[savedCount] || anglePresets[8];
    addLog(`撮影枚数: ${currentAngles.length}枚 (ファイルから読み込み)`);

    try {
      // 1. 原点復帰
      addLog('原点復帰中...');
      try {
        await homeTurntable();
        addLog('原点復帰完了');
      } catch (e) {
        addLog(`原点復帰エラー: ${e.message}`);
        throw new Error(`原点復帰に失敗しました: ${e.message}`);
      }
      
      // 2. 撮影ループ (プリセットの角度で撮影)
      const capturedUris = [];

      for (let i = 0; i < currentAngles.length; i++) {
        const angle = currentAngles[i];
        addLog(`角度 ${angle}° 移動中...`);
        
        if (angle !== 0) {
          try {
            await moveTurntable(angle);
            addLog(`${angle}° 移動完了`);
          } catch (e) {
            addLog(`移動エラー: ${e.message}`);
            throw new Error(`角度 ${angle}° への移動に失敗しました: ${e.message}`);
          }
        }
        
        await sleep(1000);

        addLog(`${angle}° 撮影中...`);
        try {
          const camera = cameraRef.current;
          if (!camera) {
            throw new Error('カメラが初期化されていません');
          }
          
          const photo = await Promise.race([
            camera.takePictureAsync({ quality: 0.8 }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('撮影がタイムアウトしました。')), 10000)
            )
          ]);
          
          if (!photo || !photo.uri) {
            throw new Error('撮影結果が空です');
          }
          
          addLog(`${angle}° 撮影完了`);
          capturedUris.push({ uri: photo.uri, angle: angle });
        } catch (e) {
          addLog(`撮影エラー: ${e.message}`);
          throw new Error(`角度 ${angle}° での撮影に失敗しました: ${e.message}`);
        }
      }
      
      // --- 全方向の撮影が完了 ---
      addLog('全撮影完了。360°復帰中...');
      
      // 撮影終了後に360°に移動（撮影はしない）
      try {
        addLog('360° 移動中...');
        await moveTurntable(360);
        addLog('360° 移動完了');
      } catch (e) {
        addLog('360° 移動失敗');
      }
      
      addLog('アップロード開始...');
      
      let successCount = 0;
      let firstError = null;
      const timestamp = Date.now();

      for (let i = 0; i < capturedUris.length; i++) {
        const { uri, angle } = capturedUris[i];
        addLog(`アップロード ${angle}° (${i + 1}/${capturedUris.length})...`);
        
        const fileName = `turntable_${timestamp}_${angle}.jpg`;
        
        try {
          const base64Data = await RNFS.readFile(uri, 'base64');
          if (!base64Data) {
            throw new Error('ファイルの読み込みに失敗しました (データが空です)');
          }
          await uploadToNextcloud(fileName, base64Data);
          addLog(`${angle}° アップロード完了`);
          successCount++;
        } catch (uploadError) {
          addLog(`アップロードエラー: ${uploadError.message}`);
          if (!firstError) {
            // 最初の失敗原因を保存しておく
            firstError = uploadError.message || '不明なエラー';
          }
        }
      }
      
      if (successCount === capturedUris.length) {
        addLog(`全撮影・アップロード完了 ✓`);
        Alert.alert('成功', `${capturedUris.length}方向すべての撮影とアップロードが完了しました！`);
      } else if (successCount > 0) {
        addLog(`完了: ${successCount}/${capturedUris.length} 成功`);
        Alert.alert('一部成功', `${capturedUris.length}枚中 ${successCount}枚のアップロードに成功しました。\n\n最初のエラー: ${firstError}`);
      } else {
        addLog('アップロード失敗 ✗');
        Alert.alert('アップロード失敗', `撮影は完了しましたが、アップロードにすべて失敗しました。\n\n原因: ${firstError}`);
      }
    } catch (error) {
      addLog(`エラー: ${error.message}`);
      Alert.alert('エラー', error.message || '撮影プロセス中に予期せぬエラーが発生しました。');
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

  const handleBackFromSettings = async (savedConfig) => {
    addLog(`設定から戻る`);
    setShowSettings(false);
    
    // ファイルから最新の設定を再読み込み
    const currentConfig = await loadConfig();
    const count = parseInt(currentConfig.CAPTURE_COUNT || '8', 10);
    addLog(`新しい撮影枚数: ${count} (ファイルから読み込み)`);
    setCaptureCount(count);
  };

  if (showSettings) {
    return <SettingsScreen onBack={handleBackFromSettings} />;
  }

  return (
    <View style={styles.container}>
      {/* カメラプレビュー（全画面） */}
      <CameraView
        ref={cameraRef}
        style={styles.cameraView}
        facing="back"
        pointerEvents="none"
      />
      
      <View style={styles.overlay}>
        <Text style={styles.title}>SpinScan Controller</Text>

        {/* コンソールログ表示 */}
        <View style={styles.logContainer}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
          {logs.length === 0 && (
            <Text style={styles.logTextPlaceholder}>待機中...</Text>
          )}
        </View>

        <View style={styles.bottomContainer}>
          <View style={styles.bottomControls}>
            <TouchableOpacity 
              style={[styles.secondaryButton, styles.settingsButton]} 
              onPress={() => setShowSettings(true)}
              disabled={loading || manualLoading}
            >
              <Text style={styles.buttonText}>⚙️</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.mainButton, loading && styles.buttonDisabled]} 
              onPress={handleCapture}
              disabled={loading || manualLoading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.mainButtonText}>ターンテーブル撮影 🔄</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.secondaryButton, styles.manualButton, manualLoading && styles.buttonDisabled]} 
              onPress={handleManualCapture}
              disabled={loading || manualLoading}
            >
              {manualLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>🕒</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <Text style={styles.footer}>Nextcloud 自動同期有効</Text>
        </View>
      </View>
    </View>
  );

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
    paddingVertical: 40,
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
  },
  title: {
    position: 'absolute',
    top: 40,
    right: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'right',
  },
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  mainButton: {
    backgroundColor: '#fff',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 5,
    borderColor: '#ddd',
  },
  mainButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  secondaryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.6)',
  },
  settingsButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.6)',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cameraView: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 24,
  },
  footer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  logContainer: {
    position: 'absolute',
    top: 40,
    left: 8,
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxHeight: 144,
    minHeight: 12,
    overflow: 'visible',
    zIndex: 10,
  },
  logText: {
    fontSize: 9,
    color: '#4ade80',
    fontFamily: 'monospace',
    lineHeight: 12,
  },
  logTextPlaceholder: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.2)',
    fontFamily: 'monospace',
  },
});

export default HomeScreen;

