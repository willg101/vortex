import Persistor from '../../../debugger/js/Persistor.module.js'
import Window from './Window.module.js'
export default Pane

var attr = {
  splitDirection: 'data-split',
  splitId: 'data-split-id'
}

var selectors = {
  pane: '.layout-split',
  currentLayout: '#layout_in_use',
  leafPane: '.leaf'
}

const DEFAULT_LAYOUT = 'outer0_3'
const SELECTED_LAYOUT_LS_KEY = 'dpoh_selected_layout'

/**
 * @brief
 *  Normalizes an Array of numbers so that the numbers all remain proportional to each other
 *  but add up to 100.
 */
function normalizeSizes (sizes) {
  if (!sizes.length) {
    return undefined
  }

  var totalSize = sizes.reduce(function (sum, el) {
    return sum + el
  })
  return sizes.map(function (el) {
    return el * 100 / totalSize
  })
}

/**
 * @brief
 *  Pane constructor
 *
 * @param HTMLElement|jQuery el
 * @param Pane               parent OPTIONAL. Should only be given when this constructor is
 *                                  called recursively (external callers should NOT pass this
 *                                  parameter)
 */
function Pane (el, parent) {
  this.element = $(el)
  this.direction = this.element.attr(attr.splitDirection) // 'vertical' or 'horizontal'
  this.id = this.element.attr(attr.splitId)
  this.path = parent // path: a fully qualified id used
    ? parent.path + '.' + this.id // for saving/loading settings
    : this.id + '{root}'
  this.element.data('pane', this)

  this.windows = []

  this.parent = parent
  this.children = []

  var childPanes = this.element.children(selectors.pane)
  if (childPanes.length) { // Recursively initialize child Panes if applicable
    var that = this
    childPanes.each(function () {
      that.children.push(new Pane($(this), that))
    })
  } else {
    this.suggestedWindows = new Persistor(this.id + '_suggested_windows')
  }

  this.sizePersistor = new Persistor(this.id + '_size')
}

Object.defineProperty(Pane.prototype, 'size', {
  get: function () {
    return this.sizePersistor.size
  },
  set: function (val) {
    this.sizePersistor.size = val
    return val
  }
})

/**
 * @brief
 *  Transform the Pane and its descendants using the given callback
 *
 * @param function transformer Receives a Pane instance as its only argument; returns a jQuery
 *
 * @return jQuery
 */
Pane.prototype.transform = function (transformer) {
  if (typeof transformer !== 'function') {
    throw new Error('Pane.transform: Expected `transformer` argument to be a ' +
      'function; received a ' + typeof transformer)
  }

  var transformedSelf = transformer(this)
  if (!this.isLeaf()) {
    this.children.forEach(function (el, i) {
      if (i) {
        transformedSelf.append($('<div class="gutter">'))
      }

      transformedSelf.append(el.transform(transformer))
    })
  }

  return transformedSelf
}

/**
 * @brief
 *  Generate the HTML for a preview of this Pane and its children
 *
 * @param int nPreviewWindows The number of preview "windows" to include in each leaf Pane
 *
 * @return string
 */
Pane.prototype.buildPreviewLayout = function (nPreviewWindows) {
  nPreviewWindows = typeof nPreviewWindows === 'undefined'
    ? 2
    : nPreviewWindows

  var transformer = function (pane) {
    var isLeaf = pane.isLeaf()
    var jquery = $('<div class="layout-pane-preview ' + pane.direction + '">')

    if (isLeaf) {
      jquery.addClass('leaf')
      var html = '<div class="preview-window"></div>' +
        (nPreviewWindows > 1 ? '<div class="gutter"></div>' +
        '<div class="preview-window"></div>'.repeat(nPreviewWindows - 1) : '')
      jquery.append($(html))
    }

    return jquery
  }
  return $('<div>').append(this.transform(transformer)).html()
}

/**
 * @brief
 * Initialize a Sortable instance on each leaf Pane of this Pane's layout
 */
Pane.prototype.initSortable = function () {
  if (!this.isRoot()) {
    this.parent.initSortable()
    return
  }

  var layout = this.element
  layout.find(selectors.leafPane).each(function () {
    Sortable.create(this, {
      group: 'omega',
      handle: '.label-row',
      filter: '.btn',
      scroll: false,
      animation: 150,
      onStart: function () {
        $(selectors.currentLayout).addClass('rearranging').find(selectors.pane).css('display', '')
      },
      onEnd: function (e) {
        var self = $(this)
        self.css(self.is('.horizontal') ? 'height' : 'width', '')
        $(selectors.currentLayout).removeClass('rearranging')
        $(e.to).data('pane').attach($(e.item).data('window'))

        publish('layout-changed')
      }
    })
  })
}

