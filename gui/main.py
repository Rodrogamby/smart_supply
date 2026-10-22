import network
import time

SSID = "IZZI-0EEE-Piso2"
PASSWORD = "9Nnw775R-2"

wifi = network.WLAN(network.STA_IF)
wifi.active(True)

if not wifi.isconnected():
    wifi.connect(SSID, PASSWORD)

    # Wait up to 20 seconds for a connection.
    start = time.ticks_ms()

    while not wifi.isconnected():
        if time.ticks_diff(time.ticks_ms(), start) > 20000:
            raise RuntimeError("Wi-Fi connection timed out")

        time.sleep_ms(250)

print("Wi-Fi connected")
print("ESP32 IP:", wifi.ifconfig()[0])