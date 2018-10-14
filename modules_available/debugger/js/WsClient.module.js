export default { send,
  openConnection,
  isConnected,
  getConnection,
  onMessageReceived,
  registerTypeDeterminer,
  registerMessageProcessor }

/**
 * @file
 *	Communicate with the socket server
 *
 * @note 'Web Socket' is frequently abbreviated in this file as 'WS'
 */

// A reference to the current websocket connection
var currentConnection = null

// The path (relative to location.host) to send initial WS requests to
var wsPath = '/bridge'

var identifier = 0

// The initiator of a socket server message can opt to have a function called automatically
// when a response is received for that particular message, though whatever mechanism that
// generates the response on the server must support transcation ids (the Xdebug debugger
// engine does, for example). This object maps transaction ids to respective callbacks
var transactionCallbacks = {}

// tid => promise
var promises = {}

// A list of functions that help determine what type of response was received from the server.
// See determineMessageType() for more information.
var typeDeterminers = []

// A list of functions that process messages from the socket server. See processMessage() for
// more information.
var messageProcessors = []

// As we receive data from the socket server, especially when receiving the data in bursts, the
// messages may get split up or multiple messages may get combined into one. In the case where
// messages get broken up between multiple communications, these variables keep track of the
// current expected message length and message text
var pendingData = ''
var pendingDataLength

const NULL_CHAR = String.fromCharCode(0)

/**
 * @brief
 *	Handles the changing of a WS connection status and fires an appropriate event
 *
 * @param string newStatus
 *	One of 'connected', 'disconnected', or 'error'
 */
function onConnectionStatusChanged (newStatus) {
  // Unless we're now connected, drop the our reference to a now-nonexistent WS
  if (newStatus != 'connected') {
    currentConnection = null
  }

  publish('connection-status-changed', {
    status: newStatus
  })
}

/**
 * @brief
 *	Attempts to open a WS connection
 *
 * @param object params HTTP GET params to include with the request
 *
 * @return bool
 *	true if the connection was attempted; false if not (a connection already exists)
 */
function openConnection (params) {
  // Allow connections to be aborted by other modules
  var options = { 'abort': false }
  publish('attempt-connection', { options, params })
  if (options.abort) {
    return
  }

  // Don't open a new connection if one is currently open
  if (currentConnection) {
    return false
  }

  var wsUrl = (location.protocol == 'http:' ? 'ws://' : 'wss://') + location.host + wsPath
  if (params) {
    wsUrl += '?' + $.param(params)
  }
  currentConnection = new WebSocket(wsUrl)

  currentConnection.onclose = onConnectionStatusChanged.bind(undefined, 'disconnected')
  currentConnection.onerror = onConnectionStatusChanged.bind(undefined, 'error')
  currentConnection.onmessage = onMessageReceived

  return true
}

/**
 * @brief
 *	Sends a command to the socket server
 *
 * @param string name The command to send
 * @param mixed  ...  Any 3 of the following:
 *                     - An object whose key/value pairs are args for the command
 *                     - A string of additional data to include with the command
 *                     - A function to handle the socket server's response (requires transaction
 *                       id support from the server)
 */
function send (command) {
  if (!isConnected()) {
    return false
  }

  var commandArgs = {}

  var data = ''

  var callback = null

  var tid = identifier++

  var maxArgs = Math.min(4, arguments.length)

  for (var i = 1; i < maxArgs; i++) {
    switch (typeof arguments[ i ]) {
      case 'string' : data = arguments[ i ]; break
      case 'object' : commandArgs = arguments[ i ]; break
      case 'function' : callback = arguments[ i ]; break
    }
  }

  // If applicable, associate the given callback with this command's transaction id so that we
  // can call it when the socket server responds to the command specifically
  if (typeof callback === 'function') {
    transactionCallbacks[ tid ] = callback
  }

  if (typeof commandArgs.i === 'undefined') {
    commandArgs.i = tid
  }

  for (var arg in commandArgs) {
    command += (arg.length == 1 ? ' -' : ' --') + arg + ' '
    command += typeof commandArgs[ arg ] === 'string'
      ? '"' + escapeDoubleQuotes(commandArgs[ arg ]) + '"'
      : commandArgs[ arg ]
  }

  // If applicable, base64 encode the additional data to include with the command
  if (data) {
    command += ' -- ' + btoa(data)
  }

  currentConnection.send(command)
  return new Promise(resolve => { promises[ tid ] = resolve })
}

