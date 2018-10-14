import Debugger from './Debugger.module.js'

var $ = jQuery

// The currently-selected autorun mode (in the settings page)
var selectedItem = false

/**
 * @return string
 */
function getCurrentMode () {
  return localStorage.getItem('vortex_autoplay_mode') || 'disabled'
}

/**
 * @brief
 *  Session init handler; determines if the debug session should use autorun
 */
function onSessionInit (e) {
  var mode = getCurrentMode()
  if (mode == 'disabled') {
    return
  }

  whenReadyTo('inspect-context').then(async function () {
    // If the request includes a "VORTEX_NO_AUTORUN" GET param, we will not autorun
    var data = await Debugger.command('property_get', { name: '$_GET["VORTEX_NO_AUTORUN"]' })
    if (!data.parsed || !data.parsed[ 0 ]) { // No "VORTEX_NO_AUTORUN" GET param
      if (document.visibilityState == 'hidden' || mode == 'always') {
        whenReadyTo('autorun').then(() => {
          var className = 'autorun-in-progress'
          $('body').addClass(className)
          Debugger.command('run', () => $('body').removeClass(className))
        })
      }
    }
  })
}

/**
 * @return Array
 *  An Array of plain objects that represent the available autorun modes
 */
function getModes () {
  var currentMode = getCurrentMode()
  var modes = [
    {
      title: 'Take no action',
      id: 'disabled'
    },
    {
      title: 'Run to the first breakpoint',
      id: 'always'
    },
    {
      title: 'Run to the first breakpoint when this tab is not focused',
      id: 'not_focused'
    }
  ]

  for (var i in modes) {
    if (currentMode == modes[ i ].id) {
      modes[ i ].selected = true
    }
  }

  return modes
}

/**
 * @brief
 *  gather-settings-pages handler
 */
function provideSettingsPage (e) {
  e.pages.push({
    val: 'autorun',
    icon: 'bolt',
    title: 'Autorun'
  })
}

/**
 * @brief
 *  gather-settings-page-widgets handler
 */
function provideSettingsPageWidgets (e) {
  if (e.page == 'autorun') {
    e.widgets.push(render('debugger.autorun_settings', {
      modes: getModes()
    }))
  }
}

/**
 * @brief
 *  save-settings handler
 */
function saveSettings (e) {
  if (selectedItem && selectedItem != getCurrentMode()) {
    localStorage.setItem('vortex_autoplay_mode', selectedItem)
  }
}

/**
 * @brief
 *  cache-settings handler
 */
function cacheSettings (e) {
  if (e.page == 'autorun') {
    selectedItem = $('[name=autorun_mode]:checked').val()
  }
}

/**
 * @brief
 *  clear-cache-settings handler
 */
function clearCachedSettings () {
  selectedItem = false
}

/**
 * @brief
 *  alter-dummy-session-request handler; adds a GET param to the request to prevent autorun
 */
function alterDummySessionRequest (e) {
  e.options.params.VORTEX_NO_AUTORUN = 1
}

subscribe('gather-settings-pages', provideSettingsPage)
subscribe('gather-settings-page-widgets', provideSettingsPageWidgets)
subscribe('save-settings', saveSettings)
subscribe('cache-settings', cacheSettings)
subscribe('clear-cached-settings', clearCachedSettings)
subscribe('session-init', onSessionInit)
subscribe('alter-dummy-session-request', alterDummySessionRequest)
