#include <WiFi.h>
#include <WebServer.h>
#include <AccelStepper.h>

// --- 設定 ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// 28BYJ-48 ステッピングモーターの設定
// ギア比は約 63.6839:1, 1ステップ 5.625度 (フルステップの場合)
// 1回転に必要なステップ数: 2048 (4-step sequence)
const float STEPS_PER_REV = 2048.0;

// ピン定義 (ULN2003A接続)
#define IN1 19
#define IN2 18
#define IN3 5
#define IN4 17

// AccelStepperの設定 (HALF4WIRE = 8ステップ/回転、28BYJ-48に最適)
// ULN2003の配線順序によっては 1, 3, 2, 4 の順にする必要がある場合があります
AccelStepper stepper(AccelStepper::HALF4WIRE, IN1, IN3, IN2, IN4);

WebServer server(80);

// 角度からステップ数への変換
long angleToSteps(float angle) {
  return (long)((angle / 360.0) * STEPS_PER_REV);
}

// ハンドラ: 初期位置に戻る
void handleHome() {
  Serial.println("Homing...");
  // 物理的なリミットスイッチがないため、ここでは安全に一定量戻して0とする
  // 実際にはリミットスイッチの入力判定を実装することを推奨します
  stepper.setCurrentPosition(0);
  server.send(200, "text/plain", "Homing complete. Position reset to 0.");
}

// ハンドラ: 指定角度へ移動
void handleMove() {
  if (!server.hasArg("angle")) {
    server.send(400, "text/plain", "Missing 'angle' parameter.");
    return;
  }

  float angle = server.arg("angle").toFloat();
  if (angle < 0 || angle > 360) {
    server.send(400, "text/plain", "Angle must be between 0 and 360.");
    return;
  }

  long targetStep = angleToSteps(angle);
  Serial.printf("Moving to angle: %.2f (Step: %ld)\n", angle, targetStep);
  
  stepper.moveTo(targetStep);
  
  server.send(200, "text/plain", String("Moving to ") + angle + " degrees.");
}

void setup() {
  Serial.begin(115200);

  // モーター設定
  stepper.setMaxSpeed(1000.0);
  stepper.setAcceleration(500.0);

  // WiFi接続
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // APIエンドポイント設定
  server.on("/home", HTTP_GET, handleHome);
  server.on("/move", HTTP_GET, handleMove);
  
  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
  stepper.run();
}
