import File from './File.module.js'
import Debugger from './Debugger.module.js'
import QueuedSessionsIndicator from './QueuedSessionsIndicator.module.js'
import LanguageAbstractor from './LanguageAbstractor.module.js'

class Breakpoint {
  constructor (file, line, expression, id) {
    this.info = { file, line, expression, id }
    this.info.state = id ? 'confirmed' : 'offline'
    this.triggerStateChange()
    this.sendToDebugger()
  }

  get id () { return this.info.id }
  get expression () { return this.info.expression }
  get file () { return this.info.file }
  set line (n) {
    if (n == this.info.line || n == this.info.movingToLine) {
      return;
    }
    this.info.movingToLine = n;
    let prevState   = this.state;
    this.info.state = 'moving';
    this.triggerStateChange();
    this.info.line  = n;
    this.info.state = prevState;
    this.triggerStateChange();
    delete this.info.movingToLine;
  }
  get line () { return this.info.line }
  get state () { return this.info.state }
  get type () { return this.expression ? 'conditional' : 'line' }

  triggerStateChange () {
    publish('breakpoint-state-change', { breakpoint: this })
  }

  async sendToDebugger () {
    if (!Debugger.sessionIsActive() || this.state == 'confirmed') {
      return
    }

    var filename = this.file

    if (File.isCodebaseRelative(filename)) {
      var codebase = await QueuedSessionsIndicator.getCurrentCodebase()
      if (codebase.id && codebase.root) {
        filename = File.convertFromCodebaseRelativePath(filename, codebase.id, codebase.root)
        // If the path is still codebase-relative, it's not a reference to a file in the
        // current codebase
        if (File.isCodebaseRelative(filename)) {
          return
        }
      }
    }

    this.info.state = 'pending'
    this.triggerStateChange()

    var data = await Debugger.command('breakpoint_set', {
      type: this.type,
      line: this.line,
      file: filename
    }, this.expression)
    this.info.id = data.parsed.id

    this.info.state = 'confirmed'
    this.triggerStateChange()
  }

  async removeFromDebugger () {
    if (Debugger.sessionIsActive() && this.state != 'removed') {
      this.info.state = 'pending'
      this.triggerStateChange()

      await Debugger.command('breakpoint_remove', { breakpoint: this.id })
    }

    this.info.state = 'removed'
    this.triggerStateChange()
  }

  goOffline () {
    delete this.info.id
    this.info.state = 'offline'
    this.triggerStateChange()
  }
}

class SessionBreakpoints {
  constructor () {
    this.breakpointsById = {}
    this.breakpointsByFile = {}
    this.pendingResolution = {};
    subscribe('session-status-changed', (e) => {
      if (e.status == 'active') {
        this.importFromDebuggerEngine()
      } else {
        this.apply(bp => bp.goOffline())
        this.breakpointsById = {};
      }
    })

    subscribe('breakpoint-state-change', e => {
      if (e.breakpoint.state != 'removed'
        && e.breakpoint.state != 'moving'
        && e.breakpoint.id
        && this.breakpointsByFile[ e.breakpoint.file ]
        && this.breakpointsByFile[ e.breakpoint.file ][ e.breakpoint.line ])
      {
        if (!this.breakpointsById[e.breakpoint.id]) {
           this.breakpointsById[e.breakpoint.id]
            = this.breakpointsByFile[ e.breakpoint.file ][ e.breakpoint.line ];
        }

        if (this.pendingResolution[ e.breakpoint.id ]
          && this.pendingResolution[ e.breakpoint.id ] != this.breakpointsById[e.breakpoint.id].line) {
          let prevLine = this.breakpointsById[e.breakpoint.id].line;

          this.breakpointsById[e.breakpoint.id].line = this.pendingResolution[ e.breakpoint.id ];
          this.breakpointsByFile[ e.breakpoint.file ][ e.breakpoint.line ]
            = this.breakpointsByFile[ e.breakpoint.file ][ prevLine ];

          delete this.pendingResolution[ e.breakpoint.id ];
          delete this.breakpointsByFile[ e.breakpoint.file ][ prevLine ];
        }
      }
    });

    subscribe('notification-received', (e) => {
      if (e.jqMessage.is('[name=breakpoint_resolved]')) {
        (e.parsed.line || []).forEach(bp => {
          let resolvedLine = bp.lineno;
          if (this.breakpointsById[ bp.id ]) {
            let prevLine = this.breakpointsById[ bp.id ].line;
            let file     = this.breakpointsById[ bp.id ].file;
            this.breakpointsById[ bp.id ].line = resolvedLine;
            delete this.breakpointsByFile[ file ][ prevLine ];
            this.breakpointsByFile[ file ][ resolvedLine ] = this.breakpointsById[ bp.id ];
          } else {
            this.pendingResolution[ bp.id ] = resolvedLine;
          }
        });
      }
    });
  }

