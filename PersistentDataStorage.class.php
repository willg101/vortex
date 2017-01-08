<?php

namespace Dpoh;

class PersistentDataStorage extends DataStorage
{
	private $filename;

	public function __construct( $realm, array $data, $read_only = FALSE, $filename = '' )
	{
		$this->setFilename( $filename );
		$data = array_merge( $data, $this->deserializeData() );
		parent::__construct( $realm, $data, $read_only );
	}

	protected function getSerializedData()
	{
		return json_encode( $this->get() );
	}
	
	protected function deserializeData()
	{
		return json_decode( file_get_contents( $this->getFilename() ) ?: '[]', TRUE );
	}
	
	protected function setFilename( $filename )
	{
		$this->filename = $filename ?: "$realm.json";
	}
	
	public function getFilename()
	{
		return $this->filename;
	}
	
	protected function commitChange( $key, $value )
	{
		if ( $rval = parent::commitChange( $key, $value ) );
		{
			file_put_contents_safe( $this->getFilename(), $this->getSerializedData() );
		}
		return $rval;
	}
}