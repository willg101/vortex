import File from './File.module.js'
import RecentFiles from './RecentFiles.module.js'
import sessionBreakpoints from './SessionBreakpoints.module.js'
import LanguageAbstractor from './LanguageAbstractor.module.js'
import Debugger from './Debugger.module.js'
import RemoteFiles from './RemoteFiles.module.js'
import VariableExpressionParser from './VariableExpressionParser.module.js'

export default { getCurrentFileShowing }

var $ = jQuery

var editor = null
var activeLineMarker = ''
var currentLineNum = false
var currentFile = false
var Range = ace.require('ace/range').Range
var commandStopwatchTimeout
var currentCodebase = {}

subscribe('vortex-init', function () {
  // We'll get all sorts of errors if the element we need isn't available...
  if (!$('#editor').length) {
    return
  }

  $(vTheme.getSpinner()).appendTo('.command-timer .spinner')

  var data = {
    options: {
      theme: 'solarized_light',
      language: LanguageAbstractor.getLanguageNameForEditor()
    }
  }
  publish('alter-editor-options', data) // Allow other modules to change theme and language

  editor = ace.edit('editor')
  editor.setTheme('ace/theme/' + data.options.theme)
  editor.session.setMode('ace/mode/' + data.options.language)
  editor.setOption('showPrintMargin', false)
  editor.on('guttermousedown', function (e) {
    // Ensure a line number cell was clicked (this should always be true)
    var target = e.domEvent.target
    if (target.className.indexOf('ace_gutter-cell') == -1) {
      return
    }

    var line = e.getDocumentPosition().row + 1
    var file = currentCodebase.id && currentCodebase.root
      ? File.convertToCodebaseRelativePath(currentFile, currentCodebase.id, currentCodebase.root)
      : currentFile

    // Middle button or right button
    if (!$(target).is('.ace_breakpoint:not(.conditional-breakpoint)') &&
      (e.domEvent.button == 1 || e.domEvent.button == 1 & 2 ||
        e.domEvent.button == 2 || e.domEvent.button == 1 & 3)) {
      e.domEvent.preventDefault()
      var currentBp  = sessionBreakpoints.get(file, line)
      var expression = ( currentBp && currentBp.expression ) || ''
      vTheme.showModal('Conditional Breakpoint', render('debugger.conditional_bp_modal', {
        line: line,
        file: file,
        expression: expression
      }))
      setTimeout(function () { $('.bp-expression-input').focus() }, 30)
    } else {
      sessionBreakpoints.toggle(file, line)
    }
  })
  editor.setReadOnly(true)
  publish('editor-ready', { editor })
})

// Listen for the `enter` key on breakpoint expression input
$(document).on('keypress', '.bp-expression-input', function (e) {
  // If enter was pressed (and not enter + ctl/shift/cmd)
  if (e.which == 13 && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
    e.preventDefault()
    var expression = $(e.target).text()
    var line = $(e.target).attr('data-lineno')
    var file = $(e.target).attr('data-file')

    vTheme.hideModal()
    sessionBreakpoints.del(file, line)
    sessionBreakpoints.create(file, line, expression)
  }
})

$(document).on('click', '.nested-codebase-indicator', function() {
  vTheme.showModal('Nested Codebases', render('debugger.nested_codebases_modal'));
});

// Update how a breakpoint from the currently showing file is displayed
subscribe('breakpoint-state-change', function (e) {
  var file = File.stripScheme(getCurrentFileShowing())
  if (currentCodebase.id && currentCodebase.root && File.isCodebaseRelative(e.breakpoint.file)) {
    let realPath = File.convertFromCodebaseRelativePath(e.breakpoint.file, currentCodebase.id,
      currentCodebase.root)
    if (File.stripScheme(realPath) != file) {
      return
    }
  } else if (File.stripScheme(e.breakpoint.file) != file) { // Non-codebase-relative path
    return
  }

  updateBreakpointDisplay(e.breakpoint)
})

// Show and start the command timer when the DE begins executing a continuation command
subscribe('before-send', function (data) {
  if ((data.alterData.command || '').match(/^(step_|run)/)) {
    showCommandTimer()
  }
})

// Hide the command timer when the DE finishes executing a continuation command
subscribe('response-received', function (e) {
  if (e.parsed && e.parsed.isContinuation) {
    hideCommandTimer()
  }
})

// Resize the editor whenever the code window is resized
subscribe('layout-changed', function () {
  if (editor) {
    editor.resize()
  }
})

