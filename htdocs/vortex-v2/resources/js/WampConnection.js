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
      let status = this.connection.isRetrying ? 'reconnecting' : 'disconnected';
      this.eventBus.$emit('wamp-connection-status-changed', { status });
    };
    this.connection.open();
  }
  call(...args) {
    return this.connection.session.call(...args);
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
    return this.call('vortex.debug_connection.pair', [], {'wamp_cid' : this.connection.session.id, 'dbgp_cid' : dbgp_cid});
  }
  listRecentFiles(dbgp_cid) {
    return this.call('vortex.debug_connection.list_recent_files', [], {'dbgp_cid' : dbgp_cid});
  }
  sendContinuationCommand(dbgp_cid, command) {
    if (!command.match(/^(run|step_over|step_into|step_out|stop|detach)$/)) {
      throw new Error(`Invalid continuation command: '${command}'`);
    }
    return this.call('vortex.debug_connection.send_command', [], {command, dbgp_cid});
  }
  source(dbgp_cid, file_uri) {
    let args = {};
    if (file_uri) {
      args.f = file_uri;
    }
    return this.call('vortex.debug_connection.send_command', [], {dbgp_cid, command: 'source', args});
  }
}
// vim: shiftwidth=2 tabstop=2
