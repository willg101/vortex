var templateName = 'vue.spinner'
var renderedSpinner = render(templateName, {
  img_path: Dpoh.settings.base_path + 'modules_enabled/vue/img'
})

vTheme.getSpinner = () => renderedSpinner