/**
 * @brief
 *  Save this Pane's state in localStorage, along with all child panes' states.
 *
 * @param noRecurse OPTIONAL. When passed (and non-false), prevents a recursive save.
 */
Pane.prototype.save = function (noRecurse) {
  for (var key in this.suggestedWindows) {
    delete this.suggestedWindows[ key ]
  }
  this.windows.forEach(function (el, i) {
    this.suggestedWindows[ el.id ] = i
  }.bind(this))

  if (!noRecurse) {
    this.children.forEach(function (el) {
      el.save()
    })
  }
}

/**
 * @note
 *  Leaves are Panes with no Pane children and are thus capable of containing Window
 *  instances
 *
 * @return bool
 */
Pane.prototype.isLeaf = function () {
  return !this.children.length
}

/**
 * @return bool
 */
Pane.prototype.isRoot = function () {
  return !this.parent
}

/**
 * @brief
 *  Suggest which Pane should contain the given window based on previously saved preferences,
 *  and falling back to suggesting the first leaf Pane in the DOM
 *
 * @param Window|string aWindow
 */
Pane.prototype.suggestOwner = function (aWindow) {
  if (aWindow instanceof Window) {
    aWindow = aWindow.id
  }

  // When the root Pane is a leaf, it is the only Pane that may contain windows
  if (this.isLeaf() && this.isRoot()) {
    // Don't associate the window id with this Pane more than once
    if (typeof this.suggestedWindows[ aWindow ] !== 'undefined') {
      this.suggestedWindows[ aWindow ] = Object.keys(this.suggestedWindows).length
    }

    return this
  } else if (this.isLeaf()) {
    // Check if this leaf is known to own the given window
    return typeof this.suggestedWindows[ aWindow ] !== 'undefined'
      ? this
      : false
  } else {
    // Recursively iterate through our child Panes in search of a leaf Pane that is
    // known to own the given window
    var rval = false
    for (var i in this.children) {
      rval = this.children[ i ].suggestOwner(aWindow)
      if (rval) {
        return rval
      }
    }

    // If we reach this point, we didn't find a known owner of the window. Let the root
    // Pane figure out what to do now
    if (!this.isRoot()) {
      return false
    } else {
      return this.element.find(selectors.leafPane).sort((a, b) => a.children.length - b.children.length).first().data('pane')
    }
  }
}

/**
 * @brief
 *  Show this Pane and all of its ancestors so that if any anscestor Pane is currently
 *  hidden, it does not prevent this Pane from showing
 */
Pane.prototype.show = function () {
  this.element.show()
  if (!this.isRoot()) {
    this.parent.show()
  }
}

/**
 * @brief
 *  Triggers a recursive refresh on one or more Panes
 *
 * @param bool skipBubbleToRoot Only recursive downward, effectively refreshing just this
 *                              Pane and its children
 */
Pane.prototype.refreshAll = function (skipBubbleToRoot) {
  if (!skipBubbleToRoot && !this.isRoot()) {
    this.parent.refreshAll()
    return
  }

  if (!this.isLeaf()) {
    this.children.forEach(function (child) {
      child.refreshAll(true)
    })
  } else {
    this.refresh()
  }
}

/**
 * @brief
 *  Perform all tasks necessary to ensure this Pane's visual state (hidden/showing) and Split
 *  instance are both appropriate
 *
 * @param bool didShow OPTIONAL. Should only be passed when called recursively; indicates that
 *                               it's not necessary to call this.show(), since it has already
 *                               been called somewhere deeper in the call stack.
 */
