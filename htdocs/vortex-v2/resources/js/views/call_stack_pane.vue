<template>
  <collapsible-vertical-pane :title="title">
    <div>
      <div v-for="frame in call_stack._children" :class="(selected_depth == frame.level ? '': 'no-icon') + ' frame-line'" @click="onFrameClicked(frame.level)">
        <svg-icon v-if="selected_depth == frame.level" :size="12" type="mdi" :path="selected_icon"></svg-icon>
        {{ frame.where }} <span class="frame-position">{{ frame.filename }}:{{ frame.lineno }}</span>
      </div>
    </div>
  </collapsible-vertical-pane>
</template>

<script>
import { EventBus } from '../event_bus.js'
import { mdiArrowRightCircle } from '@mdi/js'
import SvgIcon from '@jamescoyle/vue-icon'
import CollapsibleVerticalPane from './collapsible_vertical_pane.vue'

export default {
  components: {
    CollapsibleVerticalPane,
    SvgIcon
  },
  props: {
    call_stack: {},
    selected_depth: {
      default: -1,
    },
  },
  methods: {
    onFrameClicked(level) {
      EventBus.$emit('set-stack-depth-requested', {depth: level});
    }
  },
  data() {
    return {
      title: 'Call Stack',
      selected_icon: mdiArrowRightCircle,
    };
  },
}
</script>

<style>
.frame-line {
  font-family: monospace;
}
.frame-position {
  color: #888;
}
</style>
// vim: shiftwidth=2 tabstop=2
