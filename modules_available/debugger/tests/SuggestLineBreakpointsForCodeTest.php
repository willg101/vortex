<?php
declare(strict_types=1);

require_once __DIR__ . '/../hooks.php';

use Vortex\Response;
use Vortex\SendAndTerminateException;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

final class SuggestLineBreakpointsForCodeTest extends TestCase
{
    protected function assertBreakpoints($code) {
        $actual = get_line_breakpoint_candidates_for_code($code);
        sort($actual); // We sort these because our array of expected lines will be in sorted order
                       // and we want to verify the values in the two arrays are the same; order
                       // is meaningless in this context.

        $expected = [];
        foreach (explode("\n", $code) as $line_n => $line_content) {
            if (preg_match('#//\s*Break\s*$#i', $line_content)) {
                $expected[] = $line_n + 1;
            }
        }

        $this->assertEquals($expected, $actual);
    }
    public function testEmpty(): void {
        $this->assertBreakpoints(''); # No code at all
        $this->assertBreakpoints('<!DOCTYPE html><html><body></body></html>'); # No PHP code
        $this->assertBreakpoints('<?php '); # PHP opening tag, but no PHP code
        $this->assertBreakpoints('<?php
            /**
             * Foobar
             */'); # PHP opening tag and comments, but no breakable statements
    }

    public function testForLoop(): void {
        // Xdebug breaks on the first init and condition statement of a for loop; it does not break
        // on the loop incrementor statement
       $this->assertBreakpoints('<?php
            for
                (
                    $i = 0, // Break
                    $j = 0,
                    foo();
                    $i < 5, // Break
                    $j < 2,
                    foo();
                    $i++,
                    $j++
                )
                {}');
    }

    public function testForeachLoop(): void {
        // Xdebug breaks on the "as" of foreach statements; PhpParser doesn't tell us which line
        // the "as" is on. So, we can only infer its location when the iterated value and loop
        // variable are on the same line.
        $this->assertBreakpoints('<?php
            foreach ( $a as $b ) // Break
            {}');

        $this->assertBreakpoints('<?php
            foreach ( $a as $b => $c ) // Break
            {}');
    }

    public function testIf(): void {
        // Xdebug breaks on the opening brace before an if-statement's body. We don't have this
        // exact information available to us, but we can make an educated guess that the location
        // of the opening brace is the line immediately preceding the first expression in the
        // body (this implicitly requires there *to be* expressions in the if-statement's body)
        $this->assertBreakpoints('<?php
            if ($a == $b)
            {             // Break
                $x = 1;   // Break
            }');

        $this->assertBreakpoints('<?php
            if (foo() == $b)
            {                // Break
                $x = 1;      // Break
            }');

        $this->assertBreakpoints('<?php
            if ($a == $b) { // Break
                $x = 1;     // Break
            }');

        $this->assertBreakpoints('<?php
            if (foo()
                    == $b)
            {               // Break
                $x = 1;     // Break
            }');

        $this->assertBreakpoints('<?php
            if (foo()
                    == $b) { // Break
                $x = 1;      // Break
            }');
    }

    public function testWhile(): void {
        $this->assertBreakpoints('<?php
            while ($x == 9)      // Break
            {
            }

            while
                ( $x == 9 )     // Break
                {
                }

            // We cannot support this form currently:
            // ======================================
            // while
            //     (
            //     $x == 9
            //     )           // <Break>
            //     {
            //     }
    ');

    }

    public function testFunctionDec(): void {
        $this->assertBreakpoints('<?php
            function foobar() // Break
            {
            }

            function
                   bizbaz     // Break
                   ()
                   {}');
    }

    public function testFunctionCalls(): void {
        $this->assertBreakpoints('<?php
            foobar();           // Break
            foobar(             // Break
                $a,
                [ $b ] );

            Bizbaz::foobar();   // Break
            Bizbaz::
                   foobar();    // Break
            Bizbaz::foobar(     // Break
                $a,
                [ $b ] );
            Bizbaz::
                   foobar(      // Break
                      $a,
                      [ $b ] );

            $fuzz->foobar();    // Break
            $fuzz
                 ->foobar();    // Break
            $fuzz->foobar(      // Break
                $a,
                [ $b ] );
            $fuzz->
                   foobar(      // Break
                      $a,
                      [ $b ] );');
    }

    public function testStatementsThatBreakAtEnd(): void {
        $this->assertBreakpoints('<?php
            return 5;                   // Break
            return
                5
                ;                       // Break
            return

                ;                       // Break
            
            return $x=5;                // Break
            return
                $x = 
                5
                ;                       // Break');

        $this->assertBreakpoints('<?php
            break 5;                    // Break
            break
                5
                ;                       // Break
            break

                ;                       // Break');

        $this->assertBreakpoints('<?php
            $t =& $a;                   // Break
            $t =&
                $b
                ;                       // Break');

        $this->assertBreakpoints('<?php
            $t = 0;                     // Break
            $t =
                0
                ;                       // Break');

        $this->assertBreakpoints('<?php
            $t *= 0;                    // Break
            $t
                *=
                0;                      // Break');

        $this->assertBreakpoints('<?php
            $t++;                       // Break
            $t
                ++
                ;                       // Break

            $t--;                       // Break
            $t
                --
                ;                       // Break

            ++$t;                       // Break
            ++
                $t
                ;                       // Break

            --$t;                       // Break
            --
                $t
                ;                       // Break');

        $this->assertBreakpoints('<?php
            include "foo_bar.php";      // Break
            include
                "foo_bar.php"
                ;                       // Break

            include_once "foo_bar.php"; // Break
            include_once
                "foo_bar.php"
                ;                       // Break

            require "foo_bar.php";      // Break
            require
                "foo_bar.php"
                ;                       // Break

            require_once "foo_bar.php"; // Break
            require_once
                "foo_bar.php"
                ;                       // Break
            ');
    }
}
