from machine import Pin, SPI, Timer
from binascii import hexlify
from ade7953 import ADE7953
from struct import unpack
from mqtt_connection import Sender
from worker import Worker
from logger import Log
import ade7953

Log.level = 0

ade7953.setup()
sender = Sender()
worker = Worker(sender)
