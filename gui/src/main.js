import './style.css'
import mqtt from 'mqtt'

// Shortcut for finding an HTML element by its id
const $ = (id) => document.getElementById(id)

// Holds the current MQTT client ---- null means there is no active client
let client = null

// Add a message at the top of the Event Log
function log(message) {
  const item = document.createElement('li')
  item.textContent = message
  $('event-log').prepend(item)
}

// Update the broker badge and the notice below the connection form.
// The type (good, bad, or neutral) selects the badge color in CSS.
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
      console.log('CH1 readings:', readings)
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

// Close the connection if a client exists.
$('disconnect-btn').addEventListener('click', () => client?.end(true))

// Remove all entries from the Event Log.
$('clear-log').addEventListener('click', () => $('event-log').replaceChildren())