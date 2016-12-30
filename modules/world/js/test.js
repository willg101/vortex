(function( $, send_api_request, module_settings )
{
	$( function(){ console.log( module_settings ) } );
	setInterval( send_api_request.bind( undefined, 'get', { test : 1 } ), 1000 );
}( jQuery, send_api_request, module_settings ));