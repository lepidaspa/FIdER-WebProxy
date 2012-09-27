#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
import shutil
from django.core.servers.basehttp import FileWrapper
from io import StringIO

import json
import tempfile
import traceback
import urllib2
import os
import sys
import uuid
import zipfile

from django.http import HttpResponse
from django.shortcuts import render_to_response
from django.template.context import RequestContext
from django.utils.safestring import SafeString
from django.views.decorators.csrf import csrf_exempt

from FIdERProxyFS import proxy_core, ProxyFS, proxy_web, proxy_query
import FIdERProxyFS.proxy_config_core as proxyconf
from FIdERProxyFS.proxy_core import readSingleShape
from FIdERWeb import MessageTemplates, Components
from MarconiLabsTools import ArDiVa

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'



def error404 (request):

	htmldata = "<html><body>Error 404 test: </body></html>"
	return HttpResponse(htmldata)



def error500 (request):
	type, value, tb = sys.exc_info()
	htmldata = "<html><body>Error 500 test: <br><pre>"+str(request)+"\n"+str(value)+"</pre><br> </body></html>"
	print "ERROR: %s %s\n%s" % (type, value, tb)
	return HttpResponse(htmldata)


def proxysel (request):
	"""
	Shows the basic proxy selection screen. From here the user can also create a new proxy
	:return:
	"""


	proxydict = getManifests()

	proxies = {}
	for proxy_id in proxydict:
		proxies [proxy_id] = {}
		proxies [proxy_id]['area'] = proxydict[proxy_id]['area']
		proxies [proxy_id]['time'] = proxydict[proxy_id]['time']
		proxies [proxy_id]['name'] = proxydict[proxy_id]['name']
		proxies [proxy_id]['type'] = learnProxyType(proxydict[proxy_id])

	print "Proxy listing:\n%s" % proxies


	return render_to_response ('fwp_proxysel.html', {'proxies': SafeString(json.dumps(proxies))},
		context_instance=RequestContext(request))


def proxypage (request, **kwargs):
	"""
	Shows the meta selection screen for a selected proxy and any other proxy-specific option. Includes a small static view of the proxy bounding box
	:return:
	"""

	proxy_id = kwargs['proxy_id']
	manifest = getProxyManifest(proxy_id)

	return render_to_response ('fwp_proxypage.html', {'proxy_id': proxy_id, 'manifest': SafeString(json.dumps(manifest)), 'proxy_name': manifest['name']},
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


	if proxytype == 'read' or proxytype == 'write' or proxytype == 'local':
		maplist_st = os.listdir(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone))
		if meta_id != '.st':
			metadir = os.path.join(proxyconf.baseproxypath,proxy_id, proxyconf.path_geojson, meta_id)

			proxymaps = []
			for mapfile in os.listdir(metadir):
				proxymaps.append(mapfile)


			remotedir = os.path.join (proxyconf.baseproxypath, proxy_id, proxyconf.path_remoteres, meta_id)
			remotemaps = []
			for conffile in os.listdir(remotedir):
				remotemaps.append(conffile[:-4])
		else:
			proxymaps = maplist_st




	elif proxytype == 'query':
		metadir = os.path.join(proxyconf.baseproxypath,proxy_id, proxyconf.path_mirror, meta_id)
		proxymaps = {}
		for mapfile in os.listdir(metadir):
			proxymaps[mapfile] = json.load(open(os.path.join(metadir, mapfile)))



	kwargs = {'proxy_id': proxy_id, 'proxy_name': manifest['name'], 'manifest': SafeString(json.dumps(manifest)), 'meta_id': meta_id, 'proxy_type': proxytype, 'maps': SafeString(json.dumps(proxymaps))}


	if proxytype == 'read' or proxytype == 'write':
		template = 'fwp_metapage.html'
		kwargs['remote'] = SafeString(json.dumps(remotemaps))

	elif proxytype == 'query':
		template = 'fwp_querypage.html'

	elif proxytype == 'local':
		template = 'fwp_metapage.html'
		kwargs['maps_st'] = SafeString(json.dumps(maplist_st))
		if meta_id != '.st':
			kwargs['remote'] = SafeString(json.dumps(remotemaps))




	# models are loaded at start for both
	try:
		kwargs['models'] = SafeString(json.dumps(getModels()))
	except:
		kwargs['models'] = {}

	#print "MAP DATA:\n",proxymaps,"\n***************************************************"

	return render_to_response (template, kwargs, context_instance=RequestContext(request))

