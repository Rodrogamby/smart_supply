import './style.css'
import mqtt from 'mqtt'

// =====================================================
// CONFIGURATION
//  device ID and topics 
// =====================================================

const DEVICE_ID = 'spps-01'
const TOPIC = `spps/${DEVICE_ID}`
const STALE_AFTER_MS = 10000

// Find an HTML element by its ID.
const $ = (id) => document.getElementById(id)

// Build MQTT topics
const topic = (suffix) => `${TOPIC}/${suffix}`

// Connection state and latest measurements
let client = null
let lastTelemetryAt = 0
let deviceOnline = false
let hasFault = false
const measurements = {}

// =====================================================
// INTERFACE HELPERS
// =====================================================

// Update a status badge and its CSS appearance
function badge(id, label, type) {
  const element = $(id)
  element.textContent = label
  element.className = `badge ${type}`
}

// Display a message above the channel cards
function notice(message, isError = false) {
  $('notice').textContent = message
  $('notice').classList.toggle('error', isError)
}

// Add a timestamped event, keeping the latest 30 entries
function log(message) {
  const item = document.createElement('li')
  const time = document.createElement('time')

  time.textContent = new Date().toLocaleTimeString()
  item.append(time, document.createTextNode(message))
  $('event-log').prepend(item)

  while ($('event-log').children.length > 30) {
    $('event-log').lastElementChild.remove()
  }
}

// Enable controls only when the ESP32 is communicating
// Faults block ON requests, while OFF remains available
function controlsEnabled() {
  const fresh = Date.now() - lastTelemetryAt < STALE_AFTER_MS
  const available = client?.connected && deviceOnline && fresh

  document.querySelectorAll('.channel-command').forEach((button) => {
    const turningOn = button.dataset.enabled === 'true'
    button.disabled = !available || (hasFault && turningOn)
  })
}

// Format numbers; missing or invalid values appear as a dash
function reading(value, digits) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(digits)
    : '—'
}



// =====================================================
// INCOMING MQTT DATA
// =====================================================

// Refresh the channel cards using measurements from the ESP32
// Output badges change here, rather than immediately on a click
function renderTelemetry(data) {
  if (!data || typeof data !== 'object') return

  lastTelemetryAt = Date.now()
  let anyFault = false

  for (const channel of ['ch1', 'ch2']) {
    const state = data[channel]
    if (!state || typeof state !== 'object') continue

    measurements[channel] = state

    if (typeof state.enabled === 'boolean') {
      badge(
        `${channel}-state`,
        state.enabled ? 'ON' : 'OFF',
        state.enabled ? 'good' : 'neutral'
      )
    }

    $(`${channel}-voltage`).textContent = reading(state.voltage, 1)
    $(`${channel}-current`).textContent = reading(state.current, 2)
    $(`${channel}-power`).textContent = reading(state.power, 1)

    const fault = state.fault === true
    anyFault ||= fault

    $(`${channel}-fault`).textContent = fault
      ? 'Fault reported by ESP32'
      : 'No fault reported'

    $(`${channel}-fault`).classList.toggle('active', fault)
  }

  hasFault = anyFault
  deviceOnline = true

  $('last-update').textContent = new Date().toLocaleTimeString()
  badge('device-status', 'ESP32 reporting', 'good')

  renderTriangle()
  controlsEnabled()
}

// Parse JSON messages and route them by their MQTT topic
function handleMessage(name, payload) {
  let data

  try {
    data = JSON.parse(payload.toString())
  } catch {
    log(`Ignored invalid JSON on ${name}`)
    return
  }

  if (name === topic('telemetry')) {
    renderTelemetry(data)
  } else if (name === topic('status')) {
    deviceOnline = data.online === true

    badge(
      'device-status',
      deviceOnline ? 'ESP32 online' : 'ESP32 offline',
      deviceOnline ? 'good' : 'bad'
    )

    controlsEnabled()
    log(`Device status: ${deviceOnline ? 'online' : 'offline'}`)
  } else if (name === topic('ack')) {
    // An acknowledgement reports command acceptance
    // Telemetry separately reports the actual output state
    const result = data.accepted === true ? 'accepted' : 'rejected'
    const reason = data.reason ? ` (${String(data.reason)})` : ''

    log(`Command ${String(data.id ?? '?')}: ${result}${reason}`)
  }
}

