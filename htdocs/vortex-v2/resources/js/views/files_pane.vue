<template>
  <collapsible-vertical-pane :title="title" :buttons="pane_buttons">
    <div>
      <div v-for="file in files" class="cursor-pointer" @click="onFileClicked(file)">
        <svg-icon v-if="current_file == file" :size="12" type="mdi" :path="open_icon"></svg-icon>
        {{ file }}
      </div>
    </div>
  </collapsible-vertical-pane>
</template>

<script>
import { EventBus } from '../event_bus.js'
import { mdiFileEye, mdiPlus } from '@mdi/js'
import SvgIcon from '@jamescoyle/vue-icon'
import CollapsibleVerticalPane from './collapsible_vertical_pane.vue'

export default {
  components: {
    CollapsibleVerticalPane,
    SvgIcon
  },
  props: {
    files: {
      default: [],
    },
    current_file: {
      default: '',
    }
  },
  methods: {
    onFileClicked(file) {
      EventBus.$emit('open-file-clicked', {file});
    },
  },
  data() {
    return {
      title: 'Files',
      open_icon: mdiFileEye,
      pane_buttons: [
        {
          id: 'file_pane_open',
          icon: mdiPlus,
        }
      ],
    };
  },
  created() {
    EventBus.$on('action-button-clicked', e => {
      if (e.button == 'file_pane_open') {
        console.log('Open file clicked...');
      }
    });
  }
}
</script>
// vim: shiftwidth=2 tabstop=2
