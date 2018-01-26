namespace( 'Theme' ).PopoverList = (function( $ )
{
	function PopoverList( options )
	{
		this.options = options;

		var toggler = options.el;
		var position = {
			my : ( options.side == 'right' ? 'right top' : 'left top' ),
			at : ( options.side == 'right' ? 'right bottom' : 'left bottom' ),
			of : toggler,
		};

		Theme.Popover.call( this, this.renderLists(), options.classes, position, toggler );
	}

	PopoverList.prototype = Object.create( Theme.Popover.prototype );

	PopoverList.prototype.renderLists = function()
	{
		var html = '';
		this.options.lists.forEach( function( list )
		{
			var title = list.title;
			var options  = list.options;
			var container = $( '<div>' );

			if ( title )
			{
				container.append( '<h2>' + title + ( options ? '' : ' ' + new Theme.Spinner ) + '</h2>' );
			}

			if ( options )
			{
				for ( var i in options )
				{
					var tag_name = options[ i ].tag_name || 'a';
					var attr     = options[ i ].attr || {};
					var content  = options[ i ].content;
					var item = $( '<' + tag_name + '>' ).addClass( 'popover-list-option' ).attr( attr ).html( content ).appendTo( container );
					if ( !options[ i ].no_close )
					{
						item.addClass( 'close-popover-on-click' );
					}
				}
			}

			html += container.html();
		} );

		return html;
	}

	PopoverList.prototype.setTitle = function( new_title )
	{
		this.title = new_title;
		this.setContent( this.renderList() );
	}

	PopoverList.prototype.setLists = function( new_lists )
	{
		this.options.lists = new_lists;
		this.setContent( this.renderLists() );
	}

	PopoverList.prototype.setList = function( i, new_list )
	{
		this.options.lists[ i ] = new_list;
		this.setContent( this.renderLists() );
	}

	return PopoverList;

}( jQuery ));
