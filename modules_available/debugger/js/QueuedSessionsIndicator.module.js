import Debugger from './Debugger.module.js'
import File from './File.module.js'
import WsClient from './WsClient.module.js'
import LanguageAbstractor from './LanguageAbstractor.module.js'

export default { getCurrentCodebase, getSessionId }

var knownSessions = []
var sessionId = ''

subscribe('connection-status-changed', function onConnectionStatusChanged (e) {
  var indicator = $('#connection_queue_indicator')
  if (e.status == 'connected') {
    Debugger.command('X-ctrl:peek_queue')
    indicator.removeClass('no-connection')
  } else {
    indicator.addClass('no-connection').find('.n').html('<i class="fa fa-times">')
  }
})

subscribe('session-status-changed', function () {
  Debugger.command('X-ctrl:peek_queue')
})

async function getCurrentCodebase () {
  for (let i in knownSessions) {
    if (knownSessions[ i ].active) {
      return LanguageAbstractor.getCodebaseRoot(knownSessions[ i ].file)
    }
  }
  return null
}

subscribe('server-info', function (e) {
  if (e.jq_message.is('[type=peek_queue]')) {
    knownSessions = []
    sessionId = ''
    e.jq_message.find('queuedsession').each(function () {
      var self = $(this)
      sessionId = self.attr('connection_id')
      if (!sessionId) {
        return
      }

      var file = self.attr('path') || '(Unknown file)'
      knownSessions.push({
        id: sessionId,
        active: self.attr('active') == 'true',
        uuid: self.attr('uuid'),
        host: self.attr('host'),
        codebase_id: self.attr('codebase_id'),
        codebase_root: self.attr('codebase_root'),
        file: file.replace(/^file:\/\//, '')
      })
    })

    var indicator = $('#connection_queue_indicator')
    indicator.find('.n').text(knownSessions.length)
    if (knownSessions.length) {
      indicator.removeClass('inactive')
    } else {
      indicator.addClass('inactive')
    }
  } else if (e.jq_message.is('[type=detach_queued_session]')) {
    Debugger.command('X-ctrl:peek_queue')
  }
})

subscribe('session-switched', function () {
  Debugger.command('X-ctrl:peek_queue')
})

$(document).on('click', '[data-detach-session]', function (e) {
  var cid = $(e.currentTarget).attr('data-detach-session')
  WsClient.send('X-ctrl:detach_queued_session -s ' + cid)
})

$(document).on('click', '#connection_queue_indicator:not(.no-connection)', function () {
  var items = ''
  if (knownSessions.length) {
    for (var i in knownSessions) {
      let data = {
        host: knownSessions[ i ].host,
        id: knownSessions[ i ].id,
        active: knownSessions[ i ].active,
        content: File.basename(knownSessions[ i ].file),
        file: File.basename(knownSessions[ i ].file),
        img: GeoPattern.generate(knownSessions[ i ].uuid).toDataUrl(),
        attr: {
          'data-switch-to-session': knownSessions[ i ].id
        }
      }
      items += render('debugger.item', data)
    }
  }
  showPopover(items)
})

$(document).on('click', '[data-switch-to-session]', function (e) {
  if ($(e.target).closest('tr.active').length) {
    return
  }
  var sessionId = $(e.target).closest('[data-switch-to-session]').attr('data-switch-to-session')
  Debugger.command('X-ctrl:switch_session -s ' + sessionId)
})

function getSessionId () {
  return sessionId
}

function showPopover (renderedItems) {
  var content = ''
  var classes = []
  if (renderedItems) {
    content = `<h2>Active Sessions</h2><table class="session-table">${renderedItems}</table>`
    classes = [ 'no-padding' ]
  } else {
    content = '<h2 class="swallow-margin">Active Sessions</h2><i>No active sessions</i>'
  }
  new vTheme.Popover(content, classes, {
    my: 'right top',
    at: 'right bottom',
    of: $('#connection_queue_indicator')
  }, $('#connection_queue_indicator'))
}
