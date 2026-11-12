from machine import Pin, SPI
from binascii import hexlify
from ade7953 import ADE7953
from struct import unpack
from mqtt_connection import Sender
import ade7953


ade7953.setup()
sender = Sender.Sender

def callback():
    readings = {
        "vrms": ade7953.get_vrms(),
        "irms": ade7953.get_irms(),
        "p": ade7953.get_p(),
        "q": ade7953.get_q(),
        "s": ade7953.get_s(),
        "pf": ade7953.get_pf(),
        "angle": ade7953.get_angle()
    }
    sender.send(readings)
