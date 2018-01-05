MainController = (function( $ )
{
	var reconnect_delay_ms = 5000;
	var was_connected = true;
	var showing_no_connection_modal = false;

	$( window ).on( 'load', function()
	{
		$( "#splash" ).on( 'transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function()
			{
				$( '#splash' ).remove();
			} )
			.addClass( 'done' );
	} );

	function init()
	{
		BasicApi.SocketServer.openConnection();
		var on_resize = function( pane_name )
		{
			publish( 'layout-changed', {
				pane : pane_name,
			} );
		};
		$( window ).on( 'load', function()
		{
			/*$( '.main-layout' ).layout( {
				spacing_open   : 1,
				spacing_closed : 18,
				onresize_end    : on_resize,
				customHotkeyModifier : 'CTRL',
				west : {
					customHotkey : 'o',
					initClosed   : true,
				},
				south : {
					customHotkey : 'e',
					initClosed   : true,
					size : '30%',
				},
			} );*/
			//$( '.status-layout' ).layout( { south : { size : '50%' }, spacing_open : 1, spacing_closed: 18 } );
			window.setTimeout( on_resize.bind( undefined, '*' ), 150 );
		} );
	}

	function onConnectionStatusChanged( e )
	{
		if ( e.status == 'error' || e.status == 'closed' )
		{
			PageTitle.update( 'status', 'disconnected' );
			setTimeout( BasicApi.SocketServer.openConnection, reconnect_delay_ms );
			if ( was_connected )
			{
				Theme.Modal.set( {
					title : 'No connection',
					content : 'DPOH can\'t connect to the websocket server, which most likely means one '
						+ 'of the following: <ul><li>The server is not running</li><li>There is a '
						+ 'proxy or firewall misconfiguration</li><li>You have lost your network '
						+ 'connection</li></ul>',
					on_hide : function(){ showing_no_connection_modal = false; },
				} );
				showing_no_connection_modal = true
				Theme.Modal.show();
			}
			was_connected = false;
		}
		else if ( e.status == 'no-exclusive-access' )
		{
			PageTitle.update( 'status', 'disconnected' );
			was_connected = false;

			Theme.Modal.set( {
				title : 'Vortex is already is use',
				content : 'Vortex is already in use in another browser or tab, or on another computer.',
			} );
			Theme.Modal.show();
		}
		else if ( e.status == 'connected' )
		{
			if ( showing_no_connection_modal )
			{
				Theme.Modal.hide();
			}

			// Probe for an existing session; allows us to pick up where we left off if the user
			// left the page and has now returned or lost their connection and has now regained it
			BasicApi.Debugger.command( 'status' );
			PageTitle.update( 'status', 'waiting' );
			was_connected = true;
		}
	}

	function onSessionStatusChanged( e )
	{
		BasicApi.Debugger.command( 'ctrl:peek_queue' );

		if ( e.status == 'active' )
		{
			PageTitle.update( 'status', 'active' );
			BasicApi.Debugger.command( 'feature_set', { name : 'max_data',  value : 2048 } );
			BasicApi.Debugger.command( 'feature_set', { name : 'max_children',  value : 128 } );
			BasicApi.Debugger.command( 'feature_set', { name : 'max_depth', value : 1 } );
			BasicApi.Debugger.command( 'status' );
		}
		else
		{
			PageTitle.update( 'status', ( BasicApi.SocketServer.isConnected() ? 'waiting' : 'disconnected' ) );
		}
	}

	function onResponseReceived( e )
	{
		if ( e.is_stopping )
		{
			BasicApi.Debugger.command( 'run' );
		}
	}

	function onSessionInit()
	{
		BasicApi.Debugger.command( 'step_into' );
	}

	subscribe( 'connection-status-changed', onConnectionStatusChanged );
	subscribe( 'session-status-changed',    onSessionStatusChanged );
	subscribe( 'session-init',              onSessionInit );
	subscribe( 'response-received',         onResponseReceived );

	$( init );

}( jQuery ));