// Reload the current file
$(document).on('click', '.refresh-file', function (e) {
  if (!currentFile) {
    return
  }

  var target = $(e.target).closest('button').css('visibility', 'hidden')
  var spinner = $(vTheme.getSpinner())
    .css('position', 'absolute')
    .appendTo('.file-bar')
    .position({
      my: 'center',
      at: 'center',
      of: target
    })
  showFile(currentFile, false, function () {
    spinner.remove()
    target.css('visibility', '')
  }, true, editor.session.getScrollTop(), true)
})

// Show the "Clear all breakpoints" option in the "Quick Actions" menu
subscribe('alter-settings-quick-actions', function (e) {
  e.items.unshift({
    content: 'Clear all breakpoints',
    attr: {
      'data-action': 'clear-all-breakpoints'
    }
  })

  $(document).on('click', '[data-action=clear-all-breakpoints]',
    sessionBreakpoints.clearAll.bind(sessionBreakpoints))
})

// Open the file finder menu when ctrl+O is pressed
// TODO: Create key binding layer?
$(document).on('keyup', function (e) {
  if (e.which == 'O'.charCodeAt(0) && e.ctrlKey) {
    $('#file_finder').click().focus()
  }
})

// When the code editor is finished initializing, set up the feature for hovering variables to
// preview their values
subscribe('editor-ready', function (e) {
  var session = e.editor.session
  var lastHighlightedExpr
  var lastHighlightedMarker
  var showPopoverTimeout

  // Clears the preview popover
  function clearPopover () {
    if (typeof lastHighlightedMarker !== 'undefined') {
      session.removeMarker(lastHighlightedMarker)
    }
    lastHighlightedExpr = ''
    clearTimeout(showPopoverTimeout)
    $('.current-value').removeClass('showing')
  }

  e.editor.on('mousemove', function (e) {
    var TokenIterator = ace.require('./token_iterator').TokenIterator
    var pos = e.getDocumentPosition()
    var hovered = Debugger.sessionIsActive() &&
      VariableExpressionParser.getContainingExpression(
        new TokenIterator(session, pos.row, pos.column))

    if (!hovered) { // No variable expression was hovered
      clearPopover()
    } else if (hovered.expr != lastHighlightedExpr) { // A new variable expression was hovered
      if (typeof lastHighlightedMarker !== 'undefined') {
        clearPopover()
      }

      lastHighlightedExpr = hovered.expr
      lastHighlightedMarker = session.addMarker(hovered.range, 'var-expr-hover', 'text')
      clearTimeout(showPopoverTimeout) // Debounce

      showPopoverTimeout = setTimeout(async function () {
        Debugger.command('feature_set', { name: 'max_depth', value: 10 })
        var data = await Debugger.command('eval', lastHighlightedExpr)
        Debugger.command('feature_set', { name: 'max_depth', value: 1 })
        var sel = '.current-value .tree-container'

        if (data.parsed.value && data.parsed.value.length) {
          data.parsed.value.forEach(function (item) {
            item.name = item.name || ''
            item.fullname = item.fullname || ''
          })

          $('.current-value').addClass('showing')
            .appendTo('body')
            .position({
              my: 'left top',
              at: 'left bottom',
              of: $('.var-expr-hover')
            })
            .find('.tree-container')
            .html('<i class="fa fa-spin fa-circle-notch"></i>')

          setTimeout(function () {
            $('.current-value .tree-container')
              .html('')
              .vtree(data.parsed.value)
          }, 30)
        } else if (data.parsed.message) {
          var message = $('<div>').text(data.parsed.message).html()
          message = '<span class="debugger-message">' + message + '</span>'
          $(sel).html(message)
        } else {
          $(sel).html('<span class="no-debugger-message">Empty response ' +
            'received</span>')
        }
      }, 500)
    }
  })
})

// When a debug session ends, hide the command timer and un-highlight the active line
subscribe('session-status-changed', function (e) {
  if (e.status != 'active') {
    clearCurrentLineIndicator()
    hideCommandTimer()
  }
})

// Update which file we're showing in response to program state changes
subscribe('program-state-ui-refresh-needed', (e) => {
  showFile(e.file, e.line != -1 ? e.line : undefined)
})

/**
 * @return string
 *  The full URI of the current file
 */
function getCurrentFileShowing () {
  return currentFile
}

/**
 * @brief
 *  Updates the display of a breakpoint
 *
 * @param Breakpoint breakpoint
 */
