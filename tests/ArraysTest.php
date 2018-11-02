<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/arrays.php';

use PHPUnit\Framework\TestCase;

final class ArraysTest extends TestCase
{
    public function testArrayGet(): void {
        $empty = [];
        $this->assertEquals( array_get( $empty, '0' ), NULL );
        $this->assertEquals( array_get( $empty, '0.a', 123 ), 123 );

        $indexed = [ 1, 2, [ 3 ] ];
        $this->assertEquals( array_get( $indexed, '0' ), 1 );
        $this->assertEquals( array_get( $indexed, 1 ), 2 );
        $this->assertEquals( array_get( $indexed, 2 ), [ 3 ] );
        $this->assertEquals( array_get( $indexed, '2.0' ), 3 );

        $assoc = [ 'a' => 'A', 'b' => 2, 'c' => [ 'd' => 3 ] ];
        $this->assertEquals( array_get( $assoc, 'a' ), 'A' );
        $this->assertEquals( array_get( $assoc, 'b' ), 2 );
        $this->assertEquals( array_get( $assoc, 'c' ), [ 'd' => 3 ] );
        $this->assertEquals( array_get( $assoc, 'c.d' ), 3 );

        $mixed = [ 'A', 'b' => 2, 'c' => [ 3 ] ];
        $this->assertEquals( array_get( $mixed, 0 ), 'A' );
        $this->assertEquals( array_get( $mixed, 'b' ), 2 );
        $this->assertEquals( array_get( $mixed, 'c' ), [ 3 ] );
        $this->assertEquals( array_get( $mixed, 'c.0' ), 3 );
    }

    public function testArraySet(): void {
        $arr = [];

        array_set( $arr, 0, 'A' );
        $this->assertEquals( $arr, [ 'A' ] );

        array_set( $arr, 0, 'B' );
        $this->assertEquals( $arr, [ 'B' ] );

        array_set( $arr, 'A.1', 'C' );
        $this->assertEquals( $arr, [ 'B', 'A' => [ 1 => 'C' ] ] );

        array_set( $arr, '0.0', 'D' );
        $this->assertEquals( $arr, [ [ 'D' ], 'A' => [ 1 => 'C' ] ] );
    }
}

