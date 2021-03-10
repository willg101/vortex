<template>
  <div>
    Enter an expression for this breakpoint:
    <textarea v-model="buffer.expression"></textarea>
    <button @click="$emit('close')">Cancel</button>
    <button @click="okClicked">OK</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      buffer : {
        expression : '',
      }
    };
  },
  props: {
    expression: {
      type: String,
      default: '',
    },
    handleUpdate: {
      type: Function,
      required: true,
    },
  },
  methods: {
    okClicked() {
      this.handleUpdate(this.buffer);
      this.$emit('close');
    },
  },
  created() {
    this.buffer.expression = this.expression;
  },
}
</script>
// vim: shiftwidth=2 tabstop=2
