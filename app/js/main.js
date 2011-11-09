// Codename "Loud Player"
var ver = '0.9.4a';

/* ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ******************************************************/


/**
 * Объект VK API.
 * @see vk_api
 * @var Object
 */
var vk;

/**
 * Текущий трек.
 * @var Object
 */
var current_track = {
	title: '',
	artist: '',
	vk_title: '',
	vk_artist: '',
	vk_aid: '',
	vk_oid: '',
	album_cover: '',
	album_name: '',
	album_artist: '',
	artist_bio: '',
	artist_photo: '',
	artist_link: '',
	tags: [],
	similar_artists: [],
	url: '',
	duration: 0,
	lyrics: '',
	started: 0
};

/**
 * Текущая станция.
 * @var Object
 */
var current_station = {
	type: '',
	name: ''
};


/**
 * Для получения текстов песен.
 * @var Object
 */
var song;

/**
 * Проигранные треки. Чтобы не повторялось.
 * @var Array
 */
var played_tracks = [];

/**
 * Количество проигранных стреков.
 * @var Number
 */
var played_tracks_num = 0;


/**
 * Приложение запущено.
 * @var bool
 */
var started = false;


var google_language = 'ru';

var ads_interval;

/* КЛАССЫ *************************************************************/

/**
 * Класс для работы с Last.fm API.
 *
 * @link http://last.fm/api
 * @param Object options Настройки: адрес API, ключ и секретный ключ.
 */
var lastfm = {

	/**
	 * Адрес-URL для запросов к API.
	 * @var String
	 */
	api_url: 'http://ws.audioscrobbler.com/2.0/',

	/**
	 * Ключ API.
	 * @var String
	 */
	api_key: '5f170ff5352903d39512d907566283fc',

	/**
	 * Простой временный кэш запросов.
	 * @var Object
	 */
	cache: {},

	/**
	 * Вызов метода Last.fm API.
	 *
	 * @param String method Имя метода.
	 * @param Object params Параметры вызова.
	 * @param Function callback Функция, вызываемая после завершения запроса.
	 */
	call: function(method, params, callback) {
		var cache_key = method;
		var _this = this;
		for (var k in params) {
			cache_key += '&'+k+'='+params[k];
		}

		if (this.cache[cache_key]) {
			callback(this.cache[cache_key]);
		} else {
			callback.cache_key = cache_key;
			params.format = 'json';
			params.method = method;
			params.api_key = this.api_key;

			$.getJSON(this.api_url+'?callback=?', params, function(data){
				_this.cache[callback.cache_key] = data;
				callback(data);
			});
		}
	}
};

/**
 * Объект для скробблинга на Last.fm
 */
var scrobbler = {
	enabled: false,
	queue: [],
	sessid: null,
	login: null,
	password: null,
	failures: 0,
	handshake_url: 'http://tvoeradio.org/php/scrobbler-handshake.php',
	nowplaying_url: 'http://tvoeradio.org/php/scrobbler-nowplaying.php',
	submission_url: 'http://tvoeradio.org/php/scrobbler-submission.php',
	handshake: function(callback) {
		var timestamp = Math.round((new Date()).getTime()/1000);
		var _this = this;
		$.ajax({
			url: this.handshake_url,
			global: false,
			type: 'GET',
			dataType: 'text',
			data: {
				hs: 'true',
				p: '1.2.1',
				c: 'tvo',
				v: ver,
				u: this.login,
				t: timestamp,
				a: MD5(this.password+timestamp),
				api_key: lastfm.api_key
			},
			success: function(data) {
				$('#page_tune_tab_lastfm_login_error').hide();
				data = data.split(/\n/);
				if (data[0] == 'OK') {
					_this.sessid = data[1];
					_this.enabled = true;
					_this.failures = 0;
					$('a[rel="#page_tune_tab_lastfm"] b.tab_word').text('Last.fm ['+_this.login+']');
					$('#page_tune_tab_lastfm_login').hide();
					$('#page_tune_tab_lastfm_profile').show();
					$('#page_tune_tab_lastfm_profile strong').text(_this.login);
					lastfm.call('user.getTopArtists', {user:_this.login,period:'12month'}, function(data) {
						var html = '';
						for (var i in data.topartists.artist) {
							if (i==25) break;
							html += '<li><a href="javascript:start_radio_artist(\''+data.topartists.artist[i].name+'\')">'+data.topartists.artist[i].name+'</a></li>';
						}
						$('#page_tune_tab_lastfm_artists').html(html);
						fit();
					});
					fit();
					_this.enabled = true;
					if (callback) callback(data);
				} else {
					_this.enabled = false;
					if (data[0] == 'BADAUTH') {
						$('a[rel="#page_tune_tab_lastfm"] b.tab_word').text('Last.fm');
						$('#page_tune_tab_lastfm_login').show();
						$('#page_tune_tab_lastfm_login_error').show();
						$('#page_tune_tab_lastfm_profile').hide();
						fit();
					} else {
						setTimeout(_this.handshake, 60000, callback);
					}
				}
			}
		});
	},
	nowplaying: function(track) {
		var _this = this;
		if (this.enabled) {
			if (this.sessid) {
				$.ajax({
					url: this.nowplaying_url,
					global: false,
					type: 'POST',
					dataType: 'text',
					data: {
						s: this.sessid,
						a: track.artist,
						t: track.title,
						l: track.duration
					},
					success: function(data) {
						if (data.match('BADSESSION')) {
							_this.sessid = null;
							_this.handshake();
						}
					}
				});
			} else {
				this.handshake(function(){
					_this.nowplaying(track);
				});
			}
		}
	},
	submission: function(track) {
		var _this = this;
		if (this.enabled) {
			if (track.duration>30) {
				this.queue.push({
					artist: track.artist,
					title: track.title,
					started: track.started,
					duration: track.duration,
					album_name: track.album_name
				});
			}
			if (this.queue.length) {
				var po = {
					s: this.sessid
				}
				for (var i in this.queue) {
					po['a['+i+']'] = this.queue[i].artist;
					po['t['+i+']'] = this.queue[i].title;
					po['i['+i+']'] = this.queue[i].started;
					po['o['+i+']'] = 'P';
					po['r['+i+']'] = '';
					po['l['+i+']'] = this.queue[i].duration;
					po['b['+i+']'] = this.queue[i].album_name;
					po['n['+i+']'] = '';
					po['m['+i+']'] = '';
				}
				$.ajax({
					url: this.submission_url,
					global: false,
					type: 'POST',
					dataType: 'text',
					data: po,
					success: function(data) {
						if (data.match('BADSESSION')) {
							_this.sessid = null;
							_this.handshake();
						} else if (data.match('OK')) {
							_this.queue = [];
						} else {
							_this.failures++;
							if (_this.failures>3) {
								_this.handshake();
							}
						}
					}
				});
			}
		}
	}
};

