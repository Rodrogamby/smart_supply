# This file is executed on every boot (including wake-boot from deepsleep)
#import esp
#esp.osdebug(None)

from machine import Timer
import micropython
import mqtt_connection as mqtt
import network_interface as ni
import os

micropython.alloc_emergency_exception_buf(100) # reserve memory for call back error stacks

sender = mqtt.Sender()

def setupMqtt():
    sender.connect()

nif = ni.Nif(callbacks=[setupMqtt])
nif.setup_sta()

