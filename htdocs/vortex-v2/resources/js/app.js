require('./bootstrap');

import Vue from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import Toolbar from './views/toolbar.vue'
import TreeView from './views/tree_view.vue'
import { EventBus } from './event_bus.js'
import WampConnection from './WampConnection.js'
import { PrismEditor as CodeViewer } from './vue-prism-editor.js';

// import highlighting library (you can use any library you want just return html string)
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-dark.css'; // import syntax highlighting styles

Vue.component('splitpanes', Splitpanes);
Vue.component('pane', Pane);
Vue.component('toolbar', Toolbar);
Vue.component('code-viewer', CodeViewer);
Vue.component('tree-view', TreeView);

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
      code: "let foo = 'a';\nvar bar = 'ffff';",
      debug_connections: {},
      wamp_connection_status: '',
      session_id : '',
      recent_files: [],
      line_breakpoints: {},
      all_breakpoints: {},
      context: {},
    };
  },
  computed: {
    file_breakpoints: function() {
      return this.line_breakpoints[this.current_file] || {};
    },
    current_line : function() {
      return this.debug_connections[this.dbgp_cid]
        && Number.parseInt(this.debug_connections[this.dbgp_cid].current_line)
        || 0;
    },
    current_file : function() {
      return this.debug_connections[this.dbgp_cid]
        && this.debug_connections[this.dbgp_cid].current_file
        || null;
    },
    conn_times_formatted: function() {
      let out = {};
      for (let cid in this.debug_connections) {
        out[cid] = formatUnixTime(this.debug_connections[cid].time);
      }
      return out;
    },
    dbgp_cid: function() {
      for (let cid in this.debug_connections) {
        if (this.debug_connections[cid].wamp_session == this.session_id) {
          return cid;
        }
      }
      return null;
    }
  },
  created() {
    EventBus.$on('debug-command', e => {
      //console.log('debug-command', e.id)
      if (this.dbgp_cid) {
        this.wamp_conn.sendContinuationCommand(this.dbgp_cid, e.id)
          .then(data => {
            this.showFile();
            this.updateContext();
          });
      }
    });
    EventBus.$on('debug-connections-changed', e => {
      this.debug_connections = e.connections;
    });
    EventBus.$on('debugger-engine-notification', e => {
      let msg = e.msg;
      if (msg.name == 'breakpoint_resolved') {
        (msg._children || []).forEach(breakpoint => {
          let file = breakpoint.filename;
          let old_line = this.all_breakpoints[breakpoint.id]
            && this.all_breakpoints[breakpoint.id].line;
          if (old_line) {
            this.$delete(this.line_breakpoints[breakpoint.filename], old_line);
          }
          if (!this.line_breakpoints[file]) {
            this.$set(this.line_breakpoints, file, {});
          }
          this.$set(this.all_breakpoints, breakpoint.id , { type: 'line', file, line: e.line });
          this.$set(this.line_breakpoints[breakpoint.filename], breakpoint.lineno, { id: breakpoint.id});

          // TODO: For resolved breakpoints, we can't assume they are line breakpoints
          // TODO: re-use code between this function and $onLineClicked()
        });
      }
    });
    EventBus.$on('line-clicked', e => this.onLineClicked(e));
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
    onLineClicked(e) {
      if (this.dbgp_cid) {
        let file = this.current_file;
        if (this.line_breakpoints[file] && this.line_breakpoints[file][e.line]) {
          let bpid = this.line_breakpoints[file][e.line].id;
          this.wamp_conn.removeBreakpoint(this.dbgp_cid, bpid)
            .then(() => {
              this.$delete(this.line_breakpoints[file], e.line)
              this.$delete(this.all_breakpoints, bpid);
            });
        } else {
          this.wamp_conn.addLineBreakpoint(this.dbgp_cid, file, e.line)
            .then(data => {
              if (this.all_breakpoints[data.id]) {
                return; // Already been resolved
              }

              if (!this.line_breakpoints[file]) {
                this.$set(this.line_breakpoints, file, {});
              }
              this.$set(this.line_breakpoints[file], e.line, { id: data.id });
              this.$set(this.all_breakpoints, data.id , { type: 'line', file, line: e.line });
            });
        }
      }
    },
    showFile(uri) {
      this.wamp_conn.source(this.dbgp_cid, uri).then(data => {
        this.code = data._value;
      });
    },
    updateContext(context_id, depth) {
      this.wamp_conn.getContext(this.dbgp_cid, context_id, depth).then(data => {
        this.context = data._children;
      })
    },
    onRestartServerClicked: function(e) {
      this.wamp_conn.restartSocketServer();
    },
    onPairDbgpSessionClicked: function(dbgp_cid) {
      this.recent_files = [];
      this.wamp_conn.pair(dbgp_cid).then(data => console.log(data))
      this.wamp_conn.listRecentFiles(dbgp_cid)
        .then(recent_files => {
          this.recent_files = recent_files;
          this.showFile();
          this.updateContext();
        })
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
              <b>{{ conn.initial_file }}</b>
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
            <pane>
              <code-viewer :line-numbers=true :breakpoints="file_breakpoints"  :current_line="current_line" :code="code"></code-viewer>
            </pane>
            <pane><tree-view :context=context ></tree-view></pane>
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