/**
 * Объект для работы с избранными радиостанциями.
 */
var favorites = {

	/**
	 * ID переменной VK API, с которой начинается диапазон с избранным.
	 * @var Number
	 */
	start: 1400,

	/**
	 * Список избранных станций.
	 *
	 * Представляет собой список хэшей с ключами type (тип радоистанции,
	 * tag либо artist) и name (имя, название исполнителя или тега),
	 * а также time - время добавления станции в избранное.
	 *
	 * @var Array
	 */
	items: [],

	/**
	 * Разделитель частей переменных.
	 *
	 * @var String
	 */
	delim: '\t::\t',

	/**
	 * Ищет первую незанятую ячейку в избранном.
	 *
	 * @return Number Номер первой незанятой ячейки в списке (0..31)
	 *                либо Infinity если всё занято.
	 */
	get_first_empty: function() {
		for (var k=0; k<this.items.length; k++) {
			if (!this.items[k]) {
				return k;
			}
		}
		return Infinity;
	},

	/**
	 * Обновляет список (HTML) избранных станций.
	 */
	update_list: function() {
		var html = '';
		var f = {};
		for (var k=0; k<this.items.length; k++) {
			var v = this.items[k];
			if (v) {
				f[v.time] = k;
			}
		}
		f = sortByKey(f);
		for (var k in f) {
			var v = this.items[f[k]];
			if (v.type=='audio') {
				var name = v.name.split('\t;;\t');
				var params = '\''+addslashes(name[0])+'\',\''+addslashes(name[1])+'\'';
			} else {
				var params = '\''+addslashes(v.name)+'\'';
			}
			html += '<li><a href="javascript:start_radio_'+v.type+'('+params+')">'+get_station_html(v.type, v.name)+'</a></li>';
		}
		if (html=='') {
			$('#page_tune_tab_favorites_none').show();
			$('#page_tune_tab_favorites_container').hide();
		} else {
			$('#page_tune_tab_favorites_container ul').html(html);
			$('#page_tune_tab_favorites_none').hide();
			$('#page_tune_tab_favorites_container').show();
		}

		fit();
	},

	/**
	 * Обновляет панель навигации на странице прослушивания.
	 *
	 * Показывает и скрывает кнопки добавить/удалить избранное.
	 */
	update_listen_nav: function() {
		var c = this.find_current();
		if (c!==false) {
			$('#page_listen_nav_fav_rem').show();
			$('#page_listen_nav_fav_add').hide();
		} else {
			$('#page_listen_nav_fav_rem').hide();
			$('#page_listen_nav_fav_add').show();
		}
	},

	/**
	 * Ищет станцию в избранном.
	 *
	 * @param String type Тип станции (tag или artist).
	 * @param String name Название станции.
	 * @return Number Номер станции массиве в items.
	 * @return Boolean false если не найдено.
	 */
	find: function(type, name) {
		for (var k=0; k<32; k++) {
			if (this.items[k]) {
				if ((this.items[k].type==type)&&(this.items[k].name==name)) {
					return k;
				}
			}
		}
		return false;
	},

	/**
	 * Ищет текущую станцию в избранном.
	 *
	 * @see this.find
	 */
	find_current: function() {
		return this.find(current_station.type, current_station.name);
	},

	/**
	 * Добавляет станцию в избранное.
	 *
	 * @param String type Тип станции (tag или artist).
	 * @param String name Название станции.
	 */
	add: function(type, name) {
		var k = this.get_first_empty();
		if (k==Infinity) {
			msg('Невозможно добавить станцию в любимые: вы достигли лимита в 32 станции. Удалите одну или несколько станций и попробуйте снова.');
		} else {
			show_loader();
			var d = new Date();
			var unixtime_ms = d.getTime();
			var unixtime = parseInt(unixtime_ms / 1000);
			this.items[k] = {
				'type': type,
				'name': name,
				'time': unixtime
			}
			vk.call('putVariable', {'key': k+this.start, 'value': unixtime+this.delim+type+this.delim+name }, function(data){
				hide_loader();
			});
			this.update_list();
			this.update_listen_nav();
		}
	},

	/**
	 * Добавляет текущую станцию в избранное.
	 */
	add_current: function() {
		this.add(current_station.type, current_station.name);
	},

	/**
	 * Удаляет станцию из избранного.
	 *
	 * @param String type Тип станции (tag или artist).
	 * @param String name Название станции.
	 */
	remove: function(type, name) {
		show_loader();
		var k = this.find(type, name);
		this.items[k] = null;
		vk.call('putVariable', {'key': k+this.start, 'value': '' }, function(data){
			hide_loader();
		});
		this.update_list();
		this.update_listen_nav();
	},

	/**
	 * Удаляет текущую станцию из избранного.
	 */
	remove_current: function() {
		this.remove(current_station.type, current_station.name);
	},

	/**
	 * Удаляет станцию из избранного по её номеру.
	 *
	 * @param Number k Номер станции в списке this.items
	 */
	remove_by_id: function(k) {
		show_loader();
		this.items[k] = null;
		vk.call('putVariable', {'key': k+this.start, 'value': '' }, function(data){
			hide_loader();
		});
		this.update_list();
		this.update_listen_nav();
	}

};

/**
 * Класс для работы с аудиозаписями на странице пользователя.
 */
var user_audios = {

	/**
	 * Список аудио на странице пользователя.
	 *
	 * @var Array
	 */
	items: [],

	update_list: function() {
		var html = '';
		for (var i in this.items) {
			html += '<li><a href="javascript:start_radio_audio(\''+this.items[i].artist+'\',\''+addslashes($.trim(this.items[i].title))+'\')">'+$.trim(this.items[i].artist)+' — '+this.items[i].title+'</a></li>';
		}
		if (html=='') {
			$('#page_tune_tab_audio_none').show();
			$('#page_tune_tab_audio_container').hide();
		} else {
			$('#page_tune_tab_audio_container ul.listing').html(html);
			$('#page_tune_tab_audio_none').hide();
			$('#page_tune_tab_audio_container').show();
		}
		fit();
	},

	/**
	 * Добавляет текущий трек на страницу пользователя.
	 */
	add_current: function() {
		show_loader();
		this.items.push({'artist': current_track.vk_artist, 'title': current_track.vk_title});
		vk.call('audio.add', { 'aid': current_track.vk_aid, 'oid': current_track.vk_oid }, function(data){
			hide_loader();
		});
		this.update_list();
	},

	/**
	 * Ищет, есть ли текущий трек у пользователя.
	 *
	 * @return Integer Номер трека в массиве this.items
	 * @return Boolean false если не найдено.
	 */
	find_current: function() {
		for (var i in this.items) {
			if ((this.items[i].artist==current_track.vk_artist)&&(this.items[i].title==current_track.vk_title)) {
				return i;
			}
		}
		return false;
	}

}


