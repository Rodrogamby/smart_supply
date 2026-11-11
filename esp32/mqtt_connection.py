import machine
import network
import ntptime
import ssl
from binascii import hexlify
from umqtt.simple import MQTTClient

BROKER = "retotest.mexicocentral.cloudapp.azure.com"
PORT = 8883
CA_FILE = "/isrgrootx1.der"


def connect_mqtt(username, password):
    # Use the Wi-Fi connection you already set up
    wifi = network.WLAN(network.STA_IF)
    if not wifi.isconnected():
        raise RuntimeError("Connect the ESP32 to Wi-Fi first")

    # TLS certificate validation needs the correct date and time.
    print("synchronizing clock...")
    ntptime.settime()

    # Load the CA certificate and require broker verification
    tls = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    tls.verify_mode = ssl.CERT_REQUIRED
    with open(CA_FILE, "rb") as cert:
        tls.load_verify_locations(cadata=cert.read())

    # Give each ESP32 a unique MQTT client ID.
    client = MQTTClient(
        client_id=b"device-" + hexlify(machine.unique_id()),
        server=BROKER,
        port=PORT,
        user=username,
        password=password,
        keepalive=60,
        ssl=tls,
    )

    print("Connecting to Mosquitto...")
    client.connect()
    print("MQTT connected :)")
    return client