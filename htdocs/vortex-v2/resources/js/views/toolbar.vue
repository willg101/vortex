<template>
  <div class="bg-dark fg-light p-1">
    <span v-for="button in buttons.left" class="d-inline-block mr-2" @click="buttonClicked(button)"><span class="iconify" :data-icon="'mdi:' + button.icon"></span></span>
  </div>
</template>

<script>
import { EventBus } from '../event_bus.js'

export default {
  data() {
    return {
      buttons: {
        left: [
          { id: 'run',       icon: 'play' },
          { id: 'stop',      icon: 'close-octagon' },
          { id: 'detach',    icon: 'link-variant-remove' },
          { id: 'step_forward', icon: 'step-forward' },
          { id: 'step_into', icon: 'debug-step-into' },
          { id: 'step_over', icon: 'debug-step-over' },
          { id: 'step_out',  icon: 'debug-step-out' },
        ],
        right: {
        }
      }
    };
  },
  computed: {},
  methods: {
    buttonClicked(button) {
      EventBus.$emit('debug-command', button);
    }
  },
}
</script>

// vim: shiftwidth=2 tabstop=2
