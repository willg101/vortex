Interface = (function( $ )
{
	var reconnect_delay_ms = 5000;
	var active_session = false;

	var pending_breakpoints = {};
	var confirmed_breakpoints = {};
	var xdebug_response_handlers = {
		breakpoint_set    : onBreakpointSet,
		breakpoint_remove : onBreakpointRemoved,
		context_get       : onContextGet,
		stack_get         : onStackGet,
	};

	var get_tids = {};
	
	var self = {};

	function init()
	{
		CodePanel.init( self );
		StatusPanel.init( self );

		dpoh.subscribe( 'response_recevied', onResponseReceived );
		dpoh.subscribe( 'session_init',      onSessionInit );
		dpoh.subscribe( 'connection_error',  function()
		{
			CodePanel.updateStatusIndicator( 'disconnected' );
			StatusPanel.toggleIndicators( false );
			console.error( "Connection failed; retrying in " + (reconnect_delay_ms / 1000) + " seconds." );
			setTimeout( dpoh.openConnection, reconnect_delay_ms );
			active_session = false;
		} );
		dpoh.subscribe( 'connection_opened',  function()
		{
			console.log( "Connection succeeded!" );
			CodePanel.updateStatusIndicator( 'connected' );
			dpoh.sendCommand( 'status' );
		} );
		dpoh.subscribe( 'connection_closed',  function()
		{
			CodePanel.updateStatusIndicator( 'disconnected' );
			console.warn( "Connection closed." );
			StatusPanel.toggleIndicators( false );
			active_session = false;
		} );

		dpoh.openConnection();

		window.setTimeout( ajdustHeight, 100 );
	}
	
	function doCommand( command )
	{
		dpoh.sendCommand( command );
	}

	function toggleBreakpoint( current_file, row )
	{
		if ( !CodePanel.getCurrentFile() )
		{
			return;
		}

		if ( !confirmed_breakpoints[ current_file ] )
		{
			confirmed_breakpoints[ current_file ] = {};
		}

		if ( !active_session )
		{
			create = !confirmed_breakpoints[ current_file ][ row ];
			if ( create )
			{
				confirmed_breakpoints[ current_file ][ row ] = true;
			}
			else
			{
				delete confirmed_breakpoints[ current_file ][ row ];
			}
				
			CodePanel.updateBreakpoint( ( create ? 'confirmed' : 'removed' ), row );
			return;
		}

		if ( !confirmed_breakpoints[ current_file ][ row ] )
		{

			var tid = dpoh.sendCommand( "breakpoint_set -t line -n " + row + " -f " + current_file );
			CodePanel.updateBreakpoint( 'pending', row );
			confirmed_breakpoints[ current_file ][ row ] = "pending";
			pending_breakpoints[ tid ] = {
				file : current_file,
				line : row,
			};
		}
		else if ( confirmed_breakpoints[ current_file ][ row ] != "pending" )
		{
			CodePanel.updateBreakpoint( 'pending', row );
			var tid = dpoh.sendCommand( "breakpoint_remove -d " + confirmed_breakpoints[ current_file ][ row ] );
			confirmed_breakpoints[ current_file ][ row ] = "pending";
			pending_breakpoints[ tid ] = {
				file : current_file,
				line : row,
			};
		}
	}

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
			dpoh.sendCommand( 'eval', function( data )
			{
				var bytes = data.find('property').html().replace( '<!--[CDATA[', '' ).replace( /]]-->$/, '' );
				StatusPanel.updateMemoryUsage( bytes );
			}, 'memory_get_usage()' );
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

	function ajdustHeight()
	{
		var total_height = $(window).height();
		var toolbar_height = 0;//$( '.toolbar' ).height();
		$( '.layout-table' ).css( "height", (window.innerHeight - toolbar_height)  + "px" );
	}
	
	function navigateStack( file, line )
	{
		goToFile( file, line );
	}
	
	self.doCommand        = doCommand;
	self.toggleBreakpoint = toggleBreakpoint;
	self.updateVariable   = updateVariable;
	self.navigateStack    = navigateStack;

	$( init );
	$( window ).on( 'resize', ajdustHeight );
	
	return self;

}( jQuery ));
