namespace( 'Theme' ).Spinner = (function( $ )
{
	var template_name = 'theme_2.spinner';
	var rendered      = false;

	function Spinner(){}

	Spinner.prototype.toString = function()
	{
		if ( !rendered )
		{
			rendered = render( template_name, {
				img_path : Dpoh.settings.base_path + 'modules_enabled/theme_2/img',
			} );
		}
		return rendered;
	}

	return Spinner;

}( jQuery ));
