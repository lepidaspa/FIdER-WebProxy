#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
from django.http import HttpResponse
from django.shortcuts import render_to_response
from django.template.context import RequestContext
from django.utils.safestring import SafeString
from django.views.decorators.csrf import csrf_exempt
import json
import shutil
import string
import zipfile
import traceback
import os
import urllib
import urllib2

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'



from Common import Components
from FIdERProxyFS import proxy_core
from FIdERProxyFS import proxy_config_core as proxyconf



def mapvisng (request, **kwargs):
	"""
	Opens the map vis/edit function
	:param request:
	:param kwargs:
	:return:
	"""

	proxy_id = kwargs['proxy_id']
	manifest = proxy_core.getManifest(proxy_id)

	vismode = kwargs['vismode']
	# vismode must reflect one of these
	validmodes = ["modeledit", "mapview", "mapedit", "full"]
	"""
	Modes breakdown
	- Modeler: edits the model of a single map, still requires loading the map (maybe with a few reductions) but does NOT show it.
	- Mapview: views a single map, can select single elements and make filters but no changes are allowed
	- Mapedit: edits a single map, can select elements make filters and changes. Can SAVE AS but not load other maps or create new maps
	- Full: can do everything and allows to load and create as a starting point
	"""

	if vismode not in validmodes:
		raise Exception ("Not a valid mode")
	else:
		if vismode != "full":
			meta_id = kwargs['meta_id']
			map_id = kwargs['map_id']
		else:
			meta_id = None
			map_id = None

	print "Launching *%s* with context %s/%s/%s" % (vismode, proxy_id, meta_id, map_id)




	proxy_type = proxy_core.learnProxyTypeAdv(proxy_id, manifest)

	mapsdata = proxy_core.getMapsSummary(proxy_id)

	if meta_id != '.create':
		setmodel = mapsdata[meta_id][map_id]['type']
	elif map_id == 'DefaultLine':
		setmodel = 'LineString'
	elif map_id == 'DefaultPoint':
		setmodel = 'Point'


	proxy_meta = mapsdata.keys()
	proxy_mapsbymeta = {}
	for cmeta_id in proxy_meta:
		proxy_mapsbymeta [cmeta_id] = mapsdata[cmeta_id].keys()

	print "Proxy maps data: %s " % proxy_mapsbymeta

	modeldata = getModels()
	print "Proxy models: %s" % modeldata

	return render_to_response ('mapvisng.html', {'proxy_id': proxy_id, 'meta_id': meta_id, 'map_id': map_id, 'manifest': SafeString(json.dumps(manifest)), 'mode': vismode, 'proxy_name': manifest['name'], 'proxy_meta': proxy_meta, 'proxy_type': proxy_type, 'mapsbymeta': proxy_mapsbymeta, 'proxy_maps': mapsdata, 'mapsforjs': SafeString(json.dumps(mapsdata)), 'proxy_models': SafeString(json.dumps(modeldata)), 'rawmodels': modeldata, 'maptype': setmodel}, context_instance=RequestContext(request))



def uiview (request, **kwargs):
	"""
	Loads the interface of the standalone tool
	:param request:
	:param kwargs:
	:return:
	"""

	proxy_editables = proxy_core.getAllEditables()

	# we always have a proxy_id since the standalone area is specific to each proxy.
	proxy_id = kwargs['proxy_id']

	try:
		req_meta_id = kwargs['meta_id']
		req_map_id = kwargs['shape_id']
	except:
		req_meta_id = None
		req_map_id = None

	manifest = proxy_core.getManifest(proxy_id)

	proxy_name = manifest['name']
	proxy_meta = []

	maplist = {}
	for metadata in manifest['metadata']:
		meta_id = metadata['name']
		proxy_meta.append(meta_id)
		try:
			maplist[meta_id] = proxy_editables[proxy_id][meta_id]
		except:
			# we can have empty metadata
			pass

	#maplist_st = []
	maplist_st = os.listdir(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone))


	print proxy_id, proxy_name, proxy_meta, maplist, maplist_st

	models = getModels()

	return render_to_response ('fwstui.html', {'proxy_id': proxy_id, 'proxy_name': proxy_name, 'proxy_meta': SafeString(json.dumps(proxy_meta)), 'maps_fider': SafeString(json.dumps(maplist)), 'maps_st': SafeString(json.dumps(maplist_st)),  'models': SafeString(json.dumps(models)), 'manifest': SafeString(json.dumps(manifest)), 'sel_meta': req_meta_id, 'sel_map': req_map_id}, context_instance=RequestContext(request))

@csrf_exempt
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

