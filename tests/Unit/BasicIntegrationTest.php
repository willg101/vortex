<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;
use Vortex\Testing\TestsRequests;

final class BasicIntegrationTest extends TestCase
{
    use TestsRequests;

    public function testGetHomepage(): void {
        $this->sendRequest('/');
        $this->assertStatusCode(200);
        $this->assertResponseContains('<input name="username"  class="no-bg" placeholder="Username" type="text"/>');
    }
}

