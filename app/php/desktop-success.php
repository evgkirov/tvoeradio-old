<?php
include_once 'desktop-common.php';
// http://saydanke.ru/tvoeradio/app.html?api_url=http://api.vkontakte.ru/api.php&api_id=1832282&api_settings=777&viewer_id=117431&viewer_type=2&user_id=117431&group_id=0&is_app_user=1
// &auth_key=da9a7db4edd1c7825243948a5e70775c&language=0&parent_language=0&referrer=menu&lc_name=ade38fca
?>
<script type="text/javascript">
var hash = eval(unescape(window.location.hash.substring(1)));
var url = '../app.html?';
url += 'api_url=http://api.vkontakte.ru/api.php&';
url += 'api_id=<?=$settings['api_id']?>&';
url += 'api_settings=<?=$settings['api_settings']?>&';
url += 'viewer_id='+hash.mid+'&';
url += 'viewer_type=2&'; 
url += 'user_id='+hash.mid+'&'; 
url += 'group_id=0&';
url += 'is_app_user=1&';
url += 'auth_key='+hash.sid+'&';
url += 'language=0&';
url += 'desktop_mode=1&';
url += 'desktop_version=<?=$_GET['v']?>&';

window.location = url;
</script>
