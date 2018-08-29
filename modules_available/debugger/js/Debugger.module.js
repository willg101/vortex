import Parsers from './Parsers.module.js'

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

	var response_parsers = Parsers.list();

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
	 * @param bool is_new_session          ignored when `session_is_active_local` is true
	 */
	function setActiveSessionStatus( session_is_active_local, is_new_session )
	{
		if ( (!!session_is_active_local) != session_is_active )
		{
			session_is_active = !session_is_active;

			publish( 'session-status-changed', {
				status : session_is_active
					? 'active'
					: 'inactive',
				is_new_session : session_is_active_local && is_new_session,
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
		max_data    : 'm'
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

		var is_stopping   = jq_response_element.is( '[status=stopping]' );
		var is_stopped    = jq_response_element.is( '[status=stopped]' );
		var session_ended = jq_response_element.is( '[status=session_end]' );

		if ( !jq_response_element.is( '[session-status-change=neutral]' ) )
		{
			setActiveSessionStatus( !(is_stopping || is_stopped || session_ended), type == 'init' );
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
