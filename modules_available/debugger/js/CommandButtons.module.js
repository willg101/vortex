import ProgramStateUIRouter from './ProgramStateUIRouter.module.js'

var $ = jQuery;

// Issue debugger commands when elements with a `data-command` attribute are clicked
$( document ).on( 'click', '[data-command]', function( e )
{
	var command_name = $( e.currentTarget ).attr( 'data-command' );
	BasicApi.Debugger.command( command_name );
} );

// Open files when elements with a `data-open-file` attribute are clicked
$( document ).on( 'click', '[data-open-file]', function( e )
{
	ProgramStateUIRouter.setFile( $( e.target ).attr( 'data-open-file' ) );
} );
