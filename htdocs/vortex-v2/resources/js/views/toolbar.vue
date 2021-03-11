<template>
  <div class="bg-dark fg-light p-1">
    <span v-for="button in buttons.left" class="d-inline-block mr-2" @click="buttonClicked(button)"><span class="iconify" :data-icon="'mdi:' + button.icon"></span></span>
    <span class="float-right d-block">
      <span @click="restartClicked"><svg-icon :size="20" type="mdi" title="Restart socket server" :path="restart_icon"></svg-icon></span>
      <svg-icon :size="20" type="mdi" :title="connection_status" :path="status_icon"></svg-icon>
    </span>
  </div>
</template>

<script>
import { EventBus } from '../event_bus.js'
import SvgIcon from '@jamescoyle/vue-icon'
import { mdiCloseNetwork, mdiNetwork, mdiCheckNetwork, mdiConsoleNetwork, mdiRestart } from '@mdi/js'

export default {
  components: {
    SvgIcon,
  },
  props: {
    connection_status: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      buttons: {
        left: [
          { id: 'run',       icon: 'play' },
          { id: 'stop',      icon: 'close-octagon' },
          { id: 'detach',    icon: 'link-variant-remove' },
          { id: 'step_into', icon: 'debug-step-into' },
          { id: 'step_over', icon: 'debug-step-over' },
          { id: 'step_out',  icon: 'debug-step-out' },
        ],
      },
      restart_icon: mdiRestart,
    };
  },
  computed: {
    status_icon() {
      switch (this.connection_status) {
        case 'connecting': return mdiNetwork;
        case 'connected': return mdiCheckNetwork;
        case 'disconnected': return mdiCloseNetwork;
        case 'paired': return mdiConsoleNetwork;
        default: throw new Error(`Unsupported status '${this.connection_status}'`);
      }
    },
  },
  methods: {
    buttonClicked(button) {
      EventBus.$emit('debug-command', button);
    },
    restartClicked() {
      EventBus.$emit('restart-socket-server-requested');
    }
  },
}
</script>

// vim: shiftwidth=2 tabstop=2
