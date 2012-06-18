#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
from django import conf
from django.http import HttpResponse
from django.shortcuts import render_to_response
from django.template.context import RequestContext
from django.utils.safestring import SafeString
import json
import urllib2
from FIdERProxyFS import proxy_core
import FIdERProxyFS.proxy_config_core as proxyconf
import os
import sys
from FIdERProxyFS.proxy_core import readSingleShape

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

	#TODO: make conditional on proxy being NOT query and add alternative for query
	proxymaps = []
	for shape in os.listdir(os.path.join(proxyconf.baseproxypath,proxy_id, proxyconf.path_geojson, meta_id)):
		proxymaps.append(shape)




	return render_to_response ('fwp_metapage.html', {'proxy_id': proxy_id, 'manifest': SafeString(json.dumps(manifest)), 'meta_id': meta_id, 'proxy_type': proxytype, 'maps': SafeString(json.dumps(proxymaps))},
		context_instance=RequestContext(request))


def proxy_loadmap (request, **kwargs):

	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	shape_id = kwargs['shape_id']

	print "Loading map data for map %s/%s/%s" % (proxy_id, meta_id, shape_id)

	jsondata = readSingleShape (proxy_id, meta_id, shape_id)
	return HttpResponse(jsondata, mimetype="application/json")



def component_shapefile_table (request, **kwargs):
	"""

	:param request:
	:param kwargs:
	:return:
	"""
	shapedata = None
	shapetable = None

	proxy_id = kwargs["proxy_id"]
	meta_id = kwargs["meta_id"]
	shape_id = kwargs["shape_id"]

	shapedata = proxy_core.convertShapeFileToJson(proxy_id, meta_id, shape_id, False)

	try:
		shapetable = proxy_core.getConversionTable(kwargs["proxy_id"], kwargs["meta_id"], kwargs["shape_id"])
	except Exception as ex:
		print "Error when loading shape conversion table: %s" % ex
		shapetable = None

	try:

		jsonresponse = urllib2.urlopen(proxyconf.URL_CONVERSIONS)
		convtable = json.load(jsonresponse)
		print "Received conversion table from server: %s" % convtable

	except Exception as ex:
		if isinstance(ex, urllib2.HTTPError):
			errormess = ex.code
		elif isinstance(ex, urllib2.URLError):
			errormess = ex.reason
		else:
			errormess = ex.message
		print "Error when requesting conversion table from %s: %s" % (proxyconf.URL_CONVERSIONS, errormess)

		#todo: replace with handling at JS level
		raise

	conversionto = {}
	for objecttype in convtable.keys():
		conversionto[objecttype] = []
		for property in convtable[objecttype].keys():
			conversionto[objecttype].append(property)

	conversionfrom = []
	for feature in shapedata['features']:
		#print "Feature: %s *** (%s)" % (feature, type(feature))
		#print "Properties: %s " % feature['properties']
		#for key in feature['properties'].keys():
		#	if not conversionfrom.has_key (key):
		#		conversionfrom[key] = str(type(feature['properties'][key])).split("'")[1]
		for ckey in feature['properties'].keys():
			if ckey not in conversionfrom:
				conversionfrom.append(ckey)


	args = {
		"shapedata" : conversionfrom,
		"conversion" : conversionto,
		"shapetable": shapetable
	}

	print args

	return HttpResponse(json.dumps(args), mimetype="application/json")




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
