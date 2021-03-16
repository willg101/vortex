<template>
  <ul>
    <tree-node v-for="(item, index) in context" :value="item" :path="[index]"></tree-node>
  </ul>
</template>

<script>
import SvgIcon from '@jamescoyle/vue-icon'
import { mdiMenuRightOutline, mdiMenuDownOutline } from '@mdi/js'
import { EventBus } from '../event_bus.js'

export default {
  data() {
    return {
      is_open: {},
      open_icon : mdiMenuDownOutline,
      closed_icon : mdiMenuRightOutline,
    };
  },
  components: {
    SvgIcon
  },
  props: {
    context: {
      default: () => {},
      page_size: 32,
    },
  },
}
</script>

<style>
ul { list-style: none; padding-left: 0; }
ul ul { padding-left: 16px; }
.no-icon { margin-left: 16px; }
</style>

// vim: shiftwidth=2 tabstop=2
