import Debugger from './Debugger.module.js'
import File from './File.module.js'
import RecentFiles from './RecentFiles.module.js'
import ProgramStateUIRouter from './ProgramStateUIRouter.module.js'
import LanguageAbstractor from './LanguageAbstractor.module.js'
import RemoteFiles from './RemoteFiles.module.js'
import WsClient from './WsClient.module.js'

var $ = jQuery
var dirAliases = {}

$.fn.moveCursorToEnd = function () {
  return this.each(() => {
    this[ 0 ].scrollLeft = this[ 0 ].scrollWidth
  })
}

$(document).on('click', '#file_finder', function () {
  var recentFilesPopover = $('#file_finder').data('toggles_popover')
  if (!recentFilesPopover) {
    var lists = [
      {
        title: 'Recently Edited',
        id: 'recently_edited',
        options: false
      }
    ]
    var recentFiles = listRecentlyOpenFiles()
    if (recentFiles.length) {
      lists.unshift({
        title: 'Recently Viewed',
        options: recentFiles
      })
    }
    recentFilesPopover = new vTheme.PopoverList({
      lists: lists,
      classes: [],
      el: $('#file_finder'),
      side: 'left'
    })

    // Asynchronously fill in the recently edited files
    RemoteFiles.listRecentlyModified(function (success, data) {
      if (success) {
        var list = []
        for (var i in data) {
          list.push({
            attr: {
              'data-open-file': data[ i ].fullpath
            },
            content: render('debugger.recent_file', {
              filename: data[ i ].name,
              path: File.dirname(data[ i ].fullpath)
            })
          })
        }
        recentFilesPopover.setList('recently_edited', {
          id: 'recently_edited',
          title: 'Recently Edited',
          options: list
        })
      } else {
        recentFilesPopover.setContent('<i class="fa fa-exclamation-triangle"></i> An error occured.')
      }
    })
  } else {
    recentFilesPopover.remove()
  }
})

$(document).on('keydown', '#file_finder', function (e) {
  if (e.which == 9) { // tab
    e.preventDefault() // Don't let `tab` remove focus from the element
    var currentVal = $(e.target).val()

    if (dirAliases[ currentVal ]) {
      $(e.target).val(dirAliases[ currentVal ]).moveCursorToEnd()
    } else {
      processGlobOnServer(currentVal, function (items) {
        var popover = $('#file_finder').data('toggles_popover')

        if (items.length == 0) {
          popover && popover.remove()
        } else if (items.length == 1) {
          $('#file_finder').blur().focus().val('').val(items[ 0 ].name +
            (items[ 0 ].type == 'dir' ? '/' : ''))
          popover && popover.remove()
        } else if (items.length > 1) {
          let commonPrefix = new CommonPrefixFinder()
          let itemsForRendering = []

          items.forEach(function (el, i) {
            var currentText = el.name
            itemsForRendering.push({
              attr: {
                'data-full-path': currentText,
                class: 'globber-option globber-' + el.type
              },
              content: File.basename(currentText)
            })
            commonPrefix.add(currentText)
          })

          itemsForRendering = itemsForRendering.sort(function (a, b) {
            if (a.content.toLowerCase() > b.content.toLowerCase()) {
              return 1
            } else if (b.content.toLowerCase() > a.content.toLowerCase()) {
              return -1
            } else {
              return 0
            }
          })

          if (!popover) {
            popover = new vTheme.PopoverList({
              lists: [
                {
                  title: '',
                  options: false
                }
              ],
              classes: [ '' ],
              el: $('#file_finder'),
              side: 'left'
            })
          }

          popover.setLists([ { title: '', options: itemsForRendering } ])
          $('#file_finder').blur().focus().val('').val(commonPrefix.get())
        }

        $('#file_finder').moveCursorToEnd()
      })
    }
  } else if (e.which == 13) { // `Enter` key
    e.preventDefault()
    var file = $(e.target).val()
    processGlobOnServer(file, function (items) {
      if (items.length == 1 && items[ 0 ].type == 'file') {
        $('#file_finder').val('').blur()
        ProgramStateUIRouter.setFile(file)
      } else {
        var foundExactMatch = false
        items.some(function (el) {
          if (el.name == file && el.type == 'file') {
            $('#file_finder').val('').blur()
            ProgramStateUIRouter.setFile(file)
            foundExactMatch = true
            return true
          }
        })

        if (!foundExactMatch) {
          $('#file_finder').addClass('shake')
          setTimeout(function () {
            $('#file_finder').removeClass('shake')
          }, 500)
        }
      }
    })
  }
})

$(document).on('focusin', '#file_finder', function (e) {
  if (!$('#file_finder').val().trim()) {
    $('#file_finder').val(File.dirname(ProgramStateUIRouter.getFile() || '/'))
  }

  setTimeout(function () {
    var val = $('#file_finder').val()
    $('#file_finder').val('').val(val).moveCursorToEnd()
  }, 30)
  return false
})

$(document).on('click', '.globber-option', function (e) {
  var target = $(e.target).closest('.globber-option')
  var path = target.attr('data-full-path')
  if (target.is('.globber-dir')) {
    $('#file_finder').val(path + '/').focus().moveCursorToEnd().trigger({ type: 'keydown', which: 9 })
  } else if (target.is('.globber-file')) {
    $('#file_finder').val('')
    ProgramStateUIRouter.setFile(target.attr('data-full-path'))
  }
})

async function processGlobOnServer (prefix, cb) {
  if (!Debugger.sessionIsActive()) {
    WsClient.send('X-glob', { p: prefix }, function (e) {
      var items = []
      $(e.messageRaw).find('[type]').each(function () {
        items.push({
          type: $(this).attr('type'),
          name: $(this).text()
        })
      })
      cb(items)
    })
  } else {
    // Handling this via the DE allows us to use the program's host file system, which may
    // differ from the Vortex host
    cb(await LanguageAbstractor.globDirectory(prefix))
  }
}

function listRecentlyOpenFiles () {
  var list = []

  RecentFiles.list().forEach((file) => {
    list.push({
      content: render('debugger.recent_file', {
        filename: File.basename(file.filename),
        path: File.dirname(file.filename),
        host: file.host != 'localhost' ? file.host : ''
      }),
      attr: {
        'data-open-file': file.filename
      }
    })
  })

  return list
}

class CommonPrefixFinder {
  constructor () {
    this.prefix = false
  }

  add (str) {
    if (this.prefix === false) {
      this.prefix = str
      return
    }

    this.prefix = this.prefix.substr(0, Math.min(str.length, this.prefix.length))
    for (var i = 0; i < this.prefix.length; i++) {
      if (str[ i ] != this.prefix[ i ]) {
        this.prefix = str.substr(0, i)
        return
      }
    }
  }

  get () {
    return this.prefix || ''
  }
}

subscribe('provide-tests', function () {
  describe('FileFinder', function () {
    it('CommonPrefixFinder', function () {
      var finder = new CommonPrefixFinder()
      expect(finder.get()).toBe('')

      finder.add('abcdefg')
      expect(finder.get()).toBe('abcdefg')

      finder.add('abcdefghijk')
      expect(finder.get()).toBe('abcdefg')

      finder.add('abc')
      expect(finder.get()).toBe('abc')

      finder.add('xyz')
      expect(finder.get()).toBe('')

      finder.add('abc')
      expect(finder.get()).toBe('')
    })
  })
})
