<template>
  <collapsible-vertical-pane :title="title">
    <div>
      <div v-for="conn in connections">
        <span class="cursor-pointer" @click="toggle(conn.cid)">
          <svg-icon :size="12" type="mdi" :path="is_open[conn.cid] ? open_icon : closed_icon"></svg-icon>
          {{ conn.initial_file }}
        </span>
        <button @click="onPairClicked(conn.cid)" :disabled="conn.wamp_session == session_id">Pair</button>
        <div v-if="is_open[conn.cid]" class="ml-2">
          Codebase: {{ conn.codebase_id }}<br>
          Host: {{ conn.host }}<br>
          Time: {{ conn_times_formatted[conn.cid] }}<br>
        </div>
      </div>
    </div>
  </collapsible-vertical-pane>
</template>

<script>
import { EventBus } from '../event_bus.js'
import { mdiMenuRightOutline, mdiMenuDownOutline } from '@mdi/js'
import SvgIcon from '@jamescoyle/vue-icon'
import CollapsibleVerticalPane from './collapsible_vertical_pane.vue'

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

export default {
  components: {
    CollapsibleVerticalPane,
    SvgIcon,
  },
  computed: {
    conn_times_formatted: function() {
      let out = {};
      for (let cid in this.connections) {
        out[cid] = formatUnixTime(this.connections[cid].time);
      }
      return out;
    },
  },
  props: {
    connections: {
      required: true,
    },
    session_id: {
      default: '',
    }
  },
  methods: {
    onPairClicked(cid) {
      EventBus.$emit('dbgp-pair-requested', {cid});
    },
    toggle(cid) {
      this.$set(this.is_open, cid, !this.is_open[cid]);
    },
  },
  data() {
    return {
      title: 'Debug Connections',
      is_open: {}, 
      open_icon: mdiMenuDownOutline,
      closed_icon: mdiMenuRightOutline,
    };
  },
}
</script>
// vim: shiftwidth=2 tabstop=2
