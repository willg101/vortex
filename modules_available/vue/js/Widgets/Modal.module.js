var selectors = {
  overlay: '.modal-overlay',
  title: '.modal-title',
  exit_button: '.modal-exit',
  modal: '.modal',
  modal_content: '.modal-content',
  blurable: '.blurable',
  open_modal: '[data-modal-role=open]'
}

vTheme.showModal = (title, content) => {
  $(selectors.title).html(title || '')
  $(selectors.modal_content).html(content || '')

  $(selectors.overlay).fadeIn()
  $(selectors.modal).removeClass('modal-hidden')
  $(selectors.blurable).addClass('blurred')
}

vTheme.hideModal = function () {
  $(selectors.overlay).fadeOut()
  $(selectors.modal).addClass('modal-hidden')
  $(selectors.blurable).removeClass('blurred')
}

$(document).on('click', function (e) {
  if (($(e.target).closest(selectors.modal).length &&
    !$(e.target).closest(selectors.exit_button).length) ||
    $(e.target).closest(selectors.open_modal).length ||
    !$(e.target).closest('body').length) {
    return
  }
  vTheme.hideModal()
})
