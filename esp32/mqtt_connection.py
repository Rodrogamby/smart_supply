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

        # Give each ESP32 a unique MQTT client ID
        self.client = MQTTClient(
            client_id=b"device-" + hexlify(machine.unique_id()),
            server=keys['broker']['host'],
            port=keys['broker']['port'],
            user=keys['credentials']['user'],
            password=keys['credentials']['password'],
            keepalive=10,
            ssl=tls,
        )
	
        #active and low of relay ch1
        self.relays = {
            b'ch1' : machine.Pin(38, machine.Pin.OUT, value=1),
            b'ch2' : machine.Pin(3, machine.Pin.OUT, value=1) }
        
        self.relay_enabled =  {b'ch1': False, b'ch2': False}
        self.state_pending =  {b'ch1': False, b'ch2': False}

        self.client.set_callback(self.on_command)

    def on_command(self, topic, message):
        if topic == b'command/ch1':
            channel = b'ch1' 
        elif topic == b'command/ch2':
            channel = b'ch2'
        else:
            return

        if message == b'1':
            self.relays[channel].value(0) #ON
            self.relay_enabled[channel] = True
        elif message == b'0':
            self.relays[channel].value(1)#OFF
            self.relay_enabled[channel] = False
        else:
            return
        self.state_pending[channel] = True

    def check_commands(self):
        #Process an incoming MQTT message
        self.client.check_msg()

        for channel in self.relays:

            #Publish confirmation
            if self.state_pending[channel]:
                self.client.publish(
                    b'state/' + channel,
                    b'1' if self.relay_enabled[channel] else b'0',
                    retain = True, 
                    qos =0,
                )

                self.state_pending[channel] = False 
	
    def connect(self): # throws exception
        Log.debug(f'Attempting connection to {self.client.user}@{self.client.server}:{self.client.port}')
        self.client.connect()
        self.client.subscribe(b'command/ch1', qos=0)
        self.client.subscribe(b'command/ch2', qos=0)

        for channel in self.relays:
            self.state_pending[channel] = True

        Log.info(f'Connected to broker: {self.client.server}:{self.client.port}')

    def send(self, message):  # throws exception
        topic = b'telemetry/ch1'
        jsonized = json.dumps(message)
        self.client.publish(
                topic,
                jsonized.encode("utf-8"),
                qos=0)





