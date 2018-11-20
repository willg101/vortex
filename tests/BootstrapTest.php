<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';
require_once __DIR__ . '/../includes/arrays.php';

use PHPUnit\Framework\TestCase;
use Vortex\App;
use Vortex\Exceptions\HttpException;
use Monolog\Handler\StreamHandler;
use Monolog\Logger;

final class BootstrapTest extends TestCase
{
    public function testBootstrapWithNoModules(): void {
        $app = new App([], []);
        App::setInstance($app);
        $this->expectException(HttpException::class);
        bootstrap($app);
    }

    public function testBootstrapWithNoHandlers(): void {
        $app = new App(['foo' => []], []);
        App::setInstance($app);
        $this->expectException(HttpException::class);
        bootstrap($app);
    }

    public function testBootstrapDisableModuleOnPreboot(): void {
        $app = new App([
            'bootstrap_bar1__' => [ 'hook_implementations' => __FILE__ ],
            'bootstrap_foo1__' => [ 'hook_implementations' => __FILE__ ],
        ], []);
        App::setInstance($app);
        function bootstrap_bar1___preboot(&$data) {
            $data['app']->modules->del('bootstrap_foo1__');
            $data['request_handlers']->register('/%', function($app){ $app->response->setContent('bootstrap_bar1___preboot'); });
        }
        function bootstrap_foo1___boot(&$data) {
            throw new LogicException(__FUNCTION__ . '() should not be called');
        }
        bootstrap($app);
        $this->assertEquals('bootstrap_bar1___preboot', $app->response->getContent());
    }

    public function testBootstrapStandardControlFlow(): void {
        $app = new App([
            'bootstrap_bar2__' => [ 'hook_implementations' => __FILE__ ],
        ], []);
        App::setInstance($app);
        function bootstrap_bar2___preboot(&$data) {
            $data['request_handlers']->register('/%', function($app){ $app->response->setContent('bootstrap_bar2___preboot'); });
        }
        bootstrap($app);
        $this->assertEquals('bootstrap_bar2___preboot', $app->response->getContent());
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testLoggerOverrideLoggerInHook(): void {
        $app = new App([
            'bootstrap_bar3__' => [ 'hook_implementations' => __FILE__ ],
        ], ['log_level' => 'ERROR']);
        App::setInstance($app);
        function bootstrap_bar3___init_logger(&$data) {
            $data['logger'] = (object) [ 'from_hook' => __FUNCTION__ ];
        }
        $this->assertEquals(logger()->from_hook, 'bootstrap_bar3___init_logger');
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testLoggerOverrideHandlerInHook(): void {
        $app = new App([
            'bootstrap_bar4__' => [ 'hook_implementations' => __FILE__ ],
        ], ['log_level' => 'INFO']);
        App::setInstance($app);
        function bootstrap_bar4___init_logger(&$data) {
            $data['handler'] = new StreamHandler(__DIR__ . '/../logs/' . __FUNCTION__. '.log', $log_level); 
        }
        $log_file = __DIR__ . '/../logs/bootstrap_bar4___init_logger.log';
        @unlink($log_file);
        logger()->info('bizbaz');
        $log_output = file_get_contents($log_file);
        $this->assertContains('bizbaz', $log_output);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testLoggerOverrideLabelInHook(): void {
        $app = new App([
            'bootstrap_bar5__' => [ 'hook_implementations' => __FILE__ ],
        ], ['log_level' => 'INFO']);
        App::setInstance($app);
        function bootstrap_bar5___init_logger(&$data) {
            $data['label']   = __FUNCTION__;
        }
        $this->assertContains('(bootstrap_bar5___init_logger)',logger()->getName());
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testLoggerNormalFlow(): void {
        $app = new App([], ['log_level' => 'INFO']);
        App::setInstance($app);
        $expected_methods = [ 'debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency' ];
        foreach ($expected_methods as $method) {
            $this->assertTrue(method_exists(logger(), $method));
        }
    }
} 
