FragData = (function( $ )
{
	var id_regex = /^#frag_data:/;

	// We require the CodePanel object
	if ( typeof CodePanel != 'object' )
	{
		return;
	}

	function init()
	{
		var data;
		if ( !location.hash.match( id_regex ) )
		{
			return;
		}

		try
		{
			data = JSON.parse( location.hash.replace( id_regex, '' ) );
		}
		catch ( e )
		{
			console.warn( e );
			console.warn( 'Frag Data: Invalid data received' );
			return;
		}

		for ( var i in data )
		{
			var filename = data[ i ].filename;
			publish( 'file-nav-request', {
				filename : filename,
				source   : 'frag-data',
			} );
			for ( var j in data[ i ].bp_list )
			{
				CodePanel.addBreakpoint( filename, data[ i ].bp_list[ j ].line, data[ i ].bp_list[ j ].expression );
			}
		}
	}

	$( init );
}( jQuery ) );
