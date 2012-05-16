#!/usr/bin/env python
# -*- coding: utf-8 -*-
import copy
import json
from osgeo import ogr
import shutil
import zipfile
import time
from Common import MessageTemplates
from FIdERProxyFS import proxy_lock
from FIdERProxyFS.ProxyFS import createMessageFromTemplate
from MarconiLabsTools import ArDiVa

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

import os.path
import os

import proxy_config_core as conf

from Common.errors import *
from FIdERFLL import validate_fields

def getManifest (proxy_id):

	return json.load(open(os.path.join(conf.baseproxypath,proxy_id,conf.path_manifest)))

def createSoftProxy (proxy_id, manifest):
	"""
	Creates the filestructure for a softproxy using the chosen id and the manifest
	:param proxy_id:
	:param manifest:
	:return:
	"""

	basepath = os.path.join(conf.baseproxypath, proxy_id)
	uploadpath = os.path.join(conf.baseuploadpath, proxy_id)

	if os.path.exists(os.path.join(conf.baseproxypath, proxy_id)):
		raise ProxyAlreadyExistsException ("A proxy %s already exists" % proxy_id)

	#creating base proxy paths: main and upload
	os.makedirs (basepath)
	os.makedirs (uploadpath)

	#creating config directory
	os.makedirs(os.path.join(basepath, "conf"))

	#creating directories for data
	os.makedirs(os.path.join(basepath, "next"))
	os.makedirs(os.path.join(basepath, conf.path_geojson))
	os.makedirs(os.path.join(basepath, conf.path_mirror))

	json.dump(manifest, os.path.join(basepath,conf.path_manifest))

	for cmeta in manifest['metadata']:
		meta_id = cmeta['name']

		os.makedirs (os.path.join(basepath, "conf", "mappings", meta_id))
		os.makedirs (os.path.join(uploadpath, meta_id))
		os.makedirs (os.path.join(basepath, conf.path_geojson, meta_id))
		os.makedirs (os.path.join(basepath, conf.path_mirror, meta_id))



def verifyUpdateStructure (eventpath):
	"""
	Takes the path of the file event and returns, if verified, the identification of proxy, metadata and shape
	:param eventpath:
	:return: list with proxy_instance, meta_id, shape_id
	"""

	basepath, zipfilename = os.path.split(eventpath)
	basepath, meta_id = os.path.split(basepath)
	basepath, proxy_id = os.path.split(basepath)


	if os.path.realpath(basepath) != os.path.realpath(conf.baseuploadpath):
		raise InvalidDirException ("Upload path structure %s is not matched by event path %s" % (conf.baseuploadpath, eventpath))

	# getting the shape_id by removing the .zip extension from the zipfile name
	try:
		shape_id = zipfilename[:-4]
	except:
		raise InvalidShapeIdException ("Could not extract a valid shapeid from the shape file archive name" % zipfilename)

	# getting manifest data for verification

	try:
		manifest_fp = open(os.path.join(conf.baseproxypath, proxy_id, conf.path_manifest))
	except:
		raise InvalidProxyException ("Proxy instance %s does not exist" % proxy_id)
	else:
		manifest = json.load(manifest_fp)
		manifest_fp.close()

	# checking the meta_id against the list
	meta_in_manifest = False
	for currentmeta in manifest['metadata']:
		if currentmeta['name'] == meta_id:
			meta_in_manifest = True
			break

	if not meta_in_manifest:
		raise InvalidMetaException ("Could not find meta_id %s in proxy %s" % (meta_id, proxy_id))

	return proxy_id, meta_id, shape_id


def handleDelete (proxy_id, meta_id, shape_id):
	"""
	Removes the shapefile data from the $mirror directory
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	path_mirror = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, shape_id)

	if not os.path.exists(path_mirror):
		raise Exception ("Data for %s/%s already deleted in the mirror section of proxy %s" % (meta_id, shape_id, proxy_id))
	else:
		#TODO: add specific handling of further exceptions or just push it up the ladder
		shutil.rmtree(path_mirror)

def replicateDelete (proxy_id, meta_id, shape_id):
	"""
	Removes the shapefile data from the gjs directory
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	path_gj = os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson, meta_id, shape_id)

	if not os.path.exists(path_gj):
		raise Exception ("Data for %s/%s already deleted in the geojson section of proxy %s" % (meta_id, shape_id, proxy_id))
	else:
		#TODO: add specific handling of further exceptions or just push it up the ladder
		shutil.rmtree(path_gj)


def buildReadList (proxy_id, timestamp):
	"""
	Check which metadata have been updated after the timestamp
	:param proxy_id:
	:param timestamp:
	:return:
	"""

	metalist = []

	if timestamp == None:
		#total read, all meta used
		return os.listdir(os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson))
	else:
		#making a list of the meta that have actually been upgraded
		prelist = os.listdir(os.path.join(conf.baseproxypath, proxy_id, "next"))

		for meta_id in prelist:
			if os.path.getmtime(os.path.join(conf.baseproxypath, proxy_id, "next", meta_id)):
				metalist.append(meta_id)




	return metalist