def proxy_loadmap (request, **kwargs):

	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	shape_id = kwargs['shape_id']

	print "Loading map data for map %s/%s/%s" % (proxy_id, meta_id, shape_id)

	if os.path.exists(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_geojson, meta_id, shape_id)):
		jsondata = readSingleShape (proxy_id, meta_id, shape_id)
	else:
		jsondata = {}

	return HttpResponse(jsondata, mimetype="application/json")

def proxy_getModels (request):
	"""
	Returns a json with the main server models and acceptable values
	:param request:
	:return:
	"""

	#TODO: decide whether to return NULL or error (500) in case of error in getModels

	return HttpResponse(json.dumps(getModels()), mimetype="application/json")



def getModels ():
	"""
	Get the list of fields for conversion from the main server
	:return:
	"""

	print "Retrieving conversion table from server %s" % proxyconf.URL_MODELS

	try:
		jsonresponse = urllib2.urlopen(proxyconf.URL_MODELS)
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

	return convtable



def getConversionInfo (request, **kwargs):
	"""
	Returns a json with the conversion table for a given map and the list of fields for that map
	:param request:
	:param kwargs:
	:return:
	"""

	print "Retrieving conversion table..."

	proxy_id = kwargs["proxy_id"]
	meta_id = kwargs["meta_id"]
	shape_id = kwargs["shape_id"]

	# loading pre-existing conversion; should include modelid and actual conversion structure as fields with corresponding field and value conversion
	try:
		mapconv = proxy_core.getConversionTable(kwargs["proxy_id"], kwargs["meta_id"], kwargs["shape_id"])
		print "Received conversion table: %s" % mapconv
		if mapconv is None:
			mapconv = {}
	except Exception as ex:
		print "Error when loading shape conversion table: %s" % ex
		mapconv = {}

	# very simple check to be sure the conversion table has the correct structure, i.e. is in the most recent format
	if not (mapconv.has_key('modelid') and mapconv.has_key('fields')):
		print "Conversion table is in the wrong format"
		mapconv = {}

	# creating the full list of fields for this map
	sourcefields = []
	if learnProxyType(getProxyManifest(proxy_id)) != 'query':
		mapdata = proxy_core.convertShapeFileToJson(proxy_id, meta_id, shape_id, False)
		for feature in mapdata ['features']:
			for property in feature['properties'].keys():
				if property not in sourcefields:
					sourcefields.append(property)
	else:
		dbstructure = proxy_query.getPGStructure(proxy_id, meta_id, shape_id)
		for field in dbstructure:
			sourcefields.append(field[0])

	args = {
		"mapfields" : sourcefields,
		"conversion" : mapconv,
	}

	print "Retrieved conversion structure:",args

	return HttpResponse(json.dumps(args), mimetype="application/json")









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

	if shapetable is None:
		shapetable = {}


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


def proxy_getSingleMap (request, **kwargs):
	"""
	Returns a single map in geojson format
	:param request:
	:param kwargs:
	:return:
	"""

	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	map_id = kwargs['map_id']

	mapdata = ""

	if meta_id == '.st':
		path = os.path.join (proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone, map_id)
		mapdata = json.load(open(path))
	else:
		path = os.path.join (proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror, meta_id, map_id)
		mapdata = proxy_core.convertShapeFileToJson(proxy_id, meta_id, map_id, False)




	response = HttpResponse(json.dumps(mapdata), mimetype="application/json")
	response['Content-Disposition'] = 'attachment; filename=' + map_id+".geojson"

	return response



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

def proxy_maps_list (request, **kwargs):
	"""
	Returns a json object with the list of the maps available for the requested soft proxy
	:param request:
	:param kwargs: proxy_id, meta_id, shape_id
	:return: dictionary with keys standalone for standalone area maps and meta for mirror area maps by meta name
	"""

	proxy_id = kwargs['proxy_id']

	maplist = {'standalone': [], 'meta': {}}

	metapath = os.path.join (proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror)
	metalist = os.listdir(metapath)

	for cmeta in metalist:
		maplist['meta'][cmeta] = os.listdir(os.path.join(metapath, cmeta))

	maplist['standalone'] = os.listdir(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone))

	return HttpResponse(json.dumps(maplist), mimetype="application/json")





