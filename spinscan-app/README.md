# SpinScan App (Expo)

SpinScan3D システムのスマートフォン向け制御アプリケーションです。
Expo Go を利用して、スマートフォンから撮影デバイスをリモート制御し、撮影したデータを Nextcloud へアップロード・管理することを目的としています。

## 🚀 機能概要

- **リモート撮影制御**: スマホ上のボタン操作により、撮影サーバーへ撮影トリガーを送信します。
- **撮影ステータス確認**: 現在の撮影状況や完了状態をリアルタイムに確認できます。
- **Nextcloud 連携**: 撮影された画像ファイルを Nextcloud ストレージへ自動的にアップロードし、クラウド上で一元管理します。
- **設定管理**: サーバーIPアドレスや Nextcloud の認証情報をアプリ内で設定可能です。

## 🛠 技術スタック

| 項目 | バージョン |
|------|-----------|
| **Framework** | Expo SDK 52 (React Native) |
| **Language** | JavaScript |
| **HTTP Client** | Axios ^1.6.0 |
| **State Management** | React Context API / Hooks |

## 📁 プロジェクト構成

```text
spinscan-app/
├── assets/             # 画像、アイコンなどの静的ファイル
├── src/
│   ├── api/
│   │   └── client.js   # API クライアント (撮影サーバー, Nextcloud WebDAV)
│   ├── components/     # 再利用可能なUIコンポーネント
│   ├── constants/
│   │   └── config.js   # デフォルト設定値
│   ├── hooks/
│   │   └── useConfig.js # 設定管理フック (AsyncStorage)
│   ├── screens/
│   │   ├── HomeScreen.js   # メイン画面 (撮影ボタン、ステータス表示)
│   │   └── SettingsScreen.js # Nextcloud 設定画面
│   └── utils/          # 共通ユーティリティ関数
├── App.js              # エントリポイント
├── app.json            # Expo 設定ファイル
├── package.json        # 依存ライブラリ管理
└── README.md           # このファイル
```

## 📦 依存パッケージ

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| `expo` | ~52.0.0 | Expo フレームワーク |
| `expo-status-bar` | ~1.12.1 | ステータスバーの制御 |
| `react` | 18.3.1 | UI フレームワーク |
| `react-native` | 0.76.0 | モバイルレンダリング |
| `axios` | ^1.6.0 | HTTP リクエスト |
| `@react-native-async-storage/async-storage` | latest | ローカル設定の永続化 |

## ⚙️ セットアップ

### 前提条件
- Node.js 18 以上
- npm または yarn
- スマホに **Expo Go** アプリ (SDK 52 対応) がインストールされていること

### 起動手順

```bash
# 1. プロジェクトディレクトリへ移動
cd spinscan-app

# 2. 依存ライブラリのインストール
npm install

# 3. 開発サーバーの起動
npx expo start

# 4. スマホの Expo Go アプリで QR コードをスキャンして起動
```

### 開発モードでの起動オプション

| コマンド | 説明 |
|---------|------|
| `npx expo start` | デフォルト (QR コード表示) |
| `npx expo start -c` | キャッシュクリアして起動 |
| `npx expo start --android` | Android エミュレータで起動 |
| `npx expo start --ios` | iOS シミュレータで起動 |
| `npx expo start --web` | Web ブラウザで起動 |

## 📡 ワークフロー

```
┌──────────┐     HTTP POST      ┌─────────────┐
│          │ ──────────────────> │             │
│  スマホ   │   /capture エンド   │ 撮影サーバー  │
│  (App)   │ <────────────────── │             │
│          │  撮影結果 JSON       └──────┬──────┘
└──────────┘                          │ WebDAV PUT
                                      ▼
                               ┌─────────────┐
                               │   Nextcloud  │
                               │  (クラウド)   │
                               └─────────────┘
```

