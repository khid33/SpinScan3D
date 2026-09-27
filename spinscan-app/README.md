# SpinScan3D アプリ (Expo / React Native)

SpinScan3D のスマートフォン用コントロールアプリです。ターンテーブルの旋回撮影、サーバー連携、Nextcloudアップロード機能を提供します。

---

## 撮影枚数の設定
設定画面およびホーム画面から、以下の **4段階の撮影枚数** を選択可能です：
- **4枚** (90°間隔: `[0, 90, 180, 270]`)
- **8枚** (45°間隔)
- **16枚** (22.5°間隔)
- **24枚** (15°間隔: `[0, 15, 30, ..., 345]`)

---

## 開発・起動手順

### 1. 依存関係のインストール
```bash
cd spinscan-app
npm install
```

### 2. Metroサーバーの起動
Expoのバンドラー（Metroサーバー）をポート `8081` で起動します：
```bash
npx expo start --clear --port 8081
```

### 3. Androidエミュレーターでの起動
エミュレーターが接続されている状態で、以下のコマンドを実行してビルド・インストール・起動を行います：
```bash
npx expo run:android
```

※ エミュレーターからPC上のMetroサーバーに接続できない場合は、ポートフォワードを設定してください：
```bash
adb reverse tcp:8081 tcp:8081
```

---

## トラブルシューティング

### 「Could not connect to development server」エラーが出る場合
1. Metroサーバーが正しく起動しているか確認する (`http://localhost:8081`)
2. adb のポートフォワードを再適用する：
   ```bash
   adb reverse tcp:8081 tcp:8081
   ```
3. アプリをリロードする（開発者メニューから `Reload` を選択）
