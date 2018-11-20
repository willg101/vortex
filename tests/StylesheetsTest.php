<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/stylesheets.php';
require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/arrays.php';
require_once __DIR__ . '/../includes/files.php';

use PHPUnit\Framework\TestCase;
use Vortex\App;

final class StylesheetsTest extends TestCase
{
    private function mockStylesheetFiles(array $opts) {
        $app = new App([
            'foo_stylesheets_test__' => [
                'css'  => array_get($opts, 'css', []),
                'less' => array_get($opts, 'less', []),
                'settings' => [
                    'external_css' => array_get($opts, 'external_css', []),
                ],
                'hook_implementations' => __FILE__,
            ],
        ], [
            'less_output_dir' => exec('mktemp -d'),
            'less_variables' => [ 'display-type' => 'none' ],
        ]);
        $app->request->server->set('SCRIPT_NAME', '/foo/bar/index.php');
        App::setInstance($app);
    }

    public function teardown() {
        App::clearInstance();
    }

    public function testBuildCssRequirementsNoCssFiles(): void {
        $this->mockStylesheetFiles([]);
        $tags = build_css_requirements();
        $this->assertEquals('', $tags);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testBuildCssRequirementsNoExternalCssFiles(): void {
        $this->mockStylesheetFiles(['css' => ['css/foo.css', 'css/bar.css']]);
        $tags = build_css_requirements();
        $this->assertEquals('<link rel="stylesheet" href="/foo/bar/css/foo.css">'
            . "\n\t\t" . '<link rel="stylesheet" href="/foo/bar/css/bar.css">', $tags);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testBuildCssRequirementsNoInternalCssFiles(): void {
        $this->mockStylesheetFiles(['external_css' => ['//example.com/foo.css']]);
        $tags = build_css_requirements();
        $this->assertEquals('<link rel="stylesheet" href="//example.com/foo.css">', $tags);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testBuildCssRequirementsWithInternalAndExternalCssFiles(): void {
        $this->mockStylesheetFiles(['external_css' => ['//example.com/foo.css'], 'css' => ['css/foo.css' ]]);
        $tags = build_css_requirements();
        $this->assertEquals('<link rel="stylesheet" href="//example.com/foo.css">'
            . "\n\t\t" . '<link rel="stylesheet" href="/foo/bar/css/foo.css">', $tags);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testBuildLessRequirements(): void {
        $dir = exec('mktemp -d');
        $less_file = "$dir/test-less.css.less";
        file_put_contents($less_file, '.foo{display:none;}');
        $this->mockStylesheetFiles(['less' => [$less_file]]);
        $tags = build_less_requirements();
        $this->assertTrue(!!preg_match('#^<link rel="stylesheet" href="[^"]+test-less[^"]+">$#', $tags));
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testCompileLess(): void {
        // Create a fresh directory and place a sample LESS file into it
        $dir = exec('mktemp -d');
        $less_file = "$dir/test-less.css.less";
        file_put_contents($less_file, '.foo{.bar{display:@display-type;}}');

        $this->mockStylesheetFiles(['less' => [$less_file]]);

        // Create a file that compile_less() should delete when it clears cached css files
        $previously_cached_css_file = App::get('settings')->get('less_output_dir') . '/cached-deleteme.css';
        file_put_contents($previously_cached_css_file, '');

        $css_name = compile_less($less_file,'foobar');

        // Verify that the LESS file was compiled to CSS
        $this->assertEquals('.foo .bar { display: none; }', trim(preg_replace('/[\s]+/', ' ', file_get_contents($css_name))));

        // Verify that the CSS file's name is in the expected format
        $this->assertTrue(!!preg_match('/cached-foobar-\d+-test-less.css$/', basename($css_name)));

        // Verify that previously cached CSS files were deleted
        $this->assertFalse(file_exists($previously_cached_css_file));
    }
}
