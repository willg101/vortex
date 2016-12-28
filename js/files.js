Files = (function( $ )
{
	var api_url = 'files.php';
	var empty_fn = function(){};
	var default_n_recent = 5;
	var filecache = {};
	
	function onFilesReceived( cb, success, data )
	{
		if ( success )
		{
			if ( typeof data.files == 'object' )
			{
				$.extend( filecache, data.files );
			}
		}
		
		cb( success, data );
	}
	
	function load( file_names, cb )
	{
		if ( typeof file_names != 'object' )
		{
			file_names = [ file_names ];
		}
		if ( !(file_names instanceof Array) )
		{
			throw new Error( 'Unexpected argument type; expected scalar or Array' );
		}
		
		if ( typeof cb != 'function' )
		{
			throw new Error( 'Expected function; received' + typeof cb );
		}
		
		var all_cached = true;
		var cached_files = {};
		file_names.forEach( function( file_name )
		{
			if ( all_cached && filecache[ file_name ] )
			{
				cached_files[ file_name ] = filecache[ file_name ];
			}
			else
			{
				all_cached = false;
			}
		} );
		
		if ( all_cached )
		{
			cb( true, { files: cached_files } );
		}
		else
		{
			performApiRequest( { file_names : file_names }, onFilesReceived.bind( undefined, cb ) );
		}
	}
	
	function getRecentFiles( cb )
	{
		if ( typeof cb != 'function' )
		{
			throw new Error( 'Expected function; received' + typeof cb );
		}
		performApiRequest( { list_recent_files : true }, cb );
	}
	
	function performApiRequest( params, cb )
	{
		$.get( api_url, params, cb.bind( undefined, true ) ).fail( cb.bind( undefined, false ) );		
	}
	
	function clearCache()
	{
		filecache = {};
	}
	
	function listFilesInCache()
	{
		return Object.keys( filecache );
	}
	
	return {
		load             : load,
		getRecentFiles   : getRecentFiles,
		clearCache       : clearCache,
		listFilesInCache : listFilesInCache,
	};
	
}( jQuery ) );