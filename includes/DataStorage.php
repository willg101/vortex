<?php

namespace Vortex;

/**
 * @brief
 *	Model class for data shared between modules
 */
class DataStorage
{
    /**
     * @var array
     *
     * The main data that the instance houses
     */
    private $data;

    /**
     * @param string
     *
     * A name for the type of data that this instance houses
     */
    private $name;

    /**
     * @var bool
     *
     * Whether or not changes can be made to $data
     */
    private $read_only;

    /**
     * @param string $name
     * @param array  $data
     * @param bool   $read_only OPTIONAL. Default is FALSE
     */
    public function __construct($name, array $data, $read_only = false)
    {
        $this->name     = (string) $name;
        $this->data      = $data;
        $this->read_only = (bool) $read_only;
    }

    /**
     * @param string $key         OPTIONAL. Nested items may be given in "dot" notation. When this
     *	param is omitted, the entire data array is returned
     * @param mixed  $default_val OPTIONAL. When $key is given, but no corresponding value is found,
     *	this is returned instead
     *
     * @return mixed
     */
    public function get($key = null, $default_val = null)
    {
        return $key !== null
            ? array_get($this->get(), $key, $default_val)
            : array_filter($this->data, function ($a) {
                return $a !== null;
            });
    }

    /**
     * @return bool
     */
    public function isReadOnly()
    {
        return $this->read_only;
    }

    /**
     * @return string
     */
    public function getName()
    {
        return $this->name;
    }

    /**
     * @brief
     *	If the instance is not read-only, updates the given value and fires the appropriate hook
     *
     * @param string $key   The key within $data to set; may be given in "dot" notation
     * @param mixed  $value
     *
     * @return bool
     *	FALSE if the value was not set becuase the instance is read-only; the return value of
     *	commitChange() otherwise
     */
    public function set($key, $value)
    {
        if ($this->isReadOnly()) {
            return false;
        }

        $data = [
            'key'       => &$key,
            'old_value' => $this->get($key),
            'new_value' => &$value,
        ];
        fire_hook($this->generateHookName('change'), $data);
        return $this->commitChange($key, $value);
    }

    /**
     * @brief
     *	Generates a hook name for a hook related to the instance's data, properly prefixed for
     *	consistency
     *
     * @param string $hook_name
     *
     * @return string
     */
    protected function generateHookName($hook_name)
    {
        return 'data_' . $this->getName() . '_' . $hook_name;
    }

    /**
     * @brief
     *	Overrideable method that handles the actual storing of a new value
     *
     * @param string $key   The key within $data to set; may be given in "dot" notation
     * @param mixed  $value
     *
     * @return bool
     *	Indicates whether the value was updated successfully
     */
    protected function commitChange($key, $value)
    {
        array_set($this->data, $key, $value);
        return $this;
    }

    /**
     * @brief
     *	Alias for $this->set( $key, NULL )
     */
    public function del($key)
    {
        return $this->set($key, null);
    }
}
