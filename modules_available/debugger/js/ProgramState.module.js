import Debugger from './Debugger.module.js'
import File from './File.module.js'
import LanguageAbstractor from './LanguageAbstractor.module.js'
export default { refreshState }

var $ = jQuery

/**
 * @brief
 *	A single frame within the stack
 */
class StackFrame {
  /**
   * @param Array frameData
   */
  constructor (frameData) {
    frameData.schemelessFilename = File.stripScheme(frameData.filename)
    frameData.pathlessFilename = File.basename(frameData.filename)

    this.frameData = $.extend(true, {}, frameData)
  }

  get rawFilename () { return this.frameData.filename }
  get schemelessFilename () { return this.frameData.schemelessFilename }
  get pathlessFilename () { return this.frameData.pathlessFilename }
  get lineno () { return this.frameData.lineno }
  get level () { return this.frameData.level }

  /**
   * @return Promise
   */
  fetchContext () {
    if (this.contextPromise) {
      return this.contextPromise
    } else if (this.context) {
      this.contextPromise = new Promise(resolve => {
        resolve(this.context)
      })
    } else {
      this.contextPromise = new Promise(async (resolve) => {
        var response = await Debugger.command('context_names', {
          stack_depth: this.level
        })
        var contexts = []
        var contextDescriptor = null
        for (var i = 0; i < (response.parsed || []).length; i++) {
          contextDescriptor = response.parsed[ i ]
          var contextItems = await Debugger.command('context_get', {
            context: contextDescriptor.id,
            stack_depth: this.level
          })
          contexts.push(new ContextRoot(contextDescriptor.name,
            contextDescriptor.id, contextItems.parsed, this.level))
        }
        this.context = contexts
        resolve(this.context)
      })
    }

    return this.contextPromise
  }
}

/**
 * @brief
 *	A series of a stack frames received from the DE
 */
class Stack {
  /**
   * @param Array frameArray
   */
  constructor (frameArray) {
    frameArray = frameArray || []

    this.frames = frameArray.map(rawFrame => {
      return new StackFrame({
        filename: rawFrame.filename,
        lineno: rawFrame.lineno,
        level: rawFrame.level
      })
    })

    frameArray.length && this.frames[ 0 ].fetchContext()
  }

  get depth () {
    return this.frames.length
  }
}

class ContextNode {
  constructor (parent, properties) {
    this.parent = parent || null
    this.properties = properties

    if (this.children) {
      this._constructChildNodes(this.children)
    }
  }

  _constructChildNodes (children) {
    this.properties.children = children.map((child) => {
      return new ContextNode(this, child)
    })
  }

  _searchRecursivelyForValue (key) {
    if (typeof this[ key ] !== 'undefined') {
      return this[ key ]
    } else {
      return this.parent
        ? this.parent._searchRecursivelyForValue(key)
        : undefined
    }
  }

  get name () { return this.properties.name }
  get value () { return this.properties.value }
  get fullname () { return this.properties.fullname }
  get type () { return this.properties.type }
  get address () { return this.properties.address }
  get hasChildren () { return !!this.properties.numchildren }
  get size () { return this.properties.size }
  get children () { return this.properties.children }

  fetchChildren () {
    if (!this.fetchingChildrenPromise) {
      if (this.children) {
        this.fetchingChildrenPromise = new Promise(resolve => resolve(this.children))
      }
      if (!this.hasChildren) {
        this.fetchingChildrenPromise = new Promise(resolve => resolve(null))
      } else {
        this.fetchingChildrenPromise = new Promise(async (resolve) => {
          var children = await Debugger.command('property_get', {
            name: this.fullname,
            stack_depth: this.stackDepth || 0,
            context: this.cid || undefined
          })
          children = children.parsed[ 0 ].children
          this._constructChildNodes(children)
          resolve(this.properties.children)
        })
      }
    }
    return this.fetchingChildrenPromise
  }

