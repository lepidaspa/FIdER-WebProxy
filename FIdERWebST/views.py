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
				'name': 'Punto',
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
			if success:
				response_upload['success'] = True
				response_upload['report'] = "Invio del file %s su %s per integrazione completato." % (map_id, output)
			else:
				response_upload['report']= "Invio del file %s fallito. Causa: %s <br>" % (map_id, output)
		except Exception as ex:
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


@csrf_exempt
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
	except:
		for cfile in os.listdir(desttemp):
			os.remove(os.path.join(desttemp, cfile))

	zipfrom = zipfile.ZipFile(uploaded)

	zipfrom.extractall(desttemp)

	mapdata = proxy_core.convertShapePathToJson(desttemp, normalise=False)

	dest_fp = open(destpath, 'w+')
	json.dump(mapdata, dest_fp)
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