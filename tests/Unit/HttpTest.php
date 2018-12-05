<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/http.php';

use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Vortex\App;
use Vortex\Exceptions\HttpException;

final class HttpTest extends TestCase
{
    private function mockRequest($path, array $options = []) {
        $def_options = [
            'method' => 'GET',
            'server_name' => 'vortex.com',
            'is_https' => false,
            'script_name' => '/index.php',
            'params' => [],
            'proxy_list' => '',
            'client_ip' => '192.168.0.1',
        ];
        $options = array_merge($def_options, $options);
        $request = Request::create($path, $options['method'], $options['params']);
        $request->server->set('SERVER_NAME', $options['server_name']);
        $request->server->set('SCRIPT_NAME', $options['script_name']);
        $request->server->set('HTTPS', $options['is_https'] ? null : 'off');
        $request->server->set('REMOTE_ADDR', $options['client_ip']);
        if ($options['proxy_list']) {
            $request->headers->set('X-Forwarded-For', $options['proxy_list']);
        }
        $app = new App([], [], $request);
        App::setInstance($app);
    }

    public function teardown() {
        App::clearInstance();
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testBasePathAtDocumentRoot(): void {
        $this->mockRequest('/');
        $this->assertEquals('/', base_path());
        $this->mockRequest('/foo');
        $this->assertEquals('/', base_path());
        $this->mockRequest('/foo/bar');
        $this->assertEquals('/', base_path());
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testBasePathNotAtDocumentRoot(): void {
        $this->mockRequest('/', [ 'script_name' => '/foo/bar/index.php' ] );
        $this->assertEquals('/foo/bar/', base_path());
        $this->mockRequest('/biz', [ 'script_name' => '/foo/bar/index.php' ] );
        $this->assertEquals('/foo/bar/', base_path());
        $this->mockRequest('/biz/baz', [ 'script_name' => '/foo/bar/index.php' ] );
        $this->assertEquals('/foo/bar/', base_path());
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testBaseUrlWithBasePathAtDocumentRoot(): void {
        $this->mockRequest('/');
        $this->assertEquals('http://vortex.com/', base_url());

        $this->mockRequest('/', [ 'is_https' => true ]);
        $this->assertEquals('https://vortex.com/', base_url());

        $this->mockRequest('/', [ 'server_name' => 'example.com' ]);
        $this->assertEquals('http://example.com/', base_url());

        $this->mockRequest('/', [ 'is_https' => true, 'server_name' => 'example.com' ]);
        $this->assertEquals('https://example.com/', base_url());
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testBaseUrlWithBasePathNotAtDocumentRoot(): void {
        $this->mockRequest('/', [ 'script_name' => '/foo/bar/index.php' ] );
        $this->assertEquals('http://vortex.com/foo/bar/', base_url());

        $this->mockRequest('/', [ 'script_name' => '/foo/bar/index.php', 'is_https' => true ]);
        $this->assertEquals('https://vortex.com/foo/bar/', base_url());

        $this->mockRequest('/', [ 'server_name' => 'example.com', 'script_name' => '/foo/bar/index.php' ]);
        $this->assertEquals('http://example.com/foo/bar/', base_url());

        $this->mockRequest('/', [ 'is_https' => true, 'server_name' => 'example.com', 'script_name' => '/foo/bar/index.php' ]);
        $this->assertEquals('https://example.com/foo/bar/', base_url());

    }

    public function testRequireMethodWithAllowedMethod(): void {
        $methods = [ 'POST', 'GET', 'PUT', 'HEAD', 'DELETE' ];
        foreach ($methods as $method) {
            $this->mockRequest('/', ['method' => $method]);
            require_method($methods);
            require_method($method);
            require_method([$method, 'FOO']);
            $this->addToAssertionCount(3);
        }
    }

    public function testRequireMethodWithDisallowedMethod(): void {
        $methods = [ 'POST', 'GET', 'PUT', 'HEAD', 'DELETE' ];
        foreach ($methods as $method) {
            $this->mockRequest('/', ['method' => $method]);
            try {
                require_method('FIZZ');
                $this->fail("require_method('FIZZ') should have failed");
            } catch (HttpException $e) {
                $this->addToAssertionCount(1);
            }

            try {
                require_method(['FIZZ', 'FUZZ']);
                $this->fail("require_method(['FIZZ', 'FUZZ']) should have failed");
            } catch (HttpException $e) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function testParseCookieStr(): void {
        $this->assertEquals([], parse_cookie_str(''));
        $this->assertEquals(['name' => 'value'], parse_cookie_str('name=value'));
        $this->assertEquals(['name' => 'value', 'ab' => '<a>'], parse_cookie_str('name=value; ' . http_build_query(['ab' => '<a>'])));
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testGetUserIpNoProxy(): void {
        $this->mockRequest('/', ['client_ip' => '1.2.3.4']);
        $this->assertEquals('1.2.3.4', get_user_ip());
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testGetUserIpSingleProxy(): void {
        $this->mockRequest('/', ['proxy_list' => '2.3.4.5']);
        $this->assertEquals('2.3.4.5', get_user_ip());
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testGetUserIpMildyMalformedProxyList(): void {
        $this->mockRequest('/', ['proxy_list' => ' , ,2.3.4.5, 6.7.8.9, 1.1.2.2']);
        $this->assertEquals('2.3.4.5', get_user_ip());
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testGetUserIpCompletelyMalformedProxyList(): void {
        $this->mockRequest('/', ['proxy_list' => ',', 'client_ip' => '22.22.22.22']);
        $this->assertEquals('22.22.22.22', get_user_ip());
    }
}
