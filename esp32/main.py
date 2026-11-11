from machine import Pin, SPI
from binascii import hexlify
from ade7953 import ADE7953
from struct import unpack
from mqtt_connection import connect_mqtt
import json
import ade7953




client = connect_mqtt(b"reto", b"reto")

ade7953.setup()

if client is not None:
    readings = {
        "voltage_rms(vrms)": ade7953.get_voltage_rms(),
        "current_rms(arms)": ade7953.get_current_rms(),
        "active_power(w)": ade7953.get_active_power(),
    }

    readings_json = json.dumps(readings)
    client.publish(b"telemetry/ch1", readings_json.encode("utf-8"), qos=1)
    print("Published to telemetry/ch1 topic:", readings_json)
else:
    print("Not MQTTT connection")
