/**
 * @brief
 *	Get, update, and delete persistent config values on the server
 */
namespace( 'BasicApi' ).Config = ( function( $ )
{

	/**
	 * @param string item The name of a config item, optionally given in "dot" notation
	 *
	 * @retval string
	 *	The URL to contact to get/alter the config item
	 */
	function apiPath( item )
	{
		return makeUrl( 'config/' + item.replace( /\./g, '/' ) );
	}

	/**
	 * @brief
	 *	Sends a request to the server regarding the specified config value
	 *
	 * @param string   method  The HTTP method to use, e.g., "GET", "POST"
	 * @param string   item    May be given in "dot" notation, e.g., "a.b.c"
	 * @param function cb      A function that receives two arguments:
	 *                          - A boolean indicating if the call was successful
	 *                          - The data from the server (if successful) or a status message
	 * @param mixed    payload The 'payload' param to send to the server; should only be used for
	 *                         'POST' requests, which update config values
	 */
	function kernel( method, item, cb, payload )
	{
		cb = typeof cb == 'function' ? cb : function(){};
		$.ajax( {
			type    : method,
			data    : { payload : payload },
			url     : apiPath( item ),
			success : function( data )
			{
				cb( true, data );
			},
			error: function( status )
			{
				cb( false, status );
			},
		} );
	}

	/**
	 * @brief
	 *	Gets the specified config value from the server
	 *
	 * @param string   item @c kernel
	 * @param function cb   @c kernel
	 */
	function get( item, cb )
	{
		kernel( 'GET', item, cb );
	}

	/**
	 * @brief
	 *	Updates the specified config value on the server
	 *
	 * @param string   item  @c kernel
	 * @param mixed    value The new value for the config item
	 * @param function cb    @c kernel
	 */
	function set( item, value, cb )
	{
		kernel( 'POST', item, cb, value );
	}

	/**
	 * @brief
	 *	Removes the specified config value from the server
	 *
	 * @param string   item @c kernel
	 * @param function cb   @c kernel
	 */
	function del( item, cb )
	{
		kernel( 'DELETE', item, cb );
	}

	return {
		get     : get,
		set     : set,
		del     : del,
		apiPath : apiPath,
	};
}( jQuery ));
