var $ = jQuery;

subscribe( 'program-state-changed', ( e ) =>
{
	var stack = e.program_state.stack
	$( '#stack' ).html( render( 'debugger.stack_frame', { frames: stack.frames } ) );
	updateStackDepth( stack.depth );

	var context = e.program_state.contexts;
	var expanded = [];
	$( '#context li[aria-expanded=true]' ).each( function( i, el )
	{
		expanded.push( $( el ).attr( 'data-address' ) );
	} );
	$( '#context' ).vtree( context ).removeClass( 'blur-hidden' );
	var tree = $.jstree.reference( '#context' );
	expanded.forEach( function( address )
	{
		tree.open_node( '[data-address=' + address + ']', function(){}, false );
	} );
} );

$( document ).on( 'dblclick.jstree', '#context', async function( e )
{
	var li = $( e.target ).closest( 'li' );
	if ( li.is( '[data-no-alter]' ) )
	{
		return;
	}

	var identifier  = li.attr( 'data-identifier' );
	var stack_depth = li.attr( 'data-stack-depth' );
	var cid         = li.attr( 'data-cid' );
	var size        = li.attr( 'data-size' );

	var e = await BasicApi.Debugger.command( 'property_get', {
		name        : identifier,
		stack_depth : stack_depth,
		context     : cid,
		max_data    : size,
	} );
	var current_val = $('<div>').text( (e.parsed[ 0 ] || {}).value || '' ).html();
	Theme.Modal.set( {
		title : 'Update Value',
		content : render( 'debugger.change_variable_value', { identifier, stack_depth, cid, size } ),
	} );
	Theme.Modal.show();
	$( '.value-input' ).focus();
	document.execCommand( 'selectAll', false, null );
} );

$( document ).on( 'keypress', '.value-input', async function( e )
{
	if ( e.which == 13 && !e.ctrlKey && !e.shiftKey )
	{
		e.preventDefault();
		var new_value   = $( e.target ).text();
		var stack_depth = $( e.target ).attr( 'data-stack-depth' );
		var cid         = $( e.target ).attr( 'data-cid' );
		var identifier  = $( e.target ).attr( 'data-identifier' );

		Theme.Modal.hide();

		await BasicApi.Debugger.command( 'property_set', {
			name        : identifier,
			stack_depth : stack_depth,
			context     : cid
		}, new_value );
	}
} );

$( document ).on( 'click', '.stack-row', function( e )
{
	var file        = $( e.currentTarget ).attr( 'data-file' );
	var line        = $( e.currentTarget ).attr( 'data-line' );
	var stack_depth = $( e.currentTarget ).attr( 'data-stack-depth' );
	$( '.stack-row.active' ).removeClass( 'active' );
	$( e.currentTarget ).addClass( 'active' );
	publish( 'file-nav-request', {
		filename : file,
		lineno   : line,
		source   : 'stack',
	} );
	// updateContext( stack_depth ); TODO
} );

subscribe( 'file-changed', function onFileChanged( e )
{
	if ( e.source != 'stack' )
	{
		stackDeviated();
	}
} );

subscribe( 'session-status-changed', function( e )
{
	toggleIndicators( e.status == 'active' );
} );

function updateStackDepth( level )
{
	$( '#stack_depth' ).text( level );
}

function bytesToHumanReadable( size )
{
	if ( size == 0 )
	{
		return '0 B';
	}
	var i = Math.floor( Math.log( size ) / Math.log(1024) );
	return ( size / Math.pow( 1024, i) ).toFixed (2 ) * 1 + ' ' + [ 'B', 'kB', 'MB', 'GB', 'TB' ][ i ];
}

function toggleIndicators( show )
{
	if ( show )
	{
		$( '.status-indicator' ).removeClass( 'blur-hidden' );
	}
	else
	{
		$( '.status-indicator' ).addClass( 'blur-hidden' );
	}
}


async function updateMemoryUsage()
{
	var data = await BasicApi.Debugger.command( 'eval', 'memory_get_usage()' );
	var mem_data = data.parsed.value[ 0 ] || {};
	$( '#mem_usage' ).text( bytesToHumanReadable( mem_data.value || 0 ) );
}

function stackDeviated()
{
	$( '.stack-row.active' ).removeClass( 'active' );
}
