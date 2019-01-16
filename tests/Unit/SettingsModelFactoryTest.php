<?php
declare(strict_types=1);

require_once __DIR__ . '/../../includes/files.php';

use Vortex\SettingsModelFactory;
use PHPUnit\Framework\TestCase;

final class SettingsModelFactoryTest extends TestCase
{
    public function testLoadEmptySettings(): void {
        if (!defined('DPOH_ROOT')) {
            define('DPOH_ROOT', dirname(__DIR__));
        }
        $settings_file = exec('mktemp --suffix=.ini');
        $settings_model = SettingsModelFactory::create($settings_file);
        $settings_array = $settings_model->get();
        $expected_settings = [
            'allowed_directories' => [],
            'less_variables' => [
                'defaults' =>  "~'" . DPOH_ROOT . "/less/defaults'",
            ],
        ];
        $this->assertEquals($expected_settings, $settings_array);
    }

    public function testLoadPopulatedSettings(): void {
        if (!defined('DPOH_ROOT')) {
            define('DPOH_ROOT', dirname(__DIR__));
        }
        $settings_file = exec('mktemp --suffix=.ini');
        file_put_contents($settings_file, "allowed_directories[] = ./\nlorem = ipsum");
        $settings_model = SettingsModelFactory::create($settings_file);
        $settings_array = $settings_model->get();
        $expected_settings = [
            'allowed_directories' => [ getcwd() ],
            'less_variables' => [
                'defaults' =>  "~'" . DPOH_ROOT . "/less/defaults'",
            ],
            'lorem' => 'ipsum'
        ];
        $this->assertEquals($expected_settings, $settings_array);
    }

    public function testLoadSettingsThrowsForDir(): void {
        $settings_file = exec('mktemp -d --suffix=.ini');
        $this->expectException(InvalidArgumentException::class);
        $settings_model = SettingsModelFactory::create($settings_file);
    }

    public function testLoadSettingsThrowsForUnreadableFile(): void {
        $settings_file = exec('mktemp --suffix=.ini');
        exec('chmod 600 ' . escapeshellarg($settings_file));
        $this->expectException(InvalidArgumentException::class);
        // Become a non-root user
        posix_setuid(1);
        $settings_model = SettingsModelFactory::create($settings_file);
        posix_setuid(0);
    }

    public function testLoadSettingsThrowsForWrongFormat(): void {
        $settings_file = exec('mktemp --suffix=.abc');
        $this->expectException(InvalidArgumentException::class);
        $settings_model = SettingsModelFactory::create($settings_file);
    }

    public function testLoadSettingsThrowsWhenParseFails(): void {
        $settings_file = exec('mktemp --suffix=.ini');
        file_put_contents($settings_file, '{"a":"b"}');
        $this->expectException(UnexpectedValueException::class);
        $settings_model = SettingsModelFactory::create($settings_file);
    }
}
