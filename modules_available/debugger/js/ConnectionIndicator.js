namespace( 'Theme' ).SessionQueueIndicator = (function( $ )
{
	var known_sessions = [];

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
					id : session_id,
					host : self.attr( 'host' ),
					file : file.replace( /^file:\/\//, '' )
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
			BasicApi.Debugger.command( 'X-ctrl:peek_queue' );
		}
	}

	function onDetachSessionClicked( e )
	{
		var sid = $( e.currentTarget ).attr( 'data-detach-session' );
		BasicApi.SocketServer.send( 'X-ctrl:detach_queued_session -s ' + sid );
	}

	function onIndicatorClicked()
	{
		var sessions_for_list;
		var items = '';
		if ( known_sessions.length )
		{
			sessions_for_list = [];
			for ( var i in known_sessions )
			{
				sessions_for_list.push( {
					file : known_sessions[ i ].file.replace( /^.*\//, '' ),
					host : known_sessions[ i ].host,
					content : known_sessions[ i ].file.replace( /^.*\//, '' ),
					id : known_sessions[ i ].id,
					attr : {
						'data-switch-to-session' : known_sessions[ i ].id,
					},
				} );
				items += render( 'debugger.item', sessions_for_list[ i ] );
			}

			new Theme.Popover( '<h2>Queued Sessions</h2><table class="session-table">' + items + '</table>', [ 'no-padding' ], { my : 'right top', at : 'right bottom', of : $( '#connection_queue_indicator' ) }, $( '#connection_queue_indicator' ) )
		}
		else
		{
			new Theme.Popover( '<h2 class="swallow-margin">Queued Sessions</h2><i>No queued sessions</i>', [], { my : 'right top', at : 'right bottom', of : $( '#connection_queue_indicator' ) }, $( '#connection_queue_indicator' ) );
		}

	}

	function onSwitchToSessionClicked( e )
	{
		var session_id = $( e.target ).closest( '[data-switch-to-session]' ).attr( 'data-switch-to-session' );
		BasicApi.Debugger.command( 'X-ctrl:switch_session -s ' + session_id );
	}

	$( document ).on( 'click', '[data-switch-to-session]',    onSwitchToSessionClicked );
	$( document ).on( 'click', '[data-detach-session]',       onDetachSessionClicked );
	$( document ).on( 'click', '#connection_queue_indicator', onIndicatorClicked );

	subscribe( 'server-info',            onServerInfoReceived );

}( jQuery ));
