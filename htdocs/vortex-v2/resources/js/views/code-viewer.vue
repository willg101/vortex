<template>
  <prism-editor-local :line-classes="line_classes" :code="code" :highlight="highlighter" line-numbers></prism-editor-local>
</template>

<script>
import { highlight, languages } from 'prismjs/components/prism-core';

export default {
  props: {
    current_line: {
      type: Number,
      default: 0,
    },
    code: {
      type: String,
      default: "",
    },
    breakpoints: {
      type: Object,
      default: () => {}
    },
  },
  computed: {
    line_classes: function() {
      let out = {};
      if (this.current_line) {
        out[this.current_line] = [ 'current' ];
      }
      for (let line in this.breakpoints) {
        if (! out[line]) {
          out[line] = [];
        }
        out[line].push('breakpoint-line');
      }
      return out;
    },
  },
  methods: {
    highlighter(code) {
      return highlight(code, languages.js);
      // languages.<insert language> to return html with markup
    },
  }
}
</script>

// vim: shiftwidth=2 tabstop=2