/* ОБЩИЕ ФУНКЦИИ ******************************************************/

/**
 * Записывает событие в лог.
 *
 * @param String text Текст события.
 * @param Number type Тип события (0 - информация - по умолчанию, 1 - ошибка).
 */
function log(text, type) {
	var type_txt;
	switch (type) {
		case 0:
		case undefined: type_txt='ИНФО'; break;
		case 1: type_txt='ОШИБКА'; break;
		default: type_txt='ИНФО';
	}
	var d = new Date();
	var dH=''+d.getHours();dH=dH.length<2?'0'+dH:dH;
	var dM=''+d.getMinutes();dM=dM.length<2?'0'+dM:dM;
	var dS=''+d.getSeconds();dS=dS.length<2?'0'+dS:dS;
	text = '['+dH+':'+dM+':'+dS+'] '+type_txt+': '+text;
	if ($('#log').text()) text = '\n'+text;
	$('#log').append(text);
	$('#log').scrollTop(99999);
}

/**
 * Показывает или скрывает лог.
 */
function toggle_log() {
	$('#log').toggle();
	$('#log').scrollTop(99999);
	fit();
}

/**
 * Показывает пользователю сообщение.
 *
 * @param String text Текст сообщения
 */
function msg(text) {
	alert(text);
}

/**
 * Выбирает случайный элемент из массива.
 *
 * @param Array arr Массив для выбора из.
 * @param Number max Из скольки первых элементов выбирать.
 * @return mixed Случайный элемент.
 */
function choice(arr, max) {

	if (arr.length) {

		if ((!max)||(arr.length<max)) {
			max = arr.length;
		}

		return arr[Math.floor(Math.random()*max)];
	}

	return arr;
}

/**
 * Выбирает случайный похожий трек или исполнителя.
 *
 * @param Array arr Массив объектов для выбора из. Обязателен ключ match.
 * @return Object Случайный элемент.
 */
function choice_similar(arr) {
	var sim = [];
	// Выбираем только похожие
	for (var i in arr) {
		if (parseFloat(arr[i].match)>0.5) {
			sim.push(arr[i]);
		}
	}
	if (sim.length<10) {
		// Если таких мало, выбираем из 10 первых
		return choice(arr, 10);
	} else {
		// Иначе — из всех похожих
		return choice(sim);
	}
}

/**
 * Sort key-value pairs in objects by alphaber in ascending order.
 *
 * @param Object obj Object which keys to sort.
 * @return Object Object with the same set key-value pairs as 'obj' but
 *                sorted in ascending order.
 */
function sortByKey(obj) {

	//make Array from object keys
	var keys = new Array();
	for (var k in obj) {
		keys.push(k);
	}

	//sort Array
	keys.sort();

	//form new object with keys sorted alphabetically
	var sortedObj = {};
	for (var i = 0; i < keys.length; i++) {
		sortedObj[keys[i]] = obj[keys[i]];
	}

	return sortedObj;
}

/**
 * Добавляет экранирующие символы перед кавычками и апострофами.
 *
 * @link http://phpjs.org/functions/addslashes
 * @param String str Строка для экранирования.
 * @return String Экранированная строка.
 */
function addslashes(str) {
    //return (str+'').replace(/([\\"'(&#39;)])/g, "\\$1").replace(/\u0000/g, "\\0");
	str = str.replace('\'', '\\\'');
	str = str.replace('\"', '\\\"');
	str = str.replace('&#39;', '\\\'');
	return str;
}


/**
 * Вырезает все или некоторые HTML-теги.
 *
 * @link http://phpjs.org/functions/strip_tags
 * @param String str Исходная строка.
 * @param Array allowed_tags Разрешённые теги.
 * @return Строка без тегов.
 */
function strip_tags(str, allowed_tags) {

    var key = '', allowed = false;
    var matches = [];
    var allowed_array = [];
    var allowed_tag = '';
    var i = 0;
    var k = '';
    var html = '';

    var replacer = function (search, replace, str) {
        return str.split(search).join(replace);
    };

    // Build allowes tags associative array
    if (allowed_tags) {
        allowed_array = allowed_tags.match(/([a-zA-Z0-9]+)/gi);
    }

    str += '';

    // Match tags
    matches = str.match(/(<\/?[\S][^>]*>)/gi);

    // Go through all HTML tags
    for (key in matches) {
        if (isNaN(key)) {
            // IE7 Hack
            continue;
        }

        // Save HTML tag
        html = matches[key].toString();

        // Is tag not in allowed list? Remove from str!
        allowed = false;

        // Go through all allowed tags
        for (k in allowed_array) {
            // Init
            allowed_tag = allowed_array[k];
            i = -1;

            if (i != 0) { i = html.toLowerCase().indexOf('<'+allowed_tag+'>');}
            if (i != 0) { i = html.toLowerCase().indexOf('<'+allowed_tag+' ');}
            if (i != 0) { i = html.toLowerCase().indexOf('</'+allowed_tag)   ;}

            // Determine
            if (i == 0) {
                allowed = true;
                break;
            }
        }

        if (!allowed) {
            str = replacer(html, "", str); // Custom replace. No regexing
        }
    }

    return str;
}

/**
 * Сравнение строк по алгоритму Левенштейна.
 *
 * @link http://phpjs.org/functions/levenshtein
 * @param String s1 Первая строка для сравнения.
 * @param String s2 Вторая строка для сравнения.
 * @return Number Дистанция между строками.
 */
