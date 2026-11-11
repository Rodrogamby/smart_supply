from machine import Pin, SPI
from binascii import hexlify
from struct import unpack

class ADE7953:
    '''ADE7953 Metering IC Register Definitions.'''

    class Register:
        '''Represents an individual ADE7953 register entry.'''
        __slots__ = ('addr', 'bits', 'writable', 'signed')

        def __init__(self, addr, bits, writable, signed):
            self.addr = addr
            self.bits = bits
            self.writable = writable  # True = Read/Write, False = Read-Only
            self.signed = signed

        def __repr__(self):
            mode = 'R/W' if self.writable else 'R-Only'
            return f'Register(addr=0x{self.addr:03X}, bits={self.bits}, mode={mode})'

    # --- 8-Bit Registers ---
    SAGCYC = Register(0x000, 8, True, False)
    DISNOLOAD = Register(0x001, 8, True, False)
    LCYCMODE = Register(0x004, 8, True, False)
    PGA_V = Register(0x007, 8, True, False)
    PGA_IA = Register(0x008, 8, True, False)
    PGA_IB = Register(0x009, 8, True, False)
    WRITE_PROTECT = Register(0x040, 8, True, False)
    LAST_OP = Register(0x0FD, 8, False, False)
    LAST_RWDATA_8 = Register(0x0FF, 8, False, False)
    Version = Register(0x702, 8, False, False)
    EX_REF = Register(0x800, 8, True, False)

    # --- 16-Bit Registers ---
    ZXTOUT = Register(0x100, 16, True, False)
    LINECYC = Register(0x101, 16, True, False)
    CONFIG = Register(0x102, 16, True, False)
    CF1DEN = Register(0x103, 16, True, False)
    CF2DEN = Register(0x104, 16, True, False)
    CFMODE = Register(0x107, 16, True, False)
    PHCALA = Register(0x108, 16, True, True)
    PHCALB = Register(0x109, 16, True, True)
    PFA = Register(0x10A, 16, False, True)
    PFB = Register(0x10B, 16, False, True)
    ANGLE_A = Register(0x10C, 16, False, True)
    ANGLE_B = Register(0x10D, 16, False, True)
    Period = Register(0x10E, 16, False, False)
    ALT_OUTPUT = Register(0x110, 16, True, False)
    LAST_ADD = Register(0x1FE, 16, False, False)
    LAST_RWDATA_16 = Register(0x1FF, 16, False, False)

    # --- 32-Bit Registers ---
    SAGLVL = Register(0x300, 32, True, False)
    ACCMODE = Register(0x301, 32, True, False)
    AP_NOLOAD = Register(0x303, 32, True, False)
    VAR_NOLOAD = Register(0x304, 32, True, False)
    VA_NOLOAD = Register(0x305, 32, True, False)
    AVA = Register(0x310, 32, False, True)
    BVA = Register(0x311, 32, False, True)
    AWATT = Register(0x312, 32, False, True)
    BWATT = Register(0x313, 32, False, True)
    AVAR = Register(0x314, 32, False, True)
    BVAR = Register(0x315, 32, False, True)
    IA = Register(0x316, 32, False, True)
    IB = Register(0x317, 32, False, True)
    V = Register(0x318, 32, False, True)
    IRMSA = Register(0x31A, 32, False, False)
    IRMSB = Register(0x31B, 32, False, False)
    VRMS = Register(0x31C, 32, False, False)
    AENERGYA = Register(0x31E, 32, False, True)
    AENERGYB = Register(0x31F, 32, False, True)
    RENERGYA = Register(0x320, 32, False, True)
    RENERGYB = Register(0x321, 32, False, True)
    APENERGYA = Register(0x322, 32, False, True)
    APENERGYB = Register(0x323, 32, False, True)
    OVLVL = Register(0x324, 32, True, False)
    OILVL = Register(0x325, 32, True, False)
    VPEAK = Register(0x326, 32, False, False)
    RSTVPEAK = Register(0x327, 32, False, False)
    IAPEAK = Register(0x328, 32, False, False)
    RSTIAPEAK = Register(0x329, 32, False, False)
    IBPEAK = Register(0x32A, 32, False, False)
    RSTIBPEAK = Register(0x32B, 32, False, False)
    IRQENA = Register(0x32C, 32, True, False)
    IRQSTATA = Register(0x32D, 32, False, False)
    RSTIRQSTATA = Register(0x32E, 32, False, False)
    IRQENB = Register(0x32F, 32, True, False)
    IRQSTATB = Register(0x330, 32, False, False)
    RSTIRQSTATB = Register(0x331, 32, False, False)
    CRC = Register(0x37F, 32, False, False)
    AIGAIN = Register(0x380, 32, True, False)
    AVGAIN = Register(0x381, 32, True, False)
    AWGAIN = Register(0x382, 32, True, False)
    AVARGAIN = Register(0x383, 32, True, False)
    AVAGAIN = Register(0x384, 32, True, False)
    AIRMSOS = Register(0x386, 32, True, True)
    VRMSOS = Register(0x388, 32, True, True)
    AWATTOS = Register(0x389, 32, True, True)
    AVAROS = Register(0x38A, 32, True, True)
    AVAOS = Register(0x38B, 32, True, True)
    BIGAIN = Register(0x38C, 32, True, False)
    BVGAIN = Register(0x38D, 32, True, False)
    BWGAIN = Register(0x38E, 32, True, False)
    BVARGAIN = Register(0x38F, 32, True, False)
    BVAGAIN = Register(0x390, 32, True, False)
    BIRMSOS = Register(0x392, 32, True, True)
    BWATTOS = Register(0x395, 32, True, True)
    BVAROS = Register(0x396, 32, True, True)
    BVAOS = Register(0x397, 32, True, True)
    LAST_RWDATA_32 = Register(0x3FF, 32, False, False)



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

