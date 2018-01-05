namespace( 'Theme' ).PopoverList = (function( $ )
{
	function PopoverList( title, list, classes, position, toggler )
	{
		this.title = title;
		this.list  = list;
		Theme.Popover.call( this, this.renderList(), classes, position, toggler );
	}

	PopoverList.prototype = Object.create( Theme.Popover.prototype );

	PopoverList.prototype.renderList = function()
	{
		var title = this.title;
		var list  = this.list;
		var container = $( '<div>' );

		if ( title )
		{
			container.append( '<h2>' + title + ( list ? '' : ' ' + new Theme.Spinner ) + '</h2>' );
		}

		if ( list )
		{
			for ( var i in list )
			{
				var tag_name = list[ i ].tag_name || 'a';
				var attr     = list[ i ].attr || {};
				var content  = list[ i ].content;
				var item = $( '<' + tag_name + '>' ).addClass( 'popover-list-option' ).attr( attr ).html( content ).appendTo( container );
				if ( !list[ i ].no_close )
				{
					item.addClass( 'close-popover-on-click' );
				}
			}
		}

		return container.html();
	}

	PopoverList.prototype.setTitle = function( new_title )
	{
		this.title = new_title;
		this.setContent( this.renderList() );
	}

	PopoverList.prototype.setList = function( new_list )
	{
		this.list = new_list;
		this.setContent( this.renderList() );
	}

	return PopoverList;

}( jQuery ));
