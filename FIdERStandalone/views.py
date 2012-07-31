#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
from django.http import HttpResponse
from django.shortcuts import render_to_response
from django.template.context import RequestContext
from django.utils.safestring import SafeString
from django.views.decorators.csrf import csrf_exempt
import json
import os
from FIdERWebST import views as fwstviews

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

from FIdERProxyFS import proxy_core
from Common import Components
from FIdERProxyFS import proxy_config_core as proxyconf

def uiview (request, **kwargs):
	"""
	Draws the main view of the standalone instrument. It can use a map from the softproxy or create a new one
	:param request:
	:param kwargs: parameters from the url
	:return:
	"""

	proxy_editables = proxy_core.getAllEditables()

	# we always have a proxy_id since the standalone area is specific to each proxy.
	proxy_id = kwargs['proxy_id']

	manifest = proxy_core.getManifest(proxy_id)

	proxy_name = manifest['name']
	proxy_meta = []

	maplist = {}
	for metadata in manifest['metadata']:
		meta_id = metadata['name']
		proxy_meta.append(meta_id)
		maplist[meta_id] = proxy_editables[proxy_id][meta_id]

	#maplist_st = []
	maplist_st = os.listdir(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone))


	print proxy_id, proxy_name, proxy_meta, maplist, maplist_st

	#TODO: remove marker, commented out for debug reasons
	#hasmodels, models = Components.getModelsFromServer()
	#if not hasmodels:
	#	models = None
	#else:
	#	models = SafeString(json.dumps(models))

	models = fwstviews.getModels()

	return render_to_response ('st_ui.html', {'proxy_id': proxy_id, 'proxy_name': proxy_name, 'proxy_meta': SafeString(json.dumps(proxy_meta)), 'maps_fider': SafeString(json.dumps(maplist)), 'maps_st': SafeString(json.dumps(maplist_st)),  'models': SafeString(json.dumps(models)), 'manifest': SafeString(json.dumps(manifest))}, context_instance=RequestContext(request))


def loadSTMap (request, **kwargs):
	"""
	Loads a map from the standalone area
	:param request:
	:param kwargs:
	:return:
	"""

	proxy_id = kwargs['proxy_id']
	map_id = kwargs['map_id']

	mapdata = json.load(open(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone, map_id)))

	return HttpResponse(json.dumps(mapdata), mimetype="application/json")



@csrf_exempt
def saveMap (request, **kwargs):
	"""
	Saves a map in the Standalone directory of the requested proxy, overwrites any existing map in that point
	:param request:
	:param kwargs:
	:return:
	"""

	try:
		proxy_id = kwargs['proxy_id']
		map_id = request.POST['mapname']
		mapdata = request.POST['jsondata']

		print "Changes submitted for map %s to standalone tool %s" % (map_id, proxy_id)
		print "format %s" % (type(mapdata))
		print "DATA: %s" % mapdata

		path_tool = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone)

		dest_fp = open(os.path.join(path_tool, map_id), 'w+')
		json.dump(json.loads(mapdata), dest_fp)
		dest_fp.close()


		feedback = {
			'success': True,
			'report': "Mappa salvata correttamente nell'area standalone"
		}

	except Exception as ex:

		print "Save fail due to:\n%s" % ex

		feedback = {

			'success': False,
			'report': "Salvataggio fallito: %s" % ex

		}






	return HttpResponse(json.dumps(feedback), mimetype="application/json")
