<template>
  <collapsible-vertical-pane :title="title">
    <tree-view :context="context"></tree-view>
  </collapsible-vertical-pane>
</template>

<script>
import TreeView from './tree_view.vue'
import CollapsibleVerticalPane from './collapsible_vertical_pane.vue'

export default {
  components: {
    CollapsibleVerticalPane,
  },
  props: {
    context: {
      required: true,
    }
  },
  data() {
    return {
      title: 'Scope',
    };
  },
}
</script>
// vim: shiftwidth=2 tabstop=2
