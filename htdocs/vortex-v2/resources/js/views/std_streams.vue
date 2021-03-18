<template>
  <collapsible-vertical-pane :title="title">
    <ul>
      <li v-for="msg in messages" :class="msg.type + '-msg'">
        <template v-if="msg.pending">
          <input @keyup.enter="sendMessage" />
        </template>
        <template v-else>
          {{ msg.text }}
          <br>
          <svg-icon :size="12" type="mdi" :path="msg.type == 'in' ? up_icon : down_icon"></svg-icon>
          {{ msg.time }} | {{ msg.type }}
        </template>
      </li>
    </ul>
  </collapsible-vertical-pane>
</template>

<script>
import SvgIcon from '@jamescoyle/vue-icon'
import { mdiArrowUpBoldOutline, mdiArrowDownBoldOutline } from '@mdi/js'
import { EventBus } from '../event_bus.js'
import CollapsibleVerticalPane from './collapsible_vertical_pane.vue'

export default {
  data() {
    return {
      title : 'Messages',
      up_icon : mdiArrowUpBoldOutline,
      down_icon : mdiArrowDownBoldOutline,
    };
  },
  components: {
    SvgIcon,
    CollapsibleVerticalPane,
  },
  props: {
    messages: {
      default: () => [],
    },
  },
  methods: {
    sendMessage(e) {
      EventBus.$emit('send-stdin', { message: e.target.value });
    }
  },
}
</script>

<style>
ul { list-style: none; padding-left: 0; }
ul ul { padding-left: 16px; }
.no-icon { margin-left: 16px; }
</style>

// vim: shiftwidth=2 tabstop=2
