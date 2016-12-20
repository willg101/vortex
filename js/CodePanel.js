CodePanel = (function( $ )
{
	var editor              = null;
	var controller          = null;
	var current_line_marker = '';
	var current_line        = false;
	var current_file        = false;
	
	function init( controller_local )
	{
		controller = controller_local;
		
		editor = ace.edit( "editor" );
		editor.setTheme( "ace/theme/solarized_light" );
		editor.session.setMode( "ace/mode/php" );
		editor.setOption( "showPrintMargin", false );
		editor.on( "guttermousedown", onGutterClicked );
		editor.setReadOnly( true );
	}
	
	function getCurrentFile()
	{
		return current_file;
	}
	
	function onGutterClicked( e )
	{
		var target = e.domEvent.target;
		if ( target.className.indexOf( "ace_gutter-cell" ) == -1 )
		{
			return;
		}
		
		var line = e.getDocumentPosition().row + 1;
		controller.toggleBreakpoint( current_file, line );
	}
	
	function updateBreakpoint( status, line )
	{
		line--;
		editor.session.clearBreakpoint( line );
		editor.getSession().removeGutterDecoration( line, "pending-breakpoint" );

		switch ( status )
		{
			case 'pending':
				editor.getSession().addGutterDecoration( line, "pending-breakpoint" );
				break;

			case 'confirmed':
				editor.session.setBreakpoint( line );
				break;

			case 'removed':
				// Do nothing
				break;
			
			default:
				throw new Error( 'Invalid status: ' + status );
		}
	}
	
	function updateStatusIndicator( level )
	{
		switch( level )
		{
			case 'disconnected':
				$( '#status_indicator' )
					.removeClass( 'connected session-in-progress fa-spin fa-circle-o-notch fa-circle' )
					.addClass( 'fa-warning disconnected' );
					break;
			
			case 'connected':
				$( '#status_indicator' )
					.removeClass( 'disconnected session-in-progress fa-warning fa-circle' )
					.addClass( 'fa-circle-o-notch fa-spin connected' );
					break;
							
			case 'session-in-progress':
				$( '#status_indicator' )
					.removeClass( 'disconnected connected fa-circle-o-notch fa-spin fa-warning' )
					.addClass( 'fa-circle session-in-progress' );
					break;
			
			default:
				throw new Error( 'Unexpected status indicator level: ' + level );
		}
	}
	
	function showFile( filename, text, line )
	{
		if ( ! line || ! ( line = Number( line ) ) || line % 1 != 0 || line < 1 )
		{
			line = undefined;
		}

		if ( current_file != filename )
		{
			editor.setValue( text );
			$( '#filename' ).text( filename.replace( /^.*\//, '' ) );
			editor.resize( true );
			current_file = filename;
		}
		
		if ( line )
		{
			var Range = ace.require('ace/range').Range;
			if ( current_line_marker )
			{
				editor.session.removeMarker( current_line_marker );
				editor.getSession().removeGutterDecoration( current_line - 1, "gutter-current-line" );
			}
			current_line_marker = editor.session.addMarker( new Range( line - 1, 0, line - 1, 1),
				"ace-current-line", "fullLine" );
			editor.scrollToLine( line, true, true, function(){} );
			current_line = line;
			editor.getSession().addGutterDecoration( line-1, "gutter-current-line" );
		}
	}
	
	function clearBreakpoints()
	{
		editor.session.clearBreakpoints();
	}
	
	function clearCurrentLineIndicator()
	{
		editor.session.removeMarker( current_line_marker );
		editor.getSession().removeGutterDecoration( current_line - 1, "gutter-current-line" );
		
		current_line_marker = false;
		current_line = false;
	}
	
	function onCommandButtonClicked( e )
	{
		var command_name = $( e.target ).closest( '[data-command]' ).attr( 'data-command' );
		controller.doCommand( command_name );
	}
	
	$( document ).on( 'click', '[data-command]', onCommandButtonClicked );

	return {
		clearBreakpoints          : clearBreakpoints,
		clearCurrentLineIndicator : clearCurrentLineIndicator,
		getCurrentFile            : getCurrentFile,
		init                      : init,
		showFile                  : showFile,
		updateStatusIndicator     : updateStatusIndicator,
		updateBreakpoint          : updateBreakpoint,
	}
	
}( jQuery ));