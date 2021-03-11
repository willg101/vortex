import Vue from 'vue';
import { EventBus } from './event_bus.js'
import { highlight, languages } from 'prismjs/components/prism-core';

var PrismEditor = /*#__PURE__*/Vue.extend({
  props: {
    breakpoints: {
      type: Object,
      default: () => {}
    },
    current_line: {
      type: Number,
      default: 0,
    },
    lineNumbers: {
      type: Boolean,
      "default": false
    },
    autoStyleLineNumbers: {
      type: Boolean,
      "default": true
    },
    code: {
      type: String,
      "default": ''
    },
    placeholder: {
      type: String,
      "default": ''
    }
  },
  data: function data() {
    return {
      lineNumbersHeight: '20px',
      codeData: '',
      scroll_adjustment_queued: false,
    };
  },
  watch: {
    code: {
      immediate: true,
      handler: function handler(newVal) {
        if (!newVal) {
          this.codeData = '';
        } else {
          this.codeData = newVal;
          this.$nextTick(function () {
            this.scroll_adjustment_queued = true;
          });
        }
      },
    },
    current_line(newVal) {
      this.$nextTick(function () {
        this.scroll_adjustment_queued = !!(this.scroll_adjustment_queued || newVal);
      });
    },
    content: {
      immediate: true,
      handler: function handler() {
        var _this = this;

        if (this.lineNumbers) {
          this.$nextTick(function () {
            _this.setLineNumbersHeight();
          });
        }
      }
    },
    lineNumbers: function lineNumbers() {
      var _this2 = this;

      this.$nextTick(function () {
        _this2.styleLineNumbers();

        _this2.setLineNumbersHeight();
      });
    }
  },
  updated() {
    if (this.$refs.current_line && this.scroll_adjustment_queued) {
      this.$refs.current_line.scrollIntoViewIfNeeded(true);
      this.scroll_adjustment_queued = false;
    }
  },
  computed: {
    lineClasses: function() {
      let out = {};
      if (this.current_line) {
        out[this.current_line] = [ 'current' ];
      }
      for (let line in this.breakpoints) {
        if (! out[line]) {
          out[line] = [];
        }
        out[line].push('breakpoint-line');
        out[line].push(this.breakpoints[line].type);
      }
      return out;
    },
    isEmpty: function isEmpty() {
      return this.codeData.length === 0;
    },
    content: function content() {
      var result = this.highlight(this.codeData) + '<br />'; // todo: VNode support?
      let lines = result.split('\n');
      if (this.current_line) {
        lines[this.current_line - 1] = '<span class="current-line-code"></span>' + lines[this.current_line - 1];
      }
      for (let line in this.breakpoints) {
        lines[line - 1] = '<span class="breakpoint-arrow ' + this.breakpoints[line].type + '"></span>' + lines[line - 1];
      }
      return lines.join('\n');
    },
    lineNumbersCount: function lineNumbersCount() {
      var totalLines = this.codeData.split(/\r\n|\n/).length;
      return totalLines;
    }
  },
  mounted: function mounted() {
    this.styleLineNumbers();
  },
  methods: {
    onLineNumberClicked(line, is_secondary) {
      EventBus.$emit('line-clicked', {line, is_secondary});
    },
    highlight(code) {
      return highlight(code, languages.js);
      // languages.<insert language> to return html with markup
    },
    setLineNumbersHeight: function setLineNumbersHeight() {
      this.lineNumbersHeight = getComputedStyle(this.$refs.pre).height;
    },
    styleLineNumbers: function styleLineNumbers() {
      if (!this.lineNumbers || !this.autoStyleLineNumbers) return;
      var $editor = this.$refs.pre;
      var $lineNumbers = this.$el.querySelector('.prism-editor__line-numbers');
      var editorStyles = window.getComputedStyle($editor);
      this.$nextTick(function () {
        var btlr = 'border-top-left-radius';
        var bblr = 'border-bottom-left-radius';
        if (!$lineNumbers) return;
        $lineNumbers.style[btlr] = editorStyles[btlr];
        $lineNumbers.style[bblr] = editorStyles[bblr];
        $editor.style[btlr] = '0';
        $editor.style[bblr] = '0';
        var stylesList = ['background-color', 'margin-top', 'padding-top', 'font-family', 'font-size', 'line-height'];
        stylesList.forEach(function (style) {
          $lineNumbers.style[style] = editorStyles[style];
        });
        $lineNumbers.style['margin-bottom'] = '-' + editorStyles['padding-top'];
      });
    },
    _getLines: function _getLines(text, position) {
      return text.substring(0, position).split('\n');
    },
  },
  render: function render(h) {
    var _this3 = this;

    var lineNumberWidthCalculator = h('div', {
      attrs: {
        "class": 'prism-editor__line-width-calc',
        style: 'height: 0px; visibility: hidden; pointer-events: none;'
      }
    }, '999');
    var lineNumbers = h('div', {
      staticClass: 'prism-editor__line-numbers',
      style: {
        'min-height': this.lineNumbersHeight
      },
      attrs: {
        'aria-hidden': 'true'
      }
    }, [lineNumberWidthCalculator, Array.from(Array(this.lineNumbersCount).keys()).map((_, index) => {
      let opts = {
        on: {
          'click': e => this.onLineNumberClicked(index, false),
          'contextmenu': e => { e.preventDefault(); this.onLineNumberClicked(index, true)},
        },
        attrs : {
          "class": 'prism-editor__line-number token comment ' + (_this3.lineClasses[index + 1] || []).join(' ')
        }
      };
      if (this.lineClasses[index + 1] && this.lineClasses[index + 1].indexOf('current') >= 0) {
        opts['ref'] = 'current_line';
      }
      return h('div', opts, "" + ++index);
    })]);
    var textarea = h('textarea', {
      ref: 'textarea',
      staticClass: 'prism-editor__textarea',
      "class": {
        'prism-editor__textarea--empty': this.isEmpty
      },
      attrs: {
        spellCheck: 'false',
        autocapitalize: 'off',
        autocomplete: 'off',
        autocorrect: 'off',
        'data-gramm': 'false',
        placeholder: this.placeholder,
        'data-testid': 'textarea',
        readonly: true,
      },
      domProps: {
        value: this.codeData
      }
    });
    var preview = h('pre', {
      ref: 'pre',
      staticClass: 'prism-editor__editor',
      attrs: {
        'data-testid': 'preview'
      },
      domProps: {
        innerHTML: this.content
      }
    });
    var editorContainer = h('div', {
      staticClass: 'prism-editor__container'
    }, [textarea, preview]);
    return h('div', {
      staticClass: 'prism-editor-wrapper'
    }, [this.lineNumbers && lineNumbers, editorContainer]);
  }
});

export { PrismEditor };
// vim: shiftwidth=2 tabstop=2

