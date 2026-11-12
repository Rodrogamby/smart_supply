import machine
import ssl
from binascii import hexlify
from umqtt.simple import MQTTClient
from logger import Log
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


    def connect(self): # throws exception
        Log.debug(f'Attempting connection to {self.client.user}@{self.client.server}:{self.client.port}')
        self.client.connect()
        Log.info(f'Connected to broker: {self.client.server}:{self.client.port}')

    def send(self, message):  # throws exception
        topic = b'telemetry/ch1'
        jsonized = json.dumps(message)
        self.client.publish(
                topic,
                jsonized.encode("utf-8"),
                qos=0)
