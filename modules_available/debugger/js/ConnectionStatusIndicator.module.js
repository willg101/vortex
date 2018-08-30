import WsClient from './WsClient.module.js'

subscribe( 'connection-status-changed', function onConnectionStatusChanged( e )
{
	updateStatusIndicator( e.status == 'connected' ? 'connected' : 'disconnected' );
} );

subscribe( 'session-status-changed', function onSessionStatusChanged( e )
{
	if ( e.status == 'active' )
	{
		updateStatusIndicator( 'active-session' );
	}
	else
	{
		updateStatusIndicator( WsClient.isConnected() ? 'connected' : 'disconnected' );
	}
} );

/**
 * @brief
 *	Update the connection status indicator
 *
 * @param string level One of 'disconnected', 'connected', 'active-session'
 */
function updateStatusIndicator( level )
{
	switch( level )
	{
		case 'disconnected':
			$( '#status_indicator' )
				.removeClass( 'connected session-in-progress fa-spin fa-circle-o-notch fa-circle' )
				.addClass( 'fa-warning disconnected' );
				break;

		case 'connected':
			$( '#status_indicator' )
				.removeClass( 'disconnected session-in-progress fa-warning fa-circle' )
				.addClass( 'fa-circle-o-notch fa-spin connected' );
				break;

		case 'active-session':
			$( '#status_indicator' )
				.removeClass( 'disconnected connected fa-circle-o-notch fa-spin fa-warning' )
				.addClass( 'fa-circle session-in-progress' );
				break;

		default:
			throw new Error( 'Unexpected status indicator level: ' + level );
	}
}
