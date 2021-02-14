<?php

namespace App\SocketServer;

class PhpAbstractions {
    protected $raw_fragments = [];

    public function getRecentFiles(
        int $max_files,
        string $codebase_root,
        array $excluded_dirs,
        DebugConnection $dc,
        callable $callback
    )
    {
        $this->evalCodeFragment(
            'find_recent_files',
            [$max_files, $codebase_root, $excluded_dirs],
            $dc,
            $callback
        );
    }

    protected function getCodeFragment(string $name)
    {
        $name = basename($name);

        if (!isset($this->raw_fragments[$name])) {
            $this->raw_fragments[$name] = file_get_contents(__DIR__ . "/CodeFragments/Php/$name.php");
            $this->raw_fragments[$name] = preg_replace('/(^.*?<\?php|;\s*$)/', '', $this->raw_fragments[$name]);
        }

        return $this->raw_fragments[$name];
    }

    protected function evalCodeFragment(string $name, array $args, DebugConnection $dc, callable $callback)
    {
        $fragment_raw = $this->getCodeFragment($name);
        $args_str = '';
        foreach ($args as $arg) {
            $args_str .= ($args_str ? ', ' : '') . var_export($arg, true);
        }
        $fragment_prepared = "return ($fragment_raw)($args_str);";
        $dc->advancedEval($fragment_prepared, $callback);
    }
}