Pane.prototype.refresh = function (didShow) {
  // If any of our anscestors are hidden, that will mess up code that searches for visible
  // children, such as `this.element.children( ':visible' );`
  if (!didShow) {
    this.show()
  }

  // Because the call this.show() does not always take effect immediately, we will finish this
  // validation later using setTimeout(), which will allow this function to return, and for
  // the browser to update, before continuing
  if (!this.refreshQueued) {
    this.refreshQueued = true // If the browser is running slowly, don't let multiple
                               // validations pile up here
    setTimeout(function () {
      this.refreshQueued = false

      var visibleChildren = this.element.children(':visible:not(.gutter)')

      // No need to show this Pane if it has no visible child Panes or Windows
      if (visibleChildren.length == 0) {
        this.element.hide()
      }

      var dataKey = this.isLeaf() ? 'window' : 'pane'
      var visibleChildrenSizes = visibleChildren.map(function () {
        return ($(this).data(dataKey) || {}).size || 100
      }).toArray()

      if (visibleChildren.length > 1) {
        // If we currently have a Split instance, destroy it and null it out so we can start fresh
        if (this.split) {
          var dimension = this.direction.toLowerCase() == 'vertical' ? 'height' : 'width'
          var margin = this.direction.toLowerCase() == 'vertical' ? 'top' : 'left'
          this.element.children().each(function (i) {
            var self = $(this)
            if (i > 0) {
              self.css('margin-' + margin, '10px')
            }
            self[ dimension ](self[ dimension ])
          })
          this.split.destroy()
          delete this.split
        }
        this.split = Split(visibleChildren.toArray(), {
          direction: this.direction.toLowerCase(),
          sizes: normalizeSizes(visibleChildrenSizes),
          onDragEnd: this.storeSizes.bind(this)
        })
        if (margin) {
          this.element.children().each(function () {
            $(this).css('margin-' + margin, '')
          })
        }
      } else if (this.split) {
        this.split.destroy()
        delete this.split
      }

      this.storeSizes()

      // Bubble up the validation, as the number of visible children has potentially changed
      if (this.parent) {
        this.parent.refresh(true)
      } else {
        publish('layout-changed', { pane: '*' })
      }
    }.bind(this), 50)
  }
}

/**
 * @brief
 *  Store this Pane's Split sizes in localStorage
 */
Pane.prototype.storeSizes = function () {
  var sizes = this.split ? this.split.getSizes() : [ 100 ]
  var allChildren = this.isLeaf() ? (this.windows || []) : this.children
  var visibleChildren = allChildren.filter(function (el) {
    return el.element.is(':visible')
  })
  visibleChildren.forEach(function (el, i) {
    el.size = sizes[ i ]
  })
}

/**
 * @brief
 *  Attach a Window to this leaf Pane
 *
 * @param Window aWindow
 */
Pane.prototype.attach = function (aWindow) {
  if (!this.isLeaf()) {
    throw new Error("Can't attach a Window to a non-leaf Pane")
  }

  var htmlElementNeedsMove = !this.element.find(aWindow.element).length

  if (aWindow.owner) {
    if (htmlElementNeedsMove) {
      aWindow.element = aWindow.element.detach()
    }
    var indexToRemove = aWindow.owner.windows.indexOf(aWindow)
    if (indexToRemove != -1) {
      aWindow.owner.windows.splice(indexToRemove, 1)
    }
  }

  aWindow.owner = this

  var index = this.suggestedWindows[ aWindow.id ]
  if (htmlElementNeedsMove) {
    if (typeof index !== 'undefined' && this.element.children().length > index) {
      this.element.children().eq(index).before(aWindow.element)
      this.windows.splice(index, 0, aWindow)
    } else {
      this.element.append(aWindow.element)
      this.windows.push(aWindow)
    }
  } else {
    this.windows.splice(aWindow.element.index(), 0, aWindow)
  }

  if (Pane.savingAllowed) {
    Pane.currentLayout.save()
  }

  this.refreshAll()
}

subscribe('apply-default-layout-settings', function (e) {
  if (e.layout == 'outer0_3') {
    e.settings.defaults = e.settings.defaults.concat(
      [
        { layoutEl: 'inner-top_3_size', key: 'size', value: 70 },
        { layoutEl: 'inner-bottom_4_size', key: 'size', value: 30 },
        { layoutEl: 'middle-l_3_size', key: 'size', value: 75 },
        { layoutEl: 'middle-r_6_size', key: 'size', value: 25 }
      ])
  }
})

/**
 * @brief
 *  Determine which root Pane to use as the layout and initialize that Pane
 */
Pane.boot = function () {
  var layoutId = localStorage.getItem(SELECTED_LAYOUT_LS_KEY)
  if (!layoutId) {
    var e = { layout: DEFAULT_LAYOUT, settings: { defaults: [] } }
    publish('apply-default-layout-settings', e)
    e.settings.defaults.forEach(params => {
      var p = new Persistor(params.layoutEl)
      p[ params.key ] = params.value
    })
    layoutId = e.layout
    localStorage.setItem(SELECTED_LAYOUT_LS_KEY, layoutId)
  }
  var layoutElement = $('[' + attr.splitId + '="' + layoutId + '"]')
  layoutElement.appendTo(selectors.currentLayout)
  this.currentLayout = new Pane(layoutElement)
  this.currentLayout.initSortable()
  this.currentLayout.refreshAll()

  publish('pane-boot')
  Pane.savingAllowed = true
}

$(Pane.boot.bind(Pane))