def handleRead (proxy_id, datestring):
	"""
	Reads the metadata updated after timestamp and returns them in json format
	:param proxy_id:
	:param datestring: ISO8601 datestring
	:return:
	"""

	#TODO: handle validation and exceptions

	locker = proxy_lock.ProxyLocker (retries=3, wait=5)

	try:
		timestamp = validate_fields.extractTimestampFromISO8601(datestring)
	except:
		timestamp = None

	meta_dict = {}
	for meta_id in buildReadList(proxy_id, timestamp):
		meta_dict [meta_id] = locker.performLocked(assembleMetaJson, proxy_id, meta_id)

	if timestamp is not None:
		returnstamp = None
	else:
		returnstamp = time.strftime("%Y-%m-%dT%H:%M:%SZ",timestamp)

	template = MessageTemplates.model_response_read
	customfields = {
		"token" : proxy_id,
		"time" : returnstamp,
		"data": {
			"upserts" : meta_dict,
			"delete" : []
		}
	}

	responsemsg = createMessageFromTemplate(template, **customfields)

	#NOTE that the read happens as a HTTPResponse, so we only return the json for Django to send back, rather than handling the HTTPConnection ourselves

	return json.dumps(responsemsg)




def handleUpsert (proxy_id, meta_id, shape_id):
	"""
	This function adds or modifies the shapefile data to the $mirror directory
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	# first we check if the directory already exists
	# in case we remove it and write the new data so we ensure we use a clean environment

	try:
		zipfilename = os.path.join(conf.baseuploadpath, proxy_id, meta_id, shape_id, ".zip")
		zipfp = zipfile.ZipFile(zipfilename, mode='r')
	except:
		#leaving as placeholder in case we want to add a more specific handling
		raise

	# Inspecting zip file to ensure it does NOT contain path data in the filenames, which is forbidden in our use, and that the files in it have the proper naming for a SINGLE shapefile structure

	ext_mandatory = {
		".shp": False,
		".shx": False,
		".dbf": False
	}

	ext_accept = [
		".shp", ".shx", ".dbf", ".prj", ".sbn", ".sbx", ".fbn", ".fbx", ".ain", ".aih", ".ixs", ".mxs", ".atx", ".cpg", ".shp.xml"
	]

	for candidatepath in zipfp.namelist():
		#checking that no file unpacks to a different directory
		if "/" in candidatepath:
			raise InvalidShapeArchiveException ("Shapefile archives should not contain names with path data")
		else:
			#checking that the names of the file are correct
			cext = None
			for valid in ext_accept:
				if candidatepath.endswith(valid):
					cext = valid
					if cext in ext_mandatory:
						ext_mandatory[cext] = True
					break
			if cext is None:
				raise InvalidShapeArchiveException ("Shape archive %s contains unrelated data in file %s " % (shape_id, candidatepath))

	if not all(ext_mandatory.values):
		raise InvalidShapeArchiveException ("Mandatory file missing in shape archive %s (should contain .shp, .shx and .dbf)" % shape_id)

	#creating the path after opening the zip so there is a smaller risk of leaving trash behind if we get an error
	path_mirror = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, shape_id, ".tmp")
	if os.path.exists(path_mirror):
		shutil.rmtree(path_mirror)
	os.makedirs(path_mirror)

	#TODO: ensure that we remove any read-only flags and set the correct permissions if needed
	zipfp.extractall(path_mirror)


def convertShapefileToJson (path_shape):
	"""
	Converts a shapefile to GeoJSON data and returns it.
	:param path_shape: path of the shape file to be converted
	:return: geojson feature data
	"""

	basepath, shape_id = os.path.split(path_shape)
	basepath, meta_id = os.path.split(basepath)
	basepath, proxy_id = os.path.split(basepath)


	#TODO: verify key name for shape id information

	collection = {
		'id' : shape_id,
		'type': 'FeatureCollection',
		'features' : []
	}


	try:
		datasource = ogr.Open(path_shape)
	except:
		return False

	jsonlist = []

	for i in range (0, datasource.GetLayerCount()):
		layer = datasource.GetLayer(i)
		for f in range (0, layer.GetFeatureCount()):
			feature = layer.GetFeature(f)
			jsondata = feature.ExportToJson()

			jsondata = adaptGeoJson(jsondata, getConversionTable(proxy_id, meta_id, shape_id))

			collection['features'].append(jsondata)



	return collection


def getConversionTable (proxy_id, meta_id, shape_id):
	"""
	Returns a conversion table for geojson features properties. returns a dictionary with dict[keyfrom] = keyto. Returns None if there is NO table for the specified shape_id, raises an Exception if the file exists but cannot be properly accessed or parsed
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	tablepath = os.path.join(conf.baseproxypath, proxy_id, "conf", "mappings", meta_id, shape_id+".json")

	if not os.path.exists (tablepath):
		return None
	else:
		try:
			return json.load(open(tablepath))
		except Exception as ex:
			raise ConversionTableAccessException ("Error while accessing conversion table for %s.%s.%s: %s" % (proxy_id, meta_id, shape_id, ex.message))