// =====================================================
// MQTT CONNECTION
// =====================================================

// Close the connection and reset device availability.
function disconnect() {
  const old = client
  client = null
  old?.end(true)

  deviceOnline = false
  lastTelemetryAt = 0

  badge('broker-status', 'Broker disconnected', 'bad')
  badge('device-status', 'ESP32 unknown', 'neutral')

  $('connect-btn').disabled = false
  $('disconnect-btn').disabled = true

  controlsEnabled()
}

// Connect using the broker URL entered in the interface.
// Browsers require ws:// or wss://, rather than raw MQTT TCP.
function connect() {
  disconnect()

  const url = $('broker-url').value.trim()

  if (!/^wss?:\/\//i.test(url)) {
    notice('Enter a ws:// or wss:// broker WebSocket URL.', true)
    return
  }

  // Every browser tab gets a unique MQTT client ID.
  const next = mqtt.connect(url, {
    clientId: `spps-web-${crypto.randomUUID()}`,
    reconnectPeriod: 2000,
    connectTimeout: 5000,
    clean: true,
  })

  client = next

  $('connect-btn').disabled = true
  $('disconnect-btn').disabled = false

  badge('broker-status', 'Connecting…', 'neutral')
  notice(`Connecting to ${url}`)

  // Subscribe again whenever the broker connection is established.
  next.on('connect', () => {
    if (client !== next) return

    badge('broker-status', 'Broker connected', 'good')
    notice('Connected. Waiting for ESP32 telemetry…')
    log('Connected to MQTT broker')

    next.subscribe(
      [topic('telemetry'), topic('status'), topic('ack')],
      { qos: 1 },
      (error) => {
        if (error) log(`Subscription failed: ${error.message}`)
      }
    )

    controlsEnabled()
  })

  // Ignore events from a connection that has been replaced.
  next.on('message', (name, payload) => {
    if (client === next) handleMessage(name, payload)
  })

  next.on('reconnect', () => {
    if (client === next) {
      badge('broker-status', 'Reconnecting…', 'neutral')
    }
  })

  next.on('close', () => {
    if (client !== next) return

    badge('broker-status', 'Broker disconnected', 'bad')
    deviceOnline = false
    controlsEnabled()
  })

  next.on('error', (error) => {
    if (client !== next) return

    notice(`MQTT: ${error.message}`, true)
    log(`MQTT error: ${error.message}`)
  })
}

// =====================================================
// OUTPUT COMMANDS
// =====================================================

// Send an explicit ON/OFF request to the ESP32.
// The ESP32 must also validate commands and enforce protection.
function sendChannelCommand(channel, enabled) {
  if (!['ch1', 'ch2'].includes(channel)) return

  const stale = Date.now() - lastTelemetryAt >= STALE_AFTER_MS

  if (!client?.connected || !deviceOnline || stale) {
    notice('ESP32 status or telemetry is stale. Command was not sent.', true)
    controlsEnabled()
    return
  }

  if (hasFault && enabled) {
    notice('ESP32 reported a fault. ON command was not sent.', true)
    return
  }

  const command = {
    id: crypto.randomUUID(),
    action: 'set_channel',
    channel,
    enabled,
  }

  // Do not retain commands: old requests must not replay on reconnect.
  // QoS 1 can deliver duplicates; firmware should recognize repeated IDs.
  client.publish(
    topic('command'),
    JSON.stringify(command),
    { qos: 1, retain: false },
    (error) => {
      if (error) {
        log(`Publish failed: ${error.message}`)
      } else {
        log(
          `Requested ${channel.toUpperCase()} ${enabled ? 'ON' : 'OFF'} ` +
          `(${command.id.slice(0, 8)}); awaiting ESP32 acknowledgement`
        )
      }
    }
  )
}

// =====================================================
// POWER TRIANGLE
// =====================================================

