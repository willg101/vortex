import ProgramStateUIRouter from './ProgramStateUIRouter.module.js'

var $ = jQuery

/**
 * @brief
 *	Update the stack window contents as needed
 */
subscribe('program-state-ui-refresh-needed', (e) => {
  $('.stack-row.active').removeClass('active')

  if (e.stackPos < 0) // A stack frame is not currently being shown
  {
    return
  }

  var stack = e.programState.stack
  $('#stack').html(render('debugger.stack_frame', { frames: stack.frames }))
    .find(`[data-stack-depth=${e.stackPos}]`)
    .addClass('active')
  $('#stack_depth').text(stack.depth)
})

/**
 * @brief
 *	Handle click events on the buttons in the stack window
 */
$(document).on('click', '.stack-row', function (e) {
  var stackDepth = $(e.currentTarget).attr('data-stack-depth')
  ProgramStateUIRouter.setStackPosition(stackDepth)
})
