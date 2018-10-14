import Debugger from './Debugger.module.js'
import ProgramStateUIRouter from './ProgramStateUIRouter.module.js'

var $ = jQuery

// Issue debugger commands when elements with a `data-command` attribute are clicked
$(document).on('click', '[data-command]', function (e) {
  var commandName = $(e.currentTarget).attr('data-command')
  Debugger.command(commandName)
})

// Open files when elements with a `data-open-file` attribute are clicked
$(document).on('click', '[data-open-file]', function (e) {
  ProgramStateUIRouter.setFile($(e.currentTarget).attr('data-open-file'))
})