// Display the selected channel's P, Q, S and power factor
// Q must come from the ESP32; RMS voltage/current cannot reveal its sign
function renderTriangle() {
  const channel = $('power-channel').value
  const data = measurements[channel] ?? {}
  const number = (value) =>
    typeof value === 'number' && Number.isFinite(value)

  const p = number(data.power) ? data.power : null
  const q = number(data.reactivePower) ? data.reactivePower : null

  // Prefer reported apparent power; otherwise calculate Vrms × Irms
  const s = number(data.apparentPower)
    ? data.apparentPower
    : number(data.voltage) && number(data.current)
      ? data.voltage * data.current
      : null

  // PF is undefined when apparent power is zero
  const pf = s > 0 && p !== null ? p / s : null

  $('triangle-p').textContent = reading(p, 1)
  $('triangle-q').textContent = reading(q, 1)
  $('triangle-s').textContent = reading(s, 1)
  $('triangle-pf').textContent = reading(pf, 3)

  const valid =
    p !== null && q !== null && p >= 0 && s !== null && s >= 0

  $('triangle-vectors').setAttribute(
    'visibility',
    valid ? 'visible' : 'hidden'
  )

  if (!valid) {
    $('triangle-note').textContent =
      'Waiting for valid P, S and signed Q measurements.'
    $('triangle-title').textContent =
      'Power triangle: waiting for measurements'
    return
  }

  // One scale for both axes preserves the triangle angle.
  const scale = Math.min(
    315 / Math.max(p, 1),
    115 / Math.max(Math.abs(q), 1)
  )

  const x = 45 + p * scale

  // SVG coordinates grow downward, so positive Q is subtracted.
  const y = 150 - q * scale

  // Update an SVG line's endpoints.
  const line = (id, x1, y1, x2, y2) => {
    const element = $(id)

    for (const [key, value] of Object.entries({ x1, y1, x2, y2 })) {
      element.setAttribute(key, value)
    }
  }

  line('p-vector', 45, 150, x, 150)
  line('q-vector', x, 150, x, y)
  line('s-vector', 45, 150, x, y)

  // Position labels near their corresponding vectors.
  const labels = [
    ['p-label', (45 + x) / 2, 173],
    ['q-label', x + 12, (150 + y) / 2],
    ['s-label', (45 + x) / 2 - 10, (150 + y) / 2 - 12],
  ]

  for (const [id, tx, ty] of labels) {
    $(id).setAttribute('x', tx)
    $(id).setAttribute('y', ty)
  }

  // S² = P² + Q² applies to the classical sinusoidal power triangle.
  // Distortion or inconsistent data can make the vector length differ from S.
  const mismatch =
    Math.abs(Math.hypot(p, q) - s) > Math.max(1, s * 0.05)

  $('s-label').textContent = mismatch ? '|P + jQ|' : 'S'

  if (mismatch) {
    $('triangle-note').textContent =
      'P–Q vector shown. Its length differs from S; distortion or ' +
      'inconsistent measurements may be present.'
  } else if (s === 0) {
    $('triangle-note').textContent =
      'No apparent power; power factor is undefined.'
  } else if (q > 0) {
    $('triangle-note').textContent = 'Inductive load · lagging current'
  } else if (q < 0) {
    $('triangle-note').textContent = 'Capacitive load · leading current'
  } else {
    $('triangle-note').textContent = 'Zero reactive power'
  }

  $('triangle-title').textContent =
    `${channel}: P ${p} W, Q ${q} var, S ${s} VA`
}

// =====================================================
// BUTTONS AND PERIODIC CONNECTION CHECK
// =====================================================

$('power-channel').addEventListener('change', renderTriangle)
$('connect-btn').addEventListener('click', connect)

$('disconnect-btn').addEventListener('click', () => {
  disconnect()
  notice('Disconnected from broker.')
})

$('clear-log').addEventListener('click', () => {
  $('event-log').replaceChildren()
})

document.querySelectorAll('.channel-command').forEach((button) => {
  button.addEventListener('click', () => {
    sendChannelCommand(
      button.dataset.channel,
      button.dataset.enabled === 'true'
    )
  })
})

// Disable controls if telemetry stops arriving.
setInterval(() => {
  if (!client?.connected) return

  if (lastTelemetryAt && Date.now() - lastTelemetryAt >= STALE_AFTER_MS) {
    badge('device-status', 'ESP32 telemetry stale', 'bad')
    controlsEnabled()
  }
}, 1000)