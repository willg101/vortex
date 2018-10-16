var selectors = {
  overlay: '.modal-overlay',
  title: '.modal-title',
  exitButton: '.modal-exit',
  modal: '.modal',
  modalContent: '.modal-content',
  blurable: '.blurable',
  openModal: '[data-modal-role=open]'
}

vTheme.showModal = (title, content) => {
  $(selectors.title).html(title || '')
  $(selectors.modalContent).html(content || '')

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
    !$(e.target).closest(selectors.exitButton).length) ||
    $(e.target).closest(selectors.openModal).length ||
    !$(e.target).closest('body').length) {
    return
  }
  vTheme.hideModal()
})
