import Debugger from './Debugger.module.js'
var $                  = jQuery;
var reconnect_delay_ms = 5000;
var was_connected      = true;
var stepped_into       = false;
var after_stepped_into = false;

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
				+ 'another computer.' );
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

