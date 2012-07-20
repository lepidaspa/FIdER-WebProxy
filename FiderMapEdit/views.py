#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
from django.http import HttpResponse
from django.utils.safestring import SafeString
from django.views.decorators.csrf import csrf_exempt
import urllib2
from FIdERProxyFS import proxy_core, proxy_lock
from FIdERWeb.views import getProxyManifest


__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

import os
import json


from django.shortcuts import render_to_response
from django.template.context import RequestContext


import FIdERProxyFS.proxy_config_core as proxyconf


def mapeditor (request, **kwargs):

	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	shape_id = kwargs['shape_id']

	manifest = getProxyManifest(proxy_id)

	print "Launching map editor for map %s/%s/%s" % (proxy_id, meta_id, shape_id)

	metadir = os.path.join(proxyconf.baseproxypath,proxy_id, proxyconf.path_geojson, meta_id)
	proxymaps = []
	for mapfile in os.listdir(metadir):
		proxymaps.append(mapfile)

	print proxymaps

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

		#TODO: check how to go forward if we cannot access the conversion table. Technically we could edit what properties we have on each geo object, but it is far from optimal
		raise


	return render_to_response ('fwp_MapEditor.html', {'proxy_id': proxy_id, 'meta_id': meta_id, 'shape_id': shape_id, 'maps': proxymaps, 'mapsjson': SafeString(json.dumps(proxymaps)), 'proxy_name': manifest['name'], 'objmodel': SafeString(json.dumps(convtable)) }, context_instance=RequestContext(request))


def getMapsList (request):
	"""
	Returns a full list of the non-query maps in the proxy
	:param request:
	:return:
	"""

	return HttpResponse(json.dumps(proxy_core.getAllEditables()), mimetype="application/json")


@csrf_exempt
def implementchanges (request, **kwargs):
	"""
	Inserts the changelist in POST into the map, returns a table with the old and new ID of the saved objects (changes are actually only for deleted and created objects, but all are added to the table). NOTE: this will also save the updated geojson in this AND in the mirror directory and remove the conversion table as it is no longer needed (this works directly on the federator model)
	:param request:
	:param kwargs: proxy_id, meta_id, map_id
	:return:
	"""

	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	shape_id = kwargs['shape_id']

	try:

		locker = proxy_lock.ProxyLocker (retries=3, wait=5)


		req_changes = request.POST['changelist']
		req_model = request.POST['model']

		success, objects = locker.performLocked (proxy_core.alterMapDetails, proxy_id, meta_id, shape_id, req_changes, req_model)

		print "Map has been modified (success: %s)" % success

		feedback = {
			'success': success,
			'report': 	objects
		}

		print feedback
	except Exception, ex:


		feedback = {
			'success': False,
			'report': ex
		}


	return HttpResponse(json.dumps(feedback), mimetype="application/json")

