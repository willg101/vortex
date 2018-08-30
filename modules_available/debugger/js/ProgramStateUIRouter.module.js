import File         from './File.module.js'
import Debugger     from './Debugger.module.js'
import ProgramState from './ProgramState.module.js'
export default { setStackPosition, setFile, getStackPosition, getFile, refreshState };

class IllegalAction extends Error {}
var $ = jQuery

var mostRecentState = null;
var currentStackPos = 0;
var currentFile     = '';
var currentLine     = -1;

/**
 * @brief
 *	Relay program state changes to the UI
 */
subscribe( 'program-state-changed', ( e ) =>
{
	mostRecentState = e.programState;
	applyPositionFromStackFrame( 0 );
	triggerUIRefresh();
} );

subscribe( 'session-status-changed', function( e )
{
	if ( e.status == 'active' )
	{
		$( 'body' ).addClass( 'active-session' );
	}
	else
	{
		$( 'body' ).removeClass( 'active-session' );
	}
} );

/**
 * @brief
 *	Instruct all UI subscribers to refresh their view
 *
 * @param bool force Force the refresh, even if the current stack frame is unavailable
 */
function triggerUIRefresh( force )
{
	if ( force || mostRecentState.stack.frames[ currentStackPos ] )
	{
		publish( 'program-state-ui-refresh-needed', {
			programState  : mostRecentState,
			stackPos      : currentStackPos,
			file          : currentFile,
			line          : currentLine,
		} );
	}
}

/**
 * @param int n
 */
function applyPositionFromStackFrame( n )
{
	currentStackPos = n;
	if ( mostRecentState.stack.frames[ n ] )
	{
		currentFile = mostRecentState.stack.frames[ n ].schemelessFilename;
		currentLine = mostRecentState.stack.frames[ n ].lineno;
	}
}

/**
 * @brief
 *	Switch to a different frame of the stack
 */
function setStackPosition( pos )
{
	if ( ! Debugger.sessionIsActive() )
	{
		throw new IllegalAction( 'Cannot update the stack position while no session is active.' );
	}

	var posAsInt = parseInt( pos );
	var stackDepth = mostRecentState && mostRecentState.stack.depth || 0;
	if ( posAsInt < 0 || posAsInt != Number( pos ) || posAsInt > stackDepth )
	{
		throw new Error( `Illegal stack position: '${pos}' (expected an integer between 0 and`
			+ ` ${stackDepth})` );
	}

	applyPositionFromStackFrame( posAsInt );
	triggerUIRefresh();
}

/**
 * @retval int
 */
function getStackPosition()
{
	return currentStackPos;
}

/**
 * Deviate from the stack (if applicable) and show a specific file
 *
 * @param string filename
 */
function setFile( filename )
{
	if ( typeof filename != 'string' )
	{
		throw new Error( `Illegal filename: '${filename}'` );
	}
	currentStackPos = -1;
	currentLine     = -1;
	currentFile     = filename;
	triggerUIRefresh();
}

/**
 * @retval string
 */
function getFile()
{
	return currentFile;
}

function refreshState()
{
	if ( !Debugger.sessionIsActive() )
	{
		throw new Error( 'Cannot refresh program state without an active debug session' )
	}
	ProgramState.refreshState();
}

subscribe( 'before-switch-session', function( e )
{
	var resolve = e.register();
	var delay = 0;
	$( '[data-role="window"]' ).each( function()
	{
		setTimeout( function()
		{
			$( this ).addClass( 'not-loaded' );
		}.bind( this ), ++delay * 50 );
	} );
	setTimeout( resolve, delay * 50 );
} );

subscribe( 'session-switched', function()
{
	var delay = 0;
	$( '[data-role="window"]' ).each( function()
	{
		setTimeout( function()
		{
			$( this ).removeClass( 'not-loaded' );
		}.bind( this ), ++delay * 50 );
	} );
} );
