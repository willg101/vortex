import Parsers from './Parsers.module.js'
import WsClient from './WsClient.module.js'
export default { sessionIsActive, command }

/**
 * @file
 *  Communicate with the debugger engine (DE) over a websocket (WS)
 *
 * A working knowledge of https://xdebug.org/docs-dbgp.php may help clarify some of the terminology
 * used in this file
 */

// Whether or not a session with the DE is currently active
var sessionIsActiveFlag = false

var responseParsers = Parsers.list()

function init () {
  WsClient.registerMessageProcessor(processMessage)
  WsClient.registerTypeDeterminer(determineMessageType)
}

subscribe('connection-status-changed', function (e) {
  if (e.status == 'error' || e.status == 'closed') {
    setActiveSessionStatus(false)
  }
})

/**
 * @brief
 *  Updates the flag for whether or not a session with the DE is currently active. If the call
 *  to this function actually alters the flag, an event is published
 *
 * @param bool sessionIsActiveLocal
 * @param bool isNewSession         ignored when `sessionIsActiveLocal` is true
 */
function setActiveSessionStatus (sessionIsActiveLocal, isNewSession) {
  if ((!!sessionIsActiveLocal) != sessionIsActiveFlag) {
    sessionIsActiveFlag = !sessionIsActiveFlag

    publish('session-status-changed', {
      status: sessionIsActiveFlag
        ? 'active'
        : 'inactive',
      isNewSession: sessionIsActiveLocal && isNewSession
    })
  }
}

var commandArgsConversion = {
  breakpoint: 'd',
  context: 'c',
  file: 'f',
  line: 'n',
  name: 'n',
  stackDepth: 'd',
  type: 't',
  value: 'v',
  transaction: 'i',
  pattern: 'p',
  maxData: 'm',

  session: 'Xs'
}

function translateArgs (argsObject) {
  var out = {}
  for (var niceName in argsObject) {
    if (typeof commandArgsConversion[ niceName ] === 'string') {
      if (argsObject[ niceName ] || argsObject[ niceName ] === 0) {
        out[ commandArgsConversion[ niceName ] ] = argsObject[ niceName ]
      }
    } else {
      throw new Error('Unrecognized argument "' + niceName + '"')
    }
  }

  return out
}

/**
 * @brief
 *  Sends a command to the DE
 *
 * @param string name The command to send, get 'context_get', 'eval'
 * @param mixed  ...  Any 3 of the following:
 *                     - An object whose key/value pairs are args for the command
 *                     - A string of additional data to include with the command
 *                     - A function to handle the debugger engine's response
 */
function command (name /*, ... */) {
  var commandArgs = {}

  var command = name

  var data = ''

  var callback

  var maxArgs = Math.min(4, arguments.length)

  for (var i = 1; i < maxArgs; i++) {
    switch (typeof arguments[ i ]) {
      case 'string' : data = arguments[ i ]; break
      case 'object' : commandArgs = arguments[ i ]; break
      case 'function' : callback = arguments[ i ]; break
    }
  }

  // Data that we'll include under the 'alterData' within the event object; this will allow
  // other entities to modify the command details
  var alterData = {
    allowSend: true,
    command: command,
    commandArgs: commandArgs,
    callback: callback,
    data: data
  }

  publish('before-send', { alterData })

  // Check if a recipient of the 'before-send' event prevented the data from being sent
  if (!alterData.allowSend) {
    return false
  }

  callback = alterData.callback
  command = alterData.command
  commandArgs = translateArgs(alterData.commandArgs)
  data = alterData.data

  return WsClient.send(command, commandArgs, data, callback)
}

/**
 * @return bool
 */
function sessionIsActive () {
  return sessionIsActiveFlag
}

/**
 * @brief
 *  A type determiner for WsClient
 */
function determineMessageType (message) {
  if (message.is('init')) {
    return 'init'
  } else if (message.is('response[command]')) {
    return 'debugger_command:' + message.filter('response:first').attr('command')
  } else if (message.is('wsserver')) {
    return 'server_info'
  }
}

/**
 * @brief
 *  A message processor for WsClient
 */
function processMessage (type, message, processed) {
  if (!type.match(/^(init$|server_info$|debugger_command:)/)) {
    return
  }

  type = type.replace(/^debugger_command:/, '')

  // Wrap the XML message in a jQuery in order to examinine it more easily, and then discard
  // info we don't need, such as the XML declaration
  var jqResponseElement = null
  message.each(function (i, el) {
    el = $(el)
    if (el.is('[command],init,[status]')) {
      jqResponseElement = el
      return false
    }
  })

  if (!jqResponseElement) {
    return
  }

  var isStopping = jqResponseElement.is('[status=stopping]')
  var isStopped = jqResponseElement.is('[status=stopped]')
  var sessionEnded = jqResponseElement.is('[status=session_end]')

  if (!jqResponseElement.is('[session-status-change=neutral]')) {
    setActiveSessionStatus(!(isStopping || isStopped || sessionEnded), type == 'init')
  }

  // The type of data for 'session-init' and 'response-received' events is nearly identical,
  // so we build it now
  $.extend(processed, {
    jqMessage: jqResponseElement,
    parsed: responseParsers[ type ] ? responseParsers[ type ](jqResponseElement) : {},
    isStopping: isStopping,
    isStopped: isStopped,
    sessionEnded: sessionEnded
  })

  // Publish the appropriate type of event
  if (type == 'init') {
    publish('session-init', processed)
  } else if (type == 'server_info') {
    publish('server-info', processed)
  } else {
    publish('response-received', processed)
  }
}

$(init)
