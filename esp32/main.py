from machine import Pin, SPI, Timer
from binascii import hexlify
from ade7953 import ADE7953
from struct import unpack
from mqtt_connection import Sender
from worker import Worker
from logger import Log
import ade7953.ADE7953.Module as Meter

Log.level = 0

meter = Meter(14, 10, i_fscale = 500/33)
meter.setup()

sender = Sender()
worker = Worker(sender)
