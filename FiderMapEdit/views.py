#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
from django.utils.safestring import SafeString
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

	#TODO: add map type detection

	# check if the map has a mapping file
	"""

	convtablepath = os.path.join (proxyconf.baseproxypath, proxy_id, proxyconf.path_mappings, meta_id, shape_id)
	try:
		if os.path.exists(convtablepath):
			fp_conv = open(convtablepath)
			convtable = json.load(fp_conv)
			fp_conv.close()


	except:
		# check on the actual map file
		pass


	datapath = os.path.join (proxyconf.baseproxypath, proxy_id, proxyconf.path_geojson, meta_id, shape_id)
	fp_data = open(datapath)
	data = json.load(fp_data)
	fp_data.close()

	heuristic = data['features'][0]['geometry']['type']

	"""


	print proxymaps

	return render_to_response ('fwp_MapEditor.html', {'proxy_id': proxy_id, 'meta_id': meta_id, 'shape_id': shape_id, 'maps': proxymaps, 'mapsjson': SafeString(json.dumps(proxymaps)), 'proxy_name': manifest['name'] }, context_instance=RequestContext(request))