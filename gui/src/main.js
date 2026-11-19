import './style.css'
import mqtt from 'mqtt'

// Shortcut for finding an HTML element by its id
const $ = (id) => document.getElementById(id)

// Holds the current MQTT client 
let client = null

const ch1History = []
const ch2History = []
const max_readings = 60


// auto: true fits the Y axis to received readings
// auto: false to use the fixed min max values
const graphLimits = {
  ch1: {
    voltage: { min: 0, max: 150, auto: true },
    current: { min: 0, max: 12, auto: true },
    power: { min: 0, max: 1500, auto: true },
  },
  ch2: {
    voltage: { min: 0, max: 35, auto: true },
    current: { min: 0, max: 4, auto: true },
    power: { min: 0, max: 100, auto: true },
  },
}

function drawChannelHistory(channel) {
  const history = channel === 'ch1' ? ch1History : ch2History
  for (const [name, field, unit] of [
    ['voltage', 'vrms', 'V'], ['current', 'irms', 'A'], ['power', 'p', 'W'],
  ]) {
    const limits = graphLimits[channel][name]
    let { min, max } = limits
    if (limits.auto && history.length) {
      const values = history.map(sample => sample[field])
      min = Math.min(...values)
      max = Math.max(...values)
      const padding = (max - min) * 0.1 || Math.max(Math.abs(max) * 0.1, 0.01)
      min -= padding
      max += padding
    }
    drawhistory(`${channel}-${name}-chart`, field, unit, min, max, history)
  }
}

function drawhistory(canvasid, field, unit, min, max, history = []) {
  const canvas = $(canvasid)
  if (!canvas) return
  if (!(Number.isFinite(min) && Number.isFinite(max) && max > min)) {
    console.error('Invalid graph limits:', canvasid, min, max)
    return
  }
  const ctx = canvas.getContext('2d')
  const left = 64
  const right = canvas.width -16
  const top = 20
  const bottom = canvas.height - 30

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = '#456078'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, top)
  ctx.lineTo(left, bottom)
  ctx.lineTo(right, bottom)
  ctx. stroke()

  ctx.fillStyle = '#9cadbf'
  ctx.font = '12px sans-serif'

  ctx.textAlign = 'right'
  ctx.fillText(`${max.toFixed(2)} ${unit}`, left - 6, top + 4)
  ctx.fillText(`${min.toFixed(2)} ${unit}`, left - 6, bottom)

  ctx.textAlign = 'left'
  ctx.fillText('0 s', left, bottom + 18)

  if (history.length === 0) return

  const firstTime = history[0].time
  const lastTime = history[history.length - 1].time
  const duration = lastTime - firstTime

  ctx.textAlign = 'right'
  ctx.fillText(`${(duration / 1000).toFixed(1)} s`, right, bottom + 18)

  ctx.save()
  ctx.beginPath()
  ctx.rect(left, top, right - left, bottom - top)
  ctx.clip()
  ctx.strokeStyle = '#60d5b4'
  ctx.fillStyle = '#60d5b4'
  ctx.lineWidth = 2
  ctx.beginPath()

  history.forEach((sample, index) => {
    const x = duration
      ? left + (sample.time - firstTime) / duration * (right - left)
      : (left + right) / 2
    const y = bottom - (sample[field] - min) / (max - min) * (bottom - top)

    if (history.length === 1) {
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.fill()
    } else if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })

  if (history.length > 1) ctx.stroke()
  ctx.restore()
  
}

