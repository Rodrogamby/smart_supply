def capture_waveform_60ms(num_samples=120, period_us=500):
    """
    Captures a 60 ms trace (120 samples @ 2 kHz) with zero heap allocations
    inside the tight loop. Returns a list of signed 24-bit integer counts.
    """
    # Pre-allocate flat buffer (3 bytes per 24-bit sample) and a 6-byte scratch buffer
    raw_buf = bytearray(num_samples * 3)
    rx_scratch = bytearray(6)
    mv_raw = memoryview(raw_buf)
    mv_rx = memoryview(rx_scratch)

    # TODO Localize bound methods to avoid attribute lookup overhead inside the loop

    gc.collect()
    gc.disable()  # Prevent GC pauses during the 60 ms window
    try:
        next_t = ticks_us()
        offset = 0
        for _ in range(num_samples):
            # Busy-wait for exact 500 us cadence (low jitter)
            while ticks_diff(ticks_us(), next_t) < 0:
                pass
            next_t += period_us # subtract expected SPI transmission time

            # Single SPI read transaction (no heap allocation)
            cs_val(0)
            spi_xfer(tx, mv_rx)
            cs_val(1)

            # Copy the 3 data bytes (rx_scratch[3:6]) into the flat buffer
            mv_raw[offset : offset + 3] = mv_rx[3:6]
            offset += 3
    finally:
        gc.enable()

    # Unpack 24-bit big-endian signed integers after timing-critical capture finishes
    samples = [0] * num_samples
    for i in range(num_samples):
        idx = i * 3
        val = (raw_buf[idx] << 16) | (raw_buf[idx + 1] << 8) | raw_buf[idx + 2]
        if val & 0x800000:  # Sign-extend 24-bit two's complement
            val -= 0x1000000
        samples[i] = val

    return samples
