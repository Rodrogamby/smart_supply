from machine import Pin, SPI
from binascii import hexlify
from ade7953 import ADE7953
from struct import unpack

en = Pin(14, mode=Pin.OUT, value=1) # enable
cs = Pin(10, mode=Pin.OUT, value=1) # chip select
spi = SPI(2, sck=Pin(12), miso=Pin(11), mosi=(13), polarity=1, baudrate=1000000) # hardware spi

'''
Query the ADE7953 IC over SPI
Address: Memory address (2 bytes)
Mode: True (read) False (write)
Size: Addressed register size (bits)
'''
def comm(address, mode, size, payload=b''):
    size = int(size/8) # convert to bytes
    addr = bytearray([(address >> 8) & 0xFF, address & 0xFF])
    read = bytearray(b'\x80') if mode else bytearray(b'\x00')

    tx = addr + read + payload
    rx = bytearray(size)

    cs(0)
    spi.write(tx)
    print(f'Sent data: {hexlify(tx)}')
    if mode == True:
        spi.readinto(rx, 0x0)
        print(f'Received data: {hexlify(rx)}')
    cs(1)

    return rx

def setup():
    # p.18 
    # write 0xad to 0xfe (unlock)
    # write 0x30 to 0x120 (optimum settings)
    comm(0xfe, False, 1, b'\x00\xad')
    comm(0x120, False, 1, b'\x00\x30')

def cast_to_int32(data):
    # '>i' bigendian 32bit int
    return unpack('>i', data)[0]

def cast_to_uint32(data):
    return unpack('>I', data)[0]

def cast_to_int16(data):
    return unpack('>h', data)[0]

def cast_to_uint16(data):
    return unpack('>H', data)[0]

def raw_to_volts(raw : int):
    scale_factor = 1e-3 # 1m: 180V -> 180mV
    fullcount = 6500000 # 500mV
    return (250e-3 * raw) / (fullcount * scale_factor)

def raw_to_power(raw : int):
    scale = 1e-3 # 1m: 180V -> 180mV
    fullcount = 4862401
    return (250000 * raw) / (fullcount)

def get_voltage():
    rx = comm(ADE7953.V.addr, True, ADE7953.V.bits)
    return raw_to_volts(cast_to_int32(rx))

def get_voltage_rms(): # shuold be read synchronously to the zx signal
    rx = comm(ADE7953.VRMS.addr, True, ADE7953.VRMS.bits)
    return raw_to_volts(cast_to_int32(rx))

def get_voltage_peak():
    rx = comm(ADE7953.VPEAK.addr, True, ADE7953.VPEAK.bits)
    return raw_to_volts(cast_to_uint32(rx))

def get_period(): # p.36
    rx = comm(ADE7953.Period.addr, True, ADE7953.Period.bits)
    rx = cast_to_uint16(rx)
    return (rx + 1)/(223.75e3) # sec

def get_frequency():
    return 1/get_period()

def get_powerfactor():
	rx = comm(ADE7953.PFA.addr, True, ADE7953.PFA.bits)
	return cast_to_int16(rx)

def get_angle():
	rx = comm(ADE7953.ANGLE_A.addr, True, ADE7953.ANGLE_A.bits)
	return cast_to_int16(rx)

def get_current_rms():
	rx = comm(ADE7953.IRMSA.addr, True, ADE7953.IRMSA.bits)
	return raw_to_volts(cast_to_uint32(rx))

def get_current_peak():
	rx = comm(ADE7953.IAPEAK.addr, True, ADE7953.IAPEAK.bits)
	return raw_to_volts(cast_to_uint32(rx))

def get_apparent_power():
	rx = comm(ADE7953.AVA.addr, True, ADE7953.AVA.bits)
	return raw_to_power(cast_to_int32(rx))

def get_active_power():
	rx = comm(ADE7953.AWATT.addr, True, ADE7953.AWATT.bits)
	return raw_to_power(cast_to_int32(rx))

def get_reactive_power():
	rx = comm(ADE7953.AVAR.addr, True, ADE7953.AVAR.bits)
	return raw_to_power(cast_to_int32(rx))