function updateBreakpointDisplay (breakpoint) {
  var line = breakpoint.line - 1 // ace line numbers are 0-indexed
  editor.getSession().clearBreakpoint(line)
  editor.getSession().removeGutterDecoration(line, 'pending-breakpoint')
  editor.getSession().removeGutterDecoration(line, 'conditional-breakpoint')

  var decorationName = false
  switch (breakpoint.state) {
    case 'confirmed' : // fall through
    case 'offline' :
      decorationName = breakpoint.type == 'line' ? 'default' : 'conditional'
      break

    case 'pending' :
      decorationName = 'pending'
      break

    case 'removed' :
      // Do nothing (and do not enter `default` case)
      break

    default:
      throw new Error('Invalid state: ' + breakpoint.state)
  }

  if (decorationName) {
    editor.getSession().setBreakpoint(line)
    if (decorationName != 'default') {
      editor.getSession().addGutterDecoration(line, decorationName + '-breakpoint')
    }
  }
}

/**
 * @brief
 *  Gets a file from the server and displays it
 *
 * @param sring    filename             Absolute path of the file
 * @param int      line                 Optional; 1-indexed line number to highlight (indicates
 *                                      the current instruction)
 * @param function cb                   Optional; called after the file is loaded and
 *                                      displayed. This function is passed three arguments:
 *                                       - The filename
 *                                       - The line number (or undefined)
 *                                       - The file's contents
 * @param bool     skipCache            Force the file to be loaded from the server
 * @param int      scrollTop            Optional; when given, overrides `line` param; the
 *                                      position to set the editor's scrollTop to
 * @param bool     noClearActiveLine    Don't clear the current line indicator (for refreshing
 *                                      the editor)
 */
async function showFile (filename, line, cb, skipCache, scrollTop, noClearActiveLine) {
  if (scrollTop || !line || !(line = Number(line)) || line % 1 != 0 || line < 1) {
    line = undefined
  }

  filename = File.stripScheme(filename)

  try {
    var data = await RemoteFiles.get(filename, skipCache)
    RecentFiles.push(data)
  } catch (e) {
    vTheme.notify('error', 'The file <b>' + File.basename(filename) + '</b> failed to load')
    return
  }

  if (data.codebaseRoot && data.codebaseId) {
    currentCodebase = {
      root: data.codebaseRoot,
      id: data.codebaseId
    }
  } else {
    currentCodebase = {}
  }

  if (data.isNestedCodebase) {
    $('.nested-codebase-indicator').show();
  } else {
    $('.nested-codebase-indicator').hide();
  }

  var text = data.contents
  if (currentFile != filename || skipCache) {
    editor.setValue(text, -1)
    $('#filename').text(File.basename(filename))
    if (text.match(/^<\?php \/\* dpoh: ignore \*\//)) {
      $('#filename').prepend('<span class="fa fa-low-vision"></span> ')
    }
    editor.resize(true)
    currentFile = filename
  }

  if (!noClearActiveLine && activeLineMarker) {
    editor.session.removeMarker(activeLineMarker)
    editor.getSession().removeGutterDecoration(currentLineNum - 1, 'gutter-current-line')
  }

  if (line) {
    if (Debugger.sessionIsActive()) {
      activeLineMarker = editor.session.addMarker(new Range(line - 1, 0, line - 1, 1),
        'ace-current-line', 'fullLine')
      editor.getSession().addGutterDecoration(line - 1, 'gutter-current-line')
    }
    editor.scrollToLine(line, true, true, function () {})
    currentLineNum = line
  } else {
    editor.scrollToLine(1, true, true, function () {})
  }

  showBreakpointsForFile()

  if (typeof cb === 'function') {
    cb(filename, line, text)
  }

  editor.session.setScrollTop(scrollTop)
}

function clearCurrentLineIndicator () {
  editor.session.removeMarker(activeLineMarker)
  editor.getSession().removeGutterDecoration(currentLineNum - 1, 'gutter-current-line')
  hideCommandTimer()

  activeLineMarker = false
  currentLineNum = false
}

function showBreakpointsForFile () {
  editor.session.clearBreakpoints()
  var file = getCurrentFileShowing()
  if (currentCodebase.id && currentCodebase.root) {
    file = File.convertToCodebaseRelativePath(file, currentCodebase.id, currentCodebase.root)
  }
  var fileBps = sessionBreakpoints.listForFile(file)
  for (let line in fileBps) {
    updateBreakpointDisplay(fileBps[ line ])
  }
}

function showCommandTimer () {
  clearTimeout(commandStopwatchTimeout)
  if (!$('.command-timer:visible').length && Debugger.sessionIsActive()) {
    $('.command-timer')
      .removeClass('inactive')
      .find('.timer')
      .stopwatch('start')
  }
}

function hideCommandTimer () {
  clearTimeout(commandStopwatchTimeout)
  commandStopwatchTimeout = setTimeout(function () {
    $('.command-timer').addClass('inactive')
      .find('.timer')
      .stopwatch('stop')
  }, 50) // Debounce cases in which a series of stop/start continuations are issued rapidly
}
