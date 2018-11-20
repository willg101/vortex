<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/javascript.php';
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/arrays.php';

use PHPUnit\Framework\TestCase;
use Vortex\App;

final class JavaScriptTest extends TestCase
{
    private function mockJsFiles(array $opts) {
        $app = new App([
            'foo_javascript_test__' => [
                'hbs' => array_get($opts, 'hbs', []),
                'js'  => array_get($opts, 'js', []),
                'settings' => [
                    'external_js' => array_get($opts, 'mod_x_js', []),
                ],
                'hook_implementations' => __FILE__,
            ],
        ], [
            'core_js' => array_get($opts, 'core_js', [])
        ]);
        App::setInstance($app);
    }

    public function teardown() {
        App::clearInstance();
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testBuildScriptRequirementsNoJsFiles(): void {
        $this->mockJsFiles([]);
        $tags1 = build_script_requirements();
        $this->assertEquals(1, substr_count($tags1, '<script>'));
        $this->assertEquals(1, substr_count($tags1, '</script>'));
        $this->assertTrue(!!preg_match('#^<script>Dpoh = \{".*"\}.*</script>$#', $tags1));

        # Override options via hook
        function foo_javascript_test___alter_js_options(&$data) {
            $data = [];
        }
        $tags2 = build_script_requirements();
        $this->assertEquals('<script>Dpoh = [];</script>', $tags2);
    }

    public function testBuildScriptRequirementsWithCoreJsFiles(): void {
        $this->mockJsFiles(['core_js' => ['foo.js', '//example.com/foo.js']]);
        $tags = build_script_requirements();
        $this->assertEquals(3, substr_count($tags, '<script'));
        $this->assertEquals(3, substr_count($tags, '</script>'));
        $this->assertContains('<script src="//example.com/foo.js"></script>', $tags);
        $this->assertContains('<script src="foo.js"></script', $tags);
    }

    public function testBuildScriptRequirementsWithModuleJsFiles(): void {
        $this->mockJsFiles([
            'js' => ['foo.js', 'bar.module.js'],
            'mod_x_js' => ['//example.com/foo.js','//example.com/foo.js'], // Verify duplicates are ignored
        ]);
        $tags = build_script_requirements();
        $this->assertEquals(4, substr_count($tags, '<script'));
        $this->assertEquals(4, substr_count($tags, '</script>'));

        // Verify contents AND order
        $external_mod_script_pos = strpos($tags, '<script src="//example.com/foo.js"></script>');
        $mod_script_pos          = strpos($tags, '<script  src="foo.js"></script>');
        $mod_script_type_mod_pos = strpos($tags, '<script type="module" src="bar.module.js"></script>');
        $this->assertNotEmpty($external_mod_script_pos);
        $this->assertNotEmpty($mod_script_pos);
        $this->assertNotEmpty($mod_script_type_mod_pos);
        $this->assertTrue($external_mod_script_pos < $mod_script_pos);
        $this->assertTrue($external_mod_script_pos < $mod_script_type_mod_pos);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testProcessAssetPath(): void {
        $app = new App([], []);
        $app->request->server->set('SCRIPT_NAME', '/foo/index.php'); // Control base_path()
        App::setInstance($app);
        if (!defined('DPOH_ROOT')) {
            define('DPOH_ROOT', __DIR__);
        }
        $this->assertEquals('https://example.com/foo.js', process_asset_path('https://example.com/foo.js'));
        $this->assertEquals('http://example.com/foo.js', process_asset_path('http://example.com/foo.js'));
        $this->assertEquals('//example.com/foo.js', process_asset_path('//example.com/foo.js'));
        $this->assertEquals('/x/' . DPOH_ROOT . '/foo.js', process_asset_path('/x/' . DPOH_ROOT . '/foo.js'));
        $this->assertEquals('/foo/foo.js', process_asset_path(DPOH_ROOT . '/foo.js'));
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testLoadHandlebarTemplates(): void {
        $fake_root = exec('mktemp -d');
        define('DPOH_ROOT', $fake_root);
        exec("mkdir -p '$fake_root/modules_available/foo_javascript_test__/hbs'");

        $template = "$fake_root/modules_available/foo_javascript_test__/hbs/abc.hbs";
        $template_contents = "{{a}}\nb";
        file_put_contents($template, $template_contents);
        $this->mockJsFiles(['hbs' => [$template]]);
        $all_templates = load_handlebar_templates();
        $this->assertEquals(['foo_javascript_test__.abc' => $template_contents], $all_templates);

        $tags = build_script_requirements();
        $this->assertContains(json_encode($all_templates), $tags);
    }
}

