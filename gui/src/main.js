import './style.css'
import mqtt from 'mqtt'

// Temporary soil-sensor test
const TOPIC = 'test2'
const COMMAND_TOPIC = 'smart_supply/ch1/command'
const STATE_TOPIC = 'smart_supply/ch1/state'
let device = null
let lastStateAt = 0
let measuring = false
let subscribed = false
let pending = null

function buttons() {
  const ready = client?.connected && subscribed && device &&
    Date.now() - lastStateAt < 10000 && !pending
  document.querySelectorAll('[data-channel][data-enabled]').forEach((button) => {
    button.disabled = button.dataset.channel !== 'ch1' || !ready
  })
}

function resetDevice() {
  device = null
  lastStateAt = 0
  measuring = false
  subscribed = false
  pending = null
  buttons()
}

function handleState(payload, packet) {
  if (packet?.retain) return 
  let state
  try { state = JSON.parse(payload.toString()) } catch { return }
  if (!state || typeof state.device !== 'string' ||
      typeof state.online !== 'boolean' || typeof state.enabled !== 'boolean') return

      if (device && state.device !== device) return
  device = state.device
  setText('ch1-device', device)
  if (!state.online) {
    lastStateAt = 0
    measuring = false
    pending = null
    badge('device-status', 'ESP32 offline', 'bad')
    badge('ch1-state', 'Offline', 'bad')
    notice('ESP32 disconnected.')
    buttons()
    return
  }
  lastStateAt = Date.now()
  if (measuring !== state.enabled) { lastLiveAt = Date.now(); stale = false }
  measuring = state.enabled
  badge('device-status', 'ESP32 online', 'good')
  if (pending && state.request_id === pending.id) {
    log('ESP32 confirmed: ' + (measuring ? 'measurements started' : 'measurements stopped'))
    pending = null
  }
  if (!pending) {
    badge('ch1-state', measuring ? 'Running' : 'Stopped', measuring ? 'good' : 'neutral')
    notice(measuring ? 'ESP32 is publishing sensor measurements.' : 'ESP32 connected. Press Turn on to start measurements.')
  }
  buttons()
}

function sendCommand(enabled) {
  if (!client?.connected || !subscribed || !device || pending || Date.now() - lastStateAt >= 10000) return
  const id = crypto.randomUUID()
  pending = { id, at: Date.now() }
  buttons()
  notice('Waiting for the ESP32 to confirm ' + (enabled ? 'Turn on…' : 'Turn off…'))
  const connection = client
  // Do not retain commands or queue them for a later connection.
  connection.publish(COMMAND_TOPIC, JSON.stringify({device, enabled, request_id: id}),
    {qos: 0, retain: false}, (error) => {
      if (client !== connection || pending?.id !== id) return
      if (error) {
        pending = null
        notice('Could not send command: ' + error.message, true)
        buttons()
      }
    })
}
const STALE_AFTER_MS = 10000
const $ = (id) => document.getElementById(id)

function setText(id, value) {
  const element = $(id)
  if (element) element.textContent = value
}

function setDisabled(id, value) {
  const element = $(id)
  if (element) element.disabled = value
}
let client = null
let lastLiveAt = 0
let stale = false

function badge(id, text, type) {
  const element = $(id)
  if (!element) return
  element.textContent = text
  element.classList.remove('good', 'bad', 'neutral', 'demo')
  element.classList.add('badge', type)
}

function notice(text, error = false) {
  const element = $('notice')
  if (element) {
    element.textContent = text
    element.classList.toggle('error', error)
  }
  if (error) console.error(text)
}

function log(text) {
  const list = $('event-log')
  if (!list) { console.info(text); return }
  const item = document.createElement('li')
  const clock = document.createElement('time')
  clock.textContent = new Date().toLocaleTimeString()
  item.append(clock, document.createTextNode(text))
  list.prepend(item)
  while (list.children.length > 30) {
    list.lastElementChild.remove()
  }
}

function resetReadings() {
  for (const id of ['ch1-adc', 'ch1-sample', 'ch1-device', 'ch1-received', 'last-update']) {
    setText(id, '—')
  }
}

function disconnect() {
  resetDevice()
  const previous = client
  client = null
  previous?.removeAllListeners()
  previous?.end(true)
  lastLiveAt = 0
  stale = false
  badge('broker-status', 'Broker disconnected', 'bad')
  badge('device-status', 'ESP32 unknown', 'neutral')
  badge('ch1-state', 'Disconnected', 'neutral')
  setDisabled('connect-btn', false)
  setDisabled('disconnect-btn', true)
}

function handleMessage(name, payload, packet) {
  if (name === STATE_TOPIC) { handleState(payload, packet); return }
  if (name !== TOPIC) return
  let data
  try {
    data = JSON.parse(payload.toString())
  } catch {
    log('Ignored non-JSON message on ' + name)
    return
  }
  if (!data || data.sensor !== 'soil_moisture' ||
      typeof data.device !== 'string' ||
      !Number.isInteger(data.adc_raw) ||
      data.adc_raw < 0 || data.adc_raw > 65535) {
    log('Ignored message with an unexpected sensor format')
    return
  }

  if (device && data.device !== device) return
  const now = new Date()
  setText('ch1-adc', data.adc_raw.toLocaleString())
  setText('ch1-sample', Number.isInteger(data.sample) ? String(data.sample) : '—')
  setText('ch1-device', data.device)
  setText('ch1-received', now.toLocaleTimeString())
  setText('last-update', now.toLocaleTimeString())

  if (packet?.retain) {
    badge('ch1-state', 'Stored reading', 'neutral')
    notice('Retained reading received; waiting for live sensor data.')
    return
  }

  if (!lastLiveAt || stale) log('Receiving soil measurements from ' + data.device)
  lastLiveAt = Date.now()
  stale = false
  if (measuring && !pending) badge('ch1-state', 'Running', 'good')
}

