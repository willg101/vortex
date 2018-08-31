import Popover from './Popover.module.js'

var $ = jQuery;

vTheme.PopoverList = PopoverList;

function PopoverList( options )
{
	options.classes = options.classes || [];
	options.classes.push( 'no-padding' );

	this.options = options;
	this.updateListMap();

	var toggler = options.el;
	var position = {
		my : ( options.side == 'right' ? 'right top' : 'left top' ),
		at : ( options.side == 'right' ? 'right bottom' : 'left bottom' ),
		of : toggler,
	};

	Popover.call( this, this.renderLists(), options.classes, position, toggler );
}

PopoverList.prototype = Object.create( Popover.prototype );

PopoverList.prototype.updateListMap = function()
{
	this.map = [];
	(this.options.lists || []).forEach( function( list, i )
	{
		if ( list.id )
		{
			this.map[ list.id ] = i;
		}
	}.bind( this ) );
};

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
			container.append( '<h2>' + title + ( options ? '' : ' ' + vTheme.getSpinner() ) + '</h2>' );
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
	this.updateListMap();
	this.setContent( this.renderLists() );
}

PopoverList.prototype.setList = function( i, new_list )
{
	if ( typeof i == 'string' )
	{
		i = typeof this.map[ i ] != 'undefined'
			? this.map[ i ]
			: this.options.lists.length;
	}
	this.options.lists[ i ] = new_list;
	this.updateListMap();
	this.setContent( this.renderLists() );
}
