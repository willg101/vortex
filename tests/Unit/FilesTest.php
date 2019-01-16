<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/files.php';

use PHPUnit\Framework\TestCase;
use Vortex\App;

final class FilesTest extends TestCase
{
    public function testClientCanAccessPathPositive(): void {
        $dir = exec('mktemp -d');
        mkdir("$dir/a");
        mkdir("$dir/b");
        mkdir("$dir/b/b1");
        symlink("$dir/b/b1","$dir/c");

        $app = new App([], [ 'allowed_directories' => [ "$dir/a", "$dir/b" ] ]);
        App::setInstance($app);
        $this->assertTrue(client_can_access_path("$dir/a"));
        $this->assertTrue(client_can_access_path("$dir/b"));
        $this->assertTrue(client_can_access_path("$dir/b/b1"));
        $this->assertTrue(client_can_access_path("$dir/c"));
    }

    public function testClientCanAccessPathNegative(): void {
        $dir = exec('mktemp -d');
        mkdir("$dir/apple");
        mkdir("$dir/a");
        mkdir("$dir/b");
        mkdir("$dir/b/b1");
        symlink("$dir/b/b1","$dir/c");

        $app = new App([], [ 'allowed_directories' => [ "$dir/a" ] ]);
        App::setInstance($app);
        $this->assertFalse(client_can_access_path("$dir/apple"));
        $this->assertFalse(client_can_access_path("$dir/b"));
        $this->assertFalse(client_can_access_path("$dir/b/b1"));
        $this->assertFalse(client_can_access_path("$dir/c"));
    }

    public function testClientCanViewFilePositive(): void {
        $dir = exec('mktemp -d');
        mkdir("$dir/a");
        mkdir("$dir/a/b");
        file_put_contents("$dir/a/file.allowed", '');
        file_put_contents("$dir/a/b/file.allowed", '');
        file_put_contents("$dir/a/b/file_without_extension", '');
        symlink("$dir/a/b/file.allowed","$dir/c");

        $app = new App([], [ 'allowed_directories' => [ "$dir/a" ], 'allowed_extensions' => [ 'allowed', '' ] ]);
        App::setInstance($app);
        $this->assertTrue(client_can_view_file("$dir/a/file.allowed"));
        $this->assertTrue(client_can_view_file("$dir/a/b/file.allowed"));
        $this->assertTrue(client_can_view_file("$dir/a/b/file_without_extension"));
        $this->assertTrue(client_can_view_file("$dir/c"));
    }

    public function testClientCanViewFileNegative(): void {
        $dir = exec('mktemp -d');
        mkdir("$dir/a");
        mkdir("$dir/a/b");
        mkdir("$dir/d");
        file_put_contents("$dir/a/file.disallowed", '');
        file_put_contents("$dir/a/b/file.disallowed", '');
        file_put_contents("$dir/a/b/file_without_extension", '');
        file_put_contents("$dir/d/file.allowed", '');
        symlink("$dir/a/b/file.disallowed","$dir/c.allowed");

        $app = new App([], [ 'allowed_directories' => [ "$dir/a" ], 'allowed_extensions' => [ 'allowed' ] ]);
        App::setInstance($app);
        $this->assertFalse(client_can_view_file("$dir/d/file.disallowed"));
        $this->assertFalse(client_can_view_file("$dir/a"));
        $this->assertFalse(client_can_view_file("$dir/a/file.disallowed"));
        $this->assertFalse(client_can_view_file("$dir/a/b/file.disallowed"));
        $this->assertFalse(client_can_view_file("$dir/c.allowed"));
    }

    public function testRecursiveFileScanNoFiles(): void {
        $dir = exec('mktemp -d');
        // No symlinks
        $this->assertEquals([], recursive_file_scan('foo', $dir));

        // Symlink with cycle
        symlink($dir, "$dir/cycle");
        $this->assertEquals([], recursive_file_scan('foo', $dir));
    }

    public function testRecursiveFileScanNoSubdirs(): void {
        $dir = exec('mktemp -d');
        file_put_contents("$dir/a.foo", '');
        file_put_contents("$dir/a.bar", '');
        // No symlinks
        $this->assertEquals(["$dir/a.foo"], recursive_file_scan('foo', $dir));

        // Symlinked file
        symlink("$dir/a.foo", "$dir/b.foo");
        $this->assertEquals(["$dir/a.foo", "$dir/b.foo"], recursive_file_scan('foo', $dir));

        // Symlinked dir creating cycle
        symlink($dir, "$dir/cycle");
        $this->assertEquals(["$dir/a.foo", "$dir/b.foo"], recursive_file_scan('foo', $dir));
    }

    public function testRecursiveFileScanWithSubdirs(): void {
        $dir = exec('mktemp -d');
        mkdir("$dir/a");
        mkdir("$dir/a/1");
        mkdir("$dir/a/2");
        file_put_contents("$dir/a/1/x.foo", '');
        file_put_contents("$dir/a/1/x.bar", '');
        file_put_contents("$dir/a/2/x.foo", '');
        file_put_contents("$dir/a/2/x.bar", '');

        // No symlinks
        $this->assertEquals(["$dir/a/1/x.foo", "$dir/a/2/x.foo"], recursive_file_scan('foo', $dir));
        $this->assertEquals(["$dir/a/1/x.foo"], recursive_file_scan('foo', "$dir/a/1"));
        $this->assertEquals(["$dir/a/2/x.foo"], recursive_file_scan('foo', "$dir/a/2"));

        // Symlinked file
        symlink("$dir/a/1/x.foo", "$dir/a/2/y.foo");
        $this->assertEquals(["$dir/a/1/x.foo", "$dir/a/2/x.foo", "$dir/a/2/y.foo"], recursive_file_scan('foo', $dir));
        $this->assertEquals(["$dir/a/1/x.foo", "$dir/a/2/x.foo", "$dir/a/2/y.foo"], recursive_file_scan('foo', "$dir/a"));
        $this->assertEquals(["$dir/a/1/x.foo"], recursive_file_scan('foo', "$dir/a/1"));
        $this->assertEquals(["$dir/a/2/x.foo", "$dir/a/2/y.foo"], recursive_file_scan('foo', "$dir/a/2"));

        // Symlinked dir creating cycle
        symlink("$dir/a/1", "$dir/cycle");
        $this->assertEquals(["$dir/a/1/x.foo", "$dir/a/2/x.foo", "$dir/a/2/y.foo"], recursive_file_scan('foo', $dir));
    }

    public function testWithoutFileExtension(): void {
        $this->assertEquals('foobar', without_file_extension('foobar'));
        $this->assertEquals('foobar', without_file_extension('/var/foobar'));
        $this->assertEquals('biz', without_file_extension('biz.baz'));
        $this->assertEquals('biz', without_file_extension('/var/lib/biz.baz'));
        $this->assertEquals('biz', without_file_extension('biz.baz.buzz'));
        $this->assertEquals('biz', without_file_extension('/var/lib/biz.baz.buzz'));
    }
}