  get cid () { return this._searchRecursivelyForValue('_cid') }
  get stackDepth () { return this._searchRecursivelyForValue('_stackDepth') }

  get isReadOnly () { return false }
}

class ContextRoot extends ContextNode {
  constructor (name, cid, children, stackDepth) {
    children = children || []
    super(false, { name, children, numchildren: children.length })
    this._cid = cid
    this._stackDepth = stackDepth
  }

  get value () { return this.name }
  get fullname () { return this.name }
  get type () { return this.name }
  get address () { return this.name }

  get isReadOnly () { return true }
}

/**
 * The state of a program at a certain instance in time
 */
class ProgramState {
  constructor () {
    this.ctorFinished = Promise.all([
      this.getStack(),
      this.getMemoryUsage()
    ]).then(() => {
      publish('program-state-changed', { programState: this })
    })
  }

  async getStack () {
    var response = await Debugger.command('stack_get')
    this.stack = new Stack(response.parsed)
    if (this.stack.frames.length) {
      await this.stack.frames[ 0 ].fetchContext()
    }
  }

  async getMemoryUsage () {
    var response = await LanguageAbstractor.getBytesOfMemoryUsed()
    this.memoryUsage = {
      bytes: response,
      readable: File.bytesToHumanReadable(response)
    }
  }
}

function refreshState () {
  new ProgramState()
}

subscribe('server-info', function (e) {
  // Handle a debug session change
  if (e.jq_message.is('[status=session_change]')) {
    whenReadyTo('switch-session').then(async () => {
      var state = new ProgramState()
      await state.ctorFinished
      publish('session-switched')
    })
  }
})

subscribe('response-received', e => {
  if (e.parsed.is_continuation && !e.parsed.is_stopping) {
    refreshState()
  }
})

