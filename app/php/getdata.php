<?php

function getdata($url) {
	header('Content-type: text/plain');
	header('Access-Control-Allow-Origin: *');
	$ch = curl_init();

	if ($_SERVER['REQUEST_METHOD']=='POST') {
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents("php://input"));
		//print_r($HTTP_RAW_POST_DATA);
	} else {
		$url .= '?'.$_SERVER['QUERY_STRING'];
	}
	curl_setopt($ch, CURLOPT_URL,$url);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER,true);
	
	
	return curl_exec($ch);
}
