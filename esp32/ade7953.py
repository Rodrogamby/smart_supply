from binascii import hexlify
from machine import Pin, SPI
from math import pi
from struct import unpack

sqrt2 = 2**0.5

def to_int32(data):
    return unpack('>i', data)[0]

def to_uint32(data):
    return unpack('>I', data)[0]

def to_int16(data):
    return unpack('>h', data)[0]

def to_uint16(data):
    return unpack('>H', data)[0]

class ADE7953:
    class Register:
        __slots__ = ('addr', 'bits', 'writable', 'signed')

        def __init__(self, addr, bits, writable, signed):
            self.addr = addr
            self.bits = bits
            self.writable = writable  # True = R/W, False = R-Only
            self.signed = signed

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
    
    class Module():
        spi = SPI(2, sck=Pin(12), miso=Pin(11), mosi=(13), polarity=1, baudrate=1000000) # share hardware spi

        def __init__(self, en, cs, v_fscale=500, i_fscale=500):
            self.en = Pin(en, mode=Pin.OUT, value=1) # enable
            self.cs = Pin(cs, mode=Pin.OUT, value=1) # chip select
            self.v_fscale = v_fscale
            self.i_fscale = i_fscale

        def comm(self, register, read_only, payload=b''):
            size = int(register.bits/8) # bytes
            addr = bytearray([(register.addr >> 8) & 0xFF, register.addr & 0xFF])
            mode = b'\x80' if read_only else b'\x00'

            tx = addr + mode + payload
            rx = bytearray(size)

            self.cs(0)
            ADE7953.Module.spi.write(tx)
            if read_only == True:
                ADE7953.Module.spi.readinto(rx, 0x0)
            self.cs(1)
            # todo: verify success
            return rx

        def setup(self):
            # unlock and set default settings (p. 18)
            unlock = ADE7953.Register(0xfe, 8, False, False)
            settings = ADE7953.Register(0x120, 8, False, False)
            self.comm(unlock, False, b'\x00\xad')
            self.comm(settings, False, b'\x00\x30')

        def read(self, address, cast=True):
            rx = self.comm(address, True)
            b32 = [to_uint32, to_int32]
            b16 = [to_uint16, to_int16]
            signed = 1 if address.signed else 0
            if address.bits == 32:
                return b32[signed](rx)
            else:
                return b16[signed](rx)

        ### unitful conversion ###
        def conv_v(self, raw : int):   # p.21
            fullcount = 6500000
            return self.v_fscale * raw / fullcount

        def conv_vrms(self, raw: int):  # p.23
            fullcount = 9032007
            return self.v_fscale * raw / (fullcount * sqrt2)

        def conv_i(self, raw : int):
            # 10A_rms -(trns)-> 14.2mA -(33Ω)-> 468.6mV
            fullcount = 6500000
            return self.i_fscale * raw / fullcount

        def conv_irms(self, raw: int): # p.23
            fullcount = 9032007
            return self.i_fscale * raw / (fullcount * sqrt2)

        def conv_va(self, raw : int): # p. 28
            p_fscale = self.v_fscale * self.i_fscale / 2
            fullcount = 4862401
            return p_fscale * raw / fullcount

        ### voltage ###
        def get_v(self): 
            return self.conv_v(self.read(ADE7953.V))

        def get_vrms(self):  # todo: synchronous read
            return self.conv_vrms(self.read(ADE7953.VRMS))

        def get_vpeak(self):  # p.46
            return self.conv_v(self.read(ADE7953.VPEAK))

        ### current ###
        def get_i(self):
            return self.conv_i(self.read(ADE7953.IB))

        def get_irms(self):  # todo: synchronous read
            return self.conv_irms(self.read(ADE7953.IRMSB))

        def get_ipeak(self):  # p.46
            return self.conv_i(self.read(ADE7953.IBPEAK))

        ### power ###
        def get_p(self):  # p.24
            return self.conv_va(self.read(ADE7953.BWATT))

        def get_q(self):  # p.28
            return self.conv_va(self.read(ADE7953.BVAR))

        def get_s(self):  # p.31
            return self.conv_va(self.read(ADE7953.BVA))

        ### phase & frequency ###
        def get_period(self):  # p.36, seconds
            rx = self.read(ADE7953.Period)
            return (rx + 1) / (223.75e3)

        def get_frequency(self):
            return 1 / self.get_period()

        def get_pf(self):  # p.38
            rx = self.read(ADE7953.PFB)
            return rx / 0x7FFF

        def get_angle(self): # p.39 (radians)
            rx = self.read(ADE7953.ANGLE_B)
            #delta = 4.47e-6  # sec
            return rx * 2 * pi * self.get_frequency() / 223e3