def getModels ():
	"""
	Returns a dictionary with the extended models list combining local and server provided models
	:return:
	"""

	PACKAGE_ROOT = os.path.abspath(os.path.dirname(__file__))
	print os.getcwd()
	modelfile = os.path.join(PACKAGE_ROOT, "models.json")
	print modelfile
	backupfile = os.path.join (PACKAGE_ROOT, "models.json.backup")
	print backupfile
	
	fp = open(modelfile)
	models = json.load(fp)
	fp.close()

	# maps models are not "registered" and will be loaded from the editor itself "on the fly"

	hasmodels, models_fider = Components.getModelsFromServer()
	if hasmodels:
		print "received models from external server: %s" % models_fider.keys()
		try:
			for model_key in models_fider.keys():
				models[model_key] = models_fider[model_key]
			fp = open(backupfile, 'w+')
			json.dump({"DefaultLine": models['DefaultLine'], "DefaultPoint": models['DefaultPoint']}, fp)
			fp.close()
		except Exception as ex:
			print "could not add server models to local models dict"
			print ex
		else:
			shutil.copy(backupfile, modelfile)


	else:
		print "did not receive models from external server"

	return models


@csrf_exempt
def uploadfile (request, **kwargs):
	"""
	loads a new map file in the standalone area after processing it into a geojson map.
	Based on the similar function in FiderWeb
	:param request:
	:param kwargs:
	:return:
	"""

	response_upload = {
		'success': False,
		'report': ''
	}

	upload = None

	print "Uploader: init"

	if request.method == 'POST':
		try:
			#print "Raw data: %s" % request.FILES
			upload = request.FILES['shapefile']
		except:
			response_upload['report'] = "Nessun file inviato."
			print "no file sent"
	else:
		response_upload['report'] = "Metodo di accesso non valido."
		print "bad method"

	print "file upload detected, handling"

	if upload is not None:

		proxy_id = kwargs['proxy_id']
		#meta_id = request.POST['meta_id']
		print "uploading to %s / Standalone" % proxy_id

		map_id = normaliseMapName(upload.name)

		print "FORM: Uploading file to %s/Standalone Area/%s" % (proxy_id, map_id)


		try:
			success, output = saveMapToST(upload, proxy_id, map_id)
			print "Result for fwst upload:\n%s\n%s" % (success, output)
			if success:
				response_upload['success'] = True
				response_upload['report'] = "Invio del file %s su %s per integrazione completato." % (map_id, output)
			else:
				response_upload['report']= "Invio del file %s fallito. Causa: %s <br>" % (map_id, output)
		except Exception as ex:
			print "ST Uploading error"
			print ex, ex.message
			response_upload['report'] = "Caricamento fallito. Causa: %s <br>" % ex


	return HttpResponse(json.dumps(response_upload), mimetype="application/json")

def normaliseMapName(namereq):
	"""
	normalises a file name to make it a proper mapname on the proxy; does not check length, only chars
	:param namereq:
	:return:
	"""

	allowed = string.ascii_letters + string.digits + "_"
	cleanname = ''
	for cchar in namereq[:-4]:
		if cchar in allowed:
			cleanname += cchar

	return cleanname


def saveMapToST (uploaded, proxy_id, map_id):
	"""
	Tries to save the uploaded map to the standalone area of the proxy
	:param uploaded:
	:param proxy_id:
	:param map_id:
	:return:
	"""

	map_id = map_id

	print "Uploading file %s, size %s " % (uploaded.name, uploaded.size)
	#print "Data: %s " % (str(uploaded.read()))

	isvalid = proxy_core.verifyShapeArchiveStructure(uploaded)
	if not isvalid:
		return False, "Struttura dell'archivio non valida"

	destpath = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone, map_id)

	# we unzip here
	desttemp = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone, "."+map_id)
	try:
		os.makedirs(desttemp)
	except Exception as ex:
		for cfile in os.listdir(desttemp):
			os.remove(os.path.join(desttemp, cfile))

	zipfrom = zipfile.ZipFile(uploaded)

	zipfrom.extractall(desttemp)

	mapdata = proxy_core.convertShapePathToJson(desttemp, normalise=False)

	dest_fp = open(destpath, 'w+')
	json.dump(mapdata, dest_fp, encoding="latin-1")
	shutil.rmtree(desttemp)


	return True, map_id





@csrf_exempt
def saveSTMap (request, **kwargs):
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
		#print "DATA: %s" % mapdata

		path_tool = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone)

		dest_fp = open(os.path.join(path_tool, map_id), 'w+')
		json.dump(json.loads(mapdata), dest_fp, encoding="latin-1")
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

