import ProgrammingLanguage from './ProgrammingLanguage.module.js'

const MAGIC_EVAL_VAR_NAME      = '$__';
const HEREDOC_PREFIX           = 'eval(<<<\'VORTEXEVAL\'\n';
const HEREDOC_SUFFIX           = '\nreturn ' + MAGIC_EVAL_VAR_NAME + ';\nVORTEXEVAL\n);';
const EVAL_MAGIC_VAR_REGEX     = new RegExp( '\\' + MAGIC_EVAL_VAR_NAME + '($|[^_\\w])' )
const DUMMY_SESSION_TIMEOUT_MS = 500;

class PhpLanguage extends ProgrammingLanguage
{
	///////////////////////////////////////////////////////////////////////////////////////////////
	// Public/required functions
	///////////////////////////////////////////////////////////////////////////////////////////////

	async getBytesOfMemoryUsed()
	{
		var data = await BasicApi.Debugger.command( 'eval', 'memory_get_usage()' );
		var mem_data = data.parsed.value[ 0 ] || {};
		return mem_data.value;
	}

	async evalCommand( command, display )
	{
		var output = function(){};
		if ( display )
		{
			output = function( text )
			{
				display.prepend( text );
			};
		}

		if ( !BasicApi.Debugger.sessionIsActive() )
		{
			try
			{
				output( 'No debug session is active; creating dummy session...' );
				await this.startDummyDebugSession();
			}
			catch ( e )
			{
				return {
					status  : 'error',
					message : e.getMessage(),
				}
			}
		}

		// After scouring the Xdebug protocol docs for a way to get a variable name from an
		// address, which would be required to lazy-load the response's object/array's nested
		// properties, I came up empty-handed. Lazy-loading doesn't seem to be a viable option
		// here, so let's deep-load the response instead
		BasicApi.Debugger.command( 'feature_set', { name : 'max_depth', value : 10 } );
		var data = await BasicApi.Debugger.command( 'eval', this.prepareCodeForEval( command ));
		BasicApi.Debugger.command( 'feature_set', { name : 'max_depth', value : 1 } );

		var message = '';
		var status  = 'ok';
		var return_value;

		if ( data.parsed.value && data.parsed.value.length )
		{
			data.parsed.value.forEach( function( item )
			{
				item.name     = item.name || '';
				item.fullname = item.fullname || '';
			} );
			return_value = data.parsed.value;
		}
		else if ( data.parsed.message )
		{
			message = data.parsed.message
			status  = 'error';
		}
		else
		{
			message = 'Empty response received';
			status  = 'error';
		}

		return { return_value, status, message };
	}

	getConsoleInfo()
	{
		return {
			prompt    : `${this.name}> `,
			greetings : function( cb ){ cb( 'Tip: if you have trouble running a multi-statement '
				+ 'snippet, try including the magic variable [[b;#21599f;]' + MAGIC_EVAL_VAR_NAME
				+ ']. This will cause your code to be processed slightly differently and will '
				+ '[[b;;]output the final value of ][[b;#21599f;]' + MAGIC_EVAL_VAR_NAME + '].' );
			}
		};
	}

	getConsoleFormatter()
	{
		var lowercase = [ '__halt_compiler', 'abstract', 'and', 'array', 'as', 'break', 'callable',
			'case', 'catch', 'class', 'clone', 'const', 'continue', 'declare', 'default', 'die',
			'do', 'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor', 'endforeach', 'endif',
			'endswitch', 'endwhile', 'eval', 'exit', 'extends', 'final', 'for', 'foreach',
			'function', 'global', 'goto', 'if', 'implements', 'include', 'include_once',
			'instanceof', 'insteadof', 'interface', 'isset', 'list', 'namespace', 'new', 'or',
			'print', 'private', 'protected', 'public', 'require', 'require_once', 'return',
			'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use', 'var', 'while', 'xor'
		];
		var all_keywords = lowercase.concat( lowercase.map( keyword => keyword.toUpperCase ) );

		return entire_command =>
		{
			return entire_command.split( /((?:\s|&nbsp;)+)/ ).map( string =>
			{
				if ( all_keywords.indexOf( string ) != -1 )
				{
					return '[[;#268bd2;]' + string + ']';
				}
				else if ( string[ 0 ] == '$' && string.length > 1 )
				{
					return '[[;#59c203;]' + string + ']';
				}
				else
				{
					return string;
				}
			} ).join( '' );
		}
	}

	///////////////////////////////////////////////////////////////////////////////////////////////
	// Utility functions
	///////////////////////////////////////////////////////////////////////////////////////////////

	prepareCodeForEval( code )
	{
		code = String( code );
		return code.match( EVAL_MAGIC_VAR_REGEX )
			? HEREDOC_PREFIX + code + HEREDOC_SUFFIX
			: code;
	}

	constructor( ...args )
	{
		super( ...args );
		this.dummySessionTimeout = null;
	}

	startDummyDebugSession()
	{
		var resolve = null;
		var reject  = null;
		var promise = new Promise( ( resolve_promise, reject_promise ) =>
		{
			resolve = resolve_promise;
			reject  = reject_promise;
		} );

		if ( !BasicApi.Debugger.sessionIsActive() )
		{
			if ( !BasicApi.SocketServer.isConnected() )
			{
				reject( 'Error: no connection to socket server' );
				return promise;
			}

			var options = {
				url    : 'dummy.php',
				params : {
					XDEBUG_SESSION_START : 1,
				}
			};
			publish( 'alter-dummy-session-request', { options : options } );
			var url = options.url + '?' + $.param( options.params );
			$.get( url );

			function tryProcessing()
			{
				if ( !BasicApi.Debugger.sessionIsActive() )
				{
					reject( 'Could not initiate a new session (timed out)' );
				}
				else
				{
					resolve();
				}
			}
			this.dummySessionTimeout = setTimeout( tryProcessing, DUMMY_SESSION_TIMEOUT_MS );
		}
		return promise;
	}


}

ProgrammingLanguage.setDefault( new PhpLanguage( 'php' ) );
