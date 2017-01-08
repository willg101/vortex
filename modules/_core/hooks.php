<?php

function _core_alter_renderings( &$renderings )
{
	if ( !isset( $renderings[ 'main_classes' ] ) )
	{
		$renderings[ 'main_classes' ] = [];
	}
	$renderings[ 'main_classes' ][ '_core' ] = 'blurable ';
}