import File from './File.module.js'
import LanguageAbstractor from './LanguageAbstractor.module.js'
import ProgramStateUIRouter from './ProgramStateUIRouter.module.js'

const DELALYED_REFRESH_INTERVAL_MS = 1000

var $ = jQuery

// $.type( async function(){} ) returns 'object', not 'function', and this messes up calls like
// $( '#console' ).terminal( async function( command, term ){ ... } ). Let's fix that.
var AsyncFunction = async function () {}.constructor
var oldMethod = $.type
$.type = function (item) {
  if (typeof item === 'function' && item instanceof AsyncFunction) {
    return 'function'
  }
  return oldMethod.call($, item)
}

var stateRefreshTimeout = null

/**
 * Control the console output for a single command
 */
class ConsoleCommandDisplay {
  /**
   * @param jQueryTerminal term
   */
  constructor (term) {
    this.id = 'ccd_' + this.constructor.id_ctr++
    var innerFn = () => `<div id="${this.id}"></div>`
    term.echo(() => innerFn(), { raw: true })

    this.element = $(`#${this.id}`)
    this.spinner = $('<i class="fa fa-spin fa-circle-notch"></i>')
    this.element.append(this.spinner)
  }

  /**
   * @param string text
   * @param string level ('error' is the only non-default value accepted right now)
   * @return jQuery
   */
  makeText (text, level) {
    return $('<div>').text(text).css('color', level == 'error' ? '#f46242' : '')
  }

  /**
   * @brief
   *  Append a line of output
   *
   * @param string text
   * @param string level @see makeText()
   */
  append (text, level) {
    this.element.append(this.makeText(text, level))
  }

  /**
   * @brief
   *  Prepend a line of output
   *
   * @param string text
   * @param string level @see makeText()
   */
  prepend (text, level) {
    this.element.prepend(this.makeText(text, level))
  }

  /**
   * @param jQuery|string replacement
   */
  replaceSpinner (replacement) {
    this.spinner.after(replacement).remove()
  }

  removeSpinner () {
    this.spinner.remove()
  }
}

/**
 * @brief
 *  Trigger a state refresh after at least DELALYED_REFRESH_INTERVAL_MS milliseconds
 *
 * This helps us avoid making the console trigger a bunch of overlapping state refreshes
 */
function performDelayedStateRefresh () {
  clearTimeout(stateRefreshTimeout)
  stateRefreshTimeout = setTimeout(() => ProgramStateUIRouter.refreshState(),
    DELALYED_REFRESH_INTERVAL_MS)
}

// If a state refresh occurs during a timeout period intiated by performDelayedStateRefresh(),
// cancel the now-unnecessary timeout
subscribe('program-state-ui-refresh-needed', (e) => {
  clearTimeout(stateRefreshTimeout)
})

ConsoleCommandDisplay.id_ctr = 0

// Initialize the console
subscribe('vortex-init', function () {
  $('#console').terminal(async function (command, term) {
    term.pause()

    var display = new ConsoleCommandDisplay(term)
    var result = await LanguageAbstractor.evalCommand(command, display)

    if (result.message) {
      display.removeSpinner()
      display.append(result.message, result.status)
    } else {
      display.replaceSpinner($('<div>').vtree(result.return_value))
    }

    performDelayedStateRefresh()

    term.resume()
  },

  $.extend(LanguageAbstractor.getConsoleInfo(), {
    name: 'console',
    enabled: false
  }))

  $.terminal.defaults.formatters.push(LanguageAbstractor.getConsoleFormatter())

  // jQuery Terminal's handling of resizing, in which all messages are re-rendered, does not
  // work well with jsTree, and tends to crash. Since we wouldn't gain much benefit from this
  // feature even if it did work, let's just disable it.
  $('#console').resizer('unbind')
})

// Focus the console when the console window is clicked
$(document).on('click', '#console_container', function () {
  $('#console').terminal().enable()
})
