MainController = (function( $ )
{
	var reconnect_delay_ms = 5000;
	var title_prefix = '';
	
	function init()
	{
		dpoh.openConnection();
		window.setTimeout( ajdustHeight, 100 );
		title_prefix = document.title.trim() + ' ';
		$( '.status-layout' ).layout( { south : { size : '50%' }, spacing_open : 3, spacing_closed: 18 } );
	}
	
	function onConnectionStatusChanged( e )
	{
		if ( e.status == 'error' || e.status == 'closed' )
		{
			setTimeout( dpoh.openConnection, reconnect_delay_ms );
			document.title = title_prefix + "(disconnected)";
		}
		else if ( e.status == 'connected' )
		{
			dpoh.sendCommand( 'status' );
			document.title = title_prefix + "(waiting)";
		}
	}
	
	function onSessionStatusChanged( e )
	{
		if ( e.status == 'active' || e.status == 'closed' )
		{
			document.title = title_prefix + "(active)";
		}
		else
		{
			document.title = title_prefix + ( dpoh.isConnected() ? '(waiting)' : '(disconnected)' );
		}
	}
	
	function onResponseReceived( e )
	{
		if ( e.is_stopping )
		{
			dpoh.sendCommand( 'run' );
		}
	}
	
	function onSessionInit()
	{
		dpoh.sendCommand( 'step_into' )
	}
	
	function ajdustHeight()
	{
		$( '.layout-table' ).css( "height", window.innerHeight  + "px" );
	}
 
	$( document ).on( 'dpoh:connection-status-changed',  onConnectionStatusChanged );
	$( document ).on( 'dpoh:session-status-changed',     onSessionStatusChanged );
	$( document ).on( 'dpoh:session-init',               onSessionInit );
	$( document ).on( 'dpoh:response-received',          onResponseReceived );
	$( init );
	
}( jQuery ));