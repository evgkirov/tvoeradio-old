#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
reload(sys)
sys.setdefaultencoding('utf-8')

from datetime import datetime
import urllib
import json

page_file = 'app.html';

def log(text):
    print text,
    sys.stdout.flush()

def logn(text):
    log(text+'\n')

def lastfm_request(method, **kwargs):
    log('Last.fm query %s...' % method)
    params = {}
    params['api_key'] = '5f170ff5352903d39512d907566283fc'
    params['format'] = 'json'
    params['method'] = method
    for (k,v) in kwargs.iteritems():
        params[k] = v
    api_url = 'http://ws.audioscrobbler.com/2.0/'
    fetcher = urllib.urlopen(api_url+'?'+urllib.urlencode(params))
    toret = json.loads(fetcher.read())
    logn('done')
    return toret

def html_update(tag, repl, html):
    tag_open = u'<!--%s-->' % tag
    tag_close = u'<!--/%s-->' % tag
    tag_open_pos = html.index(tag_open) + len(tag_open)
    tag_close_pos = html.index(tag_close)
    html = html[:tag_open_pos]+repl+html[tag_close_pos:]
    return html


page = open(page_file)
html = unicode(page.read())


page = open('bak/'+page_file+'.'+datetime.now().strftime('%Y%m%d%H%M'), 'w')
page.write(html)
page.close()


data = lastfm_request('geo.getTopArtists', country='russia')
top_artists = '';
for artist in data['topartists']['artist'][:25]:
    top_artists += '<li><a href="javascript:start_radio_artist(\'%s\')">%s</a></li>\n' % (artist['name'], artist['name'])


data = lastfm_request('tag.getTopTags')
top_tags = ''
for tag in data['toptags']['tag'][:25]:
    top_tags += '<li><a href="javascript:start_radio_tag(\'%s\')">%s</a></li>\n' % (tag['name'], tag['name'])


html = html_update(u'fetch_top_artists', top_artists, html)
html = html_update(u'fetch_top_tags', top_tags, html)


page = open(page_file, 'w')
page.write(html)
page.close()