function levenshtein (s1, s2) {
    if (s1 == s2) {
        return 0;
    }
    var s1_len = s1.length;
    var s2_len = s2.length;
    if (s1_len === 0) {
        return s2_len;
    }
    if (s2_len === 0) {
        return s1_len;
    }

    // BEGIN STATIC
    var split = false;
    try{
        split=!('0')[0];
    } catch (e){
        split=true; // Earlier IE may not support access by string index
    }
    // END STATIC
    if (split){
        s1 = s1.split('');
        s2 = s2.split('');
    }

    var v0 = new Array(s1_len+1);
    var v1 = new Array(s1_len+1);

    var s1_idx=0, s2_idx=0, cost=0;
    for (s1_idx=0; s1_idx<s1_len+1; s1_idx++) {
        v0[s1_idx] = s1_idx;
    }
    var char_s1='', char_s2='';
    for (s2_idx=1; s2_idx<=s2_len; s2_idx++) {
        v1[0] = s2_idx;
        char_s2 = s2[s2_idx - 1];

        for (s1_idx=0; s1_idx<s1_len;s1_idx++) {
            char_s1 = s1[s1_idx];
            cost = (char_s1 == char_s2) ? 0 : 1;
            var m_min = v0[s1_idx+1] + 1;
            var b = v1[s1_idx] + 1;
            var c = v0[s1_idx] + cost;
            if (b < m_min) {
                m_min = b; }
            if (c < m_min) {
                m_min = c; }
            v1[s1_idx+1] = m_min;
        }
        var v_tmp = v0;
        v0 = v1;
        v1 = v_tmp;
    }
    return v0[s1_len];
}

/**
 * Get cookie.
 *
 * @param String name Name of cookie variable to get.
 * @return String Value of the variable we get.
 */
function getcookie(name) {

    //get all variables stored in the cookie
    var aCookie = document.cookie.split(';');

    //search variable we need
    for (var i = 0; i < aCookie.length; i++) {

        //remove spaces
        while(aCookie[i][0] == ' ') {
            aCookie[i] = aCookie[i].substr(1);
        }

        //get array [name, value]
        var aCrumb = aCookie[i].split('=');

        //if name is the same we are looking for, then return it
        if (name == aCrumb[0]) {
            return unescape(aCrumb[1]);
        }
    }

    //no variable with given name found
    return null;
}

/**
 * Set cookie with given name and value.
 *
 * @param String name Name of cookie variable.
 * @param String value Value of variable.
 * @param String expires Number of seconds cookie will be alive.
 * @param String path Server path to reduce visibility scope.
 * @param String domain Domain name for cookie.
 * @param String secure Secure.
 */
function setcookie(name, value, expires, path, domain, secure) {

    //define expires time
    var today = new Date();
    var expires_date = new Date(today.getTime() + (expires * 1000));

    //set cookie
    document.cookie =
            name + '=' + escape(value) +
            (expires ? ';expires=' + expires_date.toUTCString() : '') +
            (path    ? ';path=' + path : '' ) +
            (domain  ? ';domain=' + domain : '' ) +
            (secure  ? ';secure' : '' );
}

/**
 * Delete cookie. Use exactly the same parameters you used while cookie
 * creation.
 *
 * @param String name Name of cookie variable.
 * @param String path Server path.
 * @param String domain Domain name for cookie.
 */
function deletecookie(name, path, domain) {

    //make cookie expire 1 second ago
    setcookie(name, '', -1, path, domain);
}

/**
 * Показывает индикатор загрузки в углу.
 */
function show_loader() {
	$('#loader').show();
}

/**
 * Скрывает индикатор загрузки в углу.
 */
function hide_loader() {
	$('#loader').hide();
}

/**
 * Подгоняет размер iframe-а, в котором находится приложение
 */
function fit() {
	vk.external.resizeWindow(627,$('body').height());
}

/**
 * Меняет заголовок страницы.
 */
function update_title() {
	var t1;
	if (is_on_air()) {
		t1 = current_track.artist+' — '+current_track.title+' (Твоё Радио)';
	} else {
		t1 = 'Твоё Радио';
	}
	vk.external.setTitle(t1);
	$('title').text(t1);
}

function command(cmd) {
	var r = Math.round(Math.random()*10000);
	window.location.hash = cmd+'_'+r;
}

/**
 * Переход к экранной странице.
 *
 * @param String name Имя страницы.
 */
function go_to_page(name) {
	$('.page').hide();
	$('#page_'+name).show();
	if (name=='listen') {
		favorites.update_listen_nav();
		play_track();
	} else {
		command('stopped');
		update_title();
	}
	fit();
}


/**
 * Возвращает текстовое описание станции в формате HTML.
 *
 * @param String type Тип станции (tag или artist).
 * @param String name Название станции.
 * @return String Текстовое описание станции.
 */
function get_station_html(type, name) {

	switch (type) {

		case 'artist':
			return 'похожее на <b>'+name+'</b>';

		case 'artist_exact':
			return 'только <b>'+name+'</b>';

		case 'tag':
			return 'тег <b>'+name+'</b>';

		case 'audio':
			name = name.split('\t;;\t');
			return 'песни, похожие на <b>'+name[0]+' — '+name[1]+'</b>';

		case 'library':
			return 'радио пользователя <b>'+name+'</b>';

	}

	return 'непонятно что';
}

/**
 * Возвращает текстовое описание станции в формате HTML.
 *
 * @see get_station_html
 */
function get_current_station_html() {
	return get_station_html(current_station.type, current_station.name);
}

/**
 * Обновляет полосу навигации (ту, что в самом верху).
 *
 * @param Boolean installed Установлено ли приложение пользователем.
 *                          Если опущено, идёт запрос к VK API.
 */
function update_topnav(installed) {
	var html = '';
	var vk_url = 'vkontakte.ru';
	if (vk.params.api_url=='http://api.vk.com/api.php') {
		vk_url = 'vk.com';
	}
	//html += '<a href="javascript:toggle_log()">Лог</a>';
	html += '<a href="http://'+vk_url+'/pages.php?o=-1001832282&p=%CF%EE%EC%EE%F9%FC" target="_blank">Помощь</a>';
	html += '<span class="divider">|</span><a href="http://'+vk_url+'/club16049689" target="_blank">Официальная группа</a>';
	html += '<span class="divider">|</span><a href="http://tvoeradio.reformal.ru/" target="_blank">Есть идеи? Выскажите их!</a>';

	if (!vk.params.desktop_mode) {
		html += '<span class="divider">|</span><a href="http://'+vk_url+'/pages.php?o=-1001832282&p=%D2%E2%EE%B8%20%D0%E0%E4%E8%EE%20%C4%E5%F1%EA%F2%EE%EF" target="_blank">Программа для компьютера</a>';
	} else {
		var last_desktop_ver = [0,2];
		var user_desktop_ver = vk.params.desktop_version.split('.');
		for (var i = 0; i<4; i++) {
			var u = user_desktop_ver[i] ? parseInt(user_desktop_ver[i]) : 0;
			var l = last_desktop_ver[i] ? last_desktop_ver[i] : 0;
			if (l>u) {
				html += '<span class="divider">|</span><a href="http://'+vk_url+'/pages.php?o=-1001832282&p=%D2%E2%EE%B8%20%D0%E0%E4%E8%EE%20%C4%E5%F1%EA%F2%EE%EF" target="_blank" style="color:red">Доступна новая версия!</a>';
				break;
			} else if (l<u) {
				break;
			}
		}

		installed=true;
	}
	if (installed==undefined) {
		installed = vk.params.is_app_user=="1" ? true : false;
	}
	if (installed==false) {
		html += '<span class="divider">|</span><a href="javascript:vk.external.showInstallBox()" style="color:red">Добавить приложение на мою страницу</a>';
	} else if (!vk.params.desktop_mode) {
		html += '<span class="divider">|</span><a href="javascript:vk.external.showInviteBox()">Пригласить друзей</a>';
	}
	if (vk.params.desktop_mode) {
		html += '<div style="float:right"><a href="http://'+vk_url+'/id'+vk.params.viewer_id+'" style="font-weight:bold" target="_blank" class="username"></a> (<a href="javascript:logout()">сменить</a>)</div>';
		vk.call('getProfiles', {uids:vk.params.viewer_id,fields:"first_name,last_name"}, function(data){
			$('.username').text(data.response[0].first_name+' '+data.response[0].last_name);
		});
	}
	$('#topnav').html(html);

}

