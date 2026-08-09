# SpinScan3D

マイコン制御のターンテーブルとスマホアプリを連動させて全自動撮影を行い、Nextcloud経由で画像を収集してComfyUIで3Dモデル（.ply / .obj / 3D Gaussian Splatting）を生成するオープンソース・エンドツーエンド・フォトグラメトリパイプラインです。

---

## プロジェクト全体: SpinScan3D
### マイコン側 (ESP32): spinscan-firmware (または spinscan-esp32)
ULN2003基板と28BYJ-48ステッピングモーターをマイコンに接続（IN1〜IN4 ➔ 指定GPIO）。

### スマホアプリ (Expo): spinscan-app

### ComfyUI/PC側: spinscan-pipeline

