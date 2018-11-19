<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/files.php';

use Vortex\ModulesModelFactory;
use Vortex\DataStorage;
use PHPUnit\Framework\TestCase;


final class ModulesModelFactorysTest extends TestCase
{
    public function testLoadModules(): void {
        $modules_dir = exec('mktemp -d');

        # No modules enabled
        $modules = ModulesModelFactory::create($modules_dir);
        $this->assertTrue($modules instanceof DataStorage);
        $this->assertTrue(empty($modules->get()));

        # 1 (empty) module enabled
        mkdir("$modules_dir/foo");
        $modules = ModulesModelFactory::create($modules_dir);
        $this->assertTrue($modules instanceof DataStorage);
        $modules_array = $modules->get();
        $expected_modules = [
            'foo' => [
                'js'                   => [],
                'css'                  => [],
                'less'                 => [],
                'hbs'                  => [],
                'classes'              => [],
                'templates'            => [],
                'hook_implementations' => false,
                'settings' => [
                    'external_js' => [],
                    'external_css' => [],
                ],
            ]
        ];
        $this->assertEquals($expected_modules,$modules_array);

        # 2 modules enabled
        mkdir("$modules_dir/bar");
        file_put_contents("$modules_dir/bar/settings.ini",
            "external_js[] = foobar\nexternal_css[] = bizbaz\nfuzz = fizz");
        file_put_contents("$modules_dir/bar/hooks.php","");
        $expected_bar = [
            'hook_implementations' => "$modules_dir/bar/hooks.php",
            'settings' => [
                'external_js'  => [ 'foobar' ],
                'external_css' => [ 'bizbaz' ],
                'fuzz'         => 'fizz',
             ],
        ];
        foreach ( [ 'css', 'less', 'js', 'hbs', 'classes' => 'php', 'templates' => 'tpl.php' ] as $dir => $ext )
        {
            if ( is_numeric( $dir ) )
            {
                $dir = $ext;
            }
            mkdir("$modules_dir/bar/$dir");
            file_put_contents("$modules_dir/bar/$dir/biz-0.$ext","");
            file_put_contents("$modules_dir/bar/$dir/biz-1.$ext","");
            $expected_bar[$dir][] = "$modules_dir/bar/$dir/biz-0.$ext";
            $expected_bar[$dir][] = "$modules_dir/bar/$dir/biz-1.$ext";
        }
        $expected_modules[ 'bar' ] = $expected_bar;
        $modules = ModulesModelFactory::create($modules_dir);
        $this->assertTrue($modules instanceof DataStorage);
        $modules_array = $modules->get();
        $this->assertEquals($expected_modules, $modules_array);
    }
}