def map_refresh_remote (request, **kwargs):
	"""
	Updates a SPECIFIC WFS resource on the proxy. Starts from a GET request
	:param request:
	:param kwargs: proxy_id, meta_id, shape_id
	:return:
	"""

	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	map_id = kwargs['shape_id']

	response_refresh_remote = {
		'success': False,
		'report': ""
	}

	try:
		remotelist = proxy_core.getRemotesList (proxy_id)
	except Exception as ex:
		print "ERROR: %s " % ex

		return HttpResponse(json.dumps(response_refresh_remote), mimetype="application/json")

	foundmap = False
	for item in remotelist:
		conf_file = item['mapconf']
		if meta_id == item['meta_id'] and map_id == conf_file[:-4]:
			foundmap = True

			conf_fp = open(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_remoteres, meta_id, conf_file))
			connect = json.load(conf_fp)
			conf_fp.close()

			response_wfsupdate = ProxyFS.uploadWFS (proxy_id, meta_id, map_id, connect)

			print response_wfsupdate

			if response_wfsupdate['success'] is True:
				response_refresh_remote['report'] = "Mappa %s in %s/%s aggiornata correttamente." % (map_id, proxy_id, meta_id)

			else:
				response_refresh_remote['report'] = "Aggiornamento di %s in %s/%s fallito.<br>%s" % (map_id, proxy_id, meta_id, response_wfsupdate['report'])

			# we found our map, no need to check the other conf files
			break

	if foundmap is True:
		response_refresh_remote['success'] = response_wfsupdate['success']
	else:
		response_refresh_remote['report'] = "Impossibile trovare i dati di aggiornamento remoto per %s in %s/%s." % (map_id, proxy_id, meta_id)



	print "Refresh result: %s" % response_refresh_remote

	return HttpResponse(json.dumps(response_refresh_remote), mimetype="application/json")



def proxy_refresh_remote (request, **kwargs):
	"""
	Updates ALL WFS (and remote) resources on this proxy. Starts from a GET request
	:param request:
	:return:
	"""

	proxy_id = kwargs['proxy_id']

	response_refresh_remote = {
		'success': False,
		'report': {
			'updated': [],
			'errors': []
		}
	}

	try:
		remotelist = proxy_core.getRemotesList (proxy_id)
	except Exception as ex:
		print "ERROR: %s " % ex

		return HttpResponse(json.dumps(response_refresh_remote), mimetype="application/json")


	for item in remotelist:
		meta_id = item['meta_id']
		conf_file = item['mapconf']
		map_id = conf_file[:-4]


		conf_fp = open(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_remoteres, meta_id, conf_file))
		connect = json.load(conf_fp)
		conf_fp.close()

		response_wfsupdate = ProxyFS.uploadWFS (proxy_id, meta_id, map_id, connect)

		print response_wfsupdate

		if response_wfsupdate['success'] is True:
			response_refresh_remote['report']['updated'].append([proxy_id, meta_id, map_id])
		else:
			response_refresh_remote['report']['errors'].append([proxy_id, meta_id, map_id])

	response_refresh_remote['success'] = True

	print "Refresh result: %s" % response_refresh_remote

	return HttpResponse(json.dumps(response_refresh_remote), mimetype="application/json")



@csrf_exempt
def proxy_uploadwfs (request, **kwargs):

	response_upload = {
		'success': False,
		'report': ""
	}

	print 'Loading from WFS'
	print kwargs
	#args = request.POST
	#print args

	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']

	try:
		shape_id = kwargs['shape_id']
	except:
		shape_id = request.POST['layer']

	connect = {
		'url': request.POST['url'],
		'user': request.POST['user'],
		'pass': request.POST['pass'],
		'layer': str(request.POST['layer'])
	}

	print connect

	response_upload = ProxyFS.uploadWFS(proxy_id, meta_id, shape_id, connect, True)



	return HttpResponse(json.dumps(response_upload), mimetype="application/json")

