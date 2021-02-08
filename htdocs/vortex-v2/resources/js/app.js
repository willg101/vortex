require('./bootstrap');

import Vue from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import Toolbar from './views/toolbar.vue'
import { EventBus } from './event_bus.js'

Vue.component('splitpanes', Splitpanes);
Vue.component('pane', Pane);
Vue.component('toolbar', Toolbar);

let reconnectInterval = null;
function doConnect() {
  console.warn('Attmpting WAMP connection...');
  window.conn = new ab.Session('wss://vortex-v2.wgroenen.dart.ccel.org/pubsub',
      function() {
          clearInterval(reconnectInterval);
          conn.subscribe('general', function(topic, data) {
              // This is where you would add the new article to the DOM (beyond the scope of this tutorial)
              console.log('New article published to category "' + topic, data);
          });
      },
      function() {
        clearInterval(reconnectInterval);
        console.warn('WebSocket connection closed; reconnecting in 2 seconds...');
        reconnectInterval = setInterval(doConnect, 2000);
      },
      {'skipSubprotocolCheck': true}
  );
}
doConnect();

// Vue application
const app = new Vue({
  el: '#app',
  data: {
  },
  created() {
    EventBus.$on('debug-command', e => {
      console.log('debug-command', e.id)
    });
  },
  template: `
  <div class="app-wrapper relative h-100 w-100 d-flex flex-column">
    <div class="flex-grow-0">
      <toolbar></toolbar>
    </div>
    <div class="flex-grow-1 relative h-100">
      <splitpanes class="default-theme relative h-100">
        <pane min-size="20">1</pane>
        <pane>
          <splitpanes horizontal>
            <pane>2</pane>
            <pane>3</pane>
            <pane>4</pane>
          </splitpanes>
        </pane>
        <pane>5</pane>
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
