var listener = new window.keypress.Listener();

// Press this key at the same time as some other key (e.g., A, S, D, etc.) in order to trigger a
// DART keybinding. Browsers use many different different key combinations that rely on ctrl/cmd
// or alt as modifier keys. Let's not risk conflicting with existing keybindings.
const MODIFIER_KEY = 'space'

subscribe('vortex-init', function() {
  var bindables = getBindables()
  for ( let btn in bindables ) {
    let combo = bindables[btn].replace('~', MODIFIER_KEY + ' ')
      listener.simple_combo(combo, function() {
      let el = $(`[data-keybinding-id="${btn}"]`).click().removeClass('triggered')
      setTimeout( () => el.addClass('triggered'), 30 )
    })
  }
})

function getBindables() {
  var map = {}
  $('[data-keybinding-id][data-keybinding-default]').each((i, el) =>
    map[$(el).data('keybindingId')] = $(el).data('keybindingDefault'))
  return map
}
