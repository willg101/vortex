import Debugger                from './Debugger.module.js'
import WsClient                from './WsClient.module.js'
import QueuedSessionsIndicator from './QueuedSessionsIndicator.module.js'

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
		PageTitle.setFormat( 'Vortex ({{status}})' );
		PageTitle.updateState( { status : 'disconnected' } );
		WsClient.openConnection();
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
		PageTitle.updateState( { status : 'disconnected' } );
		setTimeout( WsClient.openConnection, reconnect_delay_ms );
		if ( was_connected )
		{
			vTheme.notify( 'error', 'No websocket connection is available' );
		}
		was_connected = false;
	}
	else if ( e.status == 'no-exclusive-access' )
	{
		PageTitle.updateState( { status : 'disconnected' } );
		if ( was_connected )
		{
			vTheme.notify( 'error', 'Vortex is already in use in another browser or tab.'
				+ '<button class="btn-block btn text-btn commandeer-btn">Use Vortex in this tab</button>', '',
				{ extendedTimeOut : 0, timeOut : 0 } );
		}
		was_connected = false;
	}
	else if ( e.status == 'connected' )
	{
		PageTitle.updateState( { status : 'waiting' } );
		// Probe for an existing session; allows us to pick up where we left off if the user
		// left the page and has now returned or lost their connection and has now regained it
		Debugger.command( 'status' );
		was_connected = true;
	}
} );

subscribe( 'server-info', function( e )
{
	if ( e.jq_message.is( '[status=session_commandeered]' ) )
	{
		// This session has been commandeered; disable the UI and show a message explaining what
		// has happened.
		vTheme.notify( 'error', 'This session was transferred to another tab or browser.', '', {
			timeOut : 0,
			extendedTimeOut : 0,
			positionClass: "toast-bottom-center"
		} );
		$( '.blurable' ).fadeOut();
		$( 'body' ).css( 'background', '#333' );

		// Kill the web socket connection and prevent attempts by this module to reconnect and/or
		// display warnings about the disconnection
		was_connected = false;
		PageTitle.updateState( { status : 'transferred' } );
		allow_reconnect = false;
		WsClient.getConnection().close();
	}
} )

$( document ).on( 'click', '.commandeer-btn', function()
{
	$.post( makeUrl( 'ws_maintenance' ), { action : 'commandeer' }, data =>
	{
		if ( typeof data.commandeer_token == 'string' )
		{
			WsClient.openConnection( data );
		}
	} );
} );

subscribe( 'session-status-changed', function( e )
{
	if ( e.status == 'active' )
	{
		PageTitle.updateState( { status : 'active' } );
		Debugger.command( 'feature_set', { name : 'max_data', value : 2048 } );
		Debugger.command( 'feature_set', { name : 'max_children', value : 128 } );
		Debugger.command( 'feature_set', { name : 'max_depth', value : 1 } );
		Debugger.command( 'status' );
	}
	else if ( allow_reconnect )
	{
		PageTitle.updateState( { status : ( WsClient.isConnected() ? 'waiting' : 'disconnected' ) } );
	}
} );

subscribe( 'response-received', function( e )
{
	if ( e.is_stopping )
	{
		// Sometimes the debugger engine will wait for a continuation command in order to end a
		// session, so if the DE indicates it's stopping, let's encourage it to end the session
		Debugger.command( 'run', { session : QueuedSessionsIndicator.getSessionId() } );
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

subscribe( 'apply-default-layout-settings', function( e )
{
	if ( e.layout == 'outer0_3' )
	{
		e.settings.defaults = e.settings.defaults.concat( [
			{ layout_el : "inner-bottom_4_suggested_windows", key : "console", value : 0   },
			{ layout_el : "inner-top_3_suggested_windows",    key : "code",    value : 0   },
			{ layout_el : "inner-top_3_suggested_windows",    key : "stack",   value : 1   },
			{ layout_el : "middle-r_6_suggested_windows",     key : "watch",   value : 0   },
			{ layout_el : "middle-r_6_suggested_windows",     key : "context", value : 1   },
			{ layout_el : "code_persistor",                   key : "size",    value : 75  },
			{ layout_el : "stack_persistor",                  key : "size",    value : 25  },
			{ layout_el : "console_persistor",                key : "size",    value : 100 },
			{ layout_el : "watch_persistor",                  key : "size",    value : 40  },
			{ layout_el : "context_persistor",                key : "size",    value : 60  },
		] );
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

