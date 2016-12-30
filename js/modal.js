modal = (function( $ )
{
	var selectors = {
		overlay : '.modal-overlay',
		title : '.modal-title',
		exit_button : '.modal-exit',
		modal : '.modal',
		modal_content : '.modal-content',
		blurable : '.blurable',
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
	
	function set( options )
	{
		setTitle( options.title || '' );
		setContent( options.content || '' );
		setOnHide( options.on_hide );
	}
	
	function onDocumentClicked( e )
	{
		if ( $( e.target ).closest( selectors.modal ).length && !$( e.target ).closest( selectors.exit_button ).length )
		{
			return;
		}
		hide();
	}

	$( document ).on( 'click', onDocumentClicked );
	
	return {
		show : show,
		hide : hide,
		setContent : setContent,
		setTitle : setTitle,
		set : set,
	};
})( jQuery );