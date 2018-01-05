/**
 * @require Modal
 */
PageTitle = (function( $ )
{
	var title_vars = {
		init   : 'DPOH',
		status : 'initializing',
	};
	var title_format = false;
	var title_format_default = '{init} ({status})';

	function init()
	{
		title_vars.init = document.title.trim();
	}

	function setFormat( format )
	{
		title_format = format;
		refreshTitle();
	}

	function getFormat()
	{
		return title_format;
	}

	function update( key, value )
	{
		title_vars[ key ] = value;
		refreshTitle();
	}

	function refreshTitle()
	{
		var format = title_format || title_format_default;
		var resolved = format.replace( /(^|[^\\]){([^}]+)}/g, function( _, prefix, key )
		{
			return prefix + title_vars[ key ];
		} );
		document.title = resolved;
	}

	function getData()
	{
		return $.extend( true, {}, title_vars );
	}

	$( init );

	return {
		setFormat : setFormat,
		getFormat : getFormat,
		update    : update,
		getData   : getData,
	};
}( jQuery ));
