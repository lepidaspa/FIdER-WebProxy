#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
from django.shortcuts import render_to_response
from django.template.context import RequestContext
from django.utils.safestring import SafeString
import json

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

from FIdERProxyFS import proxy_core
from Common import Components

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

	maplist_st = []

	print proxy_id, proxy_name, proxy_meta, maplist, maplist_st

	hasmodels, models = Components.getModelsFromServer()
	if not hasmodels:
		models = None
	else:
		models = SafeString(json.dumps(models))

	return render_to_response ('st_ui.html', {'proxy_id': proxy_id, 'proxy_name': proxy_name, 'proxy_meta': SafeString(json.dumps(proxy_meta)), 'maps_fider': SafeString(json.dumps(maplist)), 'maps_st': SafeString(json.dumps(maplist_st)),  'models': models, 'manifest': SafeString(json.dumps(manifest))}, context_instance=RequestContext(request))


