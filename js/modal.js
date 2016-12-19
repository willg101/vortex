modal = (function( $ )
{
	var selectors = {
		overlay : '.modal-overlay',
		title : '.modal-title',
		exit_button : '.modal-exit',
		modal : '.modal',
		modal_content : '.modal-content',
	}
	
	function hide()
	{
		$( selectors.overlay ).fadeOut();
	}
		
	function show()
	{
		$( selectors.overlay ).fadeIn();
	}
	
	function setContent( html )
	{
		$( selectors.modal_content ).html( html )
	}
	
	function setTitle( html )
	{
		$( selectors.modal_content ).html( html )
	}
	
	function set( options )
	{
		setTitle( options.title || '' );
		setContent( options.content || '' );
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