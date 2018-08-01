namespace( 'BasicApi' ).Controller = (function( $ )
{
	var reconnect_delay_ms = 5000;
	var was_connected = true;
	var showing_no_connection_modal = false;
	var stepped_into = false;
	var after_stepped_into = false;

	function init()
	{
		if ( !Dpoh.settings.js_test_mode )
		{
			BasicApi.SocketServer.openConnection();
			publish( 'vortex-init' );
		}
	}

	function onConnectionStatusChanged( e )
	{
		if ( e.status == 'error' || e.status == 'closed' )
		{
			Theme.PageTitle.update( 'status', 'disconnected' );
			setTimeout( BasicApi.SocketServer.openConnection, reconnect_delay_ms );
			if ( was_connected )
			{
				Theme.notify( 'error', 'No websocket connection is available' );
			}
			was_connected = false;
		}
		else if ( e.status == 'no-exclusive-access' )
		{
			Theme.PageTitle.update( 'status', 'disconnected' );

			if ( was_connected )
			{
				Theme.notify( 'error', 'Vortex is already in use in another browser or tab, or on another computer.' );
			}

			was_connected = false;
		}
		else if ( e.status == 'connected' )
		{
			// Probe for an existing session; allows us to pick up where we left off if the user
			// left the page and has now returned or lost their connection and has now regained it
			BasicApi.Debugger.command( 'status' );
			Theme.PageTitle.update( 'status', 'waiting' );
			was_connected = true;
		}
	}

	function onSessionStatusChanged( e )
	{
		BasicApi.Debugger.command( 'X-ctrl:peek_queue' );

		if ( e.status == 'active' )
		{
			BasicApi.Debugger.command( 'feature_set', { name : 'max_data',  value : 2048 } );
			BasicApi.Debugger.command( 'feature_set', { name : 'max_children',  value : 128 } );
			BasicApi.Debugger.command( 'feature_set', { name : 'max_depth', value : 1 } );
			BasicApi.Debugger.command( 'status' );
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
		stepped_into = false;
		BasicApi.Debugger.command( 'step_into' );
		if ( after_stepped_into )
		{
			after_stepped_into();
			after_stepped_into = false;
		}
	}

	function beforeInspectContext( e )
	{
		if ( !stepped_into )
		{
			after_stepped_into = e.register();
		}
	}

	function alterQuickActions( e )
	{
		e.items.unshift( {
			content : 'Restart socket bridge',
			attr : {
				'data-command' : 'X-ctrl:restart',
			},
		} );
	}

	function onServerInfo( e )
	{
		if ( e.jq_message.is( '[status=session_change]' ) )
		{
			var delay = 1;
			$( '[data-role="window"]' ).each( function()
				{
					setTimeout( function()
					{
						$( this ).addClass( 'not-loaded' );
					}.bind( this ), delay++ * 50 );
				} );
			BasicApi.Debugger.command( 'X-ctrl:peek_queue' );
			BasicApi.Debugger.command( 'stack_get' );
			$( '[data-role="window"]' ).each( function()
				{
					setTimeout( function()
					{
						$( this ).removeClass( 'not-loaded' );
					}.bind( this ), delay++ * 50 + 500 );
				} );
		}
	}

	subscribe( 'connection-status-changed',    onConnectionStatusChanged );
	subscribe( 'session-status-changed',       onSessionStatusChanged );
	subscribe( 'before-inspect-context',       beforeInspectContext );
	subscribe( 'session-init',                 onSessionInit );
	subscribe( 'response-received',            onResponseReceived );
	subscribe( 'alter-settings-quick-actions', alterQuickActions );
	subscribe( 'server-info',         onServerInfo );
	$( init );

}( jQuery) );