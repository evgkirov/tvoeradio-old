<?php
$settings['api_id'] = 1832282;
$settings['api_settings'] = 8;
$settings['base_url'] = 'http://'.$_SERVER['SERVER_NAME'].dirname($_SERVER['REQUEST_URI']).'/';
$settings['success_url'] = $settings['base_url'].'desktop-success.php?v='.$_GET['v'];
$settings['fail_url'] = $settings['base_url'].'desktop-fail.html';

