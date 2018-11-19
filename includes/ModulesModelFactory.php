<?php namespace Vortex;

class ModulesModelFactory {
    public const MODEL_NAME = 'modules';

    public static function create($modules_dir) {
        $instance = new static($modules_dir);
        return $instance->load();
    }

    protected $standard_dirs = [
        'js'      => 'js',
        'hbs'     => 'hbs',
        'css'     => 'css',
        'less'    => 'less',
        'tpl.php' => 'templates',
        'php'     => 'classes',
    ];

    protected $standard_files = [
        'hook_implementations' => 'hooks.php',
    ];

    protected $default_settings = [
        'external_js'  => [],
        'external_css' => [],
    ];

    protected $modules_dir;

    public function __construct($modules_dir) {
        if(!is_dir($modules_dir)) {
            throw new InvalidArgumentException("'$modules_dir' is not a directory");
        }
        elseif(!is_readable($modules_dir) || !is_executable($modules_dir)) {
            throw new InvalidArgumentException("Cannot list the contents of '$modules_dir'");
        }
        $this->modules_dir = $modules_dir;
    }

    public function load() {
        $list_of_modules = $this->listAllModules();
        $all_module_settings = [];
        foreach ($list_of_modules as $name => $dir) {
            $all_module_settings[$name] = $this->loadSingleModule($dir);
        }
        return new DataStorage(static::MODEL_NAME, $all_module_settings);
    }

    protected function listAllModules() {
        $all_mods = [];
        foreach (glob("$this->modules_dir/*") as $dir) {
            $all_mods[basename($dir)] = $dir;
        }
        return $all_mods;
    }

    protected function loadSingleModule($module_dir) {
        $module = [];
        foreach ($this->standard_dirs as $extension => $asset_dir) {
            if (file_exists("$module_dir/$asset_dir")) {
                $module[ $asset_dir ] = recursive_file_scan($extension, "$module_dir/$asset_dir");
            } else {
                $module[ $asset_dir ] = [];
            }
        }

        foreach ($this->standard_files as $key => $filename) {
            $module[ $key ] = file_exists("$module_dir/$filename")
                ? "$module_dir/$filename"
                : false;
        }

        $potential_settings_file = "$module_dir/settings.ini";
        $settings = file_exists($potential_settings_file)
            ? parse_ini_file($potential_settings_file)
            : [];
        $module[ 'settings' ] = array_merge($this->default_settings, $settings);

        return $module;
    }
}
