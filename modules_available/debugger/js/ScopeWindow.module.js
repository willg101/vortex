var $ = jQuery;
var expandedNodes = {};

/**
 * @brief
 *	Update the state of the Scope window as needed
 */
subscribe( 'program-state-ui-refresh-needed', async ( e ) =>
{
	if ( e.stackPos < 0 )
	{
		return;
	}

	if ( ! e.programState.stack.frames[ e.stackPos ].context )
	{
		await e.programState.stack.frames[ e.stackPos ].fetchContext();
	}

	var context = e.programState.stack.frames[ e.stackPos ].context;
	Object.keys( expandedNodes ).forEach( addr =>
	{
		var node = $( `[data-address=${addr}]`, '#context' );
		if ( node.length && !node.is( '[aria-expanded=true]' ) )
		{
			delete expandedNodes[ addr ];
		}
	} );
	$( '#context li[aria-expanded=true]' ).each( function( i, el )
	{
		expandedNodes[ $( el ).attr( 'data-address' ) ] = true;
	} );
	$( '#context' ).vtree( context ).removeClass( 'blur-hidden' );
	var tree = $.jstree.reference( '#context' );
	Object.keys( expandedNodes ).forEach( addr =>
	{
		tree.open_node( `[data-address=${addr}]`, function(){}, false );
	} );
	$( '#mem_usage' ).text( e.programState.memoryUsage.readable );
} );

/**
 * @brief
 *	When a writeable node from the context tree is double-clicked, show a modal for updating the
 *	node's value
 */
$( document ).on( 'dblclick.jstree', '#context', async function( e )
{
	var li = $( e.target ).closest( 'li' );
	if ( li.is( '[data-no-alter]' ) )
	{
		return;
	}

	var identifier = li.attr( 'data-identifier' );
	var stackDepth = li.attr( 'data-stack-depth' );
	var cid        = li.attr( 'data-cid' );
	var size       = li.attr( 'data-size' );

	var e = await BasicApi.Debugger.command( 'property_get', {
		name        : identifier,
		stack_depth : stackDepth,
		context     : cid,
		max_data    : size,
	} );
	var currentVal = $('<div>').text( (e.parsed[ 0 ] || {}).value || '' ).html();
	Theme.Modal.set( {
		title : 'Update Value',
		content : render( 'debugger.change_variable_value', { identifier, stackDepth, cid, size } ),
	} );
	Theme.Modal.show();
	$( '.value-input' ).focus();
	document.execCommand( 'selectAll', false, null );
} );

/**
 * @brief
 *	Handle the submission for a new variable value
 */
$( document ).on( 'keypress', '.value-input', async function( e )
{
	if ( e.which == 13 && !e.ctrlKey && !e.shiftKey )
	{
		e.preventDefault();
		var newValue   = $( e.target ).text();
		var stackDepth = $( e.target ).attr( 'data-stack-depth' );
		var cid        = $( e.target ).attr( 'data-cid' );
		var identifier = $( e.target ).attr( 'data-identifier' );

		Theme.Modal.hide();

		await BasicApi.Debugger.command( 'property_set', {
			name        : identifier,
			stack_depth : stackDepth,
			context     : cid
		}, newValue );
	}
} );