def adaptGeoJson (jsondata, conversiontable=None):
	"""
	Takes a GeoJson dict and removes all non-compliant keys in "FEATURE" elements, field 'PROPERTIES'; non compliant keys are those keys that are not defined specifically by the geojson specifications AND do not appear in the conversion table. The conversion table is used to change the name of the keys matched by its keys()
	:param jsondata:
	:param conversiontable: single level dictionary:
	:return:
	"""

	if conversiontable is None:
		conversiontable = {}

	keysequences =  ArDiVa.getKeysWithPath(jsondata, [u'feature',])

	for keyseq in keysequences:
		newdict = {}
		landing = ArDiVa.digDictVals(keyseq+u'properties')
		for keyfrom in landing:
			if keyfrom in conversiontable:
				keyto = conversiontable[keyfrom]
				newdict[keyto] = landing[keyfrom]

		path = copy.copy(keyseq)
		target = jsondata
		while len(path)>0:
			target = target[path.pop()]
		target['properties'] = newdict


	return jsondata







def assembleMetaJson (proxy_id, meta_id):
	"""
	Creates a list of (dict)json objects from the files in the gjs section of the soft proxy and returns it
	:param proxy_id:
	:param meta_id:
	:return: list of dicts (from json)
	"""

	meta_json = []

	filelist = os.listdir(os.path.join (conf.baseproxypath, proxy_id, conf.path_geojson, meta_id))

	for filename in filelist:
		try:
			fp = open(filename, 'r')
			try:
				meta_json.append(json.load(fp))
			except:
				raise RuntimeProxyException ("Non valid json data in file %s for meta %s on proxy %s" % (filename, meta_id, proxy_id))
			finally:
				fp.close()
		except:
			raise RuntimeProxyException ("Could not access map data %s for meta %s on proxy %s" % (filename, meta_id, proxy_id))


	return meta_json

def rebuildShape (proxy_id, meta_id, shape_id, modified=True):
	"""
	Rebuilds the GeoJSON data for the specified shape file, from the .tmp subdir if the file is marked as modified. Returns the geojson dict
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:param modified:
	:return: dict, geojson data
	"""


	path_shape = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, shape_id)
	if modified:
		path_shape = os.path.join(path_shape, ".tmp")

	shape_gj = convertShapefileToJson (path_shape)

	return shape_gj

def replicateShapeData (shapedata, proxy_id, meta_id, shape_id, modified=True):
	"""
	Saves the current geojson data for a specific shape to the geojson directory. If modified is true, the .tmp directory in the mirror section replaces the old data
	:param shapedata:
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	try:
		shape_fp = open (os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson, meta_id, shape_id))
		json.dump(shapedata, shape_fp)
		shape_fp.close()
	except:
		#TODO: add more complex exception handling
		raise

	if modified:
		# we replace the mirror directory contents with the .tmp directory
		path_mirror = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, shape_id)
		path_mirror_tmp = os.path.join(path_mirror, ".tmp")


		# TODO: add handling for remove errors, should we have any "strays"
		for filename in os.listdir(path_mirror):
			if filename != ".tmp":
				os.remove(os.path.join(path_mirror, filename))

		# TODO: add handling for remove errors to avoid data losses
		for filename in os.listdir(path_mirror_tmp):
			shutil.copy(os.path.join(path_mirror_tmp, filename), path_mirror)

		shutil.rmtree (path_mirror_tmp)

def rebuildMeta (proxy_id, meta_id, upserts=None):
	"""
	Rebuilds the GeoJSON data for the specified meta, taking the requested upserts from their .tmp dirs instead. Note that the data has been already partially validated and extracted
	:param proxy_id:
	:param meta_id:
	:param upserts: list with the elements in the meta that must be taken from their own .tmp dir rather than from the main $mirror branch
	:return: dict of geojson elements, with shape_ids as key
	"""

	path_meta = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id)

	shapelist = os.listdir(path_meta)

	shapes_gj = {}
	for shape_id in shapelist:
		if shape_id in upserts:
			modified = True
		else:
			modified = False
		shapes_gj [shape_id] = rebuildShape(proxy_id, meta_id, shape_id, modified)

	return shapes_gj

def queueForSend (proxy_id, meta_id):
	"""
	Adds a metadata to the list of updated files for this proxy
	:param proxy_id:
	:param meta_id:
	:return:
	"""

	nextfilepath = os.path.join (conf.baseproxypath, proxy_id, "next", meta_id)

	open(nextfilepath, 'w').close()









