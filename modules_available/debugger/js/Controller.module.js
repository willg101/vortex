import Debugger from './Debugger.module.js'
var $                  = jQuery;
var reconnect_delay_ms = 5000;
var was_connected      = true;
var stepped_into       = false;
var after_stepped_into = false;
var allow_reconnect    = true;

/**
 * @brief
 *	Document.ready handler
 */
$( () =>
{
	if ( !Dpoh.settings.js_test_mode )
	{
		BasicApi.SocketServer.openConnection();
		publish( 'vortex-init' );
	}
} );

subscribe( 'connection-status-changed', function( e )
{
	if ( !allow_reconnect )
	{
		return;
	}

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
			Theme.notify( 'error', 'Vortex is already in use in another browser or tab, or on '
				+ 'another computer.<br><a class="commandeer-btn">Use Vortex in this tab</a>', '',
				{ extendedTimeOut : 0, timeOut : 0 } );
		}
		was_connected = false;
	}
	else if ( e.status == 'connected' )
	{
		// Probe for an existing session; allows us to pick up where we left off if the user
		// left the page and has now returned or lost their connection and has now regained it
		Debugger.command( 'status' );
		Theme.PageTitle.update( 'status', 'waiting' );
		was_connected = true;
	}
} );

subscribe( 'server-info', function( e )
{
	if ( e.jq_message.is( '[status=session_commandeered]' ) )
	{
		// This session has been commandeered; disable the UI and show a message explaining what
		// has happened.
		Theme.notify( 'error', 'This session was transferred to another tab or brower.', '', {
			timeOut : 0,
			extendedTimeOut : 0,
			positionClass: "toast-bottom-center"
		} );
		$( '.blurable' ).fadeOut();
		$( 'body' ).css( 'background', '#333' );

		// Kill the web socket connection and prevent attempts by this module to reconnect and/or
		// display warnings about the disconnection
		was_connected = false;
		Theme.PageTitle.update( 'status', 'transferred' );
		allow_reconnect = false;
		BasicApi.SocketServer.getConnection().close();
	}
} )

$( document ).on( 'click', '.commandeer-btn', function()
{
	$.post( makeUrl( 'ws_maintenance' ), { action : 'commandeer' }, data =>
	{
		if ( typeof data.commandeer_token == 'string' )
		{
			BasicApi.SocketServer.openConnection( data );
		}
	} );
} );

subscribe( 'session-status-changed', function( e )
{
	if ( e.status == 'active' )
	{
		Debugger.command( 'feature_set', { name : 'max_data', value : 2048 } );
		Debugger.command( 'feature_set', { name : 'max_children', value : 128 } );
		Debugger.command( 'feature_set', { name : 'max_depth', value : 1 } );
		Debugger.command( 'status' );
	}
} );

subscribe( 'response-received', function( e )
{
	if ( e.is_stopping )
	{
		// Sometimes the debugger engine will wait for a continuation command in order to end a
		// session, so if the DE indicates it's stopping, let's encourage it to end the session
		Debugger.command( 'run' );
	}
} );

/**
 * When a debug session begins, we issue a continuation command to start executing the code.
 */
subscribe( 'session-init', async function()
{
	stepped_into = false;
	await Debugger.command( 'step_into' );
	stepped_into = true;
	if ( after_stepped_into )
	{
		after_stepped_into();
		after_stepped_into = false;
	}
} );

/**
 * When a session begins, we don't want to attempt to display the context before stepping into the
 * code, so let's delay until we've stepped into the code.
 */
subscribe( 'before-inspect-context', function beforeInspectContext( e )
{
	if ( !stepped_into )
	{
		after_stepped_into = e.register();
	}
} );

subscribe( 'alter-settings-quick-actions', function( e )
{
	e.items.unshift( {
		content : 'Restart socket bridge',
		attr : {
			'data-command' : 'X-ctrl:restart',
		},
	} );
} );

