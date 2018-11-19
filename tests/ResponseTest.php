<?php
declare(strict_types=1);

use Vortex\Response;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

final class ResponseTest extends TestCase
{
    public function testSetContentWithString(): void {
        $r1 = new Response;
        $current_headers = $r1->headers->all();
        $r1->setContent('foo');
        $this->assertEquals($r1->getContent(), 'foo');
        $this->assertEquals($current_headers, $r1->headers->all());
    }

    public function testSetContentWithNumber(): void {
        $r1 = new Response;
        $current_headers = $r1->headers->all();

        $r1->setContent(123);
        $this->assertEquals($r1->getContent(), 123);
        $this->assertEquals($current_headers, $r1->headers->all());

        $r1->setContent(1.23);
        $this->assertEquals($r1->getContent(), 1.23);
        $this->assertEquals($current_headers, $r1->headers->all());
    }

    public function testSetContentWithBool(): void {
        $r1 = new Response;
        $this->assertFalse(strpos($r1->headers->get('Content-Type',false), 'application/json') !== false);
        $r1->setContent(true);
        $this->assertEquals($r1->getContent(), 'true'); // json-encoded true
        $this->assertTrue(strpos($r1->headers->get('Content-Type',false), 'application/json') !== false);

        $r2 = new Response;
        $this->assertFalse(strpos($r2->headers->get('Content-Type',false), 'application/json') !== false);
        $r2->setContent(false);
        $this->assertEquals($r2->getContent(), 'false'); // json-encoded false
        $this->assertTrue(strpos($r2->headers->get('Content-Type',false), 'application/json') !== false);
    }

    public function testSetContentWithObject(): void {
        $r = new Response;
        $obj = new stdClass;
        $obj->foo = 'bar';
        $this->assertFalse(strpos($r->headers->get('content-type',false), 'application/json') !== false);
        $r->setContent($obj);
        $this->assertEquals($r->getContent(), '{"foo":"bar"}');
        $this->assertTrue(strpos($r->headers->get('content-type',false), 'application/json') !== false);
    }

    public function testSetContentWithArray(): void {
        $r = new Response;
        $arr = [ 1, 2, 3 ];
        $this->assertfalse(strpos($r->headers->get('content-type',false), 'application/json') !== false);
        $r->setContent($arr);
        $this->assertequals($r->getcontent(), '[1,2,3]');
        $this->asserttrue(strpos($r->headers->get('content-type',false), 'application/json') !== false);
    }

    public function testSendAndTerminate(): void {
        $autoloader = __DIR__ . '/../vendor/autoload.php';
        $response_class = Response::class;
        $test_code = <<<EOF
        require_once "$autoloader";
        use $response_class;
        \$r = new Response;
        \$r->setContent("foo");
        \$r->sendAndTerminate();
        exit(1); // Should not reach this point
EOF;
        $output = [];
        $exit_code = -1;
        exec("php -r '$test_code'", $output, $exit_code);
        $this->assertEquals(implode('\n', $output), 'foo');
        $this->assertEquals($exit_code, 0);
    }

    public function testMagicCallToExistingMethod(): void {
        $vr = new Response;
        $sr = $vr->getSymfonyResponse();
        $dt = new DateTime('2000-01-01 00:00:00');
        $sr->setExpires($dt);
        $this->assertEquals($vr->getExpires(), $sr->getExpires());
        $this->assertEquals($vr->getExpires(), $dt);
        $this->assertEquals($sr->getExpires(), $dt);
    }

    public function testMagicCallToNonexistentMethod(): void {
        $vr = new Response;
        $sr = $vr->getSymfonyResponse();
        $this->assertFalse(method_exists($sr, 'foobar'));
        $this->expectException(BadMethodCallException::class);
        $vr->foobar();
    }

    public function testMagicGet(): void {
        $vr = new Response;
        $sr = $vr->getSymfonyResponse();
        $this->assertFalse(isset($sr->foobar));
        $obj = new stdClass;
        $sr->foobar = $obj;
        $this->assertSame($vr->foobar, $obj);
    }
}
