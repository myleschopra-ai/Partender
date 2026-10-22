#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
ART="$PWD/putting-lab/native-ios/lab-artifacts"
mkdir -p "$ART"
echo "SIMULATOR ONLY: neither camera hardware nor real 240fps capture is available."
xcodebuild -version | tee "$ART/xcode-version.txt"
xcrun simctl list devices available --json > "$ART/available-devices.json"

DEVICE_JSON=$(python3 - "$ART/available-devices.json" <<'PY'
import json,sys
data=json.load(open(sys.argv[1]))
items=[item for arr in data.get("devices",{}).values() for item in arr if item.get("state") in ("Shutdown","Booted") and item.get("isAvailable",True)]
def sortkey(d):
 n=d.get("name","")
 if n == "iPhone 17 Pro Max": return (0,0)
 if n == "iPhone 17 Pro": return (1,0)
 if n == "iPhone 16 Pro Max": return (2,0)
 if "iPhone" in n and "Pro Max" in n: return (3,n)
 if "iPhone" in n: return (4,n)
 return (9,n)
items.sort(key=sortkey)
valid=[x for x in items if "iPhone" in x.get("name","")]
if not valid:
 print(json.dumps({"error":"No installed iPhone simulator available"}))
 sys.exit(1)
d=valid[0]
print(json.dumps({"name":d["name"],"udid":d["udid"],"runtime":d.get("udid","")}))
PY
)
echo "$DEVICE_JSON" | tee "$ART/chosen-device.json"
DEVICE_UDID=$(python3 -c 'import sys,json;print(json.load(sys.stdin)["udid"])' <<< "$DEVICE_JSON")
DEVICE_NAME=$(python3 -c 'import sys,json;print(json.load(sys.stdin)["name"])' <<< "$DEVICE_JSON")
echo "Selected simulator: $DEVICE_NAME ($DEVICE_UDID)"
if [[ "$DEVICE_NAME" != "iPhone 17 Pro Max" ]]; then
  echo "::warning::Exact iPhone 17 Pro Max Simulator unavailable; testing $DEVICE_NAME and recording this substitution."
fi

APP_PROJ="$PWD/putting-lab/native-ios/iOS/PuttingLabNative.xcodeproj"
DERIVED="$PWD/putting-lab/native-ios/.derived-simulator"
echo "Building native app for $DEVICE_NAME"
if ! xcodebuild -project "$APP_PROJ" -scheme PuttingLabNative \
       -configuration Debug -sdk iphonesimulator \
       -destination "platform=iOS Simulator,id=$DEVICE_UDID" \
       -derivedDataPath "$DERIVED" CODE_SIGNING_ALLOWED=NO build \
       >"$ART/xcodebuild.log" 2>&1; then
  tail -n 140 "$ART/xcodebuild.log"
  exit 1
fi

xcrun simctl boot "$DEVICE_UDID" || true
xcrun simctl bootstatus "$DEVICE_UDID" -b
APP="$DERIVED/Build/Products/Debug-iphonesimulator/PuttingLabNative.app"
test -d "$APP"
xcrun simctl install "$DEVICE_UDID" "$APP"
xcrun simctl launch "$DEVICE_UDID" com.myleschopra.puttinglabnative -PuttingLabSyntheticTest \
  | tee "$ART/launch.txt"
sleep 12
CONTAINER=$(xcrun simctl get_app_container "$DEVICE_UDID" com.myleschopra.puttinglabnative data)
REPORT="$CONTAINER/Documents/PuttingLabSimulatorReport.json"
if [[ ! -f "$REPORT" ]]; then
  echo "::error::Simulator app did not create its deterministic image-processing report."
  exit 1
fi
cp "$REPORT" "$ART/simulator-evidence-report.json"
python3 - "$REPORT" <<'PY'
import json,sys
data=json.load(open(sys.argv[1]))
print("Environment:", data.get("environment"))
print("Simulated input rate:", data.get("simulatedFPS"), "fps")
for c in data["cases"]:
 print("PASS" if c["passed"] else "FAIL", c["name"],"expected",c["expectedImpact"],"observed",c["detectedImpact"],"ballFrames",c["ballFrames"],"putterFrames",c["movingPutterFrames"])
if data.get("nativeCameraTested") is not False: raise SystemExit("Incorrectly claims physical camera validation")
if len(data["cases"])!=6 or not data.get("passing"): raise SystemExit("Synthetic frame-pipeline test failed")
PY

xcrun simctl io "$DEVICE_UDID" screenshot "$ART/virtual-iphone-screen.png" || true
echo "SIMULATOR LAB PASSED: real FrameVision plus StrokeEventDetector tested on generated overhead CVPixelBuffers."
echo "NO REAL CAMERA, NO PHYSICAL FPS, NO SPEED/FACE VALIDATION."
