<?php 

header('Content-type: text/plain');
header('Access-Control-Allow-Origin: *');

$params = '';
foreach ($_GET as $k=>$v) {
	$params .= $k.'='.urlencode($v).'&';
}
