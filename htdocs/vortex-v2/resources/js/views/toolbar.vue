<template>
  <div class="bg-dark fg-light p-1">
    <i v-for="button in buttons.left" :class="'d-inline-block mr-2 fa-fw fas fa-' + button.icon" @click="buttonClicked(button)"></i> 
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
          { id: 'stop',      icon: 'window-close' },
          { id: 'detach',    icon: 'unlink' },
          { id: 'step_into', icon: 'level-down-alt' },
          { id: 'step_over', icon: 'step-forward' },
          { id: 'step_out',  icon: 'level-up-alt' },
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