@csrf_exempt
def proxy_create_new (request):
	"""
	Creates a new proxy from a partially compiled manifest and performs the full communication with the main server. Returns success only if the proxy is correctly registered
	:param request:
	:return:
	"""

	print "Trying to create a new proxy"
	if request.REQUEST.has_key("linkedto"):
		linkedto = request.REQUEST['linkedto']
		print "Creating from standalone %s" % linkedto
		request = None
	else:
		print "Creating from premanifest"
		print request.POST
		linkedto = None

	if request is None and linkedto is None:
		raise Exception ("Missing manifest or linkage data for new proxy");



	result = {
		'success':  False,
		'result': ""
	}

	try:

		# creating the pre-manifest
		if request is not None:
			jsonmessage = json.loads(request.POST['jsonmessage'])
		elif linkedto is not None:
			jsonmessage = json.load(open(os.path.join(proxyconf.baseproxypath, proxyconf.basemanifestpath, linkedto+".manifest")))
			jsonmessage['operations']['read'] = 'full'
			#local proxies have no token in the manifest (it's never used anyway
			#jsonmessage.pop('token')


		premanifest = ArDiVa.Model(MessageTemplates.model_response_capabilities)

		#TODO: check that BASEURL receives the correct value

		#print "SENT:",jsonmessage
		#print "PRE:",premanifest

		#verify if the proxy is local or not (i.e. if all modes are none)
		islocal = (
			jsonmessage['operations']['read'] == 'none' and
			jsonmessage['operations']['write'] == 'none' and
			jsonmessage['operations']['query']['bi'] == 'none' and
			jsonmessage['operations']['query']['geographic'] == 'none' and
			jsonmessage['operations']['query']['inventory'] == 'none' and
			jsonmessage['operations']['query']['time'] == 'none'
		)


		# Getting the token from the main  server
		# or creating a uuid locally

		# note that we only get around the main server parts rather than rewriting the whole process for more consistent maintainance as local and federated proxies are functionally the same

		if not islocal:
			accepted, message = Components.getWelcomeFromServer()
		else:
			# local proxy are automatic
			accepted = True

			message = {'token': "local_"+str(uuid.uuid4()).replace("-","_")}




		if accepted:
			#assembling the manifest

			proxy_id = message['token']
			print "RECEIVED TOKEN %s" % proxy_id
			jsonmessage['token'] = proxy_id
			filledok, manifest = premanifest.fillSafely(jsonmessage)


			if not islocal:
				approved, response = Components.sendProxyManifestRaw (json.dumps(manifest))

				print "RECEIVED RESPONSE FOR RAW MANIFEST: %s" % approved
				print response

			else:
				approved = True




			if approved:


				created, message = ProxyFS.createSoftProxy(proxy_id, manifest, linkedto)

				if created:
					success = True
					report = "Creazione del proxy %s completata." % jsonmessage['name']
				else:
					success = False
					report = "Creazione del proxy %s fallita. Errore locale: %s" % (jsonmessage['name'], str(message))

			else:

				success = False
				report = "Creazione del proxy %s fallita. Errore dal federatore: %s" % (jsonmessage['name'], str(response))


		else:
			success = False
			report = "Creazione del proxy %s fallita, riprovare.<br>(%s)" % (jsonmessage['name'], message)


		result = {
			'success': success,
			'report': report
		}

	except Exception as ex:

		traceback.print_exc()
		print (type(ex))
		print ex
		result = {
			'success':	False,
			'report':	"Errore nella procedura: %s" % str(ex)
		}




	print json.dumps(result)

	return HttpResponse(json.dumps(result), mimetype="application/json")


@csrf_exempt
def proxy_controller (request):
	"""
	receives a POST request with the following parameters: action, proxy_id, meta_id, shape_id (if needed, technically only action and proxy_id may be mandatory, but this is dealt at function level)
	:param request:
	:return:
	"""

	actions = {
		'delete': proxy_web.deleteMap,
		'deleteproxy': proxy_web.deleteProxy,
		'fiderst': proxy_web.createStProxy
	}

	action = request.POST['action']
	oppath = {}

	try:
		oppath['proxy_id'] = request.POST['proxy_id']
		oppath['meta_id'] = request.POST['meta_id']
		oppath['shape_id'] = request.POST['shape_id']
	except:
		# we try to get the most detailed path, but we do not know if the function to be called will need all parameters, so no warning is thrown here
		pass


	try:
		result = actions[action](**oppath)
	except Exception, ex:
		result = {
			'success':	False,
			'report':	"Errore: %s" % str(ex)
		}

	return HttpResponse(json.dumps(result), mimetype="application/json")




