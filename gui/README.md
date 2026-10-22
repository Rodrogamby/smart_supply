# SPPS dashboard — first MQTT draft

## Run the complete project

Extract the ZIP, open PowerShell in the extracted `spps-dashboard` folder (the one containing `package.json`), then run:

```powershell
npm.cmd install
npm.cmd run dev
```

If you already created a Vite project, you can instead copy `index.html` to its root and `src/main.js` plus `src/style.css` into its `src` folder, then run `npm.cmd install mqtt` and `npm.cmd run dev` there.

Open the localhost URL shown by Vite. To test MQTT, start a broker with a WebSocket listener, enter its WebSocket URL, and select **Connect**. A browser cannot speak raw MQTT on port 1883.

Example Mosquitto configuration for **local, trusted-network testing only** (`mosquitto.conf`):

```conf
listener 1883 0.0.0.0
allow_anonymous true

listener 9001 0.0.0.0
protocol websockets
allow_anonymous true
```

Start with `mosquitto -c mosquitto.conf -v`. The browser on the same PC connects to `ws://localhost:9001`. The ESP32 connects to the PC's LAN IP on port `1883` while on the same network. Your firewall may need to permit incoming port 1883. **Do not expose this anonymous broker to the internet or use this configuration for deployment.**

## MQTT contract (device `spps-01`)

The ESP32 publishes telemetry about once per second on `spps/spps-01/telemetry`:

```json
{
  "ch1": {"enabled": true, "voltage": 110.2, "current": 1.25, "power": 100, "apparentPower": 137.8, "reactivePower": 94.8, "fault": false},
  "ch2": {"enabled": false, "voltage": 0, "current": 0, "power": 0, "fault": false}
}
```

`voltage` is RMS volts, `current` is RMS amps, and `power` is measured **real power in watts**, not necessarily voltage multiplied by current on AC loads. Publish the state the ESP32 actually observes, not a copy of the last command. This first draft does not include sequence editing yet.

The ESP32 publishes its availability on `spps/spps-01/status` (retained). Configure an MQTT last will message of `{"online":false}` on that topic, and publish `{"online":true}` after connecting. Retained telemetry may show an old measurement; the dashboard disables controls when telemetry is older than 10 seconds.

The dashboard publishes on `spps/spps-01/command` with QoS 1, no retain:

```json
{"id":"a-unique-uuid","action":"set_channel","channel":"ch1","enabled":true}
```

The ESP32 validates the command and publishes an acknowledgement on `spps/spps-01/ack`:

```json
{"id":"same-uuid","accepted":true}
```

For rejection: `{"id":"same-uuid","accepted":false,"reason":"overcurrent fault"}`. The ESP32 must enforce protection locally, including after network loss. QoS 1 permits duplicate delivery, so the ESP32 should recognize repeated command IDs. An ACK means the command was handled; the dashboard changes its output badge only when new telemetry reports the actual state.

For eventual internet deployment, the website will need HTTPS, the browser will need `wss://`, and control must be authenticated and authorized. Do not embed a privileged MQTT password in frontend JavaScript.

## Power triangle
Select Channel 1 or Channel 2. Each channel publishes `power` (P, W), `reactivePower` (signed Q, var), and optionally `apparentPower` (S, VA). If S is omitted it is calculated as Vrms × Irms. PF is P/S, undefined when S is zero. Q cannot be calculated from RMS voltage and current alone. For sinusoidal signals S² = P² + Q². For distorted loads the P–Q vector length can differ from S; the display labels this explicitly. No browser demo is included. Without sensors you can still publish synthetic values from ESP32 firmware.