#for 180V (peak)
#circuit: 180V --(transformer)--> 180mV
def raw_to_volts(raw : int):
    print(f'raw value: {raw}')
    scale_factor = 1/1000 # 1m: 180V -> 180mV
    fullcount = 6500000
    return (500e-3 * raw) / (fullcount * scale_factor)

#for 10A (RMS) -> 14.15A (peak)
#circuit: 14.2A --(transformer)--> 14.2mA --(33Ω resistor)--> 468.6mV
def raw_to_current(raw : int):
    print(f'raw value: {raw}')
    scale_factor = 33/1000 # 14.2A -> 468.6mV
    fullcount = 6500000
    return (500e-3 * raw) / (fullcount * scale_factor)

def raw_to_power(raw : int):
    print(f'fullscale: ${raw}')
    fullscale_power = 500 * 15.15 #Vmax * Amax (peak)
    fullcount = 4862401
    return fullscale_power * raw / fullcount

def get_voltage():
    rx = comm(ADE7953.V.addr, True, ADE7953.V.bits)
    return raw_to_volts(cast_to_int32(rx))

def get_voltage_rms(): # shuold be read synchronously to the zx signal
    rx = comm(ADE7953.VRMS.addr, True, ADE7953.VRMS.bits)
    return raw_to_volts(cast_to_uint32(rx))

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
    rx = comm(ADE7953.PFB.addr, True, ADE7953.PFB.bits)
    print(rx)
    pf_dec = cast_to_int16(rx)
    print(f'pf_dec: {pf_dec}')
    return pf_dec/32767

def get_angle():
	rx = comm(ADE7953.ANGLE_B.addr, True, ADE7953.ANGLE_B.bits)
	return cast_to_int16(rx)

def get_current_rms():
	rx = comm(ADE7953.IRMSB.addr, True, ADE7953.IRMSB.bits)
	return raw_to_current(cast_to_uint32(rx))

def get_current_peak():
	rx = comm(ADE7953.IBPEAK.addr, True, ADE7953.IBPEAK.bits)
	return raw_to_volts(cast_to_uint32(rx))

def get_apparent_power():
	rx = comm(ADE7953.BVA.addr, True, ADE7953.BVA.bits)
	return raw_to_power(cast_to_int32(rx))

def get_active_power():
	rx = comm(ADE7953.BWATT.addr, True, ADE7953.BWATT.bits)
	return raw_to_power(cast_to_int32(rx))

def get_reactive_power():
	rx = comm(ADE7953.BVAR.addr, True, ADE7953.BVAR.bits)
	return raw_to_power(cast_to_int32(rx))


