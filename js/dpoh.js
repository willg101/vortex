dpoh = (function( $ )
{
	var identifier = 0;
	var empty_function = function(){};
	
	var subscribable = {
		before_send : [],
		after_send : [],
		session_init : [],
		response_recevied : [],
	};
	
	var transaction_callbacks = {};
	
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

	function sendCommand( command, callback )
	{
		var alter_data = {
			allow_send : true,
			command : command,
			callback : callback,
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
		
		delete alter_data.allow_send;
		fireEvent( 'after_send', [ alter_data, identifier ] );

		if ( command != "get" && command != "quit" && command )
		{
			command = "send " + command + " -i " + identifier;
		}

		$.post( '/xdebug_http/connect.php', { commands: [ command ] },
			onResponseReceived.bind( undefined, command, identifier, alter_data.immediate_callback ) );
			
		return identifier++;
	}
	
	function onResponseReceived( command, original_tid, cb, data )
	{
		typeof cb == "function" && cb( data );

		if ( !data || !(data instanceof Array) )
		{
			return;
		}
		
		data.forEach( function( message )
		{
			// Skip responses that contain little data
			if ( ! message || message == "NO_DATA" || message == "SEND_ACK" )
			{
				return /* continue */;
			}
			
			var message_parts = message.split( String.fromCharCode( 0 ) );
			var message_length = Number( message_parts[ 0 ] );
			var message_data = message_parts[ 1 ];
			
			if ( message_data.length != message_length )
			{
				throw new Error( "Data length mismatch" );
			}
			
			var jq_message = $( message_data );
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
				console.warn( 'Unrecognized response from server: ' + message_data );
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
		} );
	}

	function listRecentFiles( dir, callback )
	{
		$.post( '/xdebug_http/connect.php', { commands: [ 'list_recent_files ' + dir ] }, callback );
	}

	return {
		sendCommand : sendCommand,
		subscribe : subscribe,
		unsubscribe : unsubscribe,
		listRecentFiles : listRecentFiles,
	};
	
}( jQuery ) );