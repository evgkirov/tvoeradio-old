#!/usr/bin/env python
# -*- coding: utf-8 -*-

import hashlib

params = {
    'method': 'getAds',
    'api_id': '1832282',
    'v': '2.0',
    'count': '20',
    'format': 'json',
    'min_price': '10'
}

params = {
	'api_id': '1832282',
	'callback': 'vk_api_parseJSON',
	'format': 'json',
	'method': 'audio.search',
	'q': 'Alice in Chains Down in a Hole',
	'sort': '0',
	'v': '2.0'
}

keys = params.keys()
keys.sort()

sig = '117431'
sig = '1671227'

for key in keys:
    sig += key+'='+params[key]

sig += 'rlh7nKUmRE'
sig = hashlib.md5(sig).hexdigest()

params['sig'] = sig
url = 'http://api.vkontakte.ru/api.php?'
for key in params.iterkeys():
    url += key+'='+params[key]+'&'
    
print url[:-1]
