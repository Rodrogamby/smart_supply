# Dashboard

Dashboard for the project, built with HTML, CSS, JavaScript, Vite, and MQTT.js

The current prototype displays real sensor readings from an ESP32-S3 in the Channel 1 area

## Requirements

- Install [Node.js](https://nodejs.org/) with npm 
- An internet connection to reach the MQTT broker already running on Azure
- An ESP32 publishing measurements to see live readings

## Install and run

Open a terminal in the GUI folder containing `package.json`.

```sh
npm install
npm run dev
```

`npm install` installs the project's dependencies, including Vite and MQTT.js, and creates `node_modules`. 

Open the local URL printed by Vite. Keep the terminal running while using the dashboard. Press **Ctrl+C** to stop it; use `npm run dev` to start it again.

## Connect to MQTT

Enter these values in the dashboard and click **Connect**:

| Setting | Value |
| --- | --- |
| WebSocket URL | `wss://retotest.mexicocentral.cloudapp.azure.com:8084/mqtt` |
| Current test username | `reto` |
| Current test password | `reto` |
| Topic used by the JavaScript | `test2` |

These are temporary lol

The ESP32 sends MQTT over TLS on port **8883**. The browser uses MQTT over secure WebSockets on port **8084** to connect to the same broker.

## Measurement format

The ESP32 publishes JSON messages like this on `test2`:

```json
{
  "device": "device",
  "sensor": "sensor",
  "sample": 1,
  "adc_raw": 25798
}
```


## Project files

| File | Purpose |
| --- | --- |
| `index.html` | Dashboard structure |
| `src/style.css` | Styling and responsive layout |
| `src/main.js` | MQTT connection, message validation, and display updates |
| `package.json` | Dependencies and npm commands |
| `package-lock.json` | Locked dependency versions |