  listForFile (filename) {
    return this.breakpointsByFile[ filename ] || []
  }

  apply (func) {
    for (let file in this.breakpointsByFile) {
      for (let line in this.breakpointsByFile[ file ]) {
        func(this.breakpointsByFile[ file ][ line ])
      }
    }
  }

  clearAll () {
    this.apply(breakpoint => this.del(breakpoint.file, breakpoint.line))
  }

  async importFromDebuggerEngine () {
    var realPathToCrp = {}
    var breakpoints = await Debugger.command('breakpoint_list')
    var importEach = async bp => {
      var filename = File.stripScheme(bp.filename)

      if (typeof realPathToCrp[ filename ] === 'undefined') {
        let codebaseRoot = await LanguageAbstractor.getCodebaseRoot(filename)
        if (codebaseRoot.id && codebaseRoot.root) {
          realPathToCrp[ filename ] = File.convertToCodebaseRelativePath(filename,
            codebaseRoot.id, codebaseRoot.root)
        } else {
          realPathToCrp[ filename ] = false
        }
      }
      if (realPathToCrp[ filename ]) {
        filename = realPathToCrp[ filename ]
      }

      this.breakpointsByFile[ filename ] = this.breakpointsByFile[ filename ] || {}
      if (this.breakpointsByFile[ filename ][ bp.lineno ]) {
        this.breakpointsByFile[ filename ][ bp.lineno ].info.state = 'confirmed'
        this.breakpointsByFile[ filename ][ bp.lineno ].info.id = bp.id
      } else {
        this.breakpointsByFile[ filename ][ bp.lineno ] = new Breakpoint(filename, bp.lineno,
          bp.expression || bp.expression_element, bp.id)
      }
      this.breakpointsById[ bp.id ] = this.breakpointsByFile[ filename ][ bp.lineno ];
      this.breakpointsByFile[ filename ][ bp.lineno ].triggerStateChange()
    }
    let linePromises = breakpoints.parsed.line.map(importEach)
    let conditionalPromises = breakpoints.parsed.conditional.map(importEach)

    await Promise.all(linePromises.concat(conditionalPromises))
    this.apply(bp => bp.sendToDebugger())
  }

  toggle (file, line, expression) {
    if (this.breakpointsByFile[ file ] && this.breakpointsByFile[ file ][ line ]) {
      this.del(file, line)
    } else {
      this.create(file, line, expression)
    }
  }

  del (file, line) {
    if (!this.breakpointsByFile[ file ] || !this.breakpointsByFile[ file ][ line ]) {
      return
    }
    this.breakpointsByFile[ file ][ line ].removeFromDebugger()
    delete this.breakpointsByFile[ file ][ line ]
  }

  create (file, line, expression) {
    if (!this.breakpointsByFile[ file ]) {
      this.breakpointsByFile[ file ] = {}
    }
    if (!this.breakpointsByFile[ file ][ line ]) {
      this.breakpointsByFile[ file ][ line ] = new Breakpoint(file, line, expression)
    }
  }

  get (file, line) {
    return ( this.breakpointsByFile[ file ] && this.breakpointsByFile[ file ][ line ] ) || null
  }
}

var sessionBreakpoints = new SessionBreakpoints()

export default sessionBreakpoints
