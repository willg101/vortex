import Debugger from './Debugger.module.js'
import File     from './File.module.js'
import WsClient from './WsClient.module.js'

var known_sessions = [];

subscribe( 'connection-status-changed', function onConnectionStatusChanged( e )
{
	if ( e.status == 'connected' )
	{
		Debugger.command( 'X-ctrl:peek_queue' );
	}
	else
	{
		var indicator = $( '#connection_queue_indicator' );
		indicator.find( '.n' ).html( '<i class="fa fa-times">' ).addClass( 'inactive' );
	}
} );

subscribe( 'session-status-changed', function()
{
	Debugger.command( 'X-ctrl:peek_queue' );
} );

function onServerInfoReceived( e )
{
	if ( e.jq_message.is( '[type=peek_queue]' ) )
	{
		known_sessions = [];
		e.jq_message.find( 'queuedsession' ).each( function()
		{
			var self       = $( this );
			var session_id = self.attr( 'session-id' );
			if ( !session_id )
			{
				return;
			}

			var file = self.attr( 'path' ) || '(Unknown file)';
			known_sessions.push( {
				id     : session_id,
				active : self.attr( 'active' ) == 'true',
				uuid   : self.attr( 'uuid' ),
				host   : self.attr( 'host' ),
				file   : file.replace( /^file:\/\//, '' )
			} );
		} );

		var indicator = $( '#connection_queue_indicator' );
		indicator.find( '.n' ).text( known_sessions.length );
		if ( known_sessions.length )
		{
			indicator.removeClass( 'inactive' );
		}
		else
		{
			indicator.addClass( 'inactive' );
		}
	}
	else if ( e.jq_message.is( '[type=detach_queued_session]' ) )
	{
		Debugger.command( 'X-ctrl:peek_queue' );
	}
}

subscribe( 'session-switched', function()
{
	Debugger.command( 'X-ctrl:peek_queue' );
} );

function onDetachSessionClicked( e )
{
	var sid = $( e.currentTarget ).attr( 'data-detach-session' );
	WsClient.send( 'X-ctrl:detach_queued_session -s ' + sid );
}

function onIndicatorClicked()
{
	var items = '';
	if ( known_sessions.length )
	{
		for ( var i in known_sessions )
		{
			let data = {
				host    : known_sessions[ i ].host,
				id      : known_sessions[ i ].id,
				active  : known_sessions[ i ].active,
				content : File.basename( known_sessions[ i ].file ),
				file    : File.basename( known_sessions[ i ].file ),
				img     : GeoPattern.generate( known_sessions[ i ].uuid ).toDataUrl(),
				attr    : {
					'data-switch-to-session' : known_sessions[ i ].id,
				},
			};
			items += render( 'debugger.item', data );
		}
	}
	showPopover( items )
}

function showPopover( rendered_items )
{
	var content = '';
	var classes = [];
	if ( rendered_items )
	{
		content = `<h2>Active Sessions</h2><table class="session-table">${rendered_items}</table>`;
		classes = [ 'no-padding' ];
	}
	else
	{
		content = '<h2 class="swallow-margin">Active Sessions</h2><i>No active sessions</i>';
	}
	new Theme.Popover( content, classes, {
		my : 'right top',
		at : 'right bottom',
		of : $( '#connection_queue_indicator' ),
	}, $( '#connection_queue_indicator' ) );
}

function onSwitchToSessionClicked( e )
{
	if ( $( e.target ).closest( 'tr.active' ).length )
	{
		return;
	}
	var session_id = $( e.target ).closest( '[data-switch-to-session]' ).attr( 'data-switch-to-session' );
	Debugger.command( 'X-ctrl:switch_session -s ' + session_id );
}

$( document ).on( 'click', '[data-switch-to-session]',    onSwitchToSessionClicked );
$( document ).on( 'click', '[data-detach-session]',       onDetachSessionClicked );
$( document ).on( 'click', '#connection_queue_indicator', onIndicatorClicked );

subscribe( 'server-info', onServerInfoReceived );
