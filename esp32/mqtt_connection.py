import machine
import ssl
from binascii import hexlify
from umqtt.simple import MQTTClient
import json

class Sender:
    Sender = None
    def __init__(self):
        # static instance
        if Sender.Sender == None:
            Sender.Sender = self
        else:
            return

        # setup client
        keys = json.load(open('mqtt.json'))
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        tls.verify_mode = ssl.CERT_REQUIRED
        with open("isrg-root-x2.der", "rb") as cert:
            tls.load_verify_locations(cadata=cert.read())

        # Give each ESP32 a unique MQTT client ID.
        self.client = MQTTClient(
            client_id=b"device-" + hexlify(machine.unique_id()),
            server=keys['broker']['host'],
            port=keys['broker']['port'],
            user=keys['credentials']['user'],
            password=keys['credentials']['password'],
            keepalive=10,
            ssl=tls,
        )


    def connect(self):
        self.client.connect()
        print('Connection established?')

    def send(self, message):
        topic = b'telemetry/ch1'
        self.client.publish(
                topic,
                json.dumps(message).encode("utf-8"),
                qos=1)
