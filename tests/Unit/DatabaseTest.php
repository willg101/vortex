<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/arrays.php';
require_once __DIR__ . '/../../includes/database.php';

use PHPUnit\Framework\TestCase;
use Vortex\App;
use Vortex\Exceptions\DatabaseException;

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
final class DatabaseTest extends TestCase
{
    public function setup() {
        $db_file_def = exec('mktemp --suffix=.db');
        $db_file_alt = exec('mktemp --suffix=.db');
        $app = new App([], [
            'database' => [
                'default' => $db_file_def,
                'alt' => $db_file_alt,
            ]
        ]);
        App::setInstance($app);
        (new PDO("sqlite:$db_file_def"))->exec('CREATE TABLE db_name AS SELECT "db_def" name');
        (new PDO("sqlite:$db_file_alt"))->exec('CREATE TABLE db_name AS SELECT "db_alt" name');
    }

    public function teardown() {
        App::clearInstance();
    }

    public function testDbDefaultConnection(): void {
        $this->assertEquals('db_def', db()->query('SELECT name FROM db_name', PDO::FETCH_COLUMN, 0)->fetch());
    }

    public function testDbAlternateConnection(): void {

        $this->assertEquals('db_alt', db('alt')->query('SELECT name FROM db_name', PDO::FETCH_COLUMN, 0)->fetch());
    }

    public function testUnconfiguredConnection(): void {
        $this->expectException(DatabaseException::class);
        db('foobar');
    }

    public function testDbCachedConnection(): void {
        $conn = db();
        $this->assertSame(db(), $conn);

        $alt_conn = db('alt');
        $this->assertSame(db('alt'), $alt_conn);
    }

    public function testDbQuerySelectNoParams(): void {
        $this->assertEquals([['name' => 'db_def']], db_query('SELECT * FROM db_name'));
    }

    public function testDbQueryInsertNoParams(): void {
        db_query('INSERT INTO db_name VALUES ("foobar")');
        $this->assertEquals([['name' => 'db_def'], ['name' => 'foobar']], db_query('SELECT * FROM db_name'));
    }

    public function testDbQueryUpdateNoParams(): void {
        db_query('UPDATE db_name SET name = "foobar"');
        $this->assertEquals([['name' => 'foobar']], db_query('SELECT * FROM db_name'));
    }

    public function testDbQueryDeleteNoParams(): void {
        db_query('DELETE FROM db_name');
        $this->assertEquals([], db_query('SELECT * FROM db_name'));
    }

    public function testDbQuerySelectWithParams(): void {
        $this->assertEquals([['name' => 'db_def']],
            db_query('SELECT * FROM db_name WHERE name = :param', [':param' => 'db_def']));
    }

    public function testDbQueryInsertWithParams(): void {
        db_query('INSERT INTO db_name VALUES (:param)', [':param' => 'foobar']);
        $this->assertEquals([['name' => 'db_def'], ['name' => 'foobar']], db_query('SELECT * FROM db_name'));
    }

    public function testDbQueryUpdateWithParams(): void {
        db_query('UPDATE db_name SET name = :param', [':param' => 123]);
        $this->assertEquals([['name' => '123']], db_query('SELECT * FROM db_name'));
    }

    public function testDbQueryDeleteWithParams(): void {
        db_query('DELETE FROM db_name WHERE name = :param', [':param' => 'db_def']);
        $this->assertEquals([], db_query('SELECT * FROM db_name'));
    }

    public function testDbQuerySelectUsingAlternateConnection(): void {
        $this->assertEquals([['name' => 'db_alt']],
            db_query('SELECT * FROM db_name', [], db('alt')));

        $this->assertEquals([['name' => 'db_alt']],
            db_query('SELECT * FROM db_name WHERE name = :param', [ ':param' => 'db_alt' ], db('alt')));
    }

    public function testDbQueryInsertUsingAlternateConnection(): void {
        db_query('INSERT INTO db_name VALUES ("foobar")', [], db('alt'));
        $this->assertEquals([['name' => 'db_alt'], ['name' => 'foobar']],
            db_query('SELECT * FROM db_name', [], db('alt')));

        db_query('INSERT INTO db_name VALUES (:param)', [ ':param' => 'bizbaz' ], db('alt'));
        $this->assertEquals([['name' => 'db_alt'], ['name' => 'foobar'], ['name' => 'bizbaz']],
            db_query('SELECT * FROM db_name', [], db('alt')));
    }

    public function testDbQueryUpdateUsingAlternateConnection(): void {
        db_query('UPDATE db_name SET name = "foobar"', [], db('alt'));
        $this->assertEquals([['name' => 'foobar']], db_query('SELECT * FROM db_name', [], db('alt')));

        db_query('UPDATE db_name SET name = :param', [ ':param' => 'bizbaz' ], db('alt'));
        $this->assertEquals([['name' => 'bizbaz']], db_query('SELECT * FROM db_name', [], db('alt')));

    }

    public function testDbQueryDeleteUsingAlternateConnection(): void {
        db_query('DELETE FROM db_name WHERE name = "db_alt"', [], db('alt'));
        $this->assertEquals([], db_query('SELECT * FROM db_name', [], db('alt')));

        db_query('INSERT INTO db_name VALUES ("foobar")', [], db('alt'));
        $this->assertEquals([['name' => 'foobar']], db_query('SELECT * FROM db_name', [], db('alt')));
        db_query('DELETE FROM db_name WHERE name = :param', [ ':param' => 'foobar' ], db('alt'));
        $this->assertEquals([], db_query('SELECT * FROM db_name', [], db('alt')));

    }
}