/**
 * Обновляет набор кнопок на экране воспроизведения.
 *
 * В данный момент - показывает или скрывает кнопку "Добавить
 * на страницу".
 */
function update_controls() {
	$('#control_add').hide();
	var c = user_audios.find_current();
	if (c===false) {
		$('#control_add').show();
	} else {
		$('#control_add').hide();
	}
}

/**
 * Обновляет информацию о проигрываемом треке на экране воспроизведения.
 */
function update_info() {
	$('#info #title').text(current_track.title);
	$('#info #artist').text(current_track.artist);
	$('#info #album_name').text(current_track.album_name);

	if ((current_track.album_artist)&&(current_track.album_artist!=current_track.artist)) {
		$('#info #album_artist').text('('+current_track.album_artist+')');
	} else {
		$('#info #album_artist').text('');
	}

	$('#info #album_cover').attr('src', current_track.album_cover || 'img/blank.gif');


	var tags_html = [];
	for (var i in current_track.tags) {
		tags_html.push('<a href="javascript:start_radio_tag(\''+addslashes(current_track.tags[i].name)+'\')">'+current_track.tags[i].name+'</a>');
	}
	$('#info #tags').html(tags_html.length ? 'теги: '+tags_html.join(', ') : '');

	var sima_html = []
	for (var i in current_track.similar_artists) {
		var func = 'start_radio_artist';
		if (current_station.type=='artist_exact') {
			func += '_exact';
		}
		sima_html.push('<a href="javascript:'+func+'(\''+addslashes(current_track.similar_artists[i].name)+'\')">'+current_track.similar_artists[i].name+'</a>');
	}
	$('#info #similar_artists').html(sima_html.length ? 'похожие исполнители: '+sima_html.join(', ') : '');

	if (current_track.artist_bio) {
		$('#info #artist_bio').html('<h3><a href="'+current_track.artist_link+'" target="_blank">Об исполнителе</a>:</h3><br/>'+current_track.artist_bio.replace('<a ','<a target="_blank" ').replace("\n", '<br/><br/>'));
		$('#info #artist_photo').attr('src', current_track.artist_photo || 'img/blank.gif');
	} else {
		$('#info #artist_bio').html('');
		$('#info #artist_photo').attr('src', 'img/blank.gif');
	}

	if (current_track.lyrics) {
		$('#info #lyrics').html('<h3>Слова песни</h3>'+current_track.lyrics);
	} else {
		$('#info #lyrics').html('');
	}

	fit();
}


/**
 * Вход в last.fm.
 *
 * Если указаны параметры, то осуществляется вход по логину и паролю, указанному
 * в них, если нет - берутся из cookies.
 *
 * @param String login Логин.
 * @param String password Пароль в открытом виде.
 * @param Boolean temp  Временный вход (чужой компьютер)
 */
function lastfm_login(login, password, temp) {
	if (login) {
		// Вход по логину и паролю
		password = MD5(password);
		if (temp) {
			setcookie('id'+vk.params.viewer_id+'_lastfm_login', login);
			setcookie('id'+vk.params.viewer_id+'_lastfm_password', password);
		} else {
			setcookie('id'+vk.params.viewer_id+'_lastfm_login', login, 60*60*24*1000);
			setcookie('id'+vk.params.viewer_id+'_lastfm_password', password, 60*60*24*1000);
		}
	} else {
		// Берём куки
		login = getcookie('id'+vk.params.viewer_id+'_lastfm_login');
		password = getcookie('id'+vk.params.viewer_id+'_lastfm_password');
	}

	if (login) {
		scrobbler.login = login;
		scrobbler.password = password;
		scrobbler.handshake();
	}


}


/**
 * Выход из last.fm
 */
function lastfm_logout() {
	deletecookie('id'+vk.params.viewer_id+'_lastfm_login');
	deletecookie('id'+vk.params.viewer_id+'_lastfm_password');
	scrobbler.enabled = false;
	scrobbler.sessid = null;
	$('#page_tune_tab_lastfm_login').show();
	$('#page_tune_tab_lastfm_login_error').hide();
	$('#page_tune_tab_lastfm_profile').hide();
	$('a[rel="#page_tune_tab_lastfm"] b.tab_word').text('Last.fm');
	$('#page_tune_tab_lastfm_login_login').val('');
	$('#page_tune_tab_lastfm_login_password').val('');
	fit();
}


/**
 * Выйти из last.fm и ВКонтакте
 */
function logout() {
	lastfm_logout();
	command('logout');
}

/* ФУНКЦИИ ДЛЯ РАДИО **********************************************************/

/**
 * Включена ли какая-нибудь станция.
 */
function is_on_air() {
	return ($('#page_listen').css('display')!='none');
}

/**
 * Проигрывается ли трек.
 */
function is_playing() {
	return ($("#mp3player").jPlayer("getData", "diag.isPlaying"));
}

/**
 * Ищет в контакте и запускает трек, указанный в current_track.
 */
