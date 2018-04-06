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
			BasicApi.Debugger.command( 'ctrl:peek_queue' );
		}
	}

	function onDetachSessionClicked( e )
	{
		var sid = $( e.currentTarget ).attr( 'data-detach-session' );
		BasicApi.SocketServer.send( 'ctrl:detach_queued_session -s ' + sid );
		return false;
	}

	function onIndicatorClicked()
	{
		var sessions_for_list;
		if ( known_sessions.length )
		{
			sessions_for_list = [];
			for ( var i in known_sessions )
			{
				sessions_for_list.push( {
					content : known_sessions[ i ].file,
					attr : {
						'data-switch-to-session' : known_sessions[ i ].id,
					},
				} );
			}
			new Theme.PopoverList( {
				lists : [
					{
						title : 'Queued Sessions',
						options : sessions_for_list,
					},
				],
				classes : [ 'auto-size' ],
				el      : $( '#connection_queue_indicator' ),
				side    : 'right',
			} );
			$( '[data-switch-to-session]' ).each( function()
			{
				$( this ).append( $( '<span style="position: absolute; top: 5px; right: 5px;" class="btn btn-sm">Detach</span>' ).attr( 'data-detach-session', $( this ).attr( 'data-switch-to-session' ) ) );
			} );
		}
		else
		{
			new Theme.Popover( '<h2 class="swallow-margin">Queued Sessions</h2><i>No queued sessions</i>', [], { my : 'right top', at : 'right bottom', of : $( '#connection_queue_indicator' ) }, $( '#connection_queue_indicator' ) );
		}

	}

	function onSwitchToSessionClicked( e )
	{
		var session_id = $( e.target ).closest( '[data-switch-to-session]' ).attr( 'data-switch-to-session' );
		BasicApi.Debugger.command( 'ctrl:switch_session -s ' + session_id );
	}

	$( document ).on( 'click', '[data-switch-to-session]',    onSwitchToSessionClicked );
	$( document ).on( 'click', '[data-detach-session]',       onDetachSessionClicked );
	$( document ).on( 'click', '#connection_queue_indicator', onIndicatorClicked );

	subscribe( 'server-info',            onServerInfoReceived );

}( jQuery ));
