(function()
{
	function init()
	{
		if ( Dpoh.settings.js_test_mode )
		{
			publish( 'provide-tests' );
		}
	}

	function provideSampleTest()
	{
		describe( "JS Test", function()
		{
			it( "Verify testing mode is enabled", function()
			{
				expect( Dpoh.settings.js_test_mode ).toBe( true )
			} );
		} );
	}

	subscribe( 'provide-tests', provideSampleTest );

	$( init );
}());
