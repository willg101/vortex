<template>
  <collapsible-vertical-pane :title="title">
    <div>
      <div v-for="bp in breakpoints">
        <label>
          <input type="checkbox" :checked="bp.state == 'enabled'" @change="onBreakpointToggled(bp.id, bp.state)"/>
          <span v-if="bp.type == 'exception'"><code>{{ bp.exception }}</code> thrown</span>
          <span v-else-if="bp.type == 'return'">return from <code>{{ bp.function }}</code></span>
          <span v-else-if="bp.type == 'call'">call <code>{{ bp.function }}</code></span>
          <span v-else-if="bp.type == 'line'"><code>{{ bp.filename }}</code>:<code>{{ bp.lineno }}</code></span>
          <span v-else-if="bp.type == 'conditional'"><code>{{ bp.file }}</code>:<code>{{ bp.line }}</code><br><code>{{ bp._value }}</code></span>
        </label>
      </div>
    </div>
  </collapsible-vertical-pane>
</template>

<script>
import { EventBus } from '../event_bus.js'
import { mdiMenuRightOutline, mdiMenuDownOutline } from '@mdi/js'
import SvgIcon from '@jamescoyle/vue-icon'
import CollapsibleVerticalPane from './collapsible_vertical_pane.vue'

export default {
  components: {
    CollapsibleVerticalPane,
    SvgIcon,
  },
  props: {
    breakpoints: {
      required: true,
      default: () => [],
    },
  },
  data() {
    return {
      title: 'Breakpoints',
    };
  },
  methods: {
    onBreakpointToggled(bpid, oldState) {
      let newState = oldState == 'enabled' ? 'disabled' : 'enabled';
      EventBus.$emit('breakpoint-toggled', {bpid, newState});
    },
  },
}
</script>
// vim: shiftwidth=2 tabstop=2
