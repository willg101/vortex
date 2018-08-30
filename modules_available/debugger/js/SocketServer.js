/**
 * @brief
 *	Communicate with the socket server
 *
 * @note 'Web Socket' is frequently abbreviated in this file as 'WS'
 */
namespace( 'BasicApi' ).SocketServer = (function( $ )
{
	// A reference to the current websocket connection
	var current_connection = null;

	// The path (relative to location.host) to send initial WS requests to
	var ws_path = '/bridge'

	var identifier = 0;

	// The initiator of a socket server message can opt to have a function called automatically
	// when a response is received for that particular message, though whatever mechanism that
	// generates the response on the server must support transcation ids (the Xdebug debugger
	// engine does, for example). This object maps transaction ids to respective callbacks
	var transaction_callbacks = {};

	// tid => promise
	var promises = {};

	// A list of functions that help determine what type of response was received from the server.
	// See determineMessageType() for more information.
	var type_determiners   = [];

	// A list of functions that process messages from the socket server. See processMessage() for
	// more information.
	var message_processors = [];

	// As we receive data from the socket server, especially when receiving the data in bursts, the
	// messages may get split up or multiple messages may get combined into one. In the case where
	// messages get broken up between multiple communications, these variables keep track of the
	// current expected message length and message text
	var pending_data = '';
	var pending_data_length;

	const NULL_CHAR = String.fromCharCode( 0 );

	/**
	 * @brief
	 *	Handles the changing of a WS connection status and fires an appropriate event
	 *
	 * @param string new_status
	 *	One of 'connected', 'disconnected', or 'error'
	 */
	function onConnectionStatusChanged( new_status )
	{
		// Unless we're now connected, drop the our reference to a now-nonexistent WS
		if ( new_status != 'connected' )
		{
			current_connection = null;
		}

		publish( 'connection-status-changed', {
			status : new_status,
		} );
	}

	/**
	 * @brief
	 *	Attempts to open a WS connection
	 *
	 * @param object params HTTP GET params to include with the request
	 *
	 * @retval bool
	 *	true if the connection was attempted; false if not (a connection already exists)
	 */
	function openConnection( params )
	{
		// Allow connections to be aborted by other modules
		var options = { 'abort' : false };
		publish( 'attempt-connection', { options, params } );
		if ( options.abort )
		{
			return;
		}

		// Don't open a new connection if one is currently open
		if ( current_connection )
		{
			return false;
		}

		var ws_url = ( location.protocol == 'http:' ? 'ws://' : 'wss://' ) + location.host + ws_path;
		if ( params )
		{
			ws_url += '?' + $.param( params );
		}
		current_connection = new WebSocket( ws_url );

		current_connection.onclose   = onConnectionStatusChanged.bind( undefined, 'disconnected' );
		current_connection.onerror   = onConnectionStatusChanged.bind( undefined, 'error' );
		current_connection.onmessage = onMessageReceived;

		return true;
	}

	/**
	 * @brief
	 *	Sends a command to the socket server
	 *
	 * @param string name The command to send
	 * @param mixed  ...  Any 3 of the following:
	 *                     - An object whose key/value pairs are args for the command
	 *                     - A string of additional data to include with the command
	 *                     - A function to handle the socket server's response (requires transaction
	 *                       id support from the server)
	 */
	function send( command )
	{
		if ( !isConnected() )
		{
			return false;
		}

		var command_args = {},
			data         = '',
			callback     = null,
			tid          = identifier++,
			max_args     = Math.min( 4, arguments.length );

		for ( var i = 1; i < max_args; i++ )
		{
			switch ( typeof arguments[ i ] )
			{
				case 'string'   : data         = arguments[ i ]; break;
				case 'object'   : command_args = arguments[ i ]; break;
				case 'function' : callback     = arguments[ i ]; break;
			}
		}

		// If applicable, associate the given callback with this command's transaction id so that we
		// can call it when the socket server responds to the command specifically
		if ( typeof callback == "function" )
		{
			transaction_callbacks[ tid ] = callback;
		}

		if ( typeof command_args.i == "undefined" )
		{
			command_args.i = tid;
		}

		for ( var arg in command_args )
		{
			command += ( arg.length == 1 ? ' -' : ' --' ) + arg + ' ';
			command += typeof command_args[ arg ] == 'string'
				? '"' + escapeDoubleQuotes( command_args[ arg ] ) + '"'
				: command_args[ arg ];
		}

		// If applicable, base64 encode the additional data to include with the command
		if ( data )
		{
			command += ' -- ' + btoa( data );
		}

		current_connection.send( command );
		return new Promise( resolve => { promises[ tid ] = resolve } );
	}

	/**
	 * @brief
	 *	Escapes all unescaped double quotes in a string
	 *
	 * @param string str
	 *
	 * @retval string
	 *
	 * @see https://gist.github.com/getify/3667624
	 */
	function escapeDoubleQuotes( str )
	{
		return str.replace( /\\([\s\S])|(")/g , "\\$1$2" );
	}

	/**
	 * @brief
	 *	Processes incoming messages from the socket server
	 *
	 * @param object data
	 */
	function onMessageReceived( data )
	{
		var message = data.data;

		// Skip responses that contain no data
		if ( !message )
		{
			return;
		}

		for ( var i = 0; i < message.length; i++ )
		{
			var current_char = message.charAt( i );
			if ( current_char == NULL_CHAR )
			{
				as_number = Number( pending_data );
				// If the string contained in pending_data looks like a non-zero integer
				if ( as_number && as_number % 1 === 0  )
				{
					pending_data_length = as_number;
					pending_data        = '';
				}
				else if ( pending_data.length != pending_data_length )
				{
					pending_data        = '';
					pending_data_length = false;
					throw new Error( 'DPOH: Data length mismatch' );
				}
				else
				{
					var temp_message = pending_data;
					pending_data        = '';
					pending_data_length = false;
					processMessage( temp_message );
				}
			}
			else
			{
				pending_data += current_char;
			}
		}
	}

	/**
	 * @brief
	 *	Processes incoming messages from the socket server
	 */
	function processMessage( message )
	{
		var jq_message = $( message );
		if ( jq_message.is( '[status=no_exclusive_access]' ) )
		{
			onConnectionStatusChanged( 'no-exclusive-access' );
			return;
		}
		else if ( jq_message.is( '[status=connection_accepted]' ) )
		{
			onConnectionStatusChanged( 'connected' );
			return;
		}

		var type = determineMessageType( jq_message );

		var processed  = {
			jq_message    : jq_message,
			message_raw   : message,
			response_type : type,
		};

		message_processors.forEach( function( cb )
		{
			cb( type, jq_message, processed );
		} );


		// Call the explicitly specified callback, if applicable
		var tid = processed.transaction_id
			|| jq_message.filter( '[transaction_id]' ).attr( 'transaction_id' );
		if ( typeof transaction_callbacks[ parseInt( tid ) ] == 'function' )
		{
			transaction_callbacks[ Number( tid ) ]( processed );
		}

		if ( promises[ Number( tid ) ] )
		{
			promises[ Number( tid ) ]( processed );
			delete promises[ Number( tid ) ];
		}

		return processed;
	}

	/**
	 * @brief
	 *	Examines a message in order to determine its type (i.e., whether it indicates that a session
	 *	has been initiated, a certain command has been processed, etc.)
	 *
	 * @param jQuery jq_message
	 *
	 * @retval string|false
	 */
	function determineMessageType( jq_message )
	{
		var type;
		for ( var i in type_determiners )
		{
			type = type_determiners[ i ]( jq_message );
			if ( type )
			{
				return type;
			}
		}

		return 'unknown';
	}

	/**
	 * @brief
	 *	Adds a function to the list of type determiners
	 *
	 * @param function fn
	 *	A function that receives a jQuery of message from the websocket, and optionally returns
	 *	the type of message. The first such callback to return a non-false value determines the
	 *	type of the message.
	 */
	function registerTypeDeterminer( fn )
	{
		if ( typeof fn == 'function' )
		{
			type_determiners.push( fn );
		}
		else
		{
			throw new Error( 'Expected a function; received ' + typeof fn );
		}
	}

	/**
	 * @brief
	 *	Adds a function to the list of message processors
	 *
	 * @param function fn
	 *	A function that receives three arguments:
	 *	 - A string indicating the message type
	 *	 - A jQuery of message from the websocket
	 *	 - An object in which processed data should be placed
	 */
	function registerMessageProcessor( fn )
	{
		if ( typeof fn == 'function' )
		{
			message_processors.push( fn );
		}
		else
		{
			throw new Error( 'Expected a function; received ' + typeof fn );
		}
	}


	/**
	 * @retval bool
	 */
	function isConnected()
	{
		return !!getConnection();
	}

	/**
	 * @retval WebSocket|null
	 */
	function getConnection()
	{
		return current_connection;
	}

	return {
		send                     : send,
		openConnection           : openConnection,
		isConnected              : isConnected,
		getConnection            : getConnection,
		onMessageReceived        : onMessageReceived,
		registerTypeDeterminer   : registerTypeDeterminer,
		registerMessageProcessor : registerMessageProcessor,
	};

}( jQuery ) );
