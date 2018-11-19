<?php
declare(strict_types=1);

use Vortex\App;
use Vortex\ModulesModelFactory;
use Vortex\SettingsModelFactory;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Vortex\Response;
use Dpoh\DataStorage;

final class AppTest extends TestCase
{
    /**
     * Run this in a separate process to ensure nothing has set the default instance
     * @testInSeparateProcess
     */
    public function testGetInstanceBeforeSetInstance(): void {
        $this->expectException(LogicException::class);
        App::getInstance();
    }

    public function testGetInstanceAfterSetInstance(): void {
        $instance = new App([], []);
        App::setInstance($instance);
        $this->assertSame($instance, App::getInstance());
    }

    public function testClearInstance(): void {
        $instance = new App([], []);
        App::setInstance($instance);
        App::getInstance();
        $this->expectException(LogicException::class);
        App::clearInstance();
        App::getInstance();
    }

    public function testContructorWithArrays(): void {
        if (!defined('DPOH_ROOT')) {
            define('DPOH_ROOT', dirname(__DIR__));
        }
 
        $modules  = [ 'foo' => 'bar' ];
        $settings = [ 'biz' => 'baz' ];
        $a1 = new App($modules, $settings);
        $this->assertEquals($modules,  $a1->modules->get());
        $this->assertEquals($settings, $a1->settings->get());
        $this->assertTrue($a1->request instanceof Request);
        $this->assertTrue($a1->response instanceof Response);
    }

    public function testContructorWithStrings(): void {
        if (!defined('DPOH_ROOT')) {
            define('DPOH_ROOT', dirname(__DIR__));
        }

        $modules_dir   = exec('mktemp -d');
        $settings_file = exec('mktemp --suffix=.ini');
        mkdir("$modules_dir/foo");
        mkdir("$modules_dir/bar");
        file_put_contents($settings_file, 'foobar[] = bizbaz');

        $a1 = new App($modules_dir, []);
        $this->assertCount(0, $a1->settings->get());
        $module_names_sorted = array_keys($a1->modules->get());
        sort($module_names_sorted);
        $this->assertEquals(['bar', 'foo'], $module_names_sorted);
        $this->assertTrue($a1->request instanceof Request);
        $this->assertTrue($a1->response instanceof Response);

        $a2 = new App([], $settings_file);
        $settings_array = $a2->settings->get();
        $this->assertEquals([ 'bizbaz' ], $settings_array['foobar']);
        $this->assertCount(0, $a2->modules->get());
        $this->assertTrue($a2->request instanceof Request);
        $this->assertTrue($a2->response instanceof Response);

        $a3 = new App($modules_dir, $settings_file);
        $module_names_sorted = array_keys($a1->modules->get());
        sort($module_names_sorted);
        $this->assertEquals(['bar', 'foo'], $module_names_sorted);
        $settings_array = $a2->settings->get();
        $this->assertEquals([ 'bizbaz' ], $settings_array['foobar']);
        $this->assertTrue($a3->request instanceof Request);
        $this->assertTrue($a3->response instanceof Response);
    }

    public function testContructorWithObjects(): void {
        if (!defined('DPOH_ROOT')) {
            define('DPOH_ROOT', dirname(__DIR__));
        }

        $modules_obj  = new DataStorage(ModulesModelFactory::MODEL_NAME, [ 'foo' => 'bar' ]);
        $settings_obj = new DataStorage(SettingsModelFactory::MODEL_NAME, [ 'biz' => 'baz' ]);
        $a1 = new App($modules_obj, []);
        $this->assertCount(0, $a1->settings->get());
        $this->assertSame($modules_obj, $a1->modules);
        $this->assertTrue($a1->request instanceof Request);
        $this->assertTrue($a1->response instanceof Response);

        $a2 = new App([], $settings_obj);
        $this->assertSame($settings_obj, $a2->settings);
        $this->assertCount(0, $a2->modules->get());
        $this->assertTrue($a2->request instanceof Request);
        $this->assertTrue($a2->response instanceof Response);

        $a3 = new App($modules_obj, $settings_obj);
        $this->assertSame($modules_obj, $a3->modules);
        $this->assertSame($settings_obj, $a3->settings);
        $this->assertTrue($a3->request instanceof Request);
        $this->assertTrue($a3->response instanceof Response);
    }

    public function testContructorWithUnsupportedArgs(): void {
        $values_to_test = [ null, true, false, 1, new stdClass ];
        foreach ($values_to_test as $value) {
            foreach([ [ $value, [] ], [ [], $value ], [ $value, $value ] ] as $args ) {
                $did_throw = false;
                try {
                    new App($args[0], $args[1]);
                } catch(InvalidArgumentException $e) {
                    $did_throw = true;
                }
                $this->assertTrue($did_throw, "App::__construct(" . gettype($args[0]) . ', '
                    . gettype($args[1]) . ') should throw an exception');

            }
        }
    }

    public function testMagicGetterForValidProperty(): void {
        $a = new App([], []);
        $properties_to_test = [ 'modules', 'settings', 'request', 'response' ];
        foreach ($properties_to_test as $property) {
            $this->assertTrue(!! $a->$property, "App::$property should not be empty");
        }
    }

    public function testMagicGetterForInvalidProperty(): void {
        $a = new App([], []);
        $this->expectException(LogicException::class);
        $a->foobar;
    }

    public function testMagicSetter(): void {
        $a = new App([], []);
        $this->expectException(LogicException::class);
        $a->foobar = 'bizbaz';
    }
}