function drawPowerTriangle(p, q, channel = 'ch1') {
  const suffix = channel === 'ch2' ? '-ch2' : ''
  const name = channel === 'ch2' ? 'Channel 2' : 'Channel 1'
  const triangleEl = (id) => $(`${id}${suffix}`)

  const vectors = triangleEl('triangle-vectors')
  const note = triangleEl('triangle-note')

  if (!vectors || !note) {
    console.error('Missing triangle HTML IDs for', channel)
    return
  }

  if (!Number.isFinite(p) || !Number.isFinite(q)) {
    vectors.setAttribute('visibility', 'hidden')
    note.textContent = 'Cannot plot this reading.'
    return
  }

  const x0 = 45
  const y0 = 150
  const magnitude = Math.max(Math.abs(p), Math.abs(q))
  const scale = magnitude === 0 ? 1 : Math.min(
    p === 0 ? Infinity : 330 / Math.abs(p),
    q === 0 ? Infinity : 110 / Math.abs(q)
  )

  const svg = triangleEl('triangle')
  const axes = svg.querySelectorAll('.triangle-axis')
  if (axes.length >= 2) {
    axes[0].setAttribute('x1', 45)
    axes[0].setAttribute('x2', 410)
    axes[1].setAttribute('x1', x0)
    axes[1].setAttribute('x2', x0)
  }
  const qAxisLabel = [...svg.querySelectorAll('.axis-label')]
    .find(label => label.textContent.includes('Q'))
  if (qAxisLabel) qAxisLabel.setAttribute('x', 10)

  const x = x0 + p * scale
  const y = y0 - q * scale // In SVG, positive y points down.

  function setLine(id, x1, y1, x2, y2) {
    const line = triangleEl(id)
    line.setAttribute('x1', x1)
    line.setAttribute('y1', y1)
    line.setAttribute('x2', x2)
    line.setAttribute('y2', y2)
  }

  setLine('p-vector', x0, y0, x, y0)
  setLine('q-vector', x, y0, x, y)
  setLine('s-vector', x0, y0, x, y)

  function setLabel(id, labelX, labelY, visible) {
    const label = triangleEl(id)
    label.setAttribute('x', labelX)
    label.setAttribute('y', labelY)
    label.setAttribute('visibility', visible ? 'visible' : 'hidden')
  }

  setLabel('p-label', (x0 + x) / 2, y0 + 16, p !== 0)
  setLabel('q-label', x + 8, (y0 + y) / 2, q !== 0)  
  setLabel('s-label', (x0 + x) / 2, (y0 + y) / 2 - 8, q !== 0)

  vectors.setAttribute('visibility', 'visible')
  triangleEl('triangle-title').textContent = `${name} power triangle`
  note.textContent = q === 0
    ? `${name} · Q = 0 var`
    : `${name} · Live measurements`
}


// Add a message at the top of the Event Log
function log(message) {
  const item = document.createElement('li')
  item.textContent = message
  $('event-log').prepend(item)
}

function setStatus(message, type) {
  const badge = $('broker-status')
  badge.textContent = message
  badge.className = `badge ${type}`
  $('notice').textContent = message
}

