require('./bootstrap');

import Vue from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import Toolbar from './views/toolbar.vue'
import { EventBus } from './event_bus.js'
import WampConnection from './WampConnection.js'

Vue.component('splitpanes', Splitpanes);
Vue.component('pane', Pane);
Vue.component('toolbar', Toolbar);

function formatUnixTime(unixTimeSeconds) {
  let unixTimeMilliseconds = unixTimeSeconds * 1000;
  let date = new Date(unixTimeMilliseconds);
  let hours = date.getHours();
  let minutes = "0" + date.getMinutes();
  let seconds = "0" + date.getSeconds();
  let amPm = (hours > 11) ? 'pm' : 'am';
  hours -= (hours > 12) ? 12 : 0;
  hours = (hours == 0 )? 12 : hours;
  return `${hours}:${minutes.substr(-2)}:${seconds.substr(-2)} ${amPm}`;
}

// Vue application
const app = new Vue({
  el: '#app',
  data: function () {
    return {
      debug_connections: {},
      wamp_connection_status: '',
      session_id : '',
      recent_files: [],
    };
  },
  computed: {
    conn_times_formatted: function() {
      let out = {};
      for (let cid in this.debug_connections) {
        out[cid] = formatUnixTime(this.debug_connections[cid].time);
      }
      return out;
    },
  },
  created() {
    EventBus.$on('debug-command', e => {
      console.log('debug-command', e.id)
    });
    EventBus.$on('debug-connections-changed', e => {
      this.debug_connections = e.connections;
    });
    EventBus.$on('wamp-connection-status-changed', e => {
      this.wamp_connection_status = e.status;
      if (e.session_id) {
        this.session_id = e.session_id;
      } else {
        this.session_id = '';
      }
    });
    this.wamp_conn = new WampConnection('wss://' + location.hostname + '/pubsub', EventBus);
  },
  methods: {
    onRestartServerClicked: function(e) {
      this.wamp_conn.restartSocketServer();
    },
    onPairDbgpSessionClicked: function(dbgp_cid) {
      this.recent_files = [];
      this.wamp_conn.pair(dbgp_cid);
      this.wamp_conn.listRecentFiles(dbgp_cid)
        .then(recent_files => this.recent_files = recent_files);
    },
  },
  template: `
  <div class="app-wrapper relative h-100 w-100 d-flex flex-column">
    <div class="flex-grow-0">
      <toolbar></toolbar>
    </div>
    <div class="flex-grow-1 relative h-100">
      <splitpanes class="default-theme relative h-100">
        <pane min-size="20">
          <ul>
            <li v-for="conn in debug_connections">
              <b>{{ conn.file }}</b>
              |
              {{ conn.codebase_id }} on {{ conn.host }}
              ({{ conn_times_formatted[conn.cid] }})
              <button @click="onPairDbgpSessionClicked(conn.cid)" :disabled="conn.wamp_session == session_id">Pair</button>
              </li>
          </ul>
        </pane>
        <pane>
          <splitpanes horizontal>
            <pane>
              <ul>
                <li v-for="file in recent_files.args">{{ file._children[0]._value }}</li>
              </ul>
            </pane>
            <pane>3</pane>
            <pane>4</pane>
          </splitpanes>
        </pane>
        <pane>
          Connection status: {{ wamp_connection_status }}<br>
          <button @click="onRestartServerClicked">Restart Socket Server</button>
        </pane>
      </splitpanes>
    </div>
  </div>`
});

toastr.options.showMethod = 'slideDown';
toastr.options.hideMethod = 'slideUp';

$.ajaxSetup({
  headers: {
    'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
  }
});
// vim: tabstop=2 shiftwidth=2 syntax=javascript