function play_track() {

	// Если трек уже играл — следующий
	for (var i in played_tracks) {
		if ((played_tracks[i].artist==current_track.artist)&&(played_tracks[i].title==current_track.title)) {
			setTimeout("play_next()", current_station.type=='artist_exact' ? 1 : 1000);
			return;
		}
	}

	played_tracks.push({ 'artist': current_track.artist, 'title': current_track.title });
	if (played_tracks.length>25) {
		played_tracks.shift();
	}

	// Если нет — играем его
	vk.call('audio.search', {'q': current_track.artist+' '+current_track.title, 'sort': 0 }, function(data){
		current_track.album_cover = '';
		current_track.artist_photo = '';
		current_track.artist_link = '';
		current_track.album_name = '';
		current_track.album_artist = '';
		current_track.tags = [];
		current_track.similar_artists = [];
		current_track.artist_bio = '';
		current_track.lyrics = '';
		// Найдено в контакте
		if (data.response[0]!='0') {


			lastfm.call('track.getInfo', {'artist': current_track.artist, 'track': current_track.title}, function(data){
				if (data.track.album) {
					current_track.album_cover = data.track.album.image[data.track.album.image.length-1]["#text"];
					current_track.album_name = data.track.album.title;
					current_track.album_artist = data.track.album.artist;

				}
				if (typeof (data.track.toptags) !='string') {
					current_track.tags = data.track.toptags.tag;
				}
				update_info();
				update_title();
				command('playing');
			});

			lastfm.call('artist.getInfo', { 'artist': current_track.artist, 'lang': 'ru' }, function(data){
				if (data.artist.similar) {
					current_track.similar_artists = data.artist.similar.artist;
				}
				if (data.artist.bio.summary) {
					current_track.artist_bio = data.artist.bio.summary;
				}
				current_track.artist_photo = data.artist.image[data.artist.image.length-1]["#text"];
				current_track.artist_link = data.artist.url;
				update_info();
			});


			// Поиск наиболее подходящего файла
			var mp3 = data.response[1];
			var best_match = Infinity;
			var durations = {};
			var best_duration = 0;
			var best_duration_num = 0;

			$.each(data.response, function(k,v){
				if (k) {
					if (durations[v.duration]) {
						durations[v.duration]++;
					} else {
						durations[v.duration] = 1;
					}
					if (durations[v.duration]>best_duration_num) {
						best_duration_num = durations[v.duration];
						best_duration = parseInt(v.duration);
					}
				}
			});

			$.each(data.response, function(k,v){
				if (k) {

					if (best_match) {
						var cur_match = 100*levenshtein(current_track.artist, v.artist)+20*levenshtein(current_track.title, v.title)+Math.abs(v.duration-best_duration);

						if (cur_match<best_match) {
							best_match = cur_match;
							mp3 = v;
						}
					}
				}
			});
			current_track.vk_aid = parseInt(mp3.aid);
			current_track.vk_oid = parseInt(mp3.owner_id);
			current_track.duration = parseInt(mp3.duration);
			current_track.vk_title = mp3.title;
			current_track.vk_artist = mp3.artist;
			update_info();
			update_controls();
			hide_loader();
			$('#control_play').hide();
			$('#control_pause').show();
			current_track.started = Math.round((new Date()).getTime()/1000);
			scrobbler.nowplaying(current_track);
			current_track.url = mp3.url;
			if (vk.params.api_url=='http://api.vk.com/api.php') {
				current_track.url = current_track.url.replace('vkontakte.ru', 'vk.com');
				
			}
			$("#mp3player").jPlayer('setFile', current_track.url).jPlayer('play');
			load_ads();
			fit();
		} else {
			// Если нет — то следующий
			setTimeout("play_next()", 1000);
		}
	});
}

/**
 * Запускает радио исполнителя.
 *
 * @param String artist Имя исполнителя.
 */
function start_radio_artist(artist) {
	played_tracks_num = 0;
	show_loader();

	lastfm.call('artist.getSimilar', { artist: artist}, function(data) {
		if (data.error) {
			if (data.error==6) {
				msg("Такого исполнителя нет.");
			}
			hide_loader();
		} else {
			data.similarartists.artist.push({name:data.similarartists['@attr'].artist, match:1});
			var sim_artist = choice_similar(data.similarartists.artist);
			current_track.artist = sim_artist.name;
			current_station.type = 'artist';
			current_station.name = data.similarartists['@attr'].artist;
			lastfm.call('artist.getTopTracks', { 'artist': sim_artist.name }, function(data) {
				var track = choice(data.toptracks.track);
				current_track.title = track.name;
				$('#page_listen_nav_station').html(get_current_station_html());
				go_to_page('listen');
			});
		}
	});


}


/**
 * Запускает песни одного исполнителя.
 *
 * @param String artist Имя исполнителя.
 */
function start_radio_artist_exact(artist) {
	played_tracks_num = 0;
	show_loader();
	current_track.artist = artist;
	current_station.type = 'artist_exact';
	current_station.name = artist;
	lastfm.call('artist.getTopTracks', { 'artist': artist }, function(data){
		if (data.error) {
			msg("Такого исполнителя нет.");
			hide_loader();
		} else {
			var track = choice(data.toptracks.track);
			current_track.title = track.name;
			current_track.artist = data.toptracks['@attr'].artist;
			$('#page_listen_nav_station').html(get_current_station_html());
			go_to_page('listen');
		}
	});




}


/**
 * Запускает радио тега.
 *
 * @param String tag Название тега.
 */
function start_radio_tag(tag) {
	played_tracks_num = 0;
	show_loader();
	current_station.type = 'tag';
	current_station.name = tag;
	// Либо из топа треков выбираем, либо из артистов
	// Рандом 20:80
	if (Math.random()>0.8) {
		lastfm.call('tag.getTopTracks', { 'tag': tag }, function(data){
			if (data.error) {
				if (data.error==6) {
					msg("Такого тега нет.");
				}
				hide_loader();
			} else {
				var track = choice(data.toptracks.track);
				current_track.title = track.name;
				current_track.artist = track.artist.name;
				$('#page_listen_nav_station').html(get_current_station_html());
				go_to_page('listen');
			}
		});
	} else {
		lastfm.call('tag.getTopArtists', { 'tag': tag }, function(data){
			if (data.error) {
				if (data.error==6) {
					msg("Такого тега нет.");
				}
				hide_loader();
			} else {
				var artist = choice(data.topartists.artist);
				lastfm.call('artist.getTopTracks', { 'artist': artist.name }, function(data){
					var track = choice(data.toptracks.track);
					current_track.title = track.name;
					current_track.artist = track.artist.name;
					$('#page_listen_nav_station').html(get_current_station_html());
					go_to_page('listen');
				});
			}
		});
	}



}


/**
 * Запускает радио похожих песен.
 *
 * @param String artist Имя исполнителя.
 * @param String title Название песни.
 */