function connect() {
  const missing = ['broker-url', 'mqtt-user', 'mqtt-password'].filter((id) => !$(id))
  if (missing.length) {
    notice('Missing connection control IDs: ' + missing.join(', '), true)
    return
  }
  const url = $('broker-url').value.trim()
  const username = $('mqtt-user').value.trim()
  const password = $('mqtt-password').value

  try {
    const parsed = new URL(url)
    if (!['ws:', 'wss:'].includes(parsed.protocol)) throw new Error()
  } catch {
    notice('Enter a valid ws:// or wss:// broker URL.', true)
    return
  }
  if (!username || !password) {
    notice('Enter your MQTT username and password.', true)
    return
  }

  disconnect()
  resetReadings()
  let next
  try {
    next = mqtt.connect(url, {
      username,
      password,
      clientId: 'spps-web-' + crypto.randomUUID(),
      reconnectPeriod: 3000,
      connectTimeout: 10000,
      clean: true,
      queueQoSZero: false,
    })
  } catch (error) {
    notice('MQTT: ' + error.message, true)
    return
  }
  client = next
  setDisabled('connect-btn', true)
  setDisabled('disconnect-btn', false)
  badge('broker-status', 'Connecting…', 'neutral')
  badge('ch1-state', 'Waiting', 'neutral')
  notice('Connecting to ' + url)

  next.on('connect', () => {
    if (client !== next) return
    resetDevice()
    badge('broker-status', 'Broker connected', 'good')
    badge('ch1-state', 'Waiting', 'neutral')
    notice('Connected. Waiting for soil-sensor measurements…')
    log('Connected to MQTT broker')
    next.subscribe([TOPIC, STATE_TOPIC], { qos: 1 }, (error, granted) => {
      if (client !== next) return
      if (error || !granted?.length || granted.some((entry) => entry.qos >= 128)) {
        notice('Subscription failed. Check MQTT permissions.', true)
        log('Subscription failed: ' + (error?.message ?? 'broker rejected topic'))
      } else {
        subscribed = true
        buttons()
        log('Subscribed to measurements and ESP32 state')
      }
    })
  })
  next.on('message', (name, payload, packet) => {
    if (client === next) handleMessage(name, payload, packet)
  })
  next.on('reconnect', () => {
    if (client === next) badge('broker-status', 'Reconnecting…', 'neutral')
  })
  next.on('close', () => {
    if (client !== next) return
    resetDevice()
    lastLiveAt = 0
    stale = false
    badge('broker-status', 'Broker disconnected', 'bad')
    badge('device-status', 'ESP32 unknown', 'neutral')
    badge('ch1-state', 'Disconnected', 'neutral')
  })
  next.on('error', (error) => {
    if (client !== next) return
    notice('MQTT: ' + error.message, true)
    log('MQTT error: ' + error.message)
    console.error(error)
  })
}

if (!$('connect-btn')) {
  notice('Missing connection button: keep id="connect-btn" on your Connect button.', true)
}
$('connect-btn')?.addEventListener('click', connect)
$('disconnect-btn')?.addEventListener('click', () => {
  disconnect()
  notice('Disconnected. Displayed measurements are historical.')
})
$('clear-log')?.addEventListener('click', () => $('event-log')?.replaceChildren())

// Channel 1 controls acquisition; Channel 2 remains disabled.
document.querySelectorAll('[data-channel][data-enabled]').forEach((button) => {
  button.disabled = true
  if (button.dataset.channel === 'ch1') {
    button.addEventListener('click', () => sendCommand(button.dataset.enabled === 'true'))
  }
})

function renderTrianglePlaceholder() {
  $('triangle-vectors')?.setAttribute('visibility', 'hidden')
  setText('triangle-title', 'Power triangle: waiting for electrical measurements')
  for (const id of ['triangle-p', 'triangle-q', 'triangle-s', 'triangle-pf']) {
    setText(id, '—')
  }
  setText('triangle-note', 'Waiting for electrical measurements. Soil readings do not produce a power triangle.')
}
$('power-channel')?.addEventListener('change', renderTrianglePlaceholder)
renderTrianglePlaceholder()

setInterval(() => {
  if (!client?.connected) return
  if (pending && Date.now() - pending.at >= 8000) {
    pending = null
    notice('No command confirmation. Check the ESP32; its state is not confirmed.', true)
    log('Command confirmation timed out')
  }
  if (lastStateAt && Date.now() - lastStateAt >= 10000) {
    lastStateAt = 0
    pending = null
    badge('device-status', 'ESP32 not responding', 'bad')
    badge('ch1-state', 'Unknown', 'neutral')
    notice('ESP32 heartbeat stopped. Controls are disabled.', true)
  }
  buttons()
  if (!lastStateAt || !measuring || !lastLiveAt || stale) return
  if (Date.now() - lastLiveAt >= STALE_AFTER_MS) {
    stale = true
    badge('ch1-state', 'Stale', 'bad')
    badge('device-status', 'Sensor telemetry stale', 'bad')
    notice('No live sensor measurements for 10 seconds. Last values remain displayed.')
    log('Soil telemetry stopped arriving')
  }
}, 1000)

window.addEventListener('pagehide', () => client?.end(true))

