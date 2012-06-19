#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
from django import conf
from django.http import HttpResponse
from django.shortcuts import render_to_response
from django.template.context import RequestContext
from django.utils.safestring import SafeString
from django.views.decorators.csrf import csrf_exempt
import json
import traceback
import urllib2
from FIdERProxyFS import proxy_core, ProxyFS
import FIdERProxyFS.proxy_config_core as proxyconf
import os
import sys
from FIdERProxyFS.proxy_core import readSingleShape
from FIdERWP.views import saveMapFile

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'



def error404test (request):

	htmldata = "<html><body>Error 404 test: </body></html>"
	return HttpResponse(htmldata)


def error500test (request):
	type, value, tb = sys.exc_info()
	htmldata = "<html><body>Error 500 test: <br><pre>"+str(request)+"\n"+str(value)+"</pre><br> </body></html>"
	print "ERROR: %s %s\n%s" % (type, value, tb)
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



@csrf_exempt
def proxy_create_conversion (request):
	"""
	Receives a json dict describing the meta or shape to which the conversion is applied to and saves it. If to a meta, it saves it to ALL metas independently.
	:param request: request.POST has the arguments passed from the conversion table creation form. Contains 'convtable' with the full conversion table as a dict with key the source property name and value a list with object type and property name in the anfov model.
	:return:
	"""


	#print "Proxy create conversion"

	#print "Running at "+str(time.ctime())
	#print "PARAMS: "+str(request.POST)



	response_table_update = {
		'success': False,
		'report': ''
	}


	try:

		args = json.loads(request.POST['jsonmessage'])

		convtable =  args['convtable']
		proxy_id =  args['proxy_id']
		meta_id =  args['meta_id']
		shape_id = args['shape_id']

		shape_path = os.path.join (proxyconf.baseproxypath, proxy_id, "conf/mappings", meta_id, shape_id)

		try:
			#TODO: add lock file support (really needed?)
			fp = open(shape_path, 'w+')
			json.dump(convtable, fp)
			fp.close()
			response_table_update['success'] = True
			response_table_update['report'] = "Conversioni per la mappa %s sotto %s/%s aggiornate con successo." % (shape_id, proxy_id, meta_id)
		except Exception as ex:
			# if we cannot update the conversion table, we set it on the failed updates
			print "File update issue %s" % ex
			response_table_update['success'] = False
			response_table_update['report'] = "Aggiornamento delle conversioni per la mappa %s sotto %s/%s fallito." % (shape_id, proxy_id, meta_id)

	except:
		print traceback.format_exc()
		response_table_update['success'] = False
		response_table_update['report'] = "Aggiornamento delle conversioni per la mappa %s sotto %s/%s fallito." % (shape_id, proxy_id, meta_id)

	print "TABLE: %s" % response_table_update

	return HttpResponse(json.dumps(response_table_update), mimetype="application/json")







@csrf_exempt
def proxy_uploadmap (request, **kwargs):
	"""
	Uploads a zipped archive to the proxy.
	:param request:
	:return:
	"""
	print "Uploader: launching"


	response_upload = {
		'success': False,
		'report': ''
	}

	upload = None

	print "Uploader: init"

	if request.method == 'POST':
		try:
			print "Raw data: %s" % request.FILES
			upload = request.FILES['shapefile']
		except:
			response_upload['report'] = "Nessun file inviato."
			print "no file sent"
	else:
		response_upload['report'] = "Metodo di accesso non valido."
		print "bad method"

	print "file upload detected, handling"
	if upload is not None:

		#proxy_id = request.POST['proxy_id']
		#meta_id = request.POST['meta_id']
		proxy_id  = kwargs['proxy_id']
		meta_id = kwargs['meta_id']
		print "uploading to %s / %s" % (proxy_id, meta_id)
		try:
		#	shape_id = request.POST['shape_id']
			shape_id = kwargs['shape_id']
		except:
			shape_id = None
			print "uploading to new map (or overwriting by chance)"

		if shape_id is None or shape_id == "":
			shape_id = upload.name[:-4]

		print "FORM: Uploading file to %s/%s/%s" % (proxy_id, meta_id, shape_id)


		success, output = saveMapFile(upload, proxy_id, meta_id, shape_id)
		if success:
			response_upload['success'] = True
			response_upload['report'] = "Invio del file %s su %s per integrazione completato." % (upload.name, output)
		else:
			response_upload['report']= "Invio del file %s fallito. Causa: %s <br>" % (upload.name, output)


	return HttpResponse(json.dumps(response_upload), mimetype="application/json")



def proxy_rebuildmap (request, **kwargs):


	proxy_id  = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	shape_id = kwargs['shape_id']

	try:
		ProxyFS.handleFileEvent (os.path.join(proxyconf.baseuploadpath, proxy_id, meta_id, shape_id+".zip"))
		response_rebuild = {
			'success': True,
			'report': 'Mappa %s aggiornata.' % shape_id
		}
	except Exception, ex:
		response_rebuild = {
			'success': False,
			'report': ex
		}



	return HttpResponse(json.dumps(response_rebuild), mimetype="application/json")



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
