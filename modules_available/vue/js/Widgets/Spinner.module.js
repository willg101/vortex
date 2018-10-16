var templateName = 'vue.spinner'
var renderedSpinner = render(templateName, {
  imgPath: Dpoh.settings.base_path + 'modules_enabled/vue/img'
})

vTheme.getSpinner = () => renderedSpinner
