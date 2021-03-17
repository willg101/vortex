require('./bootstrap');

import Vue from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import Toolbar from './views/toolbar.vue'
import TreeView from './views/tree_view.vue'
import TreeNode from './views/tree_node.vue'
import ScopePane from './views/scope_pane.vue'
import ConnectionsPane from './views/connections_pane.vue'
import FilesPane from './views/files_pane.vue'
import CallStackPane from './views/call_stack_pane.vue'
import BreakpointConfig from './views/dialogs/breakpoint_config.vue'
import { EventBus } from './event_bus.js'
import WampConnection from './WampConnection.js'
import { PrismEditor as CodeViewer } from './vue-prism-editor.js';
import VModal from 'vue-js-modal/dist/index.nocss.js'
import 'vue-js-modal/dist/styles.css'

// import highlighting library (you can use any library you want just return html string)
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-dark.css'; // import syntax highlighting styles

Vue.component('splitpanes', Splitpanes);
Vue.component('pane', Pane);
Vue.component('toolbar', Toolbar);
Vue.component('code-viewer', CodeViewer);
Vue.component('tree-view', TreeView);
Vue.component('tree-node', TreeNode);
Vue.component('scope-pane', ScopePane);
Vue.component('connections-pane', ConnectionsPane);
Vue.component('files-pane', FilesPane);
Vue.component('call-stack-pane', CallStackPane);
Vue.use(VModal);

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
      all_breakpoints: {},
      context_cache: {},
      file_showing: '',
      selected_depth: 0,
      call_stack: {},
    };
  },
  computed: {
    context: function() {
      // TODO: generate version of context with functions to automatically fetch more data
      return this.dbgp_cid
        && (this.context_cache[this.selected_depth]
          || (this.updateContext() && {}))
        || {};
    },
    file_breakpoints: function() {
      let out = {};
      for (let i in this.all_breakpoints) {
        let bp = this.all_breakpoints[i];
        if ((bp.type == 'line' || bp.type == 'conditional') && bp.filename == this.file_showing) {
          out[bp.lineno] = bp;
        }
      }
      return out;
    },
    current_line : function() {
      return this.debug_connections[this.dbgp_cid]
        && this.file_showing == this.current_file
        && parseInt(this.call_stack._children[this.selected_depth].lineno)
        || 0;
    },
    current_file : function() {
      return this.call_stack._children && this.call_stack._children[this.selected_depth]
        && this.call_stack._children[this.selected_depth].filename
        || null;
    },
    dbgp_cid: function() {
      for (let cid in this.debug_connections) {
        if (this.debug_connections[cid].wamp_session == this.session_id) {
          return cid;
        }
      }
      return null;
    },
    files: function() {
      let out = {};
      if (this.current_file) {
        out[this.current_file] = true;
      }
      for (let i in this.recent_files.args) {
        out[this.recent_files.args[i]._children[0]._value] = true;
      }
      return Object.keys(out);
    },
    connection_status: function() {
      return (this.wamp_connection_status == 'connected' && this.dbgp_cid)
        ? 'paired'
        : this.wamp_connection_status;
    },
  },
  created() {
    EventBus.$on('debug-command', e => {
      if (this.dbgp_cid) {
        this.wamp_conn.sendContinuationCommand(this.dbgp_cid, e.id)
          .then(data => {
            this.selected_depth = 0;
            this.context_cache = {};
            this.updateContext();
            this.updateCallStack().then(() => this.showFile(this.current_file));
          });
      }
    });
    EventBus.$on('fetch-additional-children', e => {
      let depth = this.selected_depth;
      let next_page = (parseInt(e.property.page) || 0) + 1;
      this.wamp_conn.getValue(this.dbgp_cid, e.property.fullname, depth, next_page).then(data => {
        this.augmentContextCache(e.path, depth, {
          page: next_page,
          _children: e.property._children.concat(data._children[0]._children)
        });
      });

    });
    EventBus.$on('fetch-property', e => {
      let depth = this.selected_depth;
      this.wamp_conn.getValue(this.dbgp_cid, e.property.fullname, depth).then(data => {
        this.augmentContextCache(e.path, depth, data._children[0]); 
      });
    });
    EventBus.$on('set-stack-depth-requested', e => this.selected_depth = e.depth);
    EventBus.$on('debug-connections-changed', e => {
      this.debug_connections = e.connections;
    });
    EventBus.$on('restart-socket-server-requested', e => {
      this.wamp_conn.restartSocketServer();
    });
    EventBus.$on('debugger-engine-notification', e => {
      if (e.msg.name == 'breakpoint_resolved') {
        (e.msg._children || []).forEach(bp => this.storeBreakpoint(bp));
      }
    });
    EventBus.$on('line-clicked', e => this.onLineClicked(e));
    EventBus.$on('open-file-clicked', e => this.showFile(e.file));
    EventBus.$on('dbgp-pair-requested', e => this.onDbgpPairRequested(e));
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
    
    normalizeFilename(filename) {
      if (filename && !filename.match(/^\w+:\/\/\//)) {
        filename = filename.replace(/^\/*/, 'file:///');
      }
      return filename;
    },
    configureBreakpoint(bpid, cb) {
      let expression = '';
      if (bpid && this.all_breakpoints[bpid]) {
        try {
          expression = this.all_breakpoints[bpid]._children[0]._value;
        } catch (e) {
          // pass
        }
      }
      this.$modal.show(BreakpointConfig, {
        handleUpdate: cb,
        expression,
      });
    },
    storeBreakpoint(bp, optional_data = {}) {
      for (let k in optional_data) {
        if (typeof bp[k] == 'undefined') {
          bp[k] = optional_data[k];
        }
      }
      if (bp.filename) {
        bp.filename = this.normalizeFilename(bp.filename);
      }
      this.$set(this.all_breakpoints, bp.id, bp);
    },
    removeBreakpoint(bpid) {
      this.wamp_conn.removeBreakpoint(this.dbgp_cid, bpid)
        .then(() => {
          this.$delete(this.all_breakpoints, bpid);
        });
    },
    onLineClicked(e) {
      if (this.dbgp_cid) {
        let filename = this.file_showing;
        if (e.is_secondary) {
          let bpid = this.file_breakpoints[e.line] && this.file_breakpoints[e.line].id;
          this.configureBreakpoint(bpid, updates => {
            if(bpid) {
              this.removeBreakpoint(bpid);
            }
            this.wamp_conn.addLineBreakpoint(this.dbgp_cid, filename, e.line, updates.expression)
              .then(data => {
                if (this.all_breakpoints[data.id]) {
                  return; // Already been resolved
                } else {
                  this.storeBreakpoint(data, {lineno: e.line, filename, type: 'conditional'});
                }
              });
          });
          return;
        }
        if (this.file_breakpoints[e.line]) {
          let bpid = this.file_breakpoints[e.line].id;
          this.removeBreakpoint(bpid);
        } else {
          this.wamp_conn.addLineBreakpoint(this.dbgp_cid, filename, e.line)
            .then(data => {
              if (this.all_breakpoints[data.id]) {
                return; // Already been resolved
              } else {
                this.storeBreakpoint(data, {lineno: e.line, filename, type: 'line'});
              }
            });
        }
      }
    },
    showFile(uri) {
      this.wamp_conn.source(this.dbgp_cid, uri).then(data => {
        this.code = data._value;
        this.file_showing = this.normalizeFilename(uri);
      });
    },
    updateCallStack() {
      return this.wamp_conn.getCallStack(this.dbgp_cid).then(data => this.call_stack = data);
    },
    updateBreakpoints() {
      this.all_breakpoints  = {};
      this.wamp_conn.listBreakpoints(this.dbgp_cid).then(data => {
        (data._children || []).forEach(bp => {
          this.storeBreakpoint(bp);
        });
      });
    },
    updateContext(context_id) {
      let depth = this.selected_depth;
      this.wamp_conn.getContext(this.dbgp_cid, depth, context_id).then(data => {
        this.$set(this.context_cache, depth, data._children);
      })
    },
    augmentContextCache(path, depth, data) {
      let prop = this.context_cache[depth] || {};
      let prop_par = null;
      path.forEach(part => {
        if (prop && prop[part] && prop[part]._children) {
          prop_par = prop[part];
          prop = prop_par._children;
        }
      });
      if (prop) {
        this.$set(prop_par, '_children', data._children);
        if (data.page) {
          this.$set(prop_par, 'page', data.page);
        }
      }
    },
    onDbgpPairRequested: function(e) {
      let dbgp_cid = e.cid;
      this.recent_files = [];
      this.wamp_conn.pair(dbgp_cid).then(() => {
        this.selected_depth = 0;
        this.context_cache = {};
        this.updateBreakpoints();
        this.updateCallStack().then(() => this.showFile(this.current_file));
        this.updateContext();
        this.wamp_conn.listRecentFiles(dbgp_cid)
          .then(recent_files => {
            this.recent_files = recent_files;
          });
        });
    },
  },
  template: `
  <div class="app-wrapper relative h-100 w-100 d-flex flex-column">
    <div class="flex-grow-0">
      <toolbar :connection_status="connection_status"></toolbar>
    </div>
    <div class="flex-grow-1 relative full-height-minus-bar">
      <splitpanes class="default-theme relative h-100">
        <pane min-size="20">
          <connections-pane :connections="debug_connections" :session_id="session_id"></connections-pane>
          <files-pane :files="files"></files-pane>
        </pane>
        <pane>
          <splitpanes horizontal>
            <pane>
              <code-viewer :line-numbers=true :breakpoints="file_breakpoints"  :current_line="current_line" :code="code"></code-viewer>
            </pane>
          </splitpanes>
        </pane>
        <pane>
          <div class="overflow-y-auto h-100 position-relative">
            <scope-pane :context=context></scope-pane>
            <call-stack-pane :call_stack=call_stack :selected_depth="selected_depth"></call-stack-pane>
          </div>
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
