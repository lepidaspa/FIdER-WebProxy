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

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

import os


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

	models = {
		'DefaultPoint' :
			{
				'objtype': 'Point',
				'name': 'Nodo',
				'properties': {
					'OwnerID': 'str',
					'Owner': 'str',
					'Depth': 'int',
					'Type': 'str',
					'Infrastructure': ['TLC', 'Illuminazione', 'Rete elettrica', 'Rete idrica']
				}
			},
		'DefaultLine' :
			{
				'objtype': 'LineString',
				'name': 'Tratta',
				'properties': {
					'OwnerID': 'str',
					'Owner': 'str',
					'Length': 'int',
					'Depth': 'int',
					'Type': 'str',
					'StartID': 'str',
					'EndID': 'str',
					'Infrastructure': ['TLC', 'Illuminazione', 'Rete elettrica', 'Rete idrica']
				}
			}
	}

	#TODO: add local "registered" models

	hasmodels, models_fider = Components.getModelsFromServer()
	if hasmodels:
		for model_key in models_fider.keys():
			models[model_key] = models_fider[model_key]

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

			destproxy = proxy_core.findLinkedBy(proxy_id)
			if destproxy is not None:
				print "Rebuilding map data on linker proxy %s" % destproxy
				try:
					proxy_core.rebuildShape(proxy_id, meta_id, map_id)
				except Exception as ex:
					print "Error while rebuilding shape on linker proxy: %s" % ex
			else:
				print "No destination proxy for this instance %s" % proxy_id

		dest_fp = open(path_tool, 'w+')

		json.dump(json.loads(mapdata), dest_fp, encoding="latin-1")
		dest_fp.close()

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