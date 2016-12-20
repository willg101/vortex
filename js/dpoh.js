dpoh = (function( $ )
{
	var identifier         = 0;
	var empty_function     = function(){};
	var current_connection = null;
	var ws_path = '/bridge'
	
	var pending_data = '';
	var pending_data_length;
	
	var subscribable = {
		connection_opened : [],
		connection_closed : [],
		connection_error  : [],
		before_send       : [],
		after_send        : [],
		session_init      : [],
		response_recevied : [],
	};
	
	var transaction_callbacks = {};
	
	var onConnectionOpened = fireEvent.bind( undefined, 'connection_opened' );
	
	function onConnectionClosed()
	{
		current_connection = null;
		fireEvent( 'connection_closed' );
	}

	function onConnectionError()
	{
		current_connection = null;
		fireEvent( 'connection_error' );
	}
	
	function openConnection()
	{
		if ( current_connection )
		{
			return false;
		}

		current_connection = new WebSocket( 'ws://' + location.host + ws_path );

		current_connection.onopen    = onConnectionOpened;
		current_connection.onclose   = onConnectionClosed;
		current_connection.onerror   = onConnectionError;
		current_connection.onmessage = onMessageReceived;
		
		return true;
	}
	
	function subscribe( key, callback )
	{
		if ( typeof callback != "function" )
			
		{
			throw new Error( "`callback` must be a function" );
		}
	
		if ( subscribable[ key ] instanceof Array )
		{
			if ( subscribable[ key ].indexOf( callback ) == -1 )
			{
				subscribable[ key ].push( callback );
			}
		}
		else
		{
			throw new Error( "Unrecognized event `" + key + "`" );
		}
	}
	
	function unsubscribe( key, callback )
	{
		if ( typeof callback != "function" )
		{
			console.warn( "`callback` is not a function" );
			return;
		}
	
		if ( subscribable[ key ] instanceof Array )
		{
			var index = subscribable[ key ].indexOf( callback );
			if ( index != -1 )
			{
				subscribable[ key ] = subscribable[ key ].splice( index, 1 );
			}
		}
		else
		{
			throw new Error( "Unrecognized event `" + key + "`" );
		}		
	}
	
	function fireEvent( key, args )
	{
		if ( ! ( args instanceof Array ) )
		{
			args = [];
		}

		if ( subscribable[ key ] instanceof Array )
		{
			for ( var i in subscribable[ key ] )
			{
				subscribable[ key ][ i ].apply( undefined, args );
			}
		}
		else
		{
			throw new Error( "Unrecognized event `" + key + "`" );
		}
	}

	function sendCommand( command, callback, debugger_data )
	{
		var alter_data = {
			allow_send : true,
			command : command,
			callback : callback,
			debugger_data : debugger_data,
		};
		fireEvent( 'before_send', [ alter_data, identifier ] );
		if ( !alter_data.allow_send )
		{
			return;
		}
		
		callback = alter_data.callback;
		command  = alter_data.command;
		
		if ( typeof callback == "function" )
		{
			transaction_callbacks[ identifier ] = callback;
		}

		if ( alter_data.allow_send )
		{
			command += " -i " + identifier;
			
			if ( debugger_data )
			{
				command += ' -- ' + btoa( debugger_data );
			}
			
			current_connection.send( command );
			
			delete alter_data.allow_send;
			fireEvent( 'after_send', [ alter_data, identifier ] );

			return identifier++;
		}
	}
	
	function onMessageReceived( data )
	{
		var message = data.data;

		// Skip responses that contain no data
		if ( !message )
		{
			return;
		}
		
		var message_parts = message.split( String.fromCharCode( 0 ) );
		message_parts.forEach( function( part )
		{
			if ( pending_data_length )
			{
				if ( pending_data_length == ( pending_data + part ).length )
				{
					processMessage( pending_data + part );
					pending_data_length = false;
					pending_data = '';
				}
				else
				{
					pending_data += part;
				}
			}
			else if ( Number( part ) )
			{
				pending_data_length = Number( part )
			}
		} );
	}

	function processMessage( message )
	{
		var jq_message = $( message );
		var jq_response_element = jq_message.find( '[command],init' );
		if ( !jq_response_element.length && jq_message.is( '[command],init' ) )
		{
			jq_message.each( function( index, value )
			{
				if ( $( value ).is( '[command],init' ) )
				{
					jq_response_element = $( value );
					return false;
				}
			} );
		}

		if ( !jq_response_element.length )
		{
			console.warn( 'Unrecognized response from server: ' + message );
		}

		if ( jq_response_element.is( 'init' ) )
		{
			fireEvent( 'session_init', [ jq_response_element ] );
			return;
		}
		
		var tid = jq_response_element.attr( 'transaction_id' );
		if ( transaction_callbacks[ tid ] )
		{
			transaction_callbacks[ tid ]( jq_response_element );
			delete transaction_callbacks[ tid ];
		}
		
		fireEvent( 'response_recevied', [ jq_response_element, tid ] );
	}

	return {
		sendCommand     : sendCommand,
		subscribe       : subscribe,
		unsubscribe     : unsubscribe,
		openConnection  : openConnection,
	};
	
}( jQuery ) );