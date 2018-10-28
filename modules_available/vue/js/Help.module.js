
function showHelp() {
  if ( $('.help-text-rot').length )
  {
    hideHelp()
    return
  }
  $('#layout_in_use').css('filter','blur(5px)')
  var width = $(window).width()
  var maxHelpWidth = { right : 0, left : 0 }
  var added = $()
  $($('[data-help-text]').get().reverse()).each(function(i) {
    var self = $(this)
    var side = ( self.position().left > width/2 ) ? 'right' : 'left'
    var keys = (self.attr('data-keybinding-default') || '').replace('~', '').toUpperCase().split( /\s+/ ).filter(el => el)
    keys = keys.map(key => `<kbd>${key}</kbd>`).join(' ')
    var el = $(`<div class="help-text-rot help-hidden ${side}">` + self.attr('data-help-text') + ' ' + keys + '</div>' )
      .appendTo( 'body' )
      .css('position', 'absolute')
    el.data('parent', self)
    el.data('side', side)
    maxHelpWidth[side] = Math.max(el.width(), maxHelpWidth[side])
    added = added.add(el)
  })
  added.filter('.left').width(maxHelpWidth.left)
  added.filter('.right').width(maxHelpWidth.right)
  $('body').append('<div class="general-help-text"><h2>Like keyboard shortcuts?</h2> Hold down the '
    + 'spacebar and press the key shown next to any of the buttons above (e.g., <kbd>space</kbd> + <kbd>S</kbd>)</div>')
  added.each(function(i) {
      var el = $(this).position({
        collision : 'none',
        my : $(this).data('side') + ' top',
        at : `middle bottom-20px`,
        of : $(this).data('parent')
      })
    setTimeout( () => el.removeClass( 'help-hidden' ).css( 'transform', '' ), i * 30 )
  })
}

function hideHelp() {
  $('#layout_in_use').css('filter','')
  $('.general-help-text').remove()
  $(".help-text-rot").each( function(i) {
    setTimeout( () => $( this ).addClass( 'help-hidden' ).one( 'transitionend', () => $(this).remove() ), 30 * i )
  })
}

$( document ).on( 'click', '[data-role="show-help"]', showHelp )
$( document ).on( 'click', e => {
  if ( !$( e.target ).closest( '[data-role="show-help"]' ).length )
  {
    hideHelp()
  }
} )
