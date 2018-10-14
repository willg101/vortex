import Pane from './Layout/Pane.module.js'

var $ = jQuery

// Indicates whether the page needs to be reloaded after settings are saved (the page needs to
// be reloaded when a new layout has been selected)
var restartNeeded = false

// The currently selected, but not yet saved, layout on the Page Layout settings page
var selectedLayout

// Error subclass
function LayoutError () {};
LayoutError.prototype = new Error()
LayoutError.prototype.name = 'Vue.LayoutSelector.LayoutError'

/**
 * @param int  i           0 indicates the layout currently in use
 *                         1 represents the 1st layout included in the DOM that's not in use
 *                         2 respresents the 2nd layout included in the DOM that's not in use
 *                         ... etc.
 * @param bool layoutOnly  Render only the layout preview, not the controls
 *
 * @return string
 */
function renderLayoutSelector (i, layoutOnly) {
  var el = i == 0
    ? $('#layout_in_use > :first-child')
    : $($('.all-layouts').children()[ i - 1 ])
  if (!el.length) {
    throw new LayoutError('No ' + (typeof i === 'undefined' ? '' : 'matching ') +
      'layout found')
  }

  var panePreview = i == 0
    ? Pane.currentLayout
    : new Pane(el)

  return render('vue.layout_selector', {
    include_controls: !layoutOnly,
    layoutTitle: el.attr('data-title'),
    split_id: el.attr('data-split-id'),
    index: i,
    layoutPreview: panePreview.buildPreviewLayout()
  })
}

/**
 * @brief
 *  Updates the modal to display to correct layout preview
 *
 * @param int i @c renderLayoutSelector()'s documentation for this parameter
 */
function validateLayoutModal (i) {
  $('.layout-selector-widget').html(renderLayoutSelector(i))
}

/**
 * @brief
 *  Handles click events on the "next layout" button in the settings modal
 */
$(document).on('click', '.next-layout', function () {
  var currentIndex = Number($('.layout-preview-container').attr('data-index')) + 1
  if (currentIndex > $('.all-layouts').children().length) {
    currentIndex = 0
  }

  validateLayoutModal(curreIIndex)
})

/**
 * @brief
 *  Handles click events on the "previous layout" button in the settings modal
 */
$(document).on('click', '.prev-layout', function () {
  var currentIndex = Number($('.layout-preview-container').attr('data-index')) - 1
  if (currentIndex < 0) {
    currentIndex = $('.all-layouts').children().length
  }
  validateLayoutModal(currentIndex)
})

/**
 * @brief
 *  Adds the "Page Layout" to the list of settings
 */
subscribe('gather-settings-pages', function (e) {
  e.pages.push({
    val: 'page_layout',
    icon: 'window-restore',
    title: 'Page Layout'
  })
})

/**
 * @brief
 *  Adds the layout selector to the Page Layout settings page
 */
subscribe('gather-settings-page-widgets', function (e) {
  if (e.page == 'page_layout') {
    e.widgets.push(renderLayoutSelector(0))
  }
})

/**
 * @brief
 *  Saves the currently selected layout to local storage when the settings "save" button is
 *  clicked
 */
subscribe('save-settings', function () {
  if (selectedLayout !== false && localStorage.getItem('dpoh_selected_layout') != selectedLayout) {
    localStorage.setItem('dpoh_selected_layout', selectedLayout)
    restartNeeded = true
  }
})

/**
 * @brief
 *  Caches the currently selected layout when the user switches away from the "Page Layout"
 *  settings page
 */
subscribe('cache-settings', function (e) {
  if (e.page == 'page_layout') {
    selectedLayout = $('.layout-preview-container').attr('data-layout-id')
  }
})

/**
 * @brief
 *  Clears selectedLayout
 */
subscribe('clear-cached-settings', function () {
  selectedLayout = false
})

/**
 * @brief
 *  Refreshes the page after a new layout has been chosen
 */
subscribe('settings-saved', function () {
  if (restartNeeded) {
    location.reload()
  }
})
