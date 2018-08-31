var template_name    = 'vue.spinner';
var rendered_spinner = render( template_name, {
	img_path : Dpoh.settings.base_path + 'modules_enabled/vue/img',
} );

vTheme.getSpinner = () => rendered_spinner;
