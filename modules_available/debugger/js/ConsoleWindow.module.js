import File from './File.module.js'

(function( $ )
{
	var dummy_session_timeout = null;

	const MAGIC_EVAL_VAR_NAME = '$__';
	const HEREDOC_PREFIX      = 'eval(<<<\'VORTEXEVAL\'\n';
	const HEREDOC_SUFFIX      = '\nreturn ' + MAGIC_EVAL_VAR_NAME + ';\nVORTEXEVAL\n);';
	var eval_magic_var_regex  = new RegExp( '\\' + MAGIC_EVAL_VAR_NAME + '($|[^_\\w])' )

	function prepareCommand( command_str )
	{
		command_str = typeof command_str == 'string' ? command_str : '';
		return command_str.match( eval_magic_var_regex )
			? HEREDOC_PREFIX + command_str + HEREDOC_SUFFIX
			: command_str;
	}

	function init()
	{
		initConsole();
	}

	function initConsole()
	{
		var command_n = 0;
		$( '#console').terminal(function(command, term)
			{
				var my_command_n = command_n++;
				var id = 'term_resp_' + my_command_n;
				var result = '<div id="' + id + '"><i class="fa fa-spin fa-circle-o-notch"></i></div>';
				var inner_fn = function(){ return result };
				var fn = function(){ return inner_fn() };
				term.pause();

				var process_command = async function()
				{
					term.echo( fn, { raw : true } );

					// After scouring the Xdebug protocol docs for a way to get a variable name from an
					// address, which would be required to lazy-load the response's object/array's nested
					// properties, I came up empty-handed. Lazy-loading doesn't seem to be a viable option
					// here, so let's deep-load the response instead
					BasicApi.Debugger.command( 'feature_set', { name : 'max_depth', value : 10 } );
					var data = await BasicApi.Debugger.command( 'eval', prepareCommand( command ));
					if ( data.parsed.value && data.parsed.value.length )
					{
						data.parsed.value.forEach( function( item )
						{
							item.name     = item.name || '';
							item.fullname = item.fullname || '';
						} );
						$( '#' + id ).html( '' ).vtree( data.parsed.value );
						inner_fn = function()
						{
							setTimeout( function(){ $( '#' + id ).html( '' ).vtree( data.parsed.value ); }, 30 );
							return result;
						};
					}
					else if ( data.parsed.message )
					{
						var message = $( '<div>' ).text( data.parsed.message ).html();
						message = '<span class="debugger-message">' + message + '</span>';
						$( '#' + id ).html( message );
					}
					else
					{
						$( '#' + id ).html( '<span class="no-debugger-message">Empty response '
							+ 'received</span>' );
					}
					BasicApi.Debugger.command( 'feature_set', { name : 'max_depth', value : 1 } );
					term.resume();
				};

				if ( !BasicApi.Debugger.sessionIsActive() )
				{
					if ( !BasicApi.SocketServer.isConnected() )
					{
						term.echo( "Error: no connection to socket server" );
						return;
					}

					term.echo( 'No debug session is active; creating dummy session...' );
					var options = {
						url    : 'dummy.php',
						params : {
							XDEBUG_SESSION_START : 1,
						}
					};
					publish( 'alter-dummy-session-request', { options : options } );
					var url = options.url + '?' + $.param( options.params );
					$.get( url );

					var timeout;
					function tryProcessing()
					{
						if ( !BasicApi.Debugger.sessionIsActive() )
						{
							term.echo( "Could not initiate a new session (timed out)" );
							term.resume();
						}
						else
						{
							process_command();
						}
					}
					timeout = setTimeout( tryProcessing, 250 );
				}
				else
				{
					process_command();
				}
		},
		{
			greetings: function( cb ){ cb( 'Tip: if you have trouble running a multi-statement '
				+ 'snippet, try including the magic variable [[b;#21599f;]' + MAGIC_EVAL_VAR_NAME
				+ ']. This will cause your code to be processed slightly differently and will '
				+ '[[b;;]output the final value of ][[b;#21599f;]' + MAGIC_EVAL_VAR_NAME + '].' ); },
			prompt : 'php> ',
			name : 'console',
			enabled : false,
		} );
		var lowercase = [
		'__halt_compiler', 'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch', 'class', 'clone', 'const', 'continue', 'declare', 'default', 'die', 'do', 'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor', 'endforeach', 'endif', 'endswitch', 'endwhile', 'eval', 'exit', 'extends', 'final', 'for', 'foreach', 'function', 'global', 'goto', 'if', 'implements', 'include', 'include_once', 'instanceof', 'insteadof', 'interface', 'isset', 'list', 'namespace', 'new', 'or', 'print', 'private', 'protected', 'public', 'require', 'require_once', 'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use', 'var', 'while', 'xor'
	];
	var keywords = lowercase.concat(lowercase.map(function(keyword) {
    	return keyword.toUpperCase();
	}));
	$.terminal.defaults.formatters.push(function(string) {
    	return string.split(/((?:\s|&nbsp;)+)/).map(function(string) {
        	if (keywords.indexOf(string) != -1) {
            	return '[[;#268bd2;]' + string + ']';
        	} else if ( string[ 0 ] == '$' && string.length > 1) {
            	return '[[;#59c203;]' + string + ']';
        	} else {
            	return string;
        	}
    	}).join('');
	});
	}

	function resizeCell()
	{
		var height = $( '.toolbar .css-cell:not(.match-height)' ).height();
		$( '.toolbar .css-cell.match-height' ).height( height + 1 );

		// jQuery Terminal's handling of resizing, in which all messages are re-rendered, does not
		// work well with jsTree, and tends to crash. Since we wouldn't gain much benefit from this
		// feature even if it did work, let's just disable it.
		$( '#console' ).resizer( 'unbind' );
	}

	function onSessionStatusChanged()
	{
		clearInterval( dummy_session_timeout );
	}

	function onConsoleClicked()
	{
		$( '#console' ).terminal().enable();
	}

	$( document ).on( 'click',       '#console_container', onConsoleClicked );
	$( window   ).on( 'resize load',                       resizeCell );

	subscribe( 'session-status-changed', onSessionStatusChanged );
	subscribe( 'vortex-init',            init );

}( jQuery ));