function start_radio_audio(artist, title) {
	played_tracks_num = 0;
	show_loader();
	current_station.type = 'audio';
	current_station.name = artist+'\t;;\t'+title;
	lastfm.call('track.getSimilar', {'track': title, 'artist': artist }, function(data){
		hide_loader();
		if (typeof (data.similartracks.track) !='string') {
			var track = choice_similar(data.similartracks.track);
			current_track.title = track.name;
			current_track.artist = track.artist.name;
			$('#page_listen_nav_station').html(get_current_station_html());
			go_to_page('listen');
		} else {
			msg('Похожих песен нет.');
		}
	});


}


/**
 * Запускает радио похожих песен случайно из библиотеки пользователя.
 */
function start_radio_audio_random() {
	show_loader();
	var track = choice(user_audios.items);
	lastfm.call('track.getSimilar', {'track': $.trim(track.title), 'artist': $.trim(track.artist) }, function(data){
		hide_loader();
		if (typeof (data.similartracks.track) !='string') {
			start_radio_audio(data.similartracks['@attr'].artist, data.similartracks['@attr'].track);
		} else {
			setTimeout('start_radio_audio_random();', 1000);
		}
	});


}

/**
 * Запускает радио библиотеки
 *
 * @param String user Имя пользователя
 */
function start_radio_library(user) {
	show_loader();
	current_station.type = 'library';
	current_station.name = user;
	if (Math.random()<0.8) {
		lastfm.call('user.getTopArtists', {user:user,period:'12month'}, function(data) {
			var artist = choice(data.topartists.artist);
			lastfm.call('artist.getTopTracks', { 'artist': artist.name }, function(data){
				var track = choice(data.toptracks.track);
				current_track.title = track.name;
				current_track.artist = track.artist.name;
				$('#page_listen_nav_station').html(get_current_station_html());
				go_to_page('listen');
			});
		});
	} else {
		lastfm.call('user.getTopTracks', {user:user,period:'12month'}, function(data) {
			var track = choice(data.toptracks.track);
			current_track.title = track.name;
			current_track.artist = track.artist.name;
			$('#page_listen_nav_station').html(get_current_station_html());
			go_to_page('listen');
		});
	}


}

/**
 * Играет трек, похожий на текущий.
 */
function play_next_similar() {
	show_loader();
	lastfm.call('track.getSimilar', { 'artist': current_track.artist, 'track': current_track.title }, function(data) {
		if (typeof (data.similartracks.track) != 'string') {
			var sim_track = choice_similar(data.similartracks.track);
			current_track.title = sim_track.name;
			current_track.artist = sim_track.artist.name;
			play_track();
		} else {
			play_next();
		}
	});
}

/**
 * Начинает проигрывание следующего трека
 */
function play_next() {
	played_tracks_num++;
	show_loader();

	switch (current_station.type) {

		case 'tag':
			start_radio_tag(current_station.name);
			break;

		case 'artist_exact':
			start_radio_artist_exact(current_station.name);
			break;

		case 'artist':
			if (Math.random()<0.4) {
				start_radio_artist(current_station.name);
			} else {
				play_next_similar();
			}
			break;

		case 'audio':
			var n = current_station.name.split('\t;;\t');
			if (Math.random()<0.01) {
				start_radio_audio(n[0], n[1]);
			} else {
				play_next_similar();
			}
			break;

		case 'library':
			start_radio_library(current_station.name);
			break;

	}


}

/**
 * Остановить радиостанцию.
 */
function stop() {
	load_ads();
	$("#mp3player").jPlayer('stop').jPlayer('clearFile');
	go_to_page('tune');
	return false;
}

/**
 * Пауза.
 */
function pause() {
	if (is_on_air()) {
		$('#control_play').show();
		$('#control_pause').hide();
		$("#mp3player").jPlayer('pause');
	}
}

/**
 * Не пауза.
 */
function play() {
	if (is_on_air()) {
		$('#control_play').hide();
		$('#control_pause').show();
		$("#mp3player").jPlayer('play');
	}
}

/**
 * Пауза или не пауза.
 */
function play_pause() {
	if (is_playing()) {
		pause();
	} else {
		play();
	}
}

/**
 * Устанавливает новую громкость.
 *
 * @param Object e Объект-событие от мыши.
 * @param Number e Новое значение громкости.
 */
function change_volume(e) {
	var slider_width = 10;
	if (e.pageX) {
		var x = e.pageX-$('#control_volume').position().left-Math.round(slider_width/2);
		var k = ($('#control_volume').width()-slider_width)/100;
		var vol = Math.round(x/k);
	} else {
		var vol = e;
	}
	if (vol>100) vol=100;
	if (vol<0) vol=0;
	$('#control_volume').css('background-position', vol+'% 0');
	$('#control_volume').attr('title', 'Громкость '+vol+'%')
	$('#mp3player').jPlayer('volume', vol);
}



/**
 * Обновляет слайдер поиска.
 *
 * @param Number pos Сколько прослушано. В секундах.
 * @param Number loaded Сколько загружено. В процентах
 */
function update_seeker(pos, loaded) {
	var txt = '';
	if (current_track.duration) {
		$('#control_seek div').width(loaded+'%');
		txt = $.jPlayer.convertTime((current_track.duration-pos)*1000);
		$('#control_seek').css('background-position', (100*pos/current_track.duration)+'% 0');
		if ($('#control_skip').text()!=txt) {
			$('#control_skip').text(txt);
			$('#control_seek').attr('title', $.jPlayer.convertTime(pos*1000)+' / '+$.jPlayer.convertTime(current_track.duration*1000));
		}
	}
}

/**
 * Перемотка трека.
 *
 * @param Object e Объект-событие от мыши
 */
function seek(e) {
	var slider_width = 10;
	var x = e.pageX-$(this).position().left-Math.round(slider_width/2);
	var k = ($(this).width()-slider_width)/100;
	var pos = Math.round(x/k);
	var relpos = parseInt(pos*100/$('#mp3player').jPlayer('getData','diag.loadPercent'));
	if (relpos>100) return;
	if (relpos<0) relpos=0;

	$('#mp3player').jPlayer('playHead', relpos);
	$('#control_play').hide();
	$('#control_pause').show();
}

/**
 * Загрузка рекламы
 */
function load_ads() {
	/*if ($('#lx_28074').length) {
		var html = '';
		html += '<script type="text/javascript">';
		html += 'var __rt= Math.round(Math.random() * 100000);';
		html += 'document.write(\'<scr\'+\'ipt language="javascript" type="text/javascript" src="http://id34218.luxup.ru/show/28074/?div=lx_28074&rt=\'+__rt+\'&r=\'+escape(document.referrer)+\'"><\'+\'/scr\'+\'ipt>\');';
		html += '</script>';
		$('#lx_28074').writeCapture().after(html);
	}
	fit();*/
}



