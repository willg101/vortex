var mostRecentPage

$(document).on('click', '#settings_toolbar', function () {
  var indicator = $('#settings_toolbar')
  var items = getQuickActions()
  new vTheme.PopoverList({
    lists: [
      {
        title: '',
        options: items
      }
    ],
    classes: [ 'auto-size' ],
    el: indicator,
    side: 'right'
  })
})

$(document).on('click', '[data-action=open-settings]', function () {
  clearCachedSettings()

  var pagesInfo = gatherSettingsPages()

  var currentPage = {}
  for (var i in pagesInfo.pages) {
    if (pagesInfo.pages[ i ].defaultPage) {
      currentPage = pagesInfo.pages[ i ]
      break
    }
  }

  vTheme.showModal('Settings', render('vue.settings_modal', {
    widgets: gatherSettingsPageWidgets(pagesInfo.defaultPage),
    icon: currentPage.icon,
    title: currentPage.title
  }))
})

$(document).on('click', '.save-settings', function () {
  cacheSettings()
  publish('save-settings')
  vTheme.hideModal()
  publish('settings-saved')
})

$(document).on('change', '.settings-page', function () {
  cacheSettings()
  var page = $('.settings-page').val()
  mostRecentPage = page
  $('.settings-widgets').html(gatherSettingsPageWidgets(page))
})

subscribe('gather-settings-pages', function (e) {
  e.pages.push({
    val: 'about',
    icon: 'info-circle',
    title: 'About'
  })
})

subscribe('gather-settings-page-widgets', function (e) {
  if (e.page == 'about') {
    e.widgets.push('Vortex Debugger &copy; 2018 Will Groenendyk.')
  }
})

$(document).on('click', '[data-show-settings-page]', function (e) {
  cacheSettings()
  var pageId = $(e.target).closest('[data-show-settings-page]').attr('data-show-settings-page')
  mostRecentPage = pageId
  $('.settings-page').html($(e.target).closest('[data-show-settings-page]').html())
  $('.settings-widgets').html(gatherSettingsPageWidgets(pageId))
})

$(document).on('click', '.settings-page', function () {
  var list = gatherSettingsPages().pages
  var listProcessed = []
  for (var i in list) {
    listProcessed.push({
      content: '<i class="fa fa-fw fa-' + list[i].icon + '"></i> ' + list[i].title,
      attr: { 'data-show-settings-page': list[i].val }
    })
  }
  new vTheme.PopoverList({
    lists: [
      {
        title: '',
        options: listProcessed
      }
    ],
    classes: [],
    el: $('.settings-page'),
    side: 'left'
  })
})

function getQuickActions () {
  var items = [
    {
      content: 'All settings...',
      attr: {
        'data-action': 'open-settings'
      }
    }
  ]
  publish('alter-settings-quick-actions', { items: items })
  return items
}

function gatherSettingsPages () {
  var event = {
    pages: []
  }
  publish('gather-settings-pages', event)

  var pages = event.pages.sort(function (a, b) {
    if (a.title > b.title) {
      return 1
    } else if (b.title < a.title) {
      return -1
    } else {
      return 0
    }
  })

  var defaultPage = mostRecentPage

  if (!defaultPage && pages[ 0 ]) {
    defaultPage = pages[ 0 ].val
  }

  for (var i = 0; i < pages.length; i++) {
    if (pages[ i ].val == defaultPage) {
      pages[ i ].defaultPage = true
      break
    }
  }

  return {
    pages: pages,
    defaultPage: defaultPage
  }
}

function gatherSettingsPageWidgets (page) {
  var event = {
    page: page,
    widgets: []
  }
  publish('gather-settings-page-widgets', event)
  return event.widgets.join('')
}

function cacheSettings () {
  publish('cache-settings', { page: mostRecentPage })
}

function clearCachedSettings () {
  publish('clear-cached-settings')
}
