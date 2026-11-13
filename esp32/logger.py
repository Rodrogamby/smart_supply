import time


class Log:
    level = 1  # 0-Debug, 1-Info, 2-Warn, 3-Error

    def __print(message, prefix):
        t = time.gmtime(time.time() - 3600 * 6)  # UTC-6
        # [DD/MM/YY][HH:MM:SS][Name/INFO]: MSG
        print(f'[{t[2]:02d}/{t[1]:02d}/{t[0]:04d}][{t[3]:02d}:{t[4]:02d}:{t[5]:02d}][-/{prefix}]: {message}')

    def debug(message):
        if Log.level <= 0:
            Log.__print(message, 'DEBUG')

    def info(message):
        if Log.level <= 1:
            Log.__print(message, 'INFO')

    def warn(message):
        if Log.level <= 2:
            Log.__print(message, 'WARN')

    def error(message):
        if Log.level <= 3:
            Log.__print(message, 'ERROR')