def proxy_rebuildmeta (request, **kwargs):
	#TODO: placeholder, implement
	pass


def proxy_rebuildall (request, **kwargs):
	"""
	Rebuilds all maps in all metas in the proxy
	:param request:
	:param kwargs:
	:return:
	"""

	proxy_id = kwargs['proxy_id']

	manifest = getProxyManifest(proxy_id)

	result = {
		'success': [],
		'error': []
	}

	for cmeta in manifest['metadata']:
		meta_id = cmeta['name']

		mapdir = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_geojson, meta_id)
		for mapfile in os.listdir(mapdir):
			os.unlink(os.path.join(mapdir, mapfile))

		try:
			meta_data = proxy_core.rebuildMeta(proxy_id, meta_id)
			print "Rebuilding %s" % meta_data.keys()
			for shape_id in meta_data.keys():
				print "Rebuilding map %s" % shape_id
				#print meta_data[shape_id]
				proxy_core.replicateShapeData(meta_data[shape_id], proxy_id, meta_id, shape_id, False)
			result['success'].append(meta_id)
			print "Rebuilt %s" % meta_id
		except Exception as ex:
			traceback.print_exc()

			print "Failed to rebuild %s" % meta_id
			result['error'].append(meta_id)

	return HttpResponse(json.dumps(result), mimetype="application/json")




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
			print "Invio del file %s su %s per integrazione completato." % (upload.name, output)
			response_upload['success'] = True
			response_upload['report'] = "Invio del file %s su %s per integrazione completato." % (upload.name, output)
		else:
			print "Invio del file %s fallito. Causa: %s <br>" % (upload.name, output)
			response_upload['report']= "Invio del file %s fallito. Causa: %s <br>" % (upload.name, output)


	return HttpResponse(json.dumps(response_upload), mimetype="application/json")



def proxy_rebuildmap (request, **kwargs):


	proxy_id  = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	shape_id = kwargs['shape_id']

	print "Rebuilding map %s/%s/%s" % (proxy_id, meta_id, shape_id)

	try:
		ProxyFS.handleFileEvent (os.path.join(proxyconf.baseuploadpath, proxy_id, meta_id, shape_id+".zip"))
		#quick hack for first time uploads
		if shape_id == "undefined":
			shape_id = ""
		response_rebuild = {
			'success': True,
			'report': 'Mappa %s aggiornata.' % shape_id
		}
	except Exception, ex:
		print ex
		response_rebuild = {
			'success': False,
			'report': unicode(ex)
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

	elif ( manifest['operations']['query']['geographic'] != "none" or
		   manifest['operations']['query']['time'] != "none" or
		   manifest['operations']['query']['bi'] != "none" or
		   manifest['operations']['query']['inventory'] != "none" ):

		return "query"
	else:
		# local is a standalone-only proxy, non-federated
		return "local"


def proxy_get_all (request):
	"""
	returns a key/value dict with guid:manifest of each soft proxy currently on the hard proxy
	:param request:
	:return: json
	"""

	return HttpResponse(json.dumps(getManifests()), mimetype="application/json")




def getManifests ():
	"""
	Returns a dict of soft proxies manifests for the current hard proxy
	:return:
	"""

	#TODO: move to proxy_core or ProxyFS, add error handling

	proxylist = {}
	for manifestfile in os.listdir(proxyconf.basemanifestpath):
		proxy_id = manifestfile.partition(".manifest")[0]
		print "Loading manifest for %s" % proxy_id
		fp_manifest = open(os.path.join(proxyconf.basemanifestpath, manifestfile))
		proxylist[proxy_id] = json.load(fp_manifest)
		fp_manifest.close()

	#print proxylist
	return proxylist




def getProxyManifest (proxy_id):

	#TODO: move to proxy_core or ProxyFS, add error handling

	filename = os.path.join(proxyconf.basemanifestpath, proxy_id+".manifest")
	fp = open(filename, 'r')
	manifestdata = json.load(fp)
	fp.close()

	return manifestdata


@csrf_exempt
def reviewPostGIS (request, **kwargs):
	"""
	returns the current conversion table for a specific query adapted to the currently available columns of the DB *in case* the db can be accessed, otherwise it takes the description in the file
	:param request:
	:return:
	"""



	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	map_id = kwargs['map_id']

	try:
		conv_fp = open (os.path.join(proxyconf.baseproxypath, proxy_id, "conf", "mappings", meta_id, map_id))
		pretable = json.load(conv_fp)
		conv_fp.close()
	except:
		pretable = None

	conn_fp = open (os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror, meta_id, map_id))
	conndesc= json.load(conn_fp)
	conn_fp.close()

	conndata = conndesc['connection']
	querydata = conndesc['query']

	workingdb = False
	try:
		sqldata = proxy_query.probePostGIS(conndata, querydata['view'], querydata['schema'])
		if len(sqldata) > 0:
			workingdb = True
	except Exception, ex:
		#it is not relevant if the DB is down or has no data in it (the latter is arguably much worse)
		pass

	#TODO: switch conversion tables to the new models?
	convtable = {}
	if workingdb:
		for columndata in sqldata:

			if columndata[0] in pretable.keys():
				convtable[columndata[0]] = pretable[columndata[0]]
			else:
				convtable[columndata[0]] = []
	else:
		if pretable is not None:
			convtable = pretable

	response_review = {
		'success': workingdb,
		'report': convtable
	}

	return HttpResponse(json.dumps(response_review), mimetype="application/json")



