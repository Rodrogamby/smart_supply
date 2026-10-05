from machine import ADC, Pin, sleep

adc = ADC(Pin(36))        # create an ADC object acting on a pin
#val = adc.read_uv()   # read an analog value in microvolts

for i in range(250):
	val = adc.read_u16()  # read a raw analog value in the range 0-65535
	print(f'{val/65535},')
	sleep(50)
