<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/templates.php';
require_once __DIR__ . '/../includes/arrays.php';
require_once __DIR__ . '/../includes/files.php';

use PHPUnit\Framework\TestCase;
use Vortex\App;

final class TemplatesTest extends TestCase
{
    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testRenderWithNoModules(): void {
        $app = new App([], []);
        App::setInstance($app);
        $html = render('foobar');
        $this->assertEquals('', $html);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testRenderWithOneModule(): void {
        $dir = exec('mktemp -d');
        $template_file = "$dir/foobar.tpl.php";
        file_put_contents($template_file, 'bizbaz');
        $app = new App([
            'foo' => [
                'templates' => [ $template_file ],
            ],
        ], []);
        App::setInstance($app);
        $html = render('foobar');
        $this->assertEquals('bizbaz', $html);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testRenderWithTwoModules(): void {
        $dir = exec('mktemp -d');
        mkdir("$dir/foo");
        mkdir("$dir/bar");
        $template_file_foo = "$dir/foo/foobar.tpl.php";
        $template_file_bar = "$dir/bar/foobar.tpl.php";
        file_put_contents($template_file_foo, 'bizbaz*');
        file_put_contents($template_file_bar, '*fizzfuzz');
        $app = new App([
            'foo' => [
                'templates' => [ $template_file_foo ],
            ],
            'bar' => [
                'templates' => [ $template_file_bar ],
            ],
        ], []);
        App::setInstance($app);
        $html = render('foobar');
        $this->assertEquals('bizbaz**fizzfuzz', $html);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testRenderWithHookAlterations(): void {
        $dir = exec('mktemp -d');

        $template_file_foo = "$dir/foobar.tpl.php";
        $GLOBALS['foo_test_render__file'] = $template_file_foo;
        file_put_contents($template_file_foo, '<?php echo $preprocess ?> ** <?php echo $process ?>');

        $template_file_bar = "$dir/foobar_bar.tpl.php";
        $GLOBALS['bar_test_render__file'] = $template_file_bar;
        file_put_contents($template_file_bar, '((bar)) ');

        $app = new App([
            'foo_test_render__' => [
                'templates' => [ 'bizbaz.tpl.php' ],
                'hook_implementations' => __FILE__,
            ],
            'bar_test_render__' => [
                'templates' => [ 'bizbaz.tpl.php' ],
                'hook_implementations' => __FILE__,
            ],
            'biz_test_render__' => [
                'templates' => [ 'bizbaz.tpl.php' ],
                'hook_implementations' => __FILE__,
            ],
        ], []);
        App::setInstance($app);
        function foo_test_render___render_preprocess(&$data) {
            unset($data['implementations']['biz_test_render__']); // Remove a module's implementaion
            $data['vars']['preprocess'] = 'Preprocessed'; // Define a variable for the template
        }
        function foo_test_render___render_process(&$data) {
            $data['vars']['process'] = 'Processed';

            // Replace modules' implementations of this template
            $data['implementations']['foo_test_render__']['file'] = $GLOBALS['foo_test_render__file'];
            $data['implementations']['bar_test_render__']['file'] = $GLOBALS['bar_test_render__file'];

            // Re-order the implementations
            $data['implementations']['bar_test_render__']['weight'] = -1;
        }
        function foo_test_render___render_postprocess(&$data) {
            // Selectively alter the rendered content
            if ($data['module'] == 'foo_test_render__') {
                $data['rendered'] .= ' ** Postprocessed';
            }
        }

        $html = render('bizbaz');
        $this->assertEquals('((bar)) Preprocessed ** Processed ** Postprocessed', $html);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testRenderTemplate(): void {
        $dir = exec('mktemp -d');

        $template_file_bar = "$dir/bar.tpl.php";
        file_put_contents($template_file_bar, ' ((bar)) ');

        $template_file_for_render = "$dir/template.tpl.php";
        file_put_contents($template_file_for_render, '<?php echo $abc; if($has("bar")){ $show("bar"); } ?>**');

        $app = new App([
            'bar' => [
                'templates' => [ $template_file_bar ],
            ],
        ], []);
        App::setInstance($app);
        $html = render_template($template_file_for_render, ['abc' => 'ABC']);
        $this->assertEquals('ABC ((bar)) **', $html);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testGetTemplateImplementations(): void {
        $app = new App([
            'foo' => [
                'templates' => [ 'a.tpl.php' ],
            ],
            'bar' => [
                'templates' => [ 'a.tpl.php', 'b.tpl.php' ],
            ],
            'biz' => [
                'templates' => [ 'a.tpl.php', 'b.tpl.php', 'c.tpl.php' ],
            ],
        ], []);
        App::setInstance($app);
        $this->assertEquals([
            'foo' => [ 'file' => 'a.tpl.php', 'weight' => 0 ],
            'bar' => [ 'file' => 'a.tpl.php', 'weight' => 0 ],
            'biz' => [ 'file' => 'a.tpl.php', 'weight' => 0 ],
        ], get_template_implementations('a'));
        $this->assertEquals([
            'bar' => [ 'file' => 'b.tpl.php', 'weight' => 0 ],
            'biz' => [ 'file' => 'b.tpl.php', 'weight' => 0 ],
        ], get_template_implementations('b'));
        $this->assertEquals([
            'biz' => [ 'file' => 'c.tpl.php', 'weight' => 0 ],
        ], get_template_implementations('c'));

        // Use cache
        App::setInstance(new App([], []));
        $this->assertEquals([
            'foo' => [ 'file' => 'a.tpl.php', 'weight' => 0 ],
            'bar' => [ 'file' => 'a.tpl.php', 'weight' => 0 ],
            'biz' => [ 'file' => 'a.tpl.php', 'weight' => 0 ],
        ], get_template_implementations('a'));
        $this->assertEquals([
            'bar' => [ 'file' => 'b.tpl.php', 'weight' => 0 ],
            'biz' => [ 'file' => 'b.tpl.php', 'weight' => 0 ],
        ], get_template_implementations('b'));
        $this->assertEquals([
            'biz' => [ 'file' => 'c.tpl.php', 'weight' => 0 ],
        ], get_template_implementations('c'));

        // Clear cache
        $this->assertEquals([], get_template_implementations('a', false));
        $this->assertEquals([], get_template_implementations('b', false));
        $this->assertEquals([], get_template_implementations('c', false));
    }
}
