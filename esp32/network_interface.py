import network
import machine
import led
import ntptime
import json
from mqtt_connection import Sender
from logger import Log

class Nif:
    sta = network.WLAN(network.STA_IF)
    ap = network.WLAN(network.AP_IF)

    online = False

    def wifirecover_(self, t):
        if Nif.sta.status() == network.STAT_GOT_IP:
            Nif.online = True
            self.led.green()
            self.led.on()
            Log.info(f"Connected. IPv4={Nif.sta.ifconfig()[0]}.")
            if self.wanAccess and not self.timeSynced:
                ntptime.settime()
                self.timeSynced = True  # handle exception
            self.wificheck()
            return

        if Nif.sta.status() < 1000:
            self.led.red()
            self.led.toggle()
        else:
            self.led.amber()
            self.led.toggle()

        self.wifirecover()

    def wificheck_(self, t):
        if Nif.sta.status() != network.STAT_GOT_IP:
            Nif.online = False
            Log.warn("Connection lost.")
            self.wifirecover()
            return

        self.wificheck()

    def wificheck(self):
        self.tim1.init(
                       mode=machine.Timer.ONE_SHOT,
                       period=2000,
                       callback=self.wificheck_)

    def wifirecover(self):
        self.tim1.init(
                       mode=machine.Timer.ONE_SHOT,
                       period=500,
                       callback=self.wifirecover_)

    def __init__(self, wanAccess=True):
        self.keys = json.load(open('keys.json'))
        self.tim1 = machine.Timer(1)
        self.led = led.Led()
        self.wanAccess = wanAccess
        self.timeSynced = False

    def setup_ap(self):
        Nif.ap.active(True)
        Nif.ap.config(
                       essid=self.keys['ap']['ssid'],
                       password=self.keys['ap']['key'],
                       security=3 if len(self.keys['ap']['key']) >= 8 else 0)

    def setup_sta(self):
        Nif.sta.active(False)  # assert inactive
        Nif.sta.active(True)
        Nif.sta.connect(
            self.keys['station']['ssid'],
            self.keys['station']['key'])
        self.wifirecover()

'''
docs.micropython.org/en/v1.24.0/library/network.WLAN.html
    BEACON TIMEOUT - 200
    NO AP FOUND - 201
    WRONG PASSWORD - 202
    ASSOC FAIL - 203
    HANDSHAKE TIMEOUT - 204
    NO AP FOUND W COMPATIBLE SECURITY - 210
    NO AP FOUND IN AUTHMODE TRESHOLD - 211
    NO AP FOUND IN RSSI TRESHOLD - 212
    IDLE - 1000
    CONNECTING - 1001
    GOT IP - 1010
'''

