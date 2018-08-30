class PersistentStorageError extends Error {};
var PersistentStorage = { get, set, del, PersistentStorageError };
export default PersistentStorage

var data_store = {};

/**
 * @param string key
 *
 * @retval string
 */
function reduceKeyCollisionProbability( key )
{
	return 'basic_api_persistent_storage_local_storage_' + key;
}

/**
 * @param string key
 */
function get( key )
{
	var ls_key = reduceKeyCollisionProbability( key );
	if ( !data_store[ key ] )
	{
		var from_ls = localStorage.getItem( ls_key );
		if ( !( from_ls === null || from_ls === undefined ) )
		{
			try
			{
				data_store[ key ] = JSON.parse( from_ls );
			}
			catch ( e )
			{
				throw new PersistentStorageError( 'Invalid JSON: ' + from_ls );
			}
		}
	}
	return data_store[ key ];
}

/**
 * @param string key
 * @param mixed  value
 *
 * @retval mixed
 *	The item actually stored; typically `value`, but may be altered when the
 *	'set-persistent-data' is triggered
 */
function set( key, value )
{
	var ls_key = reduceKeyCollisionProbability( key );
	var data = {
		key : key,
		new_value : value,
		prevent : false,
		old_value : data_store[ key ],
	};
	value = data.new_value;
	publish( 'set-persistent-data', { data : data } );
	if ( !data.prevent )
	{
		localStorage.setItem( ls_key, JSON.stringify( value ) );
		data_store[ key ] = value;
	}
	return value;
};

/**
 * @param string key
 *
 * @retval bool
 *	Indicates if the deletion occurred (true) or was prevented when the 'delete-persistent-data'
 *	event was triggered (false)
 */
function del( key )
{
	var ls_key = reduceKeyCollisionProbability( key );
	var data = {
		key : key,
		prevent : false,
		value : data_store[ key ],
	};
	publish( 'delete-persistent-data', { data : data } );
	if ( !data.prevent )
	{
		delete data_store[ key ];
		localStorage.removeItem( ls_key );
		return true;
	}
	return false;
}

// Unit tests
subscribe( 'provide-tests', function()
{
	describe( "PersistentStorage", function()
	{
		it( "Basic Usage", function()
		{
			localStorage.removeItem( reduceKeyCollisionProbability( 'xxx' ) );
			expect( PersistentStorage.get( 'xxx' ) ).toBeUndefined();

			PersistentStorage.set( 'xxx', { 'hello' : 'world' } );
			expect( typeof PersistentStorage.get( 'xxx' ) ).toBe( 'object' );
			expect( PersistentStorage.get( 'xxx' ).hello ).toBe( 'world' );
			expect( localStorage.getItem( reduceKeyCollisionProbability( 'xxx' ) ) ).toBe( JSON.stringify( { 'hello' : 'world' } ) );

			PersistentStorage.del( 'xxx' );
			expect( PersistentStorage.get( 'xxx' ) ).toBeUndefined();
			expect( localStorage.getItem( reduceKeyCollisionProbability( 'xxx' ) ) ).toBeNull();

			localStorage.setItem( reduceKeyCollisionProbability( 'xxx-prepopulated' ), JSON.stringify( { foo : 'bar' } ) );
			expect( typeof PersistentStorage.get( 'xxx-prepopulated' ) ).toBe( 'object' );
			expect( PersistentStorage.get( 'xxx-prepopulated' ).foo ).toBe( 'bar' );
			PersistentStorage.del( 'xxx-prepopulated' );
			expect( PersistentStorage.get( 'xxx-prepopulated' ) ).toBeUndefined();

			localStorage.setItem( reduceKeyCollisionProbability( 'xxx-nested' ), JSON.stringify( { foo : { bar : { baz : 'fuzz' } } } ) );
			expect( typeof PersistentStorage.get( 'xxx-nested' ) ).toBe( 'object' );
			expect( typeof PersistentStorage.get( 'xxx-nested' ).foo ).toBe( 'object' );
			expect( typeof PersistentStorage.get( 'xxx-nested' ).foo.bar ).toBe( 'object' );
			expect( typeof PersistentStorage.get( 'xxx-nested' ).foo.bar.baz ).toBe( 'string' );
			expect( PersistentStorage.get( 'xxx-nested' ).foo.bar.baz ).toBe( 'fuzz' );
		} );
	} );
} );
