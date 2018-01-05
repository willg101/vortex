/**
 * @brief
 *	Communicate with the debugger engine (DE) over a websocket (WS)
 *
 * A working knowledge of https://xdebug.org/docs-dbgp.php may help clarify some of the terminology
 * used in this file
 */
namespace( 'BasicApi' ).Debugger = (function( $ )
{
	// Whether or not a session with the DE is currently active
	var session_is_active = false;

	// Parsers for responses to various commands sent to the DE. Keys are command names and point to
	// functions that process the response into a more useful format. Parsed data returned by these
	// functions is included on 'response-received' events, under the key 'parsed'
	var response_parsers = {
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
		context_names : function( jq_message )
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
		init              : parseContinuationCommand,
		status            : parseContinuationCommand,
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

	function init()
	{
		BasicApi.SocketServer.registerMessageProcessor( processMessage );
		BasicApi.SocketServer.registerTypeDeterminer( determineMessageType );
	}

	/**
	 * @brief
	 *	Updates the flag for whether or not a session with the DE is currently active. If the call
	 *	to this function actually alters the flag, an event is published
	 *
	 * @param bool session_is_active_local
	 */
	function setActiveSessionStatus( session_is_active_local )
	{
		if ( (!!session_is_active_local) != session_is_active )
		{
			session_is_active = !session_is_active;

			publish( 'session-status-changed', {
				status : session_is_active
					? 'active'
					: 'inactive',
			} );
		}
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

	function translateArgs( args_object )
	{
		var out = {};
		for ( var nice_name in args_object )
		{
			if ( typeof command_args_conversion[ nice_name ] == 'string' )
			{
				if ( args_object[ nice_name ] || args_object[ nice_name ] === 0 )
				{
					out[ command_args_conversion[ nice_name ] ] = args_object[ nice_name ]
				}
			}
			else
			{
				throw new Error( 'Unrecognized argument "' + nice_name + '"' );
			}
		}

		return out;
	}

	/**
	 * @brief
	 *	Sends a command to the DE
	 *
	 * @param string name The command to send, get 'context_get', 'eval'
	 * @param mixed  ...  Any 3 of the following:
	 *                     - An object whose key/value pairs are args for the command
	 *                     - A string of additional data to include with the command
	 *                     - A function to handle the debugger engine's response
	 */
	function command( name /*, ... */ )
	{
		var command_args = {},
			command      = name,
			data         = '',
			callback     = undefined,
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

		// Data that we'll include under the 'alter_data' within the event object; this will allow
		// other entities to modify the command details
		var alter_data = {
			allow_send    : true,
			command       : command,
			command_args  : command_args,
			callback      : callback,
			data : data,
		};

		publish( 'before-send', { alter_data : alter_data } );

		// Check if a recipient of the 'before-send' event prevented the data from being sent
		if ( !alter_data.allow_send )
		{
			return false;
		}

		callback     = alter_data.callback;
		command      = alter_data.command;
		command_args = translateArgs( alter_data.command_args );
		data         = alter_data.data;

		return BasicApi.SocketServer.send( command, command_args, data, callback );
	}

	/**
	 * @retval bool
	 */
	function sessionIsActive()
	{
		return session_is_active;
	}

	/**
	 * @brief
	 *	A type determiner for BasicApi.SocketServer
	 */
	function determineMessageType( message )
	{
		if ( message.is( 'init' ) )
		{
			return 'init';
		}
		else if ( message.is( 'response[command]' ) )
		{
			return 'debugger_command:' + message.filter( 'response:first' ).attr( 'command' );
		}
		else if ( message.is( 'wsserver' ) )
		{
			return 'server_info'
		}
	}

	/**
	 * @brief
	 *	A message processor for BasicApi.SocketServer
	 */
	function processMessage( type, message, processed )
	{
		if ( !type.match( /^(init$|server_info$|debugger_command:)/ ) )
		{
			return;
		}

		type = type.replace( /^debugger_command:/, '' );

		// Wrap the XML message in a jQuery in order to examinine it more easily, and then discard
		// info we don't need, such as the XML declaration
		var jq_response_element = null;
		var jq_message = message.each( function( i, el )
		{
			el = $( el );
			if ( el.is( '[command],init,[status]' ) )
			{
				jq_response_element = el;
				return false;
			}
		} );

		if ( !jq_response_element )
		{
			return;
		}

		var is_stopping    = jq_response_element.is( '[status=stopping]' );
		var is_stopped     = jq_response_element.is( '[status=stopped]' );
		var session_ended  = jq_response_element.is( '[status=session_end]' );

		if ( !jq_response_element.is( '[session-status-change=neutral]' ) )
		{
			setActiveSessionStatus( !(is_stopping || is_stopped || session_ended) );
		}

		// The type of data for 'session-init' and 'response-received' events is nearly identical,
		// so we build it now
		$.extend( processed, {
			jq_message    : jq_response_element,
			parsed        : response_parsers[ type ] ? response_parsers[ type ]( jq_response_element ) : {},
			is_stopping   : is_stopping,
			is_stopped    : is_stopped,
			session_ended : session_ended,
		} );

		// Publish the appropriate type of event
		if ( type == 'init' )
		{
			publish( 'session-init', processed )
		}
		else if ( type == 'server_info' )
		{
			publish( 'server-info', processed )
		}
		else
		{
			publish( 'response-received', processed );
		}
	}

	$( init );

	return {
		sessionIsActive : sessionIsActive,
		command         : command,
	};
}( jQuery ));
