#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
from django.utils.safestring import SafeString
import urllib2
from FIdERProxyFS import proxy_core
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