// Read the connection form and start the MQTT connection
function connect() {
  const url = $('broker-url').value.trim()
  const username = $('mqtt-user').value.trim()
  const password = $('mqtt-password').value

  // Stop here if any required field is empty
  if (!url || !username || !password) {
    $('notice').textContent = 'Enter the broker URL, username and password.'
    return
  }

  try {
    client = mqtt.connect(url, {
      username,
      password,
      reconnectPeriod: 0,    // Reconnect manually using the Connect button
      connectTimeout: 10000, // Wait up to 10 seconds for a connection
    })
  } catch (error) {
    // Handle errors thrown while creating the client
    setStatus(`MQTT error: ${error.message}`, 'bad')
    return
  }

  // Prevent a second connection attempt while this one is in progress
  $('connect-btn').disabled = true
  $('disconnect-btn').disabled = false
  setStatus('Connecting…', 'neutral')

  // This runs once the broker accepts the MQTT connection
  client.on('connect', () => {
    setStatus('Broker connected', 'good')
    log('Connected to MQTT')

    //enable relay buttons
    document.querySelectorAll('.channel-command').forEach(button => {
      button.disabled = false
    });

    client.subscribe(['telemetry/ch1', 'telemetry/ch2', 'state/ch1', 'state/ch2'],(error, granted) => {
      if (error || !granted?.length || granted.some(item => item.qos >= 128)) {
        console.error('Subscription failed:', error || granted)
        return
      }
      console.log('Listening to telemetry')
    })
  })

  client.on('message', (topic, message) => {
    // Update the indicator using the state reported by the ESP
    if (topic === 'state/ch1' || topic === 'state/ch2') {
      const channel = topic.split('/')[1]
      const state = message.toString()

      if (state !== '1' && state !== '0') return

      const enabled = state === '1'
      const badge = $(`${channel}-state`)

      badge.textContent = enabled ? 'On' : 'Off'
      badge.className = `badge ${enabled ? 'good' : 'neutral'}`

      log(`${channel.toUpperCase()} reported ${enabled ? 'ON' : 'OFF'}`)
      return
    }

    let channel
    if (topic === 'telemetry/ch1') channel = 'ch1'
    else if (topic ==='telemetry/ch2') channel = 'ch2'
    else return

    try {
      const readings = JSON.parse(message.toString())
      const { vrms, irms, p, q, s, pf, freq } = readings
      function show(id, value) {
          const element = $(id)
          if (element) {
            element.textContent = Number.isFinite(value) ? value.toFixed(2) : '—'
          }
        }
      show(`${channel}-voltage`, vrms)
      show(`${channel}-current`, irms)
      show(`${channel}-power`, p)
      show(`${channel}-frequency`, freq)

      show(`p_${channel}`, p)
      show(`q_${channel}`, q)
      show(`s_${channel}`, s)
      show(`pf_${channel}`, pf)

      console.log(`${channel.toUpperCase()} readings:`, readings)

      const history = channel === 'ch1' ? ch1History : ch2History

      if ([vrms, irms, p].every(Number.isFinite)) {
        history.push({ time: Date.now(), vrms, irms, p, f: freq })
        if (history.length > max_readings) history.shift()

        drawChannelHistory(channel)
      }

      drawPowerTriangle(p, q, channel)

    }catch (error){
      console.error('Invalid telemetry:', error)
    }
  })

  // Show errors reported by the MQTT client
  client.on('error', (error) => {
    setStatus(`MQTT error: ${error.message}`, 'bad')
    log(`MQTT error: ${error.message}`)
  })

  // When the connection closes, reset the buttons for another attempt
  client.on('close', () => {
    client = null

    // Disable relay controls and clear their displayed states
    document.querySelectorAll('.channel-command').forEach(button => {
      button.disabled = true
    })

    for (const channel of ['ch1', 'ch2']) {
      const badge = $(`${channel}-state`)
      badge.textContent = 'Unknown'
      badge.className = 'badge neutral'
    }

    $('connect-btn').disabled = false
    $('disconnect-btn').disabled = true
    setStatus('Broker disconnected', 'bad')
  })
}

// Wire up the dashboard buttons
$('connect-btn').addEventListener('click', connect)

// Close the connection if a client exists
$('disconnect-btn').addEventListener('click', () => client?.end(true))

// Remove all entries from the Event Log  
$('clear-log').addEventListener('click', () => $('event-log').replaceChildren())


// Draw empty axes using the same limits used for live updates
drawChannelHistory('ch1')
drawChannelHistory('ch2')

// Publish a command when a relay button is clicked
document.querySelectorAll('.channel-command').forEach(button => {
  button.addEventListener('click', () => {
    if (!client?.connected) {
      $('notice').textContent = 'Connect to the broker first.'
      return
    }

    const channel = button.dataset.channel
    const command = button.dataset.enabled === 'true' ? '1' : '0'

    client.publish(
      `command/${channel}`,
      command,
      { retain: false, qos: 0 },
      error => {
        if (error) {
          log(`Could not send command: ${error.message}`)
          return
        }

        log(`${channel.toUpperCase()} command sent: ${command}`)
      }
    )
  })
})