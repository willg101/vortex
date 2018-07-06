namespace( 'BasicApi' ).Persistor = (function( $ )
{
	class PersistorError extends Error {}
	PersistorError.prototype.name = 'Vue.Layout.Persistor.PersistorError';

	var Storage = BasicApi.PersistentStorage;

	function generateLocalStorageItemKey( widget_key, item_key )
	{
		return widget_key + '_::_' + item_key;
	}

	function Persistor( widget_key )
	{
		this.__widget_key__ = widget_key;
		return new Proxy( this, {
			get : function( target, item_key )
			{
				if ( typeof target[ item_key ] == 'undefined' )
				{
					target[ item_key ] = Storage.get( generateLocalStorageItemKey( target.__widget_key__, item_key ) );
				}
				return target[ item_key ];
			},

			set : function( target, item_key, item_value )
			{
				if ( typeof item_value == 'undefined' )
				{
					delete this[ item_key ];
				}
				else
				{
					target[ item_key ] = item_value;
					Storage.set( generateLocalStorageItemKey( target.__widget_key__, item_key ), item_value );
				}

				return item_value;
			},

			deleteProperty : function( target, item_key )
			{
				delete target[ item_key ];
				Storage.del( generateLocalStorageItemKey( target.__widget_key__, item_key ) );
			},

			ownKeys : function( target )
			{
				var keys = Object.keys( target );
				for ( var i = 0; i < localStorage.length; i++ )
				{
					if ( localStorage.key( i ).startsWith( target.__widget_key__ + '_::_' ) )
					{
						keys.push( localStorage.key( i ) );
					}
				}
				var remove_index = keys.indexOf( '__widget_key__' );
				if ( remove_index >= 0 )
				{
					keys.splice( remove_index, 1 );
				}
				return keys;
			},
		} );
	}

	Persistor.PersistorError = PersistorError;

	// Unit tests
	subscribe( 'provide-tests', function()
	{
		describe( "Vue.Layout.Persistor", function()
		{
			it( "Basic Usage", function()
			{
				var empty_persistor = new Persistor( 'xxx-empty' );
				delete empty_persistor.proportion;
				delete empty_persistor.index;

				expect( empty_persistor.proportion ).toBeUndefined();
				expect( empty_persistor.index ).toBeUndefined();

				var proportion = Math.random();
				var index = Math.random();
				var fillable_persistor = new Persistor( 'xxx-fillable' );
				fillable_persistor.proportion = proportion;
				fillable_persistor.index = index;

				expect( fillable_persistor.proportion ).toBe( proportion );
				expect( fillable_persistor.index ).toBe( index );

				proportion = Math.random();
				index = Math.random();
				fillable_persistor.proportion = proportion;
				fillable_persistor.index = index;
				expect( fillable_persistor.proportion ).toBe( proportion );
				expect( fillable_persistor.index ).toBe( index );

				var prepoluated_persistor = new Persistor( 'xxx-fillable' );
				expect( prepoluated_persistor.proportion ).toBe( proportion );
				expect( prepoluated_persistor.index ).toBe( index );

				delete fillable_persistor.proportion;
				delete fillable_persistor.index;

				expect( fillable_persistor.proportion ).toBeUndefined();
				expect( fillable_persistor.index ).toBeUndefined();
			} );
		} );
	} );

	return Persistor;

}( jQuery ));
