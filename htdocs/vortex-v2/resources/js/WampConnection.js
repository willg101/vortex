export default class WampConnection {
  constructor(uri, reconnectDelaySeconds, eventBus) {
    this.uri = uri;
    this.eventBus = eventBus;
    this.reconnectDelay = 1000 * reconnectDelaySeconds;
    this.connect();
  }
  connect() {
    console.log(`Initiating WAMP connection to ${this.uri}...`);
    this.connection = new ab.Session(this.uri,
        () => {
          clearInterval(this.reconnectInterval);
          this.refreshDebugConnectionList();
          this.connection.subscribe('general', function(topic, data) {
            console.log('Event in "' + topic + '"', data);
          });
          this.connection.subscribe('control/hello', (t, d) => this.ws_id = d.ws_id);
          this.connection.subscribe('debug/notification', (t, d) => console.log(t, d));
          this.connection.subscribe('control/debug-connections-changed', (t, d) => {
            this.eventBus.$emit('debug-connections-changed', { connections: d })
          });
        },
        () => {
          clearInterval(this.reconnectInterval);
          console.warn(`WebSocket connection closed; reconnecting in ${this.reconnectDelay}ms...`);
          this.reconnectInterval = setInterval(() => this.connect(), this.reconnectDelay);
        },
        {'skipSubprotocolCheck': true}
    );
  }
  restartSocketServer() {
    this.connection.call('control/restart');
  }
  stopSocketServer() {
    this.connection.call('control/stop');
  }
  refreshDebugConnectionList() {
    this.connection.call('control/list-debug-connections')
      .promise.then(data => this.eventBus.$emit(
        'debug-connections-changed',
        { connections: data }
      ));
  }
  focusOnDebugConnection(cid) {
    this.connection.call('control/claim-focus', {'connection_id' : cid});
  }
}
// vim: shiftwidth=2 tabstop=2
