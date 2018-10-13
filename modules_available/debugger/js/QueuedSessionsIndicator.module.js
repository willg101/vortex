import Debugger from './Debugger.module.js'
import File     from './File.module.js'
import WsClient from './WsClient.module.js'
import LanguageAbstractor       from './LanguageAbstractor.module.js'

export default { getCurrentCodebase, getSessionId }

var known_sessions = [];
var session_id     = '';

subscribe( 'connection-status-changed', function onConnectionStatusChanged( e )
{
	var indicator = $( '#connection_queue_indicator' );
	if ( e.status == 'connected' )
	{
		Debugger.command( 'X-ctrl:peek_queue' );
		indicator.removeClass( 'no-connection' );
	}
	else
	{
		indicator.addClass( 'no-connection' ).find( '.n' ).html( '<i class="fa fa-times">' );
	}
} );

subscribe( 'session-status-changed', function()
{
	Debugger.command( 'X-ctrl:peek_queue' );
} );

async function getCurrentCodebase()
{
	for ( let i in known_sessions )
	{
		if ( known_sessions[ i ].active )
		{
			return await LanguageAbstractor.getCodebaseRoot( known_sessions[ i ].file );
		}
	}
	return null;
}

subscribe( 'server-info', function( e )
{
	if ( e.jq_message.is( '[type=peek_queue]' ) )
	{
		known_sessions = [];
		session_id     = '';
		e.jq_message.find( 'queuedsession' ).each( function()
		{
			var self   = $( this );
			session_id = self.attr( 'connection_id' );
			if ( !session_id )
			{
				return;
			}

			var file = self.attr( 'path' ) || '(Unknown file)';
			known_sessions.push( {
				id            : session_id,
				active        : self.attr( 'active' ) == 'true',
				uuid          : self.attr( 'uuid' ),
				host          : self.attr( 'host' ),
				codebase_id   : self.attr( 'codebase_id' ),
				codebase_root : self.attr( 'codebase_root' ),
				file          : file.replace( /^file:\/\//, '' )
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
} );

subscribe( 'session-switched', function()
{
	Debugger.command( 'X-ctrl:peek_queue' );
} );

$( document ).on( 'click', '[data-detach-session]', function( e )
{
	var cid = $( e.currentTarget ).attr( 'data-detach-session' );
	WsClient.send( 'X-ctrl:detach_queued_session -s ' + cid );
} );

$( document ).on( 'click', '#connection_queue_indicator:not(.no-connection)', function()
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
} );

$( document ).on( 'click', '[data-switch-to-session]', function( e )
{
	if ( $( e.target ).closest( 'tr.active' ).length )
	{
		return;
	}
	var session_id = $( e.target ).closest( '[data-switch-to-session]' ).attr( 'data-switch-to-session' );
	Debugger.command( 'X-ctrl:switch_session -s ' + session_id );
} );

function getSessionId()
{
	return session_id;
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
	new vTheme.Popover( content, classes, {
		my : 'right top',
		at : 'right bottom',
		of : $( '#connection_queue_indicator' ),
	}, $( '#connection_queue_indicator' ) );
}