/**
 * @brief
 *	Processes incoming messages from the socket server
 *
 * @param object data
 */
function onMessageReceived (data) {
  var message = data.data

  // Skip responses that contain no data
  if (!message) {
    return
  }

  for (var i = 0; i < message.length; i++) {
    var currentChar = message.charAt(i)
    if (currentChar == NULL_CHAR) {
      var asNumber = Number(pendingData)
      // If the string contained in pendingData looks like a non-zero integer
      if (asNumber && asNumber % 1 === 0) {
        pendingDataLength = asNumber
        pendingData = ''
      } else if (pendingData.length != pendingDataLength) {
        pendingData = ''
        pendingDataLength = false
        throw new Error('DPOH: Data length mismatch')
      } else {
        var tempMessage = pendingData
        pendingData = ''
        pendingDataLength = false
        processMessage(tempMessage)
      }
    } else {
      pendingData += currentChar
    }
  }
}

/**
 * @brief
 *	Processes incoming messages from the socket server
 */
function processMessage (message) {
  var jqMessage = $(message)
  if (jqMessage.is('[status=no_exclusive_access]')) {
    onConnectionStatusChanged('no-exclusive-access')
    return
  } else if (jqMessage.is('[status=connection_accepted]')) {
    onConnectionStatusChanged('connected')
    return
  }

  var type = determineMessageType(jqMessage)

  var processed = {
    jqMessage: jqMessage,
    message_raw: message,
    response_type: type
  }

  messageProcessors.forEach(function (cb) {
    cb(type, jqMessage, processed)
  })

  // Call the explicitly specified callback, if applicable
  var tid = processed.transactionId ||
		jqMessage.filter('[transaction_id]').attr('transaction_id')
  if (typeof transactionCallbacks[ parseInt(tid) ] === 'function') {
    transactionCallbacks[ Number(tid) ](processed)
  }

  if (promises[ Number(tid) ]) {
    promises[ Number(tid) ](processed)
    delete promises[ Number(tid) ]
  }

  return processed
}

/**
 * @brief
 *	Examines a message in order to determine its type (i.e., whether it indicates that a session
 *	has been initiated, a certain command has been processed, etc.)
 *
 * @param jQuery jqMessage
 *
 * @return string|false
 */
function determineMessageType (jqMessage) {
  var type
  for (var i in typeDeterminers) {
    type = tyddeterminers[ i ](jqMessage)
    if (type) {
      return type
    }
  }

  return 'unknown'
}

/**
 * @brief
 *	Adds a function to the list of type determiners
 *
 * @param function fn
 *	A function that receives a jQuery of message from the websocket, and optionally returns
 *	the type of message. The first such callback to return a non-false value determines the
 *	type of the message.
 */
function registerTypeDeterminer (fn) {
  if (typeof fn === 'function') {
    typeDeterminers.push(fn)
  } else {
    throw new Error('Expected a function; received ' + typeof fn)
  }
}

/**
 * @brief
 *	Adds a function to the list of message processors
 *
 * @param function fn
 *	A function that receives three arguments:
 *	 - A string indicating the message type
 *	 - A jQuery of message from the websocket
 *	 - An object in which processed data should be placed
 */
function registerMessageProcessor (fn) {
  if (typeof fn === 'function') {
    messageProcessors.push(fn)
  } else {
    throw new Error('Expected a function; received ' + typeof fn)
  }
}

/**
 * @return bool
 */
function isConnected () {
  return !!getConnection()
}

/**
 * @return WebSocket|null
 */
function getConnection () {
  return currentConnection
}