@csrf_exempt
def downloadStaticMap (request, **kwargs):
	"""
	Downloads a static background map from an external service
	:param request:
	:param kwargs:
	:return:
	"""

	print "Downloading static map from request"


	"""
	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	map_id = kwargs['map_id']

	proxy_type = proxy_core.learnProxyTypeAdv(proxy_id, proxy_core.getManifest(proxy_id))

	# getting the maps from the gj dir (or ST in case of the standalone instance)
	if proxy_type != 'local':
		pathtojs = os.path.join (proxyconf.baseproxypath, proxy_id, proxyconf.path_geojson, meta_id, map_id)
	else:
		pathtojs = os.path.join (proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone, map_id)

	mapdataraw = json.load(open(pathtojs))

	mapinfo = proxy_core.getMapFileStats(pathtojs)

	print "Working on map data for %s/%s/%s:\n%s" % (proxy_id, meta_id, map_id, mapinfo)
	"""

	try:
		print "Received parameters array, going by POST data"
		#print request.REQUEST
		params = json.loads(request.POST['jsondata'])
	except Exception as ex:
		print "Missing parameters array, going by default"
		params = None

	print "Params: %s" % params.items()

	urlparams = {}
	urlparams['provider'] = params['provider']

	if params['provider'] == 'google':
		baseurl = "http://maps.googleapis.com/maps/api/staticmap"
		urlparams['format'] = 'png32'
		sizeX = min(params['drawsize'][0], 640)
		sizeY = min(params['drawsize'][1], 640)
		urlparams['size']= str(sizeX)+'x'+str(sizeY)
		# note: could use 2 as scale but creates issues later on the js side
		urlparams['scale']='1'
		urlparams['sensor']='false'
		try:
			urlparams['maptype'] = params['maptype']
			print "Maptype from client params: %s" % params['maptype']
		except:
			print "Non valid maptype from client params: %s" % params['maptype']
			urlparams['maptype'] = 'roadmap'

	if params['provider'] == 'osm':
		sizeX = min(params['drawsize'][0], 1280)
		sizeY = min(params['drawsize'][1], 1280)
		urlparams['size']= str(sizeX)+'x'+str(sizeY)
		baseurl = "http://staticmap.openstreetmap.de/staticmap.php"
		try:
			urlparams['maptype'] = params['maptype']
			print "Maptype from client params: %s" % params['maptype']
		except:
			urlparams['maptype'] = 'mapnik'

	print "Partially compiled: %s" % urlparams

	print "Created render defaults for %s.%s" % (urlparams['provider'], urlparams['maptype'])

	print params['drawcenter']

	urlparams['center'] = str(params['drawcenter'][0])+","+str(params['drawcenter'][1])
	urlparams['zoom'] = params['drawzoom']

	"""
	try:
		urlparams['center'] = params['center']
	except:
		centerY = str((mapinfo['bbox'][1]+mapinfo['bbox'][3])/2)
		centerX = str((mapinfo['bbox'][2]+mapinfo['bbox'][4])/2)
		urlparams['center'] = "%s,%s" % (centerY,centerX)
	"""

	#http://maps.googleapis.com/maps/api/staticmap?size=640x640&scale=2&maptype=roadmap&visible=44.2506162174,12.3382646288|44.2667622346,12.3572303763&sensor=false
	#http://staticmap.openstreetmap.de/staticmap.php?center=40.714728,-73.998672&zoom=14&size=865x512&maptype=mapnik

	print "URL params %s" % urlparams


	params_serialized = []
	for key, value in urlparams.items():
		params_serialized.append((key, value))

	paramsencoded = urllib.urlencode (params_serialized)
	print "Encoded: %s" % baseurl+"?"+paramsencoded

	try:
		outimage = urllib2.urlopen(baseurl+"?"+paramsencoded).read()
		outimagestr = outimage.encode("base64")
		#print outimage
	except Exception as ex:
		print "ERROR: %s " % ex
		traceback.print_exc()
		raise

	return HttpResponse(outimagestr)






@csrf_exempt
def saveVisMap (request, **kwargs):
	"""
	Saves a map from the Vis tool to the requested meta
	:param request:
	:param kwargs:
	:return:
	"""

	try:
		proxy_id = kwargs['proxy_id']
		meta_id = kwargs['meta_id']
		map_id = kwargs['map_id']
		#map_id = request.POST['mapname']

		mapdata = request.POST['jsondata']

		print "Changes submitted for map %s to standalone tool %s in meta %s" % (map_id, proxy_id, meta_id)
		print "format %s" % (type(mapdata))
		#print "DATA: %s" % mapdata

		if meta_id == ".st":
			deploypath = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_standalone)
			path_tool = os.path.join(deploypath, map_id)
		else:

			deploypath = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror, meta_id, map_id)
			if not os.path.exists (deploypath):
				os.makedirs(deploypath)
			path_tool = os.path.join(deploypath, map_id+".geojson")



		dest_fp = open(path_tool, 'w+')

		json.dump(json.loads(mapdata), dest_fp, encoding="latin-1")

		dest_fp.close()

		if meta_id != ".st":

			print "Rebuilding data locally"
			proxy_core.replicateShapeData(proxy_core.rebuildShape(proxy_id, meta_id, map_id, False), proxy_id, meta_id, map_id, False)


			print "Rebuilding data on linker"
			destproxy = proxy_core.findLinkedBy(proxy_id)
			if destproxy is not None:
				print "Rebuilding map data on linker proxy %s" % destproxy
				try:
					proxy_core.replicateShapeData(proxy_core.rebuildShape(destproxy, meta_id, map_id, False), destproxy, meta_id, map_id, False)
				except Exception as ex:
					print "Error while rebuilding shape on linker proxy: %s" % ex
			else:
				print "No destination proxy for this instance %s" % proxy_id

		feedback = {
			'success': True,
			'report': "Mappa salvata correttamente."
		}

	except Exception as ex:

		print "Save fail due to:\n%s" % ex

		feedback = {

			'success': False,
			'report': "Errore: %s" % ex

		}


	return HttpResponse(json.dumps(feedback), mimetype="application/json")
