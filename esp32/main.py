from machine import Pin, SPI, Timer
from binascii import hexlify
from ade7953 import ADE7953
from struct import unpack
from mqtt_connection import Sender
from worker import Worker
from logger import Log
from ade7953 import ADE7953

Log.level = 0

meter = ADE7953.Module(14, 10, i_fscale = 500/33)
meter.setup()

sender = Sender()
worker = Worker(sender, meter)
