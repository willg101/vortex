<template>
  <collapsible-vertical-pane :title="title">
    <div>
      <div v-for="line in lines">
        <hr v-if="line === divider"/>
        <div v-else>{{ line }}</div>
      </div>
      <span>{{ prompt }}</span><input type="text" @keyup.enter="sendLine"/>
    </div>
  </collapsible-vertical-pane>
</template>

<script>
import { EventBus } from '../event_bus.js'
import CollapsibleVerticalPane from './collapsible_vertical_pane.vue'

export default {
  components: {
    CollapsibleVerticalPane,
  },
  props: {
    lines: {
      default: [],
    },
    divider: {
      type: Symbol,
    },
    prompt: {
      type: String,
    }
  },
  methods: {
    sendLine(e) {
      EventBus.$emit('interact-send-line', { text: e.target.value });
      e.target.value = '';
    },
  },
  data() {
    return {
      title: 'Console',
    }
  },
}
</script>
// vim: shiftwidth=2 tabstop=2
