<template>
  <li>
    <template v-if="value._children && value._children.length">
      <div @click="is_open = !is_open" class="cursor-pointer">
        <svg-icon :size="12" type="mdi" :path="is_open ? open_icon : closed_icon"></svg-icon>
        <code>{{ value.name }}</code>
      </div>
      <ul v-if="is_open">
        <tree-node v-for="(item, index) in value._children" :value="item" :path="path.concat(index)"></tree-node>
      </ul>
    </template>
    <div class="no-icon" v-else>
      <code>{{ value.name }}</code> : <code>{{ value._value }}</code>
    </div>
  </li>
</template>

<script>
import SvgIcon from '@jamescoyle/vue-icon'
import { mdiMenuRightOutline, mdiMenuDownOutline } from '@mdi/js'
import { EventBus } from '../event_bus.js'

export default {
  data() {
    return {
      is_open: false,
      open_icon : mdiMenuDownOutline,
      closed_icon : mdiMenuRightOutline,
    };
  },
  components: {
    SvgIcon
  },
  props: {
    value: {
      default: () => {},
    },
    path: {
      default: () => [],
    }
  },
  computed: {
    n_additional_children: function() {
      return Math.max(0, (this.value.numchildren || 0) - (this.value._children || []).length);
    },
  },
  created() {
    if (this.n_additional_children && !(this.value._children && this.value._children.length )) {
      EventBus.$emit('fetch-property', {property: this.value, path: this.path});
    }
  }
}
</script>

<style>
ul { list-style: none; padding-left: 0; }
ul ul { padding-left: 16px; }
.no-icon { margin-left: 16px; }
</style>

// vim: shiftwidth=2 tabstop=2
