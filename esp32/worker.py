from machine import Timer
from network_interface import Nif
from logger import Log
import ade7953


'''
### Class for making measurements and
### keeping the Sender object 'alive'
'''
class Worker:
    sample_rate = 30 # hz
    publish_interval = 1 # sec
    retry_cooldown = 3000 # msec

    def __init__(self, sender):
        self.sender = sender

        self.tim  = Timer(2)

        self.cnt = 0
        self.meas = [0,0,0,0,0,0,0]

        self.recover()

    def recover(self):
        self.tim.init(mode=Timer.ONE_SHOT,
                      period=Worker.retry_cooldown,
                      callback=self._recover)

    def poll_publish(self):
        self.tim.init(mode=Timer.ONE_SHOT,
                      period=int(1000/Worker.sample_rate),
                      callback=self._poll_publish)

    def _recover(self, t):
        if Nif.online == False:
            Log.debug('Skipping recovery. Net offline')
            self.recover()
            return
        try:
            self.sender.connect()
            self.poll_publish()
            return
        except Exception as e:
            self.recover()
            Log.debug(f'Failed to connect:\n{e}\r\n\
                    Retrying in {Worker.retry_cooldown}s...')


    def _poll_publish(self, t):
        try:
            self.measure()
            self.poll_publish()
        except Exception as e:
            #t.deinit()
            self.recover()
            Log.warn(f'Failed to publish:\n{e}\nRecovery poller enabled...')

    def measure(self):
        self.cnt += 1
        self.meas[0] += ade7953.get_vrms() # TODO: Continuous SPI transmission 
        self.meas[1] += ade7953.get_irms()
        self.meas[2] += ade7953.get_p()
        self.meas[3] += ade7953.get_q()
        self.meas[4] += ade7953.get_s()
        self.meas[5] += ade7953.get_pf()
        self.meas[6] += ade7953.get_angle()
        if self.cnt >= Worker.sample_rate * Worker.publish_interval:
            for i in range(len(self.meas)):
                self.meas[i] /= self.cnt
            self.publish()
            self.cnt = 0
            self.meas = [0, 0, 0, 0, 0, 0 ,0]

    def publish(self):
        readings = {
            "vrms": self.meas[0],
            "irms": self.meas[1],
            "p": self.meas[2],
            "q": self.meas[3],
            "s": self.meas[4], 
            "pf": self.meas[5], 
            "angle": self.meas[6] 
        }
        self.sender.send(readings)
        Log.debug('Published readings.')