@csrf_exempt
def probePostGIS (request):
	"""
	Performs a basic query to according to the parmaters received by POST to a PostGIS db server and returns the structure of the table
	:param request:
	:return: json with success/fail and report (error string or table data)
	"""

	conndata = json.loads(request.POST['jsonmessage'])['connection']
	querydata = json.loads(request.POST['jsonmessage'])['query']


	response_probe = {
		'success': False,
		'report': ''
	}

	try:
		sqldata = proxy_query.probePostGIS(conndata, querydata['view'], querydata['schema'])
		if len(sqldata) == 0:
			response_probe ['report'] = "Nessun risultato."
		else:
			response_probe = {
				'success': True,
				'report': sqldata
			}
	except Exception, ex:
		#print "ERROR: %s" % ex
		response_probe['report'] = "Interrogazione fallita: %s" % ex

	#print response_probe

	return HttpResponse(json.dumps(response_probe), mimetype="application/json")


@csrf_exempt
def registerquery (request, **kwargs):
	"""
	saves info for a specific query on disc, with the connection string in the mirror directory and the conversion table in the mappings directory
	:param request:
	:return: json with success/fail and report
	"""

	print request.POST
	#print kwargs

	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']

	print "Working on",proxy_id, meta_id

	jsondata = json.loads(request.POST['jsonmessage'])

	print "JSONDATA: "+str(jsondata)

	conn = jsondata['connection']
	cid = jsondata['connection']['name']

	response_register = {
		'success': False,
		'report': 'null'
	}

	try:
		proxy_query.registerQuery (proxy_id, meta_id, cid, conn)
		response_register['success'] = True
		response_register['report'] = "Connessione registrata con successo."
	except Exception as ex:
		response_register['report'] = "ERRORE: %s" % ex

	return HttpResponse(json.dumps(response_register), mimetype="application/json")


