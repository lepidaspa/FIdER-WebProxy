#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
from django import conf
from django.http import HttpResponse
from django.shortcuts import render_to_response
from django.template.context import RequestContext
from django.utils.safestring import SafeString
import json
import FIdERProxyFS.proxy_config_core as proxyconf
import os
import sys

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'



def error404test (request):

	htmldata = "<html><body>Error 404 test: </body></html>"
	return HttpResponse(htmldata)


def error500test (request):
	type, value, tb = sys.exc_info()
	htmldata = "<html><body>Error 500 test: <br><pre>"+str(request)+"\n"+str(value)+"</pre><br> </body></html>"
	return HttpResponse(htmldata)


def proxysel (request):
	"""
	Shows the basic proxy selection screen. From here the user can also create a new proxy
	:return:
	"""

	#TODO: replace with more complete version, to take into account query proxies too
	#list_proxy = os.listdir(os.path.join(proxyconf.basemanifestpath))

	proxydict = getManifests()

	proxies = {}
	for proxy_id in proxydict:
		proxies [proxy_id] = {}
		proxies [proxy_id]['area'] = proxydict[proxy_id]['area']
		proxies [proxy_id]['time'] = proxydict[proxy_id]['time']


	return render_to_response ('fwp_proxysel.html', {'proxies': SafeString(json.dumps(proxies))},
		context_instance=RequestContext(request))


def proxypage (request, **kwargs):
	"""
	Shows the meta selection screen for a selected proxy and any other proxy-specific option. Includes a small static view of the proxy bounding box
	:return:
	"""

	proxy_id = kwargs['proxy_id']
	manifest = getProxyManifest(proxy_id)


	return render_to_response ('fwp_proxypage.html', {'proxy_id': proxy_id, 'manifest': SafeString(json.dumps(manifest))},
		context_instance=RequestContext(request))



def metapage (request, **kwargs):
	"""
	Shows the meta selection screen for a selected proxy and any other proxy-specific option. Includes a small static view of the proxy bounding box
	:return:
	"""

	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	manifest = getProxyManifest(proxy_id)

	proxytype = learnProxyType(manifest)


	return render_to_response ('fwp_metapage.html', {'proxy_id': proxy_id, 'manifest': SafeString(json.dumps(manifest)), 'meta_id': meta_id, 'proxy_type': proxytype},
		context_instance=RequestContext(request))






def learnProxyType (manifest):
	"""
	Reads the manifest dict and returns the type of proxy as Read, Write, Query
	:param manifest:
	:return:
	"""

	if manifest['operations']['read'] != "none":
		return "read"

	elif manifest['operations']['write'] != "none":
		return "write"

	else:

		# proxy cannot be None, so by exclusion it must be query
		return "query"



def getManifests ():
	"""
	Returns a dict of soft proxies manifests for the current hard proxy
	:return:
	"""

	#TODO: move to proxy_core or ProxyFS, add error handling

	proxylist = {}
	for manifestfile in os.listdir(proxyconf.basemanifestpath):
		proxy_id = manifestfile.partition(".manifest")[0]
		fp_manifest = open(os.path.join(proxyconf.basemanifestpath, manifestfile))
		proxylist[proxy_id] = json.load(fp_manifest)
		fp_manifest.close()

	print proxylist
	return proxylist


def getProxyManifest (proxy_id):

	#TODO: move to proxy_core or ProxyFS, add error handling

	filename = os.path.join(proxyconf.basemanifestpath, proxy_id+".manifest")
	fp = open(filename, 'r')
	manifestdata = json.load(fp)
	fp.close()

	return manifestdata
