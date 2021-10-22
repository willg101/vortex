export default class WampConnection {
  constructor(uri, eventBus) {
    this.uri = uri;
    this.eventBus = eventBus;
    this.connect();
  }
  connect() {
    this.eventBus.$emit('wamp-connection-status-changed', { status: 'connecting' });
    console.log(`Initiating WAMP connection to ${this.uri}...`);
    this.connection = new autobahn.Connection({url: this.uri, realm: 'realm1'});
    this.connection.onopen = session => {
      // ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! !
      // TODO: DEBUGGING CODE. REMOVE
      window._session = session;
      // ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! ! !
      this.eventBus.$emit('wamp-connection-status-changed', { status: 'connected', session_id : session.id });
      this.refreshDebugConnectionList();
      session.subscribe('vortex.debug_connections.change', (args, kwargs) => {
        this.broadcastConnectionsUpdated(kwargs.connections);
      });
    };
    this.connection.onclose = () => {
      let status = this.connection.isRetrying ? 'connecting' : 'disconnected';
      this.eventBus.$emit('wamp-connection-status-changed', { status });
    };
    this.connection.open();
  }
  call(...args) {
    return this.connection.session.call(...args);
  }
  subscribe(...args) {
    return this.connection.session.subscribe(...args);
  }
  restartSocketServer() {
    this.call('vortex.management.restart');
  }
  stopSocketServer() {
    this.call('vortex.management.stop');
  }
  refreshDebugConnectionList() {
    this.call('vortex.debug_connections.list')
      .then(data => this.broadcastConnectionsUpdated(data.connections));
  }
  broadcastConnectionsUpdated(conns) {
    this.eventBus.$emit('debug-connections-changed', { connections: conns });
  }
  pair(dbgp_cid) {
    return this.call('vortex.debug_connection.pair',[], {
      'wamp_cid' : this.connection.session.id,
      'dbgp_cid' : dbgp_cid
    }).then(() => {
      this.subscribe(
        'vortex.debug_connection.notifications.' + dbgp_cid,
        (_, msg) => this.eventBus.$emit('debugger-engine-notification', { msg }))
    });
  }
  listRecentFiles(dbgp_cid) {
    return this.call('vortex.debug_connection.list_recent_files', [], {'dbgp_cid' : dbgp_cid});
  }
  listBreakpoints(dbgp_cid) {
    return this.call('vortex.debug_connection.send_command', [], {
      command: 'breakpoint_list',
      dbgp_cid
    });
  }
  getCallStack(dbgp_cid) {
    return this.call('vortex.debug_connection.send_command', [], {
      command: 'stack_get',
      dbgp_cid
    });
  }
  sendContinuationCommand(dbgp_cid, command) {
    if (!command.match(/^(run|step_over|step_into|step_out|stop|detach)$/)) {
      throw new Error(`Invalid continuation command: '${command}'`);
    }
    return this.call('vortex.debug_connection.send_command', [], {command, dbgp_cid});
  }
  addLineBreakpoint(dbgp_cid, file, line, expression) {
    let type = expression ? 'conditional' : 'line';
    return this.call('vortex.debug_connection.send_command', [], {
      command: 'breakpoint_set',
      dbgp_cid,
      args : {
        t: type,
        f: file,
        n: line,
      },
      extra_data: expression,
    });
  }
  addCallBreakpoint(dbgp_cid, fn_name) {
    return this.call('vortex.debug_connection.send_command', [], {
      command: 'breakpoint_set',
      dbgp_cid,
      args : {
        t: 'call',
        m: fn_name,
      },
    });
  }
  addReturnBreakpoint(dbgp_cid, fn_name) {
    return this.call('vortex.debug_connection.send_command', [], {
      command: 'breakpoint_set',
      dbgp_cid,
      args : {
        t: 'return',
        m: fn_name,
      },
    });
  }
  addExceptionBreakpoint(dbgp_cid, ex_name) {
    return this.call('vortex.debug_connection.send_command', [], {
      command: 'breakpoint_set',
      dbgp_cid,
      args : {
        t: 'exception',
        x: ex_name,
      },
    });
  }
  addWatchBreakpoint(dbgp_cid, expr) {
    return this.call('vortex.debug_connection.send_command', [], {
      command: 'breakpoint_set',
      dbgp_cid,
      args : {
        t: 'watch',
      },
      extra_data: expr,
    });
  }
  toggleBreakpoint(dbgp_cid, bpid, state) {
    return this.call('vortex.debug_connection.send_command', [], {
      command: 'breakpoint_update',
      dbgp_cid,
      args : {
        d: bpid,
        s: state,
      },
    }); 
  }
  removeBreakpoint(dbgp_cid, bpid) {
    return this.call('vortex.debug_connection.send_command', [], {
      command: 'breakpoint_remove',
      dbgp_cid,
      args : {
        d: bpid,
      },
    });
  }
  getValue(dbgp_cid, full_name, depth, page) {
    let args = {
      d: depth,
      n: full_name,
    };
    if (page) {
      args.p = page;
    }
    return this.call('vortex.debug_connection.send_command', [], {
      command: 'property_get',
      dbgp_cid,
      args,
    });
  }
  source(dbgp_cid, file_uri) {
    let args = {};
    if (file_uri) {
      args.f = file_uri;
    }
    return this.call('vortex.debug_connection.send_command', [], {dbgp_cid, command: 'source', args});
  }
  getContext(dbgp_cid, depth, context_id) {
    let args = {};
    if (depth) {
      args.d = depth;
    }
    if (context_id) {
      args.c = context_id;
    }
    return this.call('vortex.debug_connection.send_command', [], {
      command: 'context_get',
      dbgp_cid,
      args
    });
  }
}
// vim: shiftwidth=2 tabstop=2
