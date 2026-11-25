from machine import Pin, SPI, Timer
from binascii import hexlify
from ade7953 import ADE7953
from struct import unpack
from mqtt_connection import Sender
from worker import Worker
from logger import Log
from ade7953 import ADE7953

Log.level = 1

meter1 = ADE7953.Module(14, 9, i_fscale = 500/33)
meter2 = ADE7953.Module(14, 10, i_fscale = 500/33)
meter1.setup()
meter2.setup()

sender = Sender()
worker = Worker(sender, meter2)

r1 = Pin(4, Pin.OUT, drive=1)
r2 = Pin(5, Pin.OUT, drive=1)
def relayToggle():
    r1.toggle()
    r2.toggle()
