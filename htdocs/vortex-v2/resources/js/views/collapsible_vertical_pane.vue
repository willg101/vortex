<template>
  <div>
    <div class="pane-header d-flex cursor-pointer">
      <span @click="is_open = !is_open" class="pane-toggle flex-grow-1">
        <svg-icon :size="12" type="mdi" :path="is_open ? open_icon : closed_icon"></svg-icon>
        {{ title }}
      </span>
      <span class="flex-grow-0">
        <button v-if="is_open" v-for="button in buttons" @click="onClick(button.id)">
          <svg-icon :size="20" type="mdi" :path="button.icon"></svg-icon>
        </button>
      </span>
    </div>
    <keep-alive>
      <slot v-if="is_open"></slot>
    </keep-alive>
  </div>
</template>

<script>
import { EventBus } from '../event_bus.js'
import SvgIcon from '@jamescoyle/vue-icon'
import { mdiMenuRightOutline, mdiMenuDownOutline } from '@mdi/js'

export default {
  components: {
    SvgIcon,
  },
  props: {
    title: {
      type: String,
      required: true,
    },
    buttons: {
      type: Array,
      default: () => [],
    }
  },
  data() {
    return {
      is_open: false,
      open_icon: mdiMenuDownOutline,
      closed_icon: mdiMenuRightOutline,
    };
  },
  methods: {
    onClick(button_id) {
      EventBus.$emit('action-button-clicked', { button: button_id });
    }
  }
}
</script>

<style>
</style>
// vim: shiftwidth=2 tabstop=2
