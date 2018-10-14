export default Popover

var $ = jQuery

vTheme.Popover = Popover

var templateName = 'vue.popover'
var popoverSelector = '.vue-popover'

function Popover (content, classes, position, toggleButton, delayShow) {
  this.content = content || ''
  this.classes = classes || []
  this.toggleButton = toggleButton
  this.position = $.extend({ my: 'right top', at: 'right bottom', collision: 'none none' }, position || {})
  if (toggleButton) {
    toggleButton.data('toggles_popover', this)
  }
  if (!delayShow) {
    this.show()
  }
}

Popover.prototype.show = function () {
  if (!this.el) {
    this.el = $(this.render()).data('popover_instance', this)
    this.el.appendTo('body')
    if (this.position.of) {
      this.el.css('min-width', $(this.position.of).outerWidth() + 'px')
    }
    this.reposition()

    var that = this
    setTimeout(function () {
      that.el.addClass('removable')
    }, 50)
  }
}

Popover.prototype.reposition = function () {
  if (this.el) {
    this.el.position(this.position)
  }
}

Popover.prototype.render = function () {
  return render(templateName, { classes: this.classes.join(' '), content: this.content })
}

Popover.prototype.setContent = function (newContent) {
  if (this.el) {
    this.el.html(newContent)
    this.reposition()
  }
  this.content = newContent
}

Popover.prototype.remove = function () {
  if (!this.el.is('.removable')) {
    return
  }

  publish('popover:remove', { popover: this })
  this.el.remove()
  this.toggleButton.data('toggles_popover', null)
  delete this.el
  $(popoverSelector).each(function () {
    $(this).data('popover_instance').reposition()
  })
}

$(document).on('click', function (e) {
  $(popoverSelector).each(function () {
    var self = $(this)
    if (!$(e.target).closest(self).length || $(e.target).closest('.close-popover-on-click').length) {
      self.data('popover_instance').remove()
    }
  })
})
