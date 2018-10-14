$(window).on('load', function () {
  publish('layout-changed')
  $('.splash-outermost').addClass('out')
    .find('.full').addClass('stop')

  var i = 12
  $('[data-role=window]').each(function () {
    setTimeout(function () {
      $(this).removeClass('not-loaded')
    }.bind(this), i * 50)
    i++
  })
})

$(document).on('transitionend', '.splash-outermost', function (e) {
  $(e.target).remove()
})
