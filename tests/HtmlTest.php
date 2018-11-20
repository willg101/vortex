<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/html.php';

use PHPUnit\Framework\TestCase;

final class HtmlTest extends TestCase
{
    public function testSanitizeTextForHtml(): void {
        $this->assertEquals('foo', sanitize_text_for_html('foo'));
        $this->assertEquals('&lt;foo&gt;&amp;bar&quot;&#039;', sanitize_text_for_html('<foo>&bar"\''));
        $this->assertEquals('&amp;lt;', sanitize_text_for_html(sanitize_text_for_html('<')));
    }

    public function testHtmlAttrs(): void {
        $this->assertEquals('', html_attrs([]));
        $this->assertEquals('foo="bar" ', html_attrs(['foo' => 'bar']));
        $this->assertEquals('foo="bar" biz="baz[&quot;fuzz&quot;]" ', html_attrs([
            'foo' => 'bar',
            'biz' => 'baz["fuzz"]',
        ]));
        $this->assertEquals('foo="bar baz" biz="fizz &quot;fuzz&quot;" attr="val" ', html_attrs([
            'foo'  => [ 'bar', 'baz' ],
            'biz'  => [ 'fizz', '"fuzz"' ],
            'attr' => 'val',
        ]));
    }
}
