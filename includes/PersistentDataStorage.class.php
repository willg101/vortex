<?php

namespace Dpoh;

/**
 * @brief
 *	Subclass of DataStorage that automatically saves changes to disk
 */
class PersistentDataStorage extends DataStorage
{
	/**
	 * Where to store changes to. The format of the data itself depends on getSerializedData()
	 *
	 * @var string
	 */
	private $filename;

	/**
	 * @param string $name
	 * @param array  $data
	 * @param bool   $read_only OPTIONAL. Default is FALSE
	 * @param string $filename  OPTIONAL. setFilename() determines the default value when omitted
	 */
	public function __construct( $name, array $data, $read_only = FALSE, $filename = '' )
	{
		$this->setFilename( $filename );
		$data = array_merge( $data, $this->deserializeData() );

		parent::__construct( $name, $data, $read_only );
	}

	/**
	 * @brief
	 *	Converts the instance's data to a string for storage on disk. Performs the functional
	 *	reverse of deserializeData()
	 *
	 * @retval string
	 */
	protected function getSerializedData()
	{
		return json_encode( $this->get() );
	}

	/**
	 * @brief
	 *	Parses a string into data usable by this instance. Performs the functional reverse of
	 *	getSerializedData()
	 *
	 * @retval string
	 */
	protected function deserializeData()
	{
		return json_decode( file_get_contents( $this->getFilename() ) ?: '[]', TRUE );
	}

	/**
	 * @param string $filename
	 */
	protected function setFilename( $filename )
	{
		$this->filename = $filename ?: "$realm.json";
	}

	/**
	 * @retval string
	 */
	public function getFilename()
	{
		return $this->filename;
	}

	/**
	 * @brief
	 *	Stores the current user config on disk
	 */
	public function save()
	{
		file_put_contents_safe( $this->getFilename(), $this->getSerializedData() );
	}
}
