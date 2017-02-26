/**
 * @brief
 *	Provides an API for communicating with the debugger engine (DE) over a websocket (WS).
 *
 * A working knowledge of https://xdebug.org/docs-dbgp.php may help clarify some of the terminology
 * used in this file 
 */
dpoh = (function( $ )
{
	// The current transaction_id for Xdebug calls; incremented with each command sent
	var identifier         = 0;
	
	// A reference to the current websocket connection
	var current_connection = null;
	
	// Whether or not a session with the DE is currently active
	var session_is_active = false;
	
	// The path (relative to location.host) to send initial WS requests to
	var ws_path            = '/bridge'

	// As we receive data from the DE, especially when receiving the data in bursts, the messages
	// may get split up or multiple messages may get combined into one. In the case where messages
	// get broken up between multiple communications, these variables keep track of the current
	// expected message length and message text
	var pending_data = '';
	var pending_data_length;

	// In addition to emitting events when receiving data from the DE, the initiator of a DE command
	// can opt to have a specific function called immediately. This maps transaction ids (and thus
	// initiators) to these callbacks
	var transaction_callbacks = {};

	const NULL_CHAR = String.fromCharCode( 0 );

	// Parsers for responses to various commands sent to the DE. Keys are command names and point to
	// functions that process the response into a more useful format. Parsed data returned by these
	// functions is included on 'response-received' events, under the key 'parsed'
	var response_parsers      = {
	
		/**
		 * @brief
		 *	Parses the response from an 'eval' command
		 *
		 * @param jQuery jq_message
		 *
		 * @retval object
		 */		
		eval : function( jq_message )
		{
			var data     = {};
			data.value   = parseContextGet( jq_message );
			data.message = parseCdata( jq_message.find( 'message' ) );
			return data;
		},
	
		/**
		 * @brief
		 *	Parses the response from a stack_get command
		 *
		 * @param jQuery jq_message
		 *
		 * @retval object
		 */		
		stack_get : function( jq_message )
		{
			var stack = [];
			jq_message.find( 'stack' ).each( function( i, el )
			{
				stack.push( extractAttrs( $( el ), [ 'where', 'level', 'type', 'filename',
					'lineno' ] ) );
			} );
			return stack;
		},

		/**
		 * @brief
		 *	Parses the response from a context_names command
		 *
		 * @param jQuery jq_message
		 *
		 * @retval object
		 */			
		context_names     : function( jq_message )
		{
			var data = [];
			
			jq_message.find( 'context' ).each( function( i, el )
			{
				el = $( el );
				data.push( extractAttrs( el, [ 'name', 'id' ] ) );
			} );
			
			return data;
		},
		
		property_get      : parseContextGet,
		context_get       : parseContextGet,
		
		breakpoint_set    : parseBreakpointAddRemove,
		breakpoint_remove : parseBreakpointAddRemove,	
		breakpoint_get    : parseBreakpoints,	
		breakpoint_list   : parseBreakpoints,
		
		step_into         : parseContinuationCommand,
		step_over         : parseContinuationCommand,
		step_out          : parseContinuationCommand,
		stop              : parseContinuationCommand,
		detach            : parseContinuationCommand,
		run               : parseContinuationCommand,
	}

	/**
	 * @brief
	 *	Parses the response from a context_get command. This is defined as a standalone function due
	 *	to its recursive nature (items within the context can have items nested within them)
	 *
	 * @param jQuery jq_message
	 *
	 * @retval object
	 */
	function parseContextGet( jq_message )
	{
		var properties = [];
		jq_message.find( '> property' ).each( function( i, el )
		{
			el = $( el );
			var property = extractAttrs( el, [ 'name', 'type', 'fullname', 'address', 'size',
				'is_recursive', 'numchildren' ] );

			if ( el.children().length )
			{
				property.children = parseContextGet( el )
			}
			else if ( property.type != 'uninitialized' && property.type != 'null' )
			{
				property.value = parseCdata( el );
			}
			properties.push( property );
		} );
		return properties;
	}

	/**
	 * @brief
	 *	Parses the response from breakpoint_add and breakpoint_remove command.
	 *
	 * @param jQuery jq_message
	 *
	 * @retval object
	 */	
	function parseBreakpointAddRemove( jq_message )
	{
		return {
			id : jq_message.attr( 'id' ),
		};
	}

	/**
	 * @brief
	 *	Parses the response from a continuation command such as 'step_into', 'step_over', 'run',
	 *	etc.
	 *
	 * @param jQuery jq_message
	 *
	 * @retval object
	 */
	function parseContinuationCommand( jq_message )
	{
		var info = extractAttrs( jq_message, [ 'status', 'reason' ] );
		info.is_continuation = true;
		if ( jq_message.children().length )
		{
			$.extend( info, extractAttrs( jq_message.children(), [ 'filename', 'lineno' ] ) );
		}
		return info;
	}

	/**
	 * @brief
	 *	Parses the response from a breakpoint_get or breakpoint_list command
	 *
	 * @param jQuery jq_message
	 *
	 * @retval object
	 */
	function parseBreakpoints( jq_message )
	{
		var breakpoints = {
			line        : [],
			call        : [],
			'return'    : [],
			exception   : [],
			conditional : [],
			watch       : [], 
		};
		
		jq_message.find( 'breakpoint' ).each( function( i, el )
		{
			el = $( el );
			var attrs = extractAttrs( el, [ 'type', 'filename', 'lineno', 'state', 'function',
				'temporary', 'hit_count', 'hit_value', 'hit_condition', 'exception',
				'expression', 'id' ] );
			attrs.expression_element = parseCdata( el.find( 'expression' ) );
			breakpoints[ attrs.type ].push( attrs );
		} );
		
		return breakpoints;
	}
	
	/**
	 * @brief
	 *	Parses CDATA from within an XML element
	 *
	 * @param jQuery jq_element
	 *
	 * @retval mixed
	 */
	function parseCdata( jq_element )
	{
		if ( !jq_element.length )
		{
			return;
		}

		var data = jq_element.html().replace( '<!--[CDATA[', '' ).replace( ']]-->', '' );
		return jq_element.is( '[encoding=base64]' )
			? atob( data )
			: data;
	}

	/**
	 * @brief
	 *	Extracts a list of attributes from a jQuery-wrapped object into a plain object
	 *
	 * @param jQuery jq_el
	 * @param Array attr_list
	 *	An Array of attribute names
	 *
	 * @retval object
	 *	A key for each attribute name from attr_list will exist, even if the corresponding value is
	 *	undefined
	 */
	function extractAttrs( jq_element, attr_list )
	{
		if ( !jq_element.length )
		{
			return {};
		}

		var result = {};
		attr_list.forEach( function( attr_name )
		{
			result[ attr_name ] = jq_element.attr( attr_name );
		} );
		return result;
	}

	/**
	 * @brief
	 *	Adds, updates or deletes a parser for responses to a given command type
	 *
	 * @param string response_type
	 * @param function|null fn
	 */
	function setResponseParser( response_type, fn )
	{
		if ( fn !== null && typeof fn != "function" )
		{
			throw new Error( 'Expected function or null; received ' + typeof fn );
		}
		
		if ( fn === null )
		{
			delete response_parsers[ response_type ];
		}
		else
		{
			response_parsers[ response_type ] = fn;
		}
	}

	/**
	 * @brief
	 *	Retrieves a parser for responses to a given command type
	 *
	 * @param string response_type
	 *
	 * @retval function|undefined
	 */
	function getResponseParser( response_type )
	{
		return response_parsers[ response_type ];
	}

	/**
	 * @brief
	 *	Calls the appropriate response parse (if any) for the given message type
	 *
	 * @param jQuery jq_message
	 * @param string response_type
	 *
	 * @retval object|null
	 */
	function parseMessage( jq_message, response_type )
	{
		var parser = response_parsers[ response_type ];
		return typeof parser == "function"
			? parser( jq_message, response_type )
			: null;
	}

	
	/**
	 * @brief
	 *	The default means of publishing an event. Publishes the event on the document object via
	 *	jQuery
	 *
	 * @param string type
	 * @param object data
	 *	OPTIONAL. The data to include when publishing the event
	 */ 
	var event_publisher = function( type, data )
	{
		if ( typeof data != "object" )
		{
			data = {};
		}
		data.type = type;
		$( document ).trigger( data );
	}

	/**
	 * @brief
	 *	Updates the function responsible for publishing events
	 *
	 * @param function new_fn
	 *	Each time an event should be fired, this function will be passed the event name and an
	 *	object containing data to include with the event
	 */ 	
	function setEventPublisher( new_fn )
	{
		if ( typeof new_fn != "function" )
		{
			throw new Error( 'Expected a function; received ' + typeof new_fn );
		}
		event_publisher = new_fn;
	}

	/**
	 * @retval function
	 *	The function responsible for publishing events
	 */ 
	function getEventPublisher()
	{
		return event_publisher;
	}
	
	/**
	 * @brief
	 *	Fires an event using the method stored in event_publisher
	 *
	 * @param string type
	 * @param object data
	 *	OPTIONAL. The data to include when publishing the event
	 */
	function fireEvent( type, data )
	{
		type = 'dpoh:' + type;
		event_publisher( type, data );
	}

	/**
	 * @brief
	 *	Updates the flag for whether or not a session with the DE is currently active. If the call
	 *	to this function actually alters the flag, an event is fired.
	 *
	 * @param bool session_is_active_local
	 */
	function setActiveSessionStatus( session_is_active_local )
	{
		if ( (!!session_is_active_local) != session_is_active )
		{
			session_is_active = !session_is_active;

			fireEvent( 'session-status-changed', {
				status : session_is_active
					? 'active'
					: 'inactive',
			} );
		}
	}

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

		fireEvent( 'connection-status-changed', {
			status : new_status,
		} );
	}

	/**
	 * @brief
	 *	Attempts to open a WS connection
	 *
	 * @retval bool
	 *	true if the connection was attempted; false if not (a connection already exists)
	 */ 
	function openConnection()
	{
		// Don't open a new connection if one is currently open
		if ( current_connection )
		{
			return false;
		}

		current_connection = new WebSocket( 'ws://' + location.host + ws_path );

		current_connection.onopen    = onConnectionStatusChanged.bind( undefined, 'connected' );
		current_connection.onclose   = onConnectionStatusChanged.bind( undefined, 'disconnected' );
		current_connection.onerror   = onConnectionStatusChanged.bind( undefined, 'error' );
		current_connection.onmessage = onMessageReceived;
		
		return true;
	}

	var command_args_conversion = {
		breakpoint  : 'd',
		context     : 'c',
		file        : 'f',
		line        : 'n',
		name        : 'n',
		stack_depth : 'd',
		type        : 't',
		value       : 'v',
		transaction : 'i',
		pattern     : 'p',
	};

	function buildArgs( args_object )
	{
		var as_string = '';
		for ( var nice_name in args_object )
		{
			if ( typeof command_args_conversion[ nice_name ] == 'string' )
			{
				if ( args_object[ nice_name ] || args_object[ nice_name ] === 0 )
				{
					as_string += ' -' + command_args_conversion[ nice_name ]
						+ ' ' + args_object[ nice_name ]
				}
			}
			else
			{
				throw new Error( 'Unrecognized argument "' + nice_name + '"' );
			}
		}

		return as_string
	}

	function command( name /*, ... */ )
	{
		var command_args = {},
			data         = '',
			callback     = null,
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

		if ( name.match( /^property_/ ) && command_args.name )
		{
			command_args.name = '"' + command_args.name.replace( /"/g, '\\"' ) + '"';
		}

		return sendCommand( name + buildArgs( command_args ), callback || undefined,
			data || undefined );
	}

	/**
	 * @brief
	 *	Sends a command to the DE
	 *
	 * @param string command
	 *	The command and its arguments (except the -i argument, which is automatically added)
	 * @param function callback
	 *	OPTIONAL. Called when the server responds to this particular command
	 * @param string debugger_data
	 *	OPTIONAL. Additional data included with commands such as eval. This function takes care of
	 *	properly encoding this value
	 */
	function sendCommand( command, callback, debugger_data )
	{
		if ( !isConnected() )
		{
			return false;
		}

		// Data that we'll include under the 'alter_data' within the event object; this will allow
		// other entities to modify the command details
		var alter_data = {
			allow_send    : true,
			command       : command,
			callback      : callback,
			debugger_data : debugger_data,
			tid           : identifier,
		};

		fireEvent( 'before-send', { alter_data : alter_data } );
		
		// Check if a recipient of the 'before-send' event prevented the data from being sent
		if ( !alter_data.allow_send )
		{
			return false;
		}
		
		callback = alter_data.callback;
		command  = alter_data.command;

		// If applicable, associate the given callback with this command's transaction id so that we
		// can call it when the DE responds to the command specifically
		if ( typeof callback == "function" )
		{
			transaction_callbacks[ identifier ] = callback;
		}

		// Add the -i parameter to indicate a transaction id
		command += " -i " + identifier;

		// If applicable, base64 encode the additional data to include with the command
		if ( debugger_data )
		{
			command += ' -- ' + btoa( debugger_data );
		}
		
		current_connection.send( command );
		
		// The 'allow_send' key is not applicable for the 'after-send' event
		delete alter_data.allow_send;
		fireEvent( 'after-send', alter_data );

		return identifier++;
	}

	/**
	 * @brief
	 *	Processes incoming messages from the DE
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
	 *	Once a full message has been received, attempts to parse the message and publish an event
	 *	indicating that we received the message
	 *
	 * @param string message
	 */
	function processMessage( message )
	{
		// Wrap the XML message in a jQuery in order to examinine it more easily, and then discard
		// info we don't need, such as the XML declaration
		var jq_response_element = null;
		var jq_message = $( message ).each( function( i, el )
		{
			el = $( el );
			if ( el.is( '[command],init,wsserver,modulemessage' ) )
			{
				jq_response_element = el;
				return false;
			}
		} );

		if ( !jq_response_element )
		{
			console.warn( 'Unrecognized response from server: ' + message );
		}

		var is_stopping    = jq_response_element.is( '[status=stopping]' );
		var is_stopped     = jq_response_element.is( '[status=stopped]' );
		var session_ended  = jq_response_element.is( '[status=session_end]' );
		var is_mod_message = jq_response_element.is( 'modulemessage' );
		setActiveSessionStatus( !(is_stopping || is_stopped || session_ended || is_mod_message) );

		// Determine which command (if any) the response is for
		var response_type = determineMessageType( jq_response_element );

		// The type of data for 'session-init' and 'response-received' events is nearly identical,
		// so we build it now
		var event_data = {
			jq_message    : jq_response_element,
			message_raw   : message,
			parsed        : parseMessage( jq_response_element, response_type ),
			response_type : response_type,
			is_stopping   : is_stopping,
			is_stopped    : is_stopped,
			session_ended : session_ended, 
		};
		
		// Fire the appropriate type of event
		if ( response_type == 'init' )
		{
			fireEvent( 'session-init', event_data )
		}
		else if ( response_type == 'server_info' )
		{
			fireEvent( 'server-info', event_data )			
		}
		else
		{
			// Since the response is from a command issued by the client, determine the transaction
			// id and include that with the event data
			var tid = jq_response_element.attr( 'transaction_id' );
			event_data.tid = tid;
			
			// Whoever initiated the command related to this response had the option to specificy a
			// callback as soon as a response was received; if such a callback was given, call it
			// now
			if ( transaction_callbacks[ tid ] )
			{
				transaction_callbacks[ tid ]( event_data );
				delete transaction_callbacks[ tid ];
			}

			fireEvent( 'response-received', event_data );
		}
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
		if ( jq_message.is( 'init' ) )
		{
			return 'init';
		}
		else if ( jq_message.is( 'wsserver' ) )
		{
			return 'server_info'
		}
		else if ( jq_message.is( 'response[command]' ) )
		{
			return jq_message.attr( 'command' );
		}
		else
		{
			return false;
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
	 * @retval bool
	 */
	function sessionIsActive()
	{
		return session_is_active;
	}

	/**
	 * @retval WebSocket|null
	 */
	function getConnection()
	{
		return current_connection;
	}
	
	return {
		sendCommand       : sendCommand,
		command           : command,
		openConnection    : openConnection,
		setEventPublisher : setEventPublisher,
		getEventPublisher : getEventPublisher,
		isConnected       : isConnected,
		sessionIsActive   : sessionIsActive,
		getConnection     : getConnection,
		setResponseParser : setResponseParser,
		getResponseParser : getResponseParser,
		incomingData      : function(){ return { pending_data : pending_data, pending_data_length : pending_data_length } },
		onMessageReceived : onMessageReceived,
	};
	
}( jQuery ) );