1. **制御**: スマホから撮影サーバーの `/capture` エンドポイントに POST リクエストを送信
2. **撮影**: 撮影サーバーがカメラを制御して画像を撮影
3. **保存**: 撮影画像を撮影サーバーのローカルストレージに保存
4. **同期**: Nextcloud の WebDAV エンドポイントへ画像ファイルをアップロード

## 🔧 設定方法

### アプリ内設定画面 (推奨)

アプリのメイン画面から「⚙️ 設定」ボタンをタップして、以下の設定を行います：

1. **撮影サーバー設定**
   - 撮影サーバーの IP アドレス
   - ポート番号

2. **Nextcloud 設定**
   - Nextcloud URL (WebDAV エンドポイント)
   - ユーザー名
   - パスワード（またはアプリパスワード）
   - **アップロード先フォルダ**（空白でルートディレクトリ）

設定はアプリ内に自動保存され、再起動後も維持されます。

### Nextcloud 側の準備

1. Nextcloud にログインし、**設定 → セキュリティ → デバイスとセッション** に移動
2. **「アプリパスワード」** を発行（推奨）
3. 発行されたパスワードをアプリの設定画面に入力

### WebDAV URL の確認

Nextcloud 設定画面から WebDAV エンドポイントを確認：
```
https://<your-domain>/remote.php/dav/files/<username>/
```

### 初期値での起動 (開発用)

コードのデフォルト値で起動する場合は、アプリ内の設定をリセットしてください。

#### 手動で設定を初期化する場合

```bash
# AsyncStorage のデータを削除して初期化
# Expo Go アプリ内から：
# 設定 → アプリのデータ管理 → データを消去
```

### API クライアント (`src/api/client.js`)

- `shootPhoto()`: 設定画面で指定した撮影サーバーへ撮影トリガーを送信
- `uploadToNextcloud(fileName, fileData)`: 設定画面で指定した Nextcloud へファイルをアップロード
  - アップロード先は `NEXTCLOUD_URL` + `NEXTCLOUD_FOLDER` で決定されます

## 📱 画面構成

### HomeScreen (メイン画面)

| 要素 | 説明 |
|------|------|
| **撮影開始ボタン** | 撮影トリガーを送信するメインボタン |
| **設定ボタン** | Nextcloud 設定画面に遷移 |
| **ローディング表示** | 撮影処理中のインジケーター |
| **ステータス表示** | 撮影結果をアラートで通知 |

### SettingsScreen (設定画面)

| 項目 | 説明 |
|------|------|
| **撮影サーバー IP** | 撮影サーバーの IP アドレス |
| **ポート番号** | 撮影サーバーのポート番号 |
| **Nextcloud URL** | WebDAV エンドポイントの URL |
| **ユーザー名** | Nextcloud のログインユーザー名 |
| **パスワード** | Nextcloud のパスワード（またはアプリパスワード） |
| **アップロード先フォルダ** | Nextcloud への画像アップロード先フォルダ名（📁選択ボタンでフォルダツリーから選択可能） |

### フォルダ選択機能

「📁 選択」ボタンをタップすると、Nextcloud のフォルダツリーが表示されます。

- フォルダをタップして階層を移動
- 上部の「...」をタップして親フォルダに戻る
- 「このフォルダを選択」ボタンで選択確定
- 右上の「完了」ボタンで選択キャンセル

## 🐛 トラブルシューティング

### 「Project is incompatible with this version of Expo Go」エラー

```bash
# プロジェクトの SDK バージョンを確認
cat package.json | grep expo

# キャッシュクリアして再起動
npx expo start -c
```

### 「The required package `expo-asset` cannot be found」エラー

```bash
# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install
```

## 📝 今後の課題

- [ ] 撮影サーバーとの WebSocket 連携によるリアルタイム・フィードバックの実装
- [ ] Nextcloud 上の画像プレビュー機能の追加
- [ ] 認証機能の強化 (OAuth2 等)
- [ ] 撮影履歴のローカル保存機能
- [ ] 複数カメラの切り替え機能
- [ ] 撮影間隔の設定機能

## 📄 ライセンス

MIT License
