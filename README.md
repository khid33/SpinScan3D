# Spin Scan 3D – Turntable Point Cloud Scanner & AI Model Uploader

## 概要 (Overview)
このプロジェクトは、**回転台を制御しながら多角度から写真を撮影し、PC上のAIモデルへOBJ/GLB形式でアップロードするAndroidアプリ**です。
最大4台のカメラ（iPhoneのデュアルカメラ＋メインカメラなど）を同時または個別に起動でき、撮影した画像データを3DポインクラウドモデルとしてNextcloudに保存できます。

---

## 主な機能 (Key Features)

- **Multi-Camera Capture**: 最大4つのカメラを個別に起動・制御。複数アングルからの同時撮影に対応。
- **Turntable Control**: HTTP API経由で回転台の角度を精密に制御（0°〜360°、任意の角度指定可能）。
- **AI Model Upload (OBJ/GLB)**: 撮影データを点群データとして処理し、Nextcloud WebDAVへ自動アップロード。
- **Settings Panel**: サーバー接続設定・Nextcloud認証情報・APIキーなどを一元管理。
- **Dark Premium UI**: 黒を基調としたモダンなダークテーマ。回転台のリアルタイム視覚化とネオンアクセント。

---

## システム構成 (Architecture)

本システムは以下の2つのコンポーネントで構成されています。

1. **Android App (`spinscan-app/`)**: UI、カメラ制御、回転台操作、ファイル管理 (React Native / Expo)
2. **PC Companion Server (`pc-server/`)**: 回転台制御API、撮影コマンド受信、WebDAV経由でのOBJ/GLBアップロード仲介 (Python / FastAPI)

---

## 使用している外部API・リソース (External APIs & Resources)

### 1. 外部API
- **HTTP Turntable Control API**: 回転台の角度制御エンドポイント（`/home`, `/move?angle=N`）。
- **Nextcloud WebDAV API**: OBJ/GLB点群データのアップロード先。Basic認証対応。

### 2. ネイティブモジュール (Expo)
- **expo-camera**: カメラ起動・撮影機能。複数カメラの同時制御に対応。
- **expo-file-system**: ファイル保存・読み書き。
- **expo-secure-store**: Nextcloud認証情報などの機密データを安全に保存。
- **@react-native-async-storage/async-storage**: ローカル設定データの永続化。

### 3. ライブラリ
- **axios**: HTTP通信（サーバー制御・WebDAVアップロード）。
- **base-64 / buffer**: Base64エンコード処理。
- **fast-xml-parser**: XMLパーサー（必要に応じて使用）。

---

## セットアップ手順 (Setup Guide)

### 開発環境 (Prerequisites)
- **Node.js** (v18+), **Python** (3.8+)
- **Expo Go App** (Android実機用)
- **回転台ハードウェア**（HTTP API対応）

### 1. Android App の準備
```bash
cd spinscan-app && npm install && npx expo start
```

### 2. PC Server の準備
```bash
cd pc-server && pip install -r requirements.txt && python server.py
```

---

## APKビルド手順 (Build APK)

Expo製アプリをAndroid端末にインストール可能な `.apk` ファイルとしてビルドする方法を説明します。

### 方法1: EAS Build（推奨・クラウドビルド）

EAS（Expo Application Services）を使ったクラウドビルドです。Android Studioのインストールが不要です。

#### 事前準備
```bash
# EAS CLIのインストール
npm install -g eas-cli

# Expoアカウントでログイン（無料）
eas login
```

#### APKのビルド
```bash
cd spinscan-app

# EASプロジェクトの初期化（初回のみ）
eas build:configure

# APKをビルド（クラウドで実行。数分〜20分程度かかります）
eas build -p android --profile preview
```

> [!NOTE]
> `--profile preview` はDebug署名付きのAPKを生成します。完全なリリース用には `--profile production` を使用してください。

ビルド完了後、表示されるURLからAPKをダウンロードできます。

#### eas.json の設定例
`spinscan-app/eas.json` に以下を追加（なければ作成）:
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### 方法2: ローカルビルド（Android Studio必要）

Android Studioがインストールされている環境での直接ビルドです。

```bash
cd spinscan-app

# Androidネイティブプロジェクトを生成
npx expo prebuild --platform android

# Gradleでデバッグ用APKをビルド
cd android && ./gradlew assembleDebug
```

ビルドされたAPKは `android/app/build/outputs/apk/debug/app-debug.apk` に生成されます。

---

## 実機テストと接続設定 (Connection Settings)

1. **Wi-Fi**: 端末とPCを同一のWi-Fiに接続します。
2. **IPアドレス確認**: PCのローカルIP（例: `192.168.1.10`）を確認。
3. **アプリ設定**: 「Settings」→「Connection Settings」でPCのIP・ポートを入力し保存。
4. **Nextcloud設定**: 「Upload Settings」にNextcloud URL・ユーザー名・パスワードを入力。
5. **動作確認**: 回転台制御ボタンで回転 → カメラ撮影 → OBJ/GLBアップロードの流れを確認。

---

## アプリ画面構成 (App Screens)

| スクリーン | 説明 |
|-----------|------|
| **Main** | メイン操作画面。回転台視覚化、カメラ選択グリッド、撮影・ホームボタン |
| **Settings** | 接続設定・Nextcloud認証情報・APIキーの管理画面 |

### Main画面の構成要素
- **ヘッダー**: タイトル「Spin Scan 3D」＋設定アイコン
- **回転台インジケータ**: 現在の角度と向きをグラフィカルに表示
- **カメラグリッド**: 4つのカメラスロット（起動済みは緑枠、未起動は赤枠）
- **操作ボタン**: ホーム戻る・角度移動・撮影（全カメラ一括または個別）

---

## トラブルシューティング (TroubleShooting)

### 接続関連
- **接続できない**: 同一Wi-Fiか、ファイアウォール（ポート8000など）を確認。
- **QRコード不良**: ターミナルのExpo URLを手動でExpo Goに入力してください。

### カメラ関連
- **カメラが起動しない**: 端末のカメラ権限を許可しているか確認。expo-cameraは実機でのテストが必要です。
- **複数カメラ同時起動不可**: 端末の仕様により、デュアルカメラ＋メインカメラなど制限がある場合があります。

### アップロード関連
- **Nextcloud接続失敗**: URL・ユーザー名・パスワードが正しいか、Basic認証が有効かを確認。
- **OBJ/GLBアップロード失敗**: ファイル形式（.obj / .glb）とサイズを確認。WebDAVエンドポイントが正しいか確認。

---

## 連絡先・貢献
不具合や改善案があれば、IssueまたはPull Requestにてお知らせください。
