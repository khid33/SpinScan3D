/**
 * SpinScan3D 設定ファイル
 * 
 * このファイルはデフォルト値を提供します。
 * 実際の設定はアプリ内の「設定」画面から編集・保存されます。
 * 
 * 設定は AsyncStorage に保存され、アプリ再起動後も維持されます。
 */

export const DEFAULT_CONFIG = {
  SERVER_IP: '192.168.1.100', // 撮影サーバーのデフォルトIP
  SERVER_PORT: '5000',
  NEXTCLOUD_URL: 'https://your-nextcloud-domain.com/remote.php/dav/files/',
  NEXTCLOUD_USER: '',
  NEXTCLOUD_PASS: '',
  NEXTCLOUD_FOLDER: '', // アップロード先フォルダ（空白でルート）
};
