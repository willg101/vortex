<?php namespace Vortex;

use InvalidArgumentException;
use UnexpectedValueException;

class SettingsModelFactory {
    public const MODEL_NAME = 'settings';

    public static function create($settings_file) {
        $instance = new static($settings_file);
        return $instance->load();
    }

    protected $settings_file;

    public function __construct($settings_file) {
        if (!is_file($settings_file)) {
             throw new InvalidArgumentException("'$settings_file' is not a file");
        } elseif (!is_readable($settings_file)) {
             throw new InvalidArgumentException("Cannot read '$settings_file'");
        } elseif ($err_msg = $this->verifyFormat($settings_file)) {
             throw new InvalidArgumentException("'$settings_file' is in the wrong format ($err_msg)");
        }
        $this->settings_file = $settings_file;
    }

    public function load() {
        $settings = array_merge($this->getDefaultSettings(), $this->parseSettingsFile());
        $settings = $this->processSettings($settings);
        return new DataStorage(static::MODEL_NAME, $settings);
    }

    protected function verifyFormat($settings_file) {
        return preg_match('/\.ini$/', $settings_file)
            ? false
            : 'expected an *.ini file';
    }

    protected function getDefaultSettings() {
        return [
            'allowed_directories' => [],
            'tree_root' => '/dev/null',
            'less_variables' => [
                'defaults' =>  "~'" . DPOH_ROOT . "/less/defaults'",
            ],
        ];
    }

    protected function parseSettingsFile()
    {
        if (($parsed = @parse_ini_file($this->settings_file)) === false) {
            throw new UnexpectedValueException("Failed to parse the file '$this->settings_file'");
        }
        return $parsed;
    }

    protected function processSettings(array $settings) {
        $settings[ 'tree_root' ] = realpath($settings[ 'tree_root' ]);
        foreach ($settings[ 'allowed_directories' ] as &$dir) {
            $dir = realpath($dir);
        }
        return $settings;
    }
}
