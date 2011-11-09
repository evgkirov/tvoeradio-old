#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
reload(sys)
sys.setdefaultencoding('utf-8')
import os
from os.path import join as j
import shutil
from time import time

src_dir = '/home/xtr/Dropbox/Public/vk/tvoeradio/app'
deploy_dir = '/home/xtr/Dropbox/Projects/tvoeradio-stable'

compress_files = ('js/main.js', 'css/main.css')
app_html = 'app.html'
copy_files = [
    'js/Jplayer.swf',
    'js/jquery.jplayer.min.js',
    'js/jquery.writeCapture.min.js',
    'js/jquery.min.js',
    'js/vk_api.min.js',
    'fetch_top.py',
    'off.html',
]
subdirs = ('js', 'img', 'css', 'php')
copy_files += [j('img', f) for f in os.listdir(j(src_dir, 'img'))]
copy_files += [j('php', f) for f in os.listdir(j(src_dir, 'php'))]
compress_command = 'java -jar "%s"' % j(src_dir,'../yuicompressor.jar')

def log(text):
    print text,
    sys.stdout.flush()

def logn(text):
    log(text+'\n')



#update top
os.chdir(src_dir)
os.system(j(src_dir, 'fetch_top.py'))

#create dirs
for d in subdirs:
    log('Creating %s...' % d)
    try:
        os.mkdir(j(deploy_dir, d))
    except:
        log('already exists...')
    logn('done')

#copy app.html
log('Updating and copying  %s...' % app_html)
page = open(j(src_dir, app_html))
html = unicode(page.read())

for f in compress_files:
    html = html.replace(f, '%s?%d' % (f, int(time())))

page = open(j(deploy_dir, app_html), 'w')
page.write(html)
page.close()
logn('done')

#compress
for f in compress_files:
    log('Compressing %s...' % f)
    os.system('%s -o "%s" "%s"' % (compress_command, j(deploy_dir, f), j(src_dir, f)))
    logn('done')

#copy
for f in copy_files:
    log('Copying %s...' % f)
    shutil.copy(j(src_dir, f), j(deploy_dir, f))
    logn('done')