subscribe('provide-tests', function () {
  describe('ProgramState', function () {
    it('Stack', function () {
      var s1 = new Stack([])
      expect(s1.depth).toBe(0)

      var s2 = new Stack([ { level: 0, type: 'file', filename: 'file:///a/b/c', lineno: 123 } ])
      expect(s2.depth).toBe(1)
      expect(typeof s2.frames).toBe('object')
      expect(s2.frames instanceof Array).toBe(true)
      var frame = s2.frames[ 0 ]
      expect(frame.level).toBe(0)
      expect(frame.rawFilename).toBe('file:///a/b/c')
      expect(frame.schemelessFilename).toBe('/a/b/c')
      expect(frame.pathlessFilename).toBe(File.basename('/a/b/c'))
      expect(frame.lineno).toBe(123)

      var s3 = new Stack([
        { level: 0, type: 'file', filename: 'file:///aaa/bbb/ccc/ddd/eee', lineno: 123 },
        { level: 1, type: 'file', filename: 'file:///aaa/baaa', lineno: 12 },
        { level: 2, type: 'file', filename: 'file:///aaaa', lineno: 1 }
      ])
      expect(s3.depth).toBe(3)
      expect(typeof s3.frames).toBe('object')
      expect(s3.frames instanceof Array).toBe(true)
      frame = s3.frames[ 0 ]
      expect(frame.level).toBe(0)
      expect(frame.rawFilename).toBe('file:///aaa/bbb/ccc/ddd/eee')
      expect(frame.schemelessFilename).toBe('/aaa/bbb/ccc/ddd/eee')
      expect(frame.pathlessFilename).toBe(File.basename('/aaa/bbb/ccc/ddd/eee'))
      expect(frame.lineno).toBe(123)
      frame = s3.frames[ 1 ]
      expect(frame.level).toBe(1)
      expect(frame.rawFilename).toBe('file:///aaa/baaa')
      expect(frame.schemelessFilename).toBe('/aaa/baaa')
      expect(frame.pathlessFilename).toBe(File.basename('/aaa/baaa'))
      expect(frame.lineno).toBe(12)
      frame = s3.frames[ 2 ]
      expect(frame.level).toBe(2)
      expect(frame.rawFilename).toBe('file:///aaaa')
      expect(frame.schemelessFilename).toBe('/aaaa')
      expect(frame.pathlessFilename).toBe(File.basename('/aaaa'))
      expect(frame.lineno).toBe(1)
    })

    it('ContextNode', function () {
      var n1 = new ContextNode(false, {
        name: '$lorem',
        value: 'null',
        fullname: '$lorem',
        type: 'null',
        address: '0x12346',
        numchildren: 0,
        size: 0,
        children: undefined
      })
      expect(n1.parent).toBe(null)
      expect(n1.cid).toBeUndefined()
      expect(n1.stackDepth).toBeUndefined()
      expect(n1.name).toBe('$lorem')
      expect(n1.fullname).toBe('$lorem')
      expect(n1.value).toBe('null')
      expect(n1.size).toBe(0)
      expect(n1.type).toBe('null')
      expect(n1.hasChildren).toBe(false)
      expect(n1.isReadOnly).toBe(false)

      var n2 = new ContextNode(false, {
        name: '$lorem',
        value: undefined,
        fullname: '$lorem',
        type: 'array',
        address: '0x12346',
        numchildren: 1,
        size: 6,
        children:
          [ {
            name: '"ipsum"',
            value: 'hello',
            fullname: '$lorem["ipsum"]',
            type: 'string',
            address: '0x123',
            numchildren: 0,
            size: 6,
            children: undefined
          } ]
      })
      expect(n2.parent).toBe(null)
      expect(n2.cid).toBeUndefined()
      expect(n2.stackDepth).toBeUndefined()
      expect(n2.name).toBe('$lorem')
      expect(n2.fullname).toBe('$lorem')
      expect(n2.value).toBeUndefined()
      expect(n2.size).toBe(6)
      expect(n2.type).toBe('array')
      expect(n2.hasChildren).toBe(true)
      expect(n2.isReadOnly).toBe(false)
      var child = n2.children[ 0 ]
      expect(child.parent).toBe(n2)
      expect(child.cid).toBeUndefined()
      expect(child.stackDepth).toBeUndefined()
      expect(child.name).toBe('"ipsum"')
      expect(child.fullname).toBe('$lorem["ipsum"]')
      expect(child.value).toBe('hello')
      expect(child.size).toBe(6)
      expect(child.type).toBe('string')
      expect(child.hasChildren).toBe(false)
      expect(child.isReadOnly).toBe(false)

      n2._cid = 1
      n2._stackDepth = 3
      expect(n2.cid).toBe(1)
      expect(child.cid).toBe(1)
      expect(n2.stackDepth).toBe(3)
      expect(child.stackDepth).toBe(3)
    })

    it('ContextRoot', function () {
      var n1 = new ContextRoot('name', 123, [], 4)
      expect(n1.parent).toBe(null)
      expect(n1.cid).toBe(123)
      expect(n1.stackDepth).toBe(4)
      expect(n1.name).toBe('name')
      expect(n1.fullname).toBe('name')
      expect(n1.value).toBe('name')
      expect(n1.size).toBeUndefined()
      expect(n1.type).toBe('name')
      expect(n1.hasChildren).toBe(false)
      expect(n1.isReadOnly).toBe(true)

      var n2 = new ContextRoot('name', 123, [ {
        name: '"ipsum"',
        value: 'hello',
        fullname: '$lorem["ipsum"]',
        type: 'string',
        address: '0x123',
        numchildren: 0,
        size: 6,
        children: undefined
      } ], 4)
      expect(n2.parent).toBe(null)
      expect(n2.cid).toBe(123)
      expect(n2.stackDepth).toBe(4)
      expect(n2.name).toBe('name')
      expect(n2.fullname).toBe('name')
      expect(n2.value).toBe('name')
      expect(n2.size).toBeUndefined()
      expect(n2.type).toBe('name')
      expect(n2.hasChildren).toBe(true)
      expect(n2.isReadOnly).toBe(true)
    })
  })
})