def saveMapFile (uploaded, proxy_id, meta_id, shape_id=None):
	"""
	Takes an uploaded file (usually InMemoryUploadedFile) and saves it to the proxy/meta/shape destination, if needed after normalising the names inside
	:param uploaded:
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	print "Uploading file %s, size %s " % (uploaded.name, uploaded.size)
	#print "Data: %s " % (str(uploaded.read()))

	isvalid = proxy_core.verifyShapeArchiveStructure(uploaded)
	if not isvalid:
		return False, "Struttura dell'archivio non valida"

	if shape_id is None:
		shape_id = uploaded.name[:-4]
		if os.path.exists(os.path.join(proxyconf.baseuploadpath, proxy_id, meta_id, uploaded.name)):
			os.remove(os.path.join(proxyconf.baseuploadpath, proxy_id, meta_id, uploaded.name))
		fs = FileSystemStorage(location=os.path.join(proxyconf.baseuploadpath))
		savepath = fs.save(os.path.join(proxy_id, meta_id, shape_id+".zip"), File(uploaded))
		return True, savepath
	else:
		try:
			if os.path.exists(os.path.join(proxyconf.baseuploadpath, proxy_id, meta_id, shape_id+".zip")):
				os.remove(os.path.join(proxyconf.baseuploadpath, proxy_id, meta_id, shape_id+".zip"))

			zipfrom = zipfile.ZipFile(uploaded)
			zipdata = zipfrom.infolist()
			try:
				zipto = zipfile.ZipFile(os.path.join(proxyconf.baseuploadpath,proxy_id, meta_id, shape_id+".zip"), 'w', zipfile.ZIP_DEFLATED)
			except:
				zipto = zipfile.ZipFile(os.path.join(proxyconf.baseuploadpath,proxy_id, meta_id, shape_id+".zip"), 'w', zipfile.ZIP_STORED)
			for element in zipdata:
				filename = element.filename.replace(element.filename.split(".")[0], shape_id)
				zipto.writestr(filename, zipfrom.read(element))
			zipto.close()
			return True, shape_id

		except Exception as ex:
			#print ex.message
			return False, "Eccezione: %s" % ex


def set_access_control_headers(response):
	response['Access-Control-Allow-Origin'] = '*'
	response['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
	response['Access-Control-Max-Age'] = 1000
	response['Access-Control-Allow-Headers'] = '*'

class HttpOptionsDecorator(object):
	def __init__(self, f):
		self.f = f

	def __call__(self, *args, **kwargs):
		#logging.info("Call decorator")
		request = args[0]
		if request.method == "OPTIONS":
			response = HttpResponse()
			set_access_control_headers(response)
			return response
		else:
			response = self.f(*args, **kwargs)
			set_access_control_headers(response)
			return response


@HttpOptionsDecorator
def proxy_read_full (request, **kwargs):
	"""
	returns all the data for a specific proxy
	:param request:
	:param kwargs:
	:return:
	"""

	read_result = {}

	proxy_id = kwargs['proxy_id']

	print "DJANGO: performing full read of proxy %s " % proxy_id

	try:
		read_result = proxy_core.handleReadFull(proxy_id)
	except Exception as ex:

		print "Error: "+str(ex)



	return HttpResponse(read_result, mimetype="application/json")


@csrf_exempt
def proxy_perform_query (request, **kwargs):
	"""
	Performs an sql query on proxy, meta, map as per kwargs with the JSON message in request.POST
	:param request:
	:param kwargs:
	:return:
	"""

	print "**************\nRequest data: %s " % request.POST

	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']

	querydata = request.POST['remotequery']

	print "PRE-QUERY DATA REQ: %s (%s)" % (querydata, type(querydata))

	geojson = proxy_query.makeQueryOnMeta(proxy_id, meta_id, querydata)

	#print "ABOUT TO SEND BACK: %s " % geojson

	return HttpResponse(geojson, mimetype="application/json")


@csrf_exempt
def sideloadSTMap (request, **kwargs):
	"""
	copies a map from the standalone area to the requested meta_id and map_id, all vars passed via post
	:param request:
	:param kwargs:
	:return:
	"""

	proxy_id = request.POST['proxy_id']
	meta_id = request.POST['meta_id']
	map_id = request.POST['map_id']
	saveto = request.POST['saveto']
	if not saveto or saveto is None or saveto == "":
		saveto = map_id



	response_sideload = ProxyFS.sideloadST (proxy_id, meta_id, map_id, saveto)



	return HttpResponse(json.dumps(response_sideload), mimetype="application/json")

def getProviders(request):

	return HttpResponse(urllib2.urlopen(proxyconf.URL_PROVIDERS), mimetype="application/json")


def geosearch(request, path):
	import httplib2
	conn = httplib2.Http()


	url = path

	if request.method == 'GET':
			url_ending = '%s?%s' % (url, request.GET.urlencode())
			url = "http://" + url_ending
			response, content = conn.request(url, request.method)
	elif request.method == 'POST':
			url = "http://" + url
			data = request.POST.urlencode()
			response, content = conn.request(url, request.method, data)
	return HttpResponse(content, status = int(response['status']),
mimetype = response['content-type'])
