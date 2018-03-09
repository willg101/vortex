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

				var process_command = function()
				{
					term.echo( fn, { raw : true } );

					// After scouring the Xdebug protocol docs for a way to get a variable name from an
					// address, which would be required to lazy-load the response's object/array's nested
					// properties, I came up empty-handed. Lazy-loading doesn't seem to be a viable option
					// here, so let's deep-load the response instead
					BasicApi.Debugger.command( 'feature_set', { name : 'max_depth', value : 10 } );
					BasicApi.Debugger.command( 'eval', function( data )
					{
						if ( data.parsed.value && data.parsed.value.length )
						{
							data.parsed.value.forEach( function( item )
							{
								item.name     = item.name || '';
								item.fullname = item.fullname || '';
							} );
							$( '#' + id ).html( '' ).jstree( { core : { data : CodeInspector.StatusPanel.buildContextTree( data.parsed.value ) } } );
							inner_fn = function()
							{
								setTimeout( function(){ $( '#' + id ).html( '' ).jstree( { core : { data : CodeInspector.StatusPanel.buildContextTree( data.parsed.value ) } } ); }, 30 );
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
					}, prepareCommand( command ) );
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

	function onNavButtonClicked( e )
	{
		var selector = $( e.currentTarget ).attr( 'data-open-nav-panel' );
		if ( selector == '#console' )
		{
			$( '#console .input' ).focus();
		}
		$( selector ).addClass( 'showing' );
		
	}
	
	function sortBreakpointList( breakpoints )
	{
		var sorted = {
			Files      : {},
			Functions  : {},
		};
		
		var process_line_bp = function( bp )
		{
			if ( !sorted.Files[ bp.filename ] )
			{
				sorted.Files[ bp.filename ] = [];
			}
			sorted.Files[ bp.filename ].push( bp )
		};
		breakpoints.line.forEach( process_line_bp );
		breakpoints.conditional.forEach( process_line_bp );
		
		var sort_file_bp = function( bp1, bp2 )
		{
			return ( bp1.lineno || Math.NEGATIVE_INFINITY ) - ( bp2.lineno || Math.NEGATIVE_INFINITY );
		};
		for ( var i in sorted.Files )
		{
			sorted.Files[ i ] = sorted.Files[ i ].sort( sort_file_bp );
		}
		
		var process_fn_bp = function( bp )
		{
			if ( !sorted.Functions[ bp[ 'function' ] ] )
			{
				sorted.Functions[ bp[ 'function' ] ] = [];
			}
			sorted.Functions[ bp[ 'function' ] ].push( bp );
		};
		breakpoints.call.forEach( process_fn_bp );
		breakpoints[ 'return' ].forEach( process_fn_bp );
		
		var sort_fn_bp = function( bp1, bp2 )
		{
			return ( bp1.type == 'call' ? 1 : 0 ) - ( bp2.type == 'call' ? 1 : 0 );
		};
		for ( var i in sorted.Functions )
		{
			sorted.Functions[ i ] = sorted.Functions[ i ].sort( sort_fn_bp );
		}
		
		return sorted;
	}

	function onOpenFileClicked( e )
	{
		var file = $( e.currentTarget ).attr( 'data-file' );
		publish( 'file-nav-request', {
			filename : file,
			source   : 'file-nav',
		} );
		$( '#open_files_panel .open-file' ).removeClass( 'active' );
		$( e.currentTarget ).addClass( 'active' );
		$( '.nav-panel.showing' ).removeClass( 'showing' );
	}

	function getShortFileName( filename )
	{
		return filename.replace( /^.*\//, '' );
	}

	function onNodeDoubleClicked( e, data )
	{
		var li = $( e.target ).closest( 'li' );
		var is_file = li.attr( 'data-is-file' );
		if ( !is_file || is_file === "false" )
		{
			return;
		}

		$( '.nav-panel.showing' ).removeClass( 'showing' );
		var filename = li.attr( 'data-full-path' );
		publish( 'file-nav-request', {
			filename : filename,
			source   : 'tree',
		} );
	}

	function onDocumentKeydown( e )
	{
		var target = $( e.target );
		if ( e.which == 'O'.charCodeAt(0) && e.ctrlKey )
		{
			e.preventDefault();
			$( '.showing' ).removeClass( 'showing' );
			$( '#open_files_panel' ).addClass( 'showing' );
		}
		else if ( e.which == 'E'.charCodeAt( 0 ) && e.ctrlKey )
		{
			e.preventDefault();
			$( '.showing' ).removeClass( 'showing' );
			$( '#console' ).addClass( 'showing' );
			$( '#console .input' ).focus();
		}
		else if ( e.which == 27 )
		{
			$( '.showing' ).removeClass( 'showing' );
		}
	}

	function resizeCell()
	{
		var height = $( '.toolbar .css-cell:not(.match-height)' ).height();
		$( '.toolbar .css-cell.match-height' ).height( height + 1 );
	}

	function onFileChanged( e )
	{
		$( '.files-heading' ).slideDown();
		var filename_only = e.file.replace( /^.*\//, '' );
		if ( !$( '[data-open-file="' + e.file + '"]', '.currently-open-files' ).length )
		{
			var new_button = $( '<span>' ).attr( 'data-open-file', e.file )
				.text( filename_only );
			$( '.currently-open-files' ).append( new_button );
		}

		$( '.currently-open' ).removeClass( 'currently-open' );
		$( '[data-open-file="' + e.file + '"]', '.currently-open-files' ).addClass( 'currently-open' );
	}

	function onOpenFileClicked( e )
	{
		publish( 'file-nav-request', {
			filename : $( e.target ).attr( 'data-open-file' ),
			source   : 'currently-open-files',
		} );
	}

	function onSessionStatusChanged()
	{
		clearInterval( dummy_session_timeout );
	}

	function onConsoleClicked()
	{
		$( '#console' ).terminal().enable();
	}

	$( document ).on( 'dblclick.jstree',   '#open_files_panel',  onNodeDoubleClicked );
	$( document ).on( 'click',             '[data-open-file]',   onOpenFileClicked );
	$( document ).on( 'click',             '#console_container', onConsoleClicked );
	$( document ).on( 'keydown',                                 onDocumentKeydown );
	$( document ).on( 'click', '[data-open-nav-panel]',          onNavButtonClicked );
	$( document ).on( 'click', '[data-open-file]',               onOpenFileClicked );
	$( window   ).on( 'resize load',                             resizeCell );

	subscribe( 'session-status-changed', onSessionStatusChanged );
	subscribe( 'file-changed',           onFileChanged );
	subscribe( 'vortex-init',            init );

}( jQuery ));