/**
 */
function close_ads() {
	/*vk.call('putVariable', { 'key': 1499, 'value': 'true', 'user_id': vk.params.viewer_id });
	$('#ads iframe').hide();
	$('#ads__close').hide();
	$('#ads__load').show();
	fit();*/
	return false;
}

function show_ads() {
	/*vk.call('putVariable', { 'key': 1499, 'value': 'false', 'user_id': vk.params.viewer_id });
	$('#ads iframe').show();
	$('#ads__close').show();
	$('#ads__load').hide();
	fit();
	return false;*/
}




/**
 */
function load_user_data(p) {
	if (p||(vk.params.api_settings & vk.SETT_AUDIO)) {
		vk.call('getVariables', { 'user_id': vk.params.viewer_id, 'count': 32, 'key': favorites.start }, function(data){
			if (data.error&&vk.params.desktop_mode) {
				if (window.location.hostname=='tvoeradio.org') {
					window.location = 'http://tvoeradio.org/php/desktop-login.php';
					return;
				}
			}
			for (var i in data.response) {
				var v = data.response[i].value;
				if (v=='') {
					favorites.items.push(null);
				} else {
					v = v.split(favorites.delim);
					favorites.items.push({
						'time': parseInt(v[0]),
						'type': v[1],
						'name': v[2]
					});
				}
			}
			favorites.update_list();
			vk.call('audio.get', { 'uid': vk.params.viewer_id }, function(data){
				if (data.response.length) {
					user_audios.items = data.response;
				} else {
					user_audios.items = [];
				}
				user_audios.update_list();
				go_to_page('tune');
				if (!vk.params.mobile_mode) $('#topnav').show();
				vk.call('getVariable', { 'key' : 1499, 'user_id': vk.params.viewer_id }, function(data){
					if (data.response=='true') {
						close_ads();
					}
					fit();
				});
			});
		});
	}

}

/* ИНИЦИАЛИЗАЦИЯ ******************************************************/

/*function fuckthewall() {
	vk.call('wall.savePost', {wall_id:'116179', message:'fuck you', photo_id: '117431_168959259'}, function(data){
		vk.external.saveWallPost(data.response.post_hash);
	});
}*/

$(document).ready(function(){




	vk = new vk_api('sx--83l77l73l24l79l44l54l78l51l38l', function(){

		if (!vk.params.desktop_mode) {

			vk.addCallback('onApplicationAdded', function() {
				update_topnav(true);
			});

			vk.addCallback('onSettingsChanged', function() {
				load_user_data(true);
				fit();
			});

			vk.makeSettings(vk.SETT_AUDIO);
			//$('#ads').show()

		} else {
			$('body').addClass('desktop_mode');
		}

		if (vk.params.mobile_mode) {
			$('head').append('<link rel="stylesheet" type="text/css" href="/css/mobile.css" />');
		}

		update_topnav();


		$("#mp3player").jPlayer({
			nativeSupport: true, oggSupport: false, customCssIds: false, volume: 80, ready: function(){
				this.element.jPlayer('onSoundComplete', function(){
					scrobbler.submission(current_track);
					play_next();
				});
				this.element.jPlayer('onProgressChange', function(loadPercent, playedPercentRelative, playedPercentAbsolute, playedTime, totalTime){
					update_seeker(playedTime/1000, loadPercent);
				});
			}
		});


		load_user_data();
		lastfm_login();


		$('.page_tune_nav_link').click(function(){
			$('#page_tune_nav li').removeClass('activeLink');
			$(this).parent('li').addClass('activeLink');
			$('#page_tune .tab').hide();
			$($(this).attr('rel')).show();
			fit();
			return false;
		});


		$('#page_tune_tab_tag_listen').click(function(){
			if ($('#page_tune_tab_tag_search').val()) {
				start_radio_tag($('#page_tune_tab_tag_search').val());
			}
			return false;
		});

		$('#page_tune_tab_tag_search').keypress(function(e){
			if (e.which==13) {
				$('#page_tune_tab_tag_listen').click();
			}
		});


		$('#page_tune_tab_artist_listen').click(function(){
			if ($('#page_tune_tab_artist_search').val()) {
				if ($('#page_tune_tab_artist_exact').is(':checked')) {
					start_radio_artist_exact($('#page_tune_tab_artist_search').val());
				} else {
					start_radio_artist($('#page_tune_tab_artist_search').val());
				}
			}
			return false;

		});

		$('#page_tune_tab_artist_search').keypress(function(e){
			if (e.which==13) {
				$('#page_tune_tab_artist_listen').click();
			}
		});

		$('#page_tune_tab_lastfm_login_login, #page_tune_tab_lastfm_login_password').keypress(function(e){
			if (e.which==13) {
				$('#page_tune_tab_lastfm_login_enter').click();
			}
		});

		$('#page_tune_tab_lastfm_login_enter').click(function(){
			lastfm_login($('#page_tune_tab_lastfm_login_login').val(), $('#page_tune_tab_lastfm_login_password').val(), $('#page_tune_tab_lastfm_login_temp').is(':checked'));
			return false;
		});

		$('#page_tune_tab_audio_listen_random').click(function(){
			start_radio_audio_random();
			return false;
		});

		$('#page_tune_tab_lastfm_listen_library').click(function(){
			start_radio_library(scrobbler.login);
			return false;
		});

		$('#page_listen_nav_fav_add').click(function(){
			favorites.add_current();
		});

		$('#page_listen_nav_fav_rem').click(function(){
			favorites.remove_current();
		});


		$('#control_play').hide();

		$('#control_play').click(play);

		$('#control_pause').click(pause);

		$('.control_stop').click(stop);

		$('#control_skip').click(play_next);

		$('#control_add').click(function(){
			$(this).hide();
			user_audios.add_current();
		});

		$('#control_volume').mousedown(function(e) {
			change_volume(e);
			$(window).mousemove(change_volume);
			return false;
		});

		$(window).mouseup(function(){
			$(this).unbind('mousemove', change_volume);
		});

		$('#control_volume').click(change_volume);


		$('#control_seek').click(seek);

		$('#ads__close2').click(function(){
			$('#ads').remove();
			fit();
		});
		/*$('#ads').css('opacity', 0.7);
		$('#ads').mouseenter(function(){
			$(this).css('opacity', 1);
		});
		$('#ads').mouseleave(function(){
			$(this).css('opacity', 0.7);
		});*/


	}, function(){

	}, false);


});
