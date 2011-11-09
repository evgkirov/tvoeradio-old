<?php
include_once 'desktop-common.php';
$url = 'http://vkontakte.ru/login.php';
$url .= '?app='.$settings['api_id'];
$url .= '&layout=popup';
$url .= '&type=browser';
$url .= '&success_url='.urlencode($settings['success_url']);
$url .= '&fail_url='.urlencode($settings['fail_url']);
$url .= '&settings='.$settings['api_settings'];

/*if (($_GET['v']=='0.1')||($_GET['v']=='0.2')) {
	$url = $settings['base_url'].'desktop-update.html';
}*/

header("Location: $url");

