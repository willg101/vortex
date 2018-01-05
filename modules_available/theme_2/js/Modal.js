namespace( 'Theme' ).Modal = (function( $ )
{
	var selectors = {
		overlay : '.modal-overlay',
		title : '.modal-title',
		exit_button : '.modal-exit',
		modal : '.modal',
		modal_content : '.modal-content',
		blurable : '.blurable',
		open_modal : '[data-modal-role=open]',
	}

	var on_hide = false;

	function hide()
	{
		$( selectors.overlay ).fadeOut( function()
		{
			setContent( '' );
			on_hide && on_hide();
			setOnHide( false );
		} );
		$( selectors.modal ).addClass( 'modal-hidden' );
		$( selectors.blurable ).removeClass( 'blurred' );
	}

	function show()
	{
		$( selectors.overlay ).fadeIn();
		$( selectors.modal ).removeClass( 'modal-hidden' );
		$( selectors.blurable ).addClass( 'blurred' );
	}

	function setContent( html )
	{
		$( selectors.modal_content ).html( html )
	}

	function setTitle( html )
	{
		$( selectors.title ).html( html )
	}

	function setOnHide( fn )
	{
		on_hide = typeof fn == "function"
			? fn
			: false;
	}

	function getOnHide( fn )
	{
		return on_hide;
	}

	function set( options )
	{
		setTitle( options.title || '' );
		setContent( options.content || '' );
		setOnHide(  options.on_hide );
	}

	function onDocumentClicked( e )
	{
		if ( ( $( e.target ).closest( selectors.modal ).length
			&& !$( e.target ).closest( selectors.exit_button ).length )
			||  $( e.target ).closest( selectors.open_modal ).length
			|| !$( e.target ).closest( 'body' ).length )
		{
			return;
		}
		hide();
	}

	$( document ).on( 'click', onDocumentClicked );

	return {
		show              : show,
		hide              : hide,
		setContent        : setContent,
		setOnHide         : setOnHide,
		getOnHide         : getOnHide,
		setTitle          : setTitle,
		set               : set,
		onDocumentClicked : onDocumentClicked,
	};
}( jQuery ));
