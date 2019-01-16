<?php

namespace Vortex;

use LogicException;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Request;

class App {
    protected static $default_instance;

    public static function getInstance() {
        if (!static::$default_instance) {
            throw new LogicException(static::class . '::$default_instance has not been set');
        }
        return static::$default_instance;
    }

    public static function setInstance(App $instance) {
        static::$default_instance = $instance;
    }

    public static function clearInstance() {
        static::$default_instance = null;
    }

    public static function get($str) {
        return static::getInstance()->$str;
    }

    protected $modules;
    protected $settings;
    protected $request;
    protected $response;

    public function __construct($modules, $settings, $request = null, $response = null) {
        $this->validateModelInput($modules,   'modules', ModulesModelFactory::class);
        $this->validateModelInput($settings, 'settings', SettingsModelFactory::class);
        $this->request  = $request  ?: $this->createDefaultRequest();
        $this->response = $response ?: $this->createDefaultResponse();
    }

    protected function validateModelInput($model, $property_name, $factory_class) {
        if (is_string($model)) {
            $this->$property_name = $factory_class::create($model);
        } elseif (is_array($model)) {
            $this->$property_name = new DataStorage($factory_class::MODEL_NAME, $model);
        } elseif (is_object($model) && $model instanceof DataStorage) {
            $this->$property_name = $model;
        } else {
            throw new InvalidArgumentException("Unexpected value for \$$property_name (received " . gettype($modules) . ')');
        }
    }

    protected function createDefaultRequest() {
        return Request::createFromGlobals();
    }

    protected function createDefaultResponse() {
        return new Response;
    }

    protected function keyIsReadable($key) {
        return in_array($key, [ 'modules', 'settings', 'request', 'response' ]);
    }

    public function __get($key) {
        if ($this->keyIsReadable($key)) {
            return $this->$key;
        } else {
            throw new LogicException("Cannot access property $key of " . get_called_class());
        }
    }

    public function __set($key, $value) {
        throw new LogicException("Cannot set '$key' on an instance of " . get_called_class());
    }

    public function fireHook($hook_name, array &$data = []) {
        $results = [];
        $this_val = isset($this) && $this instanceof self ? $this : static::getInstance();
        foreach ($this_val->modules->get() as $module_name => $module_info) {
            if (empty($module_info['hook_implementations'])) {
                continue;
            } else {
                require_once $module_info['hook_implementations'];
            }

            $function_name = $module_name . '_' . $hook_name;
            if (function_exists($function_name)) {
                $current_result = $function_name($data);
                if ($current_result !== null) {
                    $results[ $module_name ] = $current_result;
                }
            }
        }
        return $results;
    }
}
