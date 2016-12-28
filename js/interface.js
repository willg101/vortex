Interface = (function( $ )
{
	var reconnect_delay_ms = 5000;

	function onResponseReceived( jq_message, tid )
	{
		var command = jq_message.attr( 'command' );
		if ( typeof xdebug_response_handlers[ command ] == "function" )
		{
			xdebug_response_handlers[ command ]( jq_message, tid );
		}
		
		// Jump to file
		var filename = jq_message.attr( 'filename' ) || jq_message.find( ':not(breakpoint)[filename]' ).attr( 'filename' );
		var lineno = jq_message.attr( 'lineno' ) || jq_message.find( ':not(breakpoint)[lineno]' ).attr( 'lineno' );
		if ( filename && lineno )
		{
			goToFile( filename, lineno );
		}

		// Don't hold on to stopping sessions
		if ( jq_message.is( '[status=stopping]' ) )
		{
			dpoh.sendCommand( "run" );
			CodePanel.updateStatusIndicator( 'connected' );
			StatusPanel.toggleIndicators( false );
			CodePanel.clearCurrentLineIndicator();
			active_session = false;
		}
		else if ( jq_message.is( '[status=break]' ) )
		{
			active_session = true;
			CodePanel.updateStatusIndicator( 'session-in-progress' );
			StatusPanel.toggleIndicators( true );
			dpoh.sendCommand( 'stack_get' );
			dpoh.sendCommand( 'context_get' );
		}
	}
	
	function onBreakpointSet( jq_message, tid )
	{
		var bp_id = jq_message.attr( 'id' );
		if ( pending_breakpoints[ tid ] )
		{
			if ( CodePanel.getCurrentFile() == pending_breakpoints[ tid ].file )
			{
				CodePanel.updateBreakpoint( 'confirmed', pending_breakpoints[ tid ].line );
			}
			confirmed_breakpoints[ pending_breakpoints[ tid ].file ][ pending_breakpoints[ tid ].line ] = bp_id;
			delete pending_breakpoints[ tid ];
		}
	}
	
	function onBreakpointRemoved( jq_message, tid )
	{
		var bp_id = jq_message.attr( 'id' );
		if ( pending_breakpoints[ tid ] )
		{
			if ( CodePanel.getCurrentFile() == pending_breakpoints[ tid ].file )
			{
				CodePanel.updateBreakpoint( 'removed', pending_breakpoints[ tid ].line );
			}
			delete confirmed_breakpoints[ pending_breakpoints[ tid ].file ][ pending_breakpoints[ tid ].line ];
			delete pending_breakpoints[ tid ];
		}
	}
	
	function onContextGet( jq_message )
	{
		StatusPanel.validateContext( jq_message );
	}

	function onStackGet( jq_message )
	{
		StatusPanel.validateStack( jq_message );
	}

	function updateVariable( identifier, value )
	{
		dpoh.sendCommand( 'property_set -n ' + identifier, dpoh.sendCommand.bind( dpoh, 'context_get' ), value );
	}

	function goToFile( file, line )
	{
		var onFileReceived = function( success, data )
		{
			if ( !success )
			{
				return;
			}
						
			CodePanel.showFile( file, data.files[ file ], line );
			if ( !line )
			{
				StatusPanel.stackDeviated();
			}
		};
		
		files.load( file, onFileReceived )
	}

	function showBreakpointsForFile( filename )
	{
		CodePanel.clearBreakpoints();
		var current_file = CodePanel.getCurrentFile();
		if ( confirmed_breakpoints[ current_file ] )
		{
			for ( var line in confirmed_breakpoints[ current_file ] )
			{
				CodePanel.updateBreakpoint( 'confirmed', line );
			}
		}
	}
	
	function sendAllBreakpoints()
	{
		for ( var filename in confirmed_breakpoints )
		{
			for ( var lineno in confirmed_breakpoints[ filename ] )
			{
				dpoh.sendCommand( "breakpoint_set -t line -n " + lineno + " -f " + filename );
			}
		}
	}
	
	function onSessionInit( jq_message )
	{
		active_session = true;
		CodePanel.updateStatusIndicator( 'session-in-progress' );
		StatusPanel.toggleIndicators( true );
		dpoh.sendCommand( 'feature_set -n max_depth -v 5' );
		dpoh.sendCommand( 'step_into' );
		sendAllBreakpoints();
	}
	
	function navigateStack( file, line )
	{
		goToFile( file, line );
	}

	$( init );
	$( window ).on( 'resize', ajdustHeight );

}( jQuery ));
