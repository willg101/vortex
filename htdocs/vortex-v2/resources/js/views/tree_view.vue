<template>
  <ul>
    <li v-for="(item, index) in context">
      <template  v-if="item._children && item._children.length">
        <div @click="toggleItem(index)" class="cursor-pointer">
          <svg-icon :size="12" type="mdi" :path="is_open[index] ? open_icon : closed_icon"></svg-icon>
          <code>{{ item.name }}</code>
        </div>
        <tree-view v-if="is_open[index]" :context="item._children"></tree-view>
      </template>
      <div class="no-icon" v-else>
        <code>{{ item.name }}</code> : <code>{{ item._value }}</code>
      </div>
    </li>
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
    }
  },
  methods: {
    toggleItem(index) {
      this.$set(this.is_open, index, !this.is_open[index]);
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
