SpinScan3D
マイコン制御のターンテーブルとスマホアプリを連動させて全自動撮影を行い、Nextcloud経由で画像を収集してComfyUIで3Dモデル（.ply / .obj / 3D Gaussian Splatting）を生成するオープンソース・エンドツーエンド・フォトグラメトリパイプラインです。

🏗 システム構成
プロジェクト全体: SpinScan3D
マイコン側 (ESP32): spinscan-firmware (または spinscan-esp32)
スマホアプリ (Expo): spinscan-app
ComfyUI/PC側: spinscan-pipeline

