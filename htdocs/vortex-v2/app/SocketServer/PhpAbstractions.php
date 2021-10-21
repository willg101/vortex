<?php

namespace App\SocketServer;

class PhpAbstractions {
    const DEFAULT_MAX_RECENT_FILES = 10;

    protected $raw_fragments = [];

    public function getRecentFiles(
        ?int $max_files,
        ?string $codebase_root,
        ?array $excluded_dirs,
        DebugConnection $dc,
        callable $callback
    )
    {
        $max_files = $max_files ?? static::DEFAULT_MAX_RECENT_FILES;
        $this->evalCodeFragment(
            'find_recent_files',
            [$max_files, $codebase_root, $excluded_dirs],
            $dc,
            function($data) use($callback) {
                $callback($data['_children'][0]['_children'] ?? []);
            }
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
        $dc->advancedEval($fragment_prepared, function($data) use ($callback, $fragment_prepared) { $data['fp'] = $fragment_prepared; $callback($data); });
    }
}
