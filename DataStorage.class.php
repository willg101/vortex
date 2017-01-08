<?php

namespace Dpoh;

class DataStorage
{
	private $data;
	private $realm;
	private $getRealm;
	
	public function __construct( $realm, array $data, $read_only = FALSE )
	{
		$this->realm     = '' . $realm;
		$this->data      = $data;
		$this->read_only = (bool) $read_only;
	}
	
	public function get( $key = NULL, $default_val = NULL )
	{
		return $key !== NULL
			? array_get( $this->get(), $key, $default_val )
			: $this->data;
	}
	
	public function isReadOnly()
	{
		return $this->read_only;
	}
	
	public function getRealm()
	{
		return $this->realm;
	}
	
	protected function generateHookName( $name )
	{
		return 'data_' . $this->getRealm() . '_' . $name;
	}
	
	public function set( $key, $value )
	{
		if ( $this->isReadOnly() )
		{
			return FALSE;
		}

		fire_hook( $this->generateHookName( 'change' ), [
			'key'       => &$key,
			'old_value' => $this->get( $key ),
			'new_value' => &$value,
		] );
		$this->commitChange( $key, $value );
		return TRUE;
	}
	
	protected function commitChange( $key, $value )
	{
		array_set( $this->data, $key, $value );
	}
	
	public function del( $key )
	{
		return $this->set( $key, NULL );
	}
}