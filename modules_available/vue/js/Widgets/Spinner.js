namespace( 'Theme' ).Spinner = (function( $ )
{
	var template_name = 'vue.spinner';
	var rendered      = false;

	function Spinner(){}

	Spinner.prototype.toString = function()
	{
		if ( !rendered )
		{
			rendered = render( template_name, {
				img_path : Dpoh.settings.base_path + 'modules_enabled/vue/img',
			} );
		}
		return rendered;
	}

	return Spinner;

}( jQuery ));
