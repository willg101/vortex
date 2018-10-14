import Debugger from './Debugger.module.js'
import ProgramStateUIRouter from './ProgramStateUIRouter.module.js'

var $ = jQuery

/**
 * Track which nodes of a jstree are open. Unlike jstree's built-in state save/restore functions,
 * this is intended to track and apply states *between different instances* of a tree, as we
 * destory and recreate the jstree instance each time the stack frame changes.
 *
 * Of particular importance, we want to handle cases in which a user is browsing through the
 * current set of stack frames. Consider the following sequence of actions, starting with the user
 * looking at the tree in frame 0:
 *	1. Open the set of Locals
 *	2. Open Locals > $foo
 *	3. Switch to frame 1
 *	4. Open Locals > $bar
 *	5. Switch to frame 0
 * In step 3, the 'Locals' node was still intentionally open, despite being a different context and
 * tree. And in step 5, `Locals` and $foo were open again, picking up where the user left off
 * in step 2.
 */
class TreeState {
  constructor () {
    this.tree = {}
  }

  /**
   * @brief
   *	Track the opening of a tree node
   *
   * @param object node The `node` argument passed to an `open_node.jstree` event handler
   */
  open (node) {
    var prevNode = this.tree
    this.tracePath(node).forEach(addr => {
      if (!prevNode[ addr ]) {
        prevNode[ addr ] = {}
      }
      prevNode = prevNode[ addr ]
    })
  }

  /**
   * @brief
   *	Track the closing of a tree node
   *
   * @param object node The `node` argument passed to a `clos_node.jstree` event handler
   */
  close (node) {
    var prevNode = this.tree
    var path = this.tracePath(node)
    var addrToDelete = path.pop()

    path.some(addr => {
      if (!prevNode[ addr ]) {
        prevNode = null
        return true
      }
      prevNode = prevNode[ addr ]
    })

    if (prevNode) {
      delete prevNode[ addrToDelete ]
    }
  }

  /**
   * @param object node The value passed to either close() or open()
   *
   * @return Array
   *	An array node addresses, with the last element being `node`'s address, and the first
   *	element being the address of the node's furthest ancestor
   */
  tracePath (node) {
    var container = node.instance.get_container()
    var path = [ node.node.li_attr[ 'data-address' ] ];
    (node.node.parents || []).forEach(nodeId => {
      if (nodeId == '#') {
        return // Root node
      }
      path.unshift(container.jstree('get_node', nodeId).li_attr[ 'data-address' ])
    })
    return path
  }

  /**
   * @brief
   *	Restore the state stored in this instance to the given jstree container
   *
   * @param jQuery container
   * @param object jstree    OPTIONAL. Only passed to this while recursing
   * @param object ctx       OPTIONAL. Only passed to this while recursing
   */
  restore (container, jstree, ctx) {
    jstree = jstree || $.jstree.reference(container)
    ctx = ctx || this.tree

    // Starting at the root of the tree, and descending one level at a time, open all nodes on
    // this level of the tree, and then do the same on the next level only once the next level
    // exists and is ready (much of the tree is lazy-loaded)
    for (let addr in ctx) {
      jstree.open_node(`[data-address='${addr}']`,
        () => this.restore(container, jstree, ctx[ addr ]), false)
    }
  }
}

var treeState = new TreeState()

/**
 * @brief
 *	Update the state of the Scope window as needed
 */
subscribe('program-state-ui-refresh-needed', async (e) => {
  if (e.stackPos < 0) {
    return
  }

  if (!e.programState.stack.frames[ e.stackPos ].context) {
    await e.programState.stack.frames[ e.stackPos ].fetchContext()
  }

  var context = e.programState.stack.frames[ e.stackPos ].context
  $('#context').vtree(context).on('ready.jstree', function () {
    treeState.restore(this)
    $('#context').on('open_node.jstree', (e, node) => treeState.open(node))
    $('#context').on('close_node.jstree', (e, node) => treeState.close(node))
  })

  $('#mem_usage').text(e.programState.memoryUsage.readable)
})

/**
 * @brief
 *	When a writeable node from the context tree is double-clicked, show a modal for updating the
 *	node's value
 */
$(document).on('dblclick.jstree', '#context', async function (e) {
  var li = $(e.target).closest('li')
  if (li.is('[data-no-alter]')) {
    return
  }

  var identifier = li.attr('data-identifier')
  var stackDepth = li.attr('data-stack-depth')
  var cid = li.attr('data-cid')
  var size = li.attr('data-size')

  var e = await Debugger.command('property_get', {
    name: identifier,
    stack_depth: stackDepth,
    context: cid,
    max_data: size
  })
  var currentVal = $('<div>').text((e.parsed[ 0 ] || {}).value || '').html()
  vTheme.showModal('Update Value',
    render('debugger.change_variable_value', { identifier,
      stackDepth,
      cid,
      size,
      current_val: currentVal }))
  $('.value-input').focus()
  document.execCommand('selectAll', false, null)
})

/**
 * @brief
 *	Handle the submission for a new variable value
 */
$(document).on('keypress', '.value-input', async function (e) {
  if (e.which == 13 && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault()
    var newValue = $(e.target).text()
    var stackDepth = $(e.target).attr('data-stack-depth')
    var cid = $(e.target).attr('data-cid')
    var identifier = $(e.target).attr('data-identifier')

    vTheme.hideModal()

    await Debugger.command('property_set', {
      name: identifier,
      stack_depth: stackDepth,
      context: cid
    }, newValue)

    ProgramStateUIRouter.refreshState()
  }
})
