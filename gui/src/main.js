import './style.css'
import mqtt from 'mqtt'

// Shortcut for finding an HTML element by its id
const $ = (id) => document.getElementById(id)

// Holds the current MQTT client ( null means there is no active client)
let client = null

const ch1History = []
const max_readings = 60

function drawhistory(canvasid, field, unit, min, max){
  const canvas = $(canvasid)
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

  if (ch1History.length === 0) return

  const firstTime = ch1History[0].time
  const lastTime = ch1History[ch1History.length - 1].time
  const duration = lastTime - firstTime

  ctx.textAlign = 'right'
  ctx.fillText(`${(duration / 1000).toFixed(1)} s`, right, bottom + 18)

  ctx.strokeStyle = '#60d5b4'
  ctx.fillStyle = '#60d5b4'
  ctx.lineWidth = 2
  ctx.beginPath()

  ch1History.forEach((sample, index) => {
    const x = duration
      ? left + (sample.time - firstTime) / duration * (right - left)
      : (left + right) / 2
    const y = bottom - (sample[field] - min) / (max - min) * (bottom - top)

    if (ch1History.length === 1) {
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.fill()
    } else if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })

  if (ch1History.length > 1) ctx.stroke()
  
}

function drawPowerTriangle(p, q) {
  const vectors = $('triangle-vectors')

  if (!Number.isFinite(p) || !Number.isFinite(q) || p < 0) {
    vectors.setAttribute('visibility', 'hidden')
    $('triangle-note').textContent = 'Cannot plot this reading.'
    return
  }

  const x0 = 45
  const y0 = 150

  const scale = Math.min(
    330 / Math.max(p, 1),
    110 / Math.max(Math.abs(q), 1)
  )

  const x = x0 + p * scale
  const y = y0 - q * scale // En SVG Y aumenta hacia abajo

  function setLine(id, x1, y1, x2, y2) {
    const line = $(id)
    line.setAttribute('x1', x1)
    line.setAttribute('y1', y1)
    line.setAttribute('x2', x2)
    line.setAttribute('y2', y2)
  }

  setLine('p-vector', x0, y0, x, y0) // P: horizontal
  setLine('q-vector', x, y0, x, y)   // Q: vertical
  setLine('s-vector', x0, y0, x, y)  // S: diagonal

  function setLabel(id, labelX, labelY, visible) {
    const label = $(id)
    label.setAttribute('x', labelX)
    label.setAttribute('y', labelY)
    label.setAttribute('visibility', visible ? 'visible' : 'hidden')
  }

  setLabel('p-label', (x0 + x) / 2, y0 + 16, p !== 0)
  setLabel('q-label', x + 8, (y0 + y) / 2, q !== 0)
  setLabel('s-label', (x0 + x) / 2, (y0 + y) / 2 - 8, q !== 0)

  vectors.setAttribute('visibility', 'visible')
  $('triangle-title').textContent = 'Channel 1 power triangle'
  $('triangle-note').textContent = q === 0
    ? 'Channel 1 · Q = 0 var'
    : 'Channel 1 · Live measurements'
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

    client.subscribe('telemetry/ch1',(error, granted) => {
      if (error || !granted?.length || granted[0].qos >= 128) {
        console.error('Subscription failed:', error || granted)
        return
      }
      console.log('Listening on telemetry/ch1')
    })
  })

  client.on('message', (topic, message) => {
    if (topic !='telemetry/ch1') return

    try {
      const readings = JSON.parse(message.toString())
      $('ch1-voltage').textContent = readings['vrms'].toFixed(2)
      $('ch1-current').textContent = readings['irms'].toFixed(2)
      $('ch1-power').textContent = readings['p'].toFixed(2)
      $('p_ch1').textContent = readings['p'].toFixed(2)
      $('q_ch1').textContent = readings['q'].toFixed(2)
      $('s_ch1').textContent = readings['s'].toFixed(2)
      $('pf_ch1').textContent = readings['pf'].toFixed(2)
      $('f_ch1').textContent = readings['f'].toFixed(2)

      console.log('CH1 readings:', readings)
      ch1History.push({
        time: Date.now(),
        vrms: readings.vrms,
        irms: readings.irms,
        p: readings.p
      })

      if(ch1History.length > max_readings) 
        ch1History.shift()

      drawhistory('ch1-voltage-chart', 'vrms', 'V', 0, 150)
      drawhistory('ch1-current-chart', 'irms', 'A', 0, 12)
      drawhistory('ch1-power-chart', 'p', 'W', 0, 1500)

      drawPowerTriangle(readings.p, readings.q)

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


drawhistory('ch1-voltage-chart', 'vrms', 'V', 0, 150)
drawhistory('ch1-current-chart', 'irms', 'A', 0, 12)
drawhistory('ch1-power-chart', 'p', 'W', 0, 1500)

drawhistory('ch2-voltage-chart', 'vrms', 'V', 0, 150)
drawhistory('ch2-current-chart', 'irms', 'A', 0, 12)
drawhistory('ch2-power-chart', 'p', 'W', 0, 1500)