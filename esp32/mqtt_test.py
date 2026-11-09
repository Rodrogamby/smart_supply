import network #wifi interface
import ssl # tls encryption
import ntptime #syncrhronize clock
import time #read and display time
import machine #obtain esp id
import binascii 
import json

from umqtt.simple import MQTTClient
from machine import ADC, Pin

#SET CONNECTION DETAAILS

BROKER = "retotest.mexicocentral.cloudapp.azure.com" #where the broker is
USER = b"reto" 
PASSWORD = b"reto"  # Contraseña MQTT 
TOPIC = b"test2"

wifi = network.WLAN(network.STA_IF)

if not wifi.isconnected():
    raise RuntimeError("Primero conecta el ESP32 al Wi-Fi")

print("Wi-Fi conectado:", wifi.ifconfig()[0])

# TLS necesita una fecha correcta para validar el certificado
print("Sincronizando reloj...")
ntptime.settime()
print("Fecha UTC:", time.gmtime())

# Cargar el certificado publico
with open("isrgrootx1.der", "rb") as certificate:
    ca = certificate.read()

# esp32 id
client_id = b"spps-" + binascii.hexlify(machine.unique_id())

client = MQTTClient(
    client_id=client_id,
    server=BROKER,
    port=8883,
    user=USER,
    password=PASSWORD,
    keepalive=60,
    ssl=True,
    ssl_params={
        "cert_reqs": ssl.CERT_REQUIRED,
        "cadata": ca,
        "server_hostname": BROKER,
    },
)

print("Conectando a Azure con TLS...")
client.connect()
print("MQTT conectado")

# Sensor conectado a GPIO4
sensor = ADC(Pin(4))
sensor.atten(ADC.ATTN_11DB)

try:
    # Prueba de 30
    for sample in range(30):
        # Promediar 10 lecturas 
        total = 0

        for _ in range(10):
            total += sensor.read_u16()
            time.sleep_ms(10)

        adc_value = total // 10

        payload = json.dumps({
            "device": client_id.decode(),
            "sensor": "soil_moisture",
            "sample": sample,
            "adc_raw": adc_value
        })

        client.publish(TOPIC, payload.encode(), qos=1)
        print("Publicado:", payload)
        time.sleep(2)

finally:
    client.disconnect()

print("Prueba terminada")
