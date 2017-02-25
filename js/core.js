var send_api_request_original = (function( $ )
{
	var api_base_url = window.location;

	function processCallbackArray( cb_array /*, ... */ )
	{
		var args = Array.prototype.slice.call( arguments );
		args.shift();
		cb_array.forEach( function( fn )
		{
			if ( typeof fn == "function" )
			{
				fn.apply( undefined, args );
			}
		} );
	}

	function send_api_request_original( module, type, params, success_cb, error_cb, url_only )
	{
		params = params || {};
		params.route_to_module = module;

		if ( url_only )
		{
			return (type && type.toLowerCase() ) == 'get'
				? api_base_url + '?' + jQuery.param( params )
				: api_base_url;
		}
		else
		{
			var alter_data = {
				request_type : type,
				params       : params,
				success      : success_cb ? [ success_cb ] : [],
				error        : error_cb   ? [ error_cb ]   : [],
				prevent_send : false,
			};
			send_api_request_original.emitAjaxEvent( 'request-presend', alter_data );

			if ( alter_data.prevent_send )
			{
				return null;
			}
			else
			{
				return jQuery[ alter_data.request_type ]( api_base_url, alter_data.params,
					processCallbackArray.bind( undefined, alter_data.success ) ).fail(
					processCallbackArray.bind( undefined, alter_data.error ) );
			}
		}
	}

	send_api_request_original.emitAjaxEvent = function( name, data )
	{
		$( document ).trigger( {
			type       : 'dpoh-interface:' + name,
			alter_data : data,
		} );
	};

	return send_api_request_original;
}( jQuery ));

