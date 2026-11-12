import machine
import ntptime
import ssl
from binascii import hexlify
from umqtt.simple import MQTTClient
from network_interface import Nif

BROKER = "retotest.mexicocentral.cloudapp.azure.com"
PORT = 8883
CA_FILE = "/isrgrootx1.der"


def connect_mqtt(username, password):

    if not Nif.sta.isconnected():
        wifi = Nif()
        wifi.setup_sta()
        print("Connecting to Wi-Fi...")
        while not Nif.sta.isconnected(): # todo: async call
            pass

    print("Connected to Wi-Fi:", Nif.sta.ifconfig()[0])

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
