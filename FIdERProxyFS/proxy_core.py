#!/usr/bin/env python
# -*- coding: utf-8 -*-


# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
from exceptions import Exception
import Common.TemplatesModels
import FIdERProxyFS.proxy_config_core as conf
import traceback

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'


import os.path
import os
import sys
import shutil
import copy
import zipfile
import time
import json

from osgeo import ogr

sys.path.append("../")

from Common.errors import *

from Common import TemplatesModels
from FIdERProxyFS import proxy_lock
import proxy_config_core as conf
from FIdERFLL import validate_fields
from Common.Components import createMessageFromTemplate, sendMessageToServer


def getManifest (proxy_id):
	"""
	Returns the manifest file for a specified softproxy
	:param proxy_id:
	:return:
	"""
	print "Requested manifest for proxy %s" % proxy_id
	return json.load(open(os.path.join(conf.basemanifestpath, proxy_id+".manifest")))


def getMapFileStats(mappath):
	"""
	Loads a mapfile and returns map type (line/point), number of features, bbox if applicable
	:param mappath:
	:return:
	"""

	rawdata = json.load(open(mappath))

	# we get the maptype from the model or from the first feature, inconsistencies should have already been checked
	try:
		maptype = rawdata['model']['objtype']
	except:
		maptype = rawdata['features'][0]['geometry']['type']

	try:
		bbox = rawdata['bbox']
	except:
		#note: should never happen since the transformation process adds it
		bbox = None

	try:
		features = len(rawdata['features'])
	except:
		features = 0

	return {'type': maptype, 'features': features, 'bbox': bbox}


def getQueryInfo (proxy_id, meta_id, map_id):
	"""
	Returns generic info on the query with the same structure as getMapStats (essentially the objtype from the conversion, everything else is nulled out)
	:param proxy_id:
	:param meta_id:
	:param map_id:
	:return:
	"""


	bbox = None
	features = None
	maptype = None

	return {'type': maptype, 'features': features, 'bbox': bbox}


def makeMapCard (proxy_id, meta_id, map_id, proxy_type):
	"""

	:param proxy_id:
	:param meta_id:
	:param map_id:
	:param proxy_type:
	:return:
	"""

	if proxy_type == 'query':
		mappath = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, map_id)
	elif proxy_type != 'local' or meta_id != '.st':
		mappath = os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson, meta_id, map_id)
	else:
		mappath = os.path.join(conf.baseproxypath, proxy_id, conf.path_standalone, map_id)

	remotedata = None
	mapsource = "File"
	if proxy_type != 'query':
		mapdata = getMapFileStats(mappath)
		if isRemoteMap(proxy_id, meta_id, map_id):

			mapsource = "WFS"

			#adding remotedata info (connection parameters)
			remotedata = json.load(open(os.path.join(conf.baseproxypath, proxy_id, "conf", "remote", meta_id, map_id+".wfs")))
			"""
			remotedata = {
				"URL": remotedataraw['url'],
				"Mappa": remotedataraw['layer'],
				"Utente": remotedataraw['user'],
				"Password": remotedataraw['pass']
			}
			"""
		if isFTPMap (proxy_id, meta_id, map_id):
			mapsource = "FTP"
			remotedata = json.load(open(os.path.join(conf.baseproxypath, proxy_id, "conf", "remote", meta_id, map_id+".ftp")))
	else:
		mapsource = "Query"
		mapdata = getQueryInfo (proxy_id, meta_id, map_id)

		#adding remotedata info (connection parameters)
		remotedata = json.load(open(os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, map_id)))
		"""
		remotedata = {
			'Host':		remotedataraw['connection']['host']+":"+remotedataraw['connection']['port'],
			'Utente':	remotedataraw['connection']['user'],
			'Password':	remotedataraw['connection']['pass'],
			'Database': remotedataraw['connection']['dbname'],
			'Schema':	remotedataraw['query']['schema'],
			'Vista':	remotedataraw['query']['view']
		}
		"""


	mapcard = {
		'name': map_id,
		'source': mapsource,
		'type': mapdata['type'],
		'bbox': mapdata['bbox'],
		'features': mapdata['features'],
		'remotedata': remotedata
	}

	return mapcard

def isRemoteMap (proxy_id, meta_id, map_id):
	"""

	:param proxy_id:
	:param meta_id:
	:param map_id:
	:return: boolean
	"""

	return os.path.exists(os.path.join(conf.baseproxypath, proxy_id, conf.path_remoteres, meta_id, map_id+'.wfs'))

def isFTPMap (proxy_id, meta_id, map_id):
	"""

	:param proxy_id:
	:param meta_id:
	:param map_id:
	:return: boolean
	"""

	return os.path.exists(os.path.join(conf.baseproxypath, proxy_id, conf.path_remoteres, meta_id, map_id+'.ftp'))

def getMapsSummary (proxy_id):
	"""
	Returns a list of all the maps with their core stats (name, type, source, number of shapes),grouped by meta
	:param proxy_id:
	:return: dict
	"""

	print "Loading the map summary for proxy %s" % proxy_id

	wfslist = getRemotesList(proxy_id)
	mapslist = {}

	manifest = getManifest(proxy_id)
	proxy_type = learnProxyTypeAdv(proxy_id, manifest)

	basequerypath = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror)
	basemapspath = os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson)


	for metadata in manifest['metadata']:
		meta_id = metadata['name']

		mapslist[meta_id] = {}

		if proxy_type == 'query':
			mapspath = os.path.join (basequerypath, meta_id)
		else:
			mapspath = os.path.join (basemapspath, meta_id)
		metamapslist = os.listdir(mapspath)

		for map_id in metamapslist:

			mapslist[meta_id][map_id] = makeMapCard(proxy_id, meta_id, map_id, proxy_type)


	if proxy_type == 'local':

		meta_id = ".st"
		mapspath = os.path.join(conf.baseproxypath, proxy_id, conf.path_standalone)
		stmapslist = os.listdir(mapspath)

		mapslist [meta_id] = {}
		for map_id in stmapslist:
			mapslist[meta_id][map_id] = makeMapCard(proxy_id, meta_id, map_id, proxy_type)


	return mapslist


def makeSoftProxy (proxy_id, manifest, linkedto=None):
	"""
	Creates the filestructure for a softproxy using the chosen id and the manifest
	:param proxy_id:
	:param manifest:
	:return:
	"""

	basepath = os.path.join(conf.baseproxypath, proxy_id)
	uploadpath = os.path.join(conf.baseuploadpath, proxy_id)

	if os.path.exists(os.path.join(conf.baseproxypath, proxy_id)):
		raise ProxyAlreadyExistsException ("Esiste già un proxy %s" % proxy_id)

	#creating base proxy paths: main and upload
	os.makedirs (basepath)
	os.makedirs (uploadpath)

	#creating config directory, log directory, locks directory
	os.makedirs(os.path.join(basepath, "conf"))
	os.makedirs(os.path.join(basepath, "locks"))



	#creating directories for data
	os.makedirs(os.path.join(basepath, "next"))
	os.makedirs(os.path.join(basepath, conf.path_geojson))

	if linkedto is None:
		os.makedirs(os.path.join(basepath, conf.path_mirror))
	else:
		os.symlink(os.path.join(conf.baseproxypath, linkedto, conf.path_contacts), os.path.join(basepath, conf.path_contacts))
		os.symlink(os.path.join(conf.baseproxypath, linkedto, conf.path_mirror), os.path.join(basepath, conf.path_mirror))
		linkerdict = { 'linkedto': linkedto }
		json.dump(linkerdict, open(os.path.join(basepath, "conf", "linkedto.json"), 'w+'))


	os.makedirs(os.path.join(basepath, conf.path_standalone))

	#TODO: remove after cleaning up any code that leads to this file
	# (old proxy manifest location)
	fp_manifest = open(os.path.join(basepath,conf.path_manifest),'w+')
	json.dump(manifest, fp_manifest)
	fp_manifest.close()

	fp_hpmanifest = open(os.path.join(conf.basemanifestpath, proxy_id+".manifest"), 'w+')
	json.dump(manifest, fp_hpmanifest)
	fp_hpmanifest.close()

	for cmeta in manifest['metadata']:
		meta_id = cmeta['name']

		os.makedirs (os.path.join(basepath, conf.path_mappings, meta_id))
		os.makedirs (os.path.join(basepath, conf.path_remoteres, meta_id))
		os.makedirs (os.path.join(uploadpath, meta_id))
		os.makedirs (os.path.join(basepath, conf.path_geojson, meta_id))
		if linkedto is None:
			os.makedirs (os.path.join(basepath, conf.path_mirror, meta_id))

	if linkedto is not None:
		print "Linker proxy: trying to rebuild all maps inherited from the current state of the linked standalone"
		try:
			rebuildAllData(proxy_id)
			print "Autorebuild successful"
		except Exception as ex:
			print "Autorebuild failed because of %s" % ex

def findLinkedBy (proxy_id):
	"""
	Returns which proxy_id is the id of a linker proxy linked to the current one. Returns None if the current proxy is not a standalone or if it has no linker
	:param proxy_id:
	:return:
	"""

	linkedBy = None

	for candidate_id in getProxyList():
		path_linkinfo = os.path.join(conf.baseproxypath, candidate_id, "conf", "linkedto.json")
		try:
			linkdataraw = json.load(open(path_linkinfo, 'r'))
			linked_id = linkdataraw['linkedto']
			if linked_id == proxy_id:
				linkedBy = candidate_id
		except:
			pass

	print "LinkedBy output: %s is linked by proxy %s" % (proxy_id, linkedBy)

	return linkedBy



def rebuildAllData (proxy_id):
	"""
	Rebuilds all maps in the softproxy from the mirror directory
	:param proxy_id:
	:return:
	"""


	manifest = getManifest(proxy_id)

	result = {
	'success': [],
	'error': []
	}

	for cmeta in manifest['metadata']:
		meta_id = cmeta['name']

		mapdir = os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson, meta_id)
		for mapfile in os.listdir(mapdir):
			os.unlink(os.path.join(mapdir, mapfile))

		try:

			mapslist = os.listdir (os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id))
			print "Rebuilding %s" % mapslist
			for shape_id in mapslist:
				print "Rebuilding map %s" % shape_id
				mapdata = rebuildShape(proxy_id, meta_id, shape_id, False)
				mapdata['id'] = shape_id
				replicateShapeData(mapdata, proxy_id, meta_id, shape_id, False)
			result['success'].append(meta_id)
			print "Rebuilt %s" % meta_id
		except Exception as ex:
			traceback.print_exc()

			print "Failed to rebuild %s" % meta_id
			result['error'].append(meta_id)

	return result




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
		raise InvalidShapeIdException ("Could not extract a valid shapeid from the shape file archive name %s" % zipfilename)

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

	if meta_id != '.st':

		path_mirror = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, shape_id)

		if not os.path.exists(path_mirror):
			print "WARNING: Data for %s/%s already deleted in the mirror section of proxy %s" % (meta_id, shape_id, proxy_id)
		else:
			#TODO: add specific handling of further exceptions or just push it up the ladder
			shutil.rmtree(path_mirror)



	else:
		path_mapfile = os.path.join(conf.baseproxypath, proxy_id, conf.path_standalone, shape_id)
		os.remove(path_mapfile)




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
		print ("WARNING: Data for %s/%s already deleted in the geojson section of proxy %s" % (meta_id, shape_id, proxy_id))
	else:
		#TODO: add specific handling of further exceptions or just push it up the ladder
		os.remove(path_gj)

	linkedby = findLinkedBy(proxy_id)
	if linkedby is not None:
		replicateDelete(linkedby, meta_id, shape_id)


def readSingleShape (proxy_id, meta_id, shape_id):
	"""
	returns the json data of a specific shape from the geojson directory
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	path_gj = os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson, meta_id, shape_id)

	fp_json = open(path_gj, 'r')
	gjdata = json.load(fp_json)
	fp_json.close()

	return json.dumps(gjdata)


def buildReadList (proxy_id, timestamp=None):
	"""
	Check which metadata have been updated after the timestamp
	:param proxy_id:
	:param timestamp:
	:return:
	"""

	metalist = []
	print "PROXY READ LIST FOR REQUEST on %s at %s" % (proxy_id, timestamp)

	if timestamp is None:
		#total read, all meta used

		metalist = os.listdir(os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson))
	else:
		#making a list of the meta that have actually been upgraded
		prelist = os.listdir(os.path.join(conf.baseproxypath, proxy_id, "next"))

		for meta_id in prelist:
			if os.path.getmtime(os.path.join(conf.baseproxypath, proxy_id, "next", meta_id)):
				metalist.append(meta_id)


	print "PROXY READ LIST IS %s " % metalist


	return metalist


def handleReadMeta (proxy_id, meta_id):
	"""
	Same as assembleMetaJson but with real-time rebuild
	:param proxy_id:
	:param meta_id:
	:return:
	"""

	meta_json = []

	metadir = os.path.join (conf.baseproxypath, proxy_id, conf.path_mirror, meta_id)

	filelist = os.listdir(metadir)

	for map_id in filelist:
		try:
			fullmapjson = convertShapeFileToJson(proxy_id, meta_id, map_id, True)
			meta_json += fullmapjson['features']
		except:
			print ("Could not access map data %s for meta %s on proxy %s" % (map_id, meta_id, proxy_id))

	return meta_json


def handleReadFull (proxy_id):
	"""
	Reads everything in the specified proxy and returns it as a json message
	:param proxy_id:
	:return:
	"""

	#note: just a modified version of handleReadTimed

	#TODO: handle validation and exceptions

	locker = proxy_lock.ProxyLocker (retries=3, wait=5)

	meta_dict = {}
	for meta_id in buildReadList(proxy_id):
		#meta_dict [meta_id] = locker.performLocked(assembleMetaJson, proxy_id, meta_id)
		try:
			meta_dict[meta_id] = locker.performLocked(handleReadMeta, proxy_id, meta_id)
		except RuntimeProxyException as ex:
			print "Exception encountered: %s" % ex.message

	print "Read performed"

	template = TemplatesModels.model_response_read_full
	customfields = {
		"token" : proxy_id,
		"data": {
			"upserts" : meta_dict,
			"delete" : []
		}
	}

	responsemsg = createMessageFromTemplate(template, **customfields)


	print "RESULT: %s features " % len(responsemsg)
	#NOTE that the read happens as a HTTPResponse, so we only return the json for Django to send back, rather than handling the HTTPConnection ourselves

	return json.dumps(responsemsg)



def handleReadTimed (proxy_id, datestring):
	"""
	Reads all metadata updated after timestamp and returns them in json format
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

	template = TemplatesModels.model_response_read
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


def verifyShapeArchiveStructure (filedata, filename=None):
	"""
	Checks that a map archive of an accepted type contains the correct elements. Mostly relevant for shapefiles
	:param filedata:
	:param filename:
	:return:
	"""


	print "Verifying archived shape %s" % (filename)

	try:
		zipfp = zipfile.ZipFile(filedata)
	except Exception as ex:
		print "Exception in zip loading: %s" % ex
		return False

	ext_mandatory_shape = {
		"shp": False,
		"shx": False,
		"dbf": False,
		"prj": False
	}

	ext_mandatory_minfo = {
		"mif": False,
		"mid": False
	}

	ext_mandatory_json = {
		"geojson": False
	}

	for candidatepath in zipfp.namelist():
		#print "Checking candidate path %s" % candidatepath
		#checking that no file unpacks to a different directory
		if "/" in candidatepath:
			return False
		else:
			cext = candidatepath.split(".")[-1]
			if ext_mandatory_shape.has_key(cext):
				ext_mandatory_shape[cext] = True
			if ext_mandatory_minfo.has_key(cext):
				ext_mandatory_minfo[cext] = True
			if ext_mandatory_json.has_key(cext):
				ext_mandatory_json[cext] = True

		if filename is not None:
			if candidatepath.split(".")[0] != filename:
				print "Archive/data filename mismatch"
				return False

	if not (all(ext_mandatory_shape.values()) or all(ext_mandatory_minfo.values()) or all(ext_mandatory_json.values())):
		return False



	return True


def handleUpsert (proxy_id, meta_id, shape_id):
	"""
	This function adds or modifies the shapefile data to the $mirror directory
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""


	print "Handling upsert on %s %s %s" % (proxy_id, meta_id, shape_id)
	# first we check if the directory already exists
	# in case we remove it and write the new data so we ensure we use a clean environment

	try:
		zipfilename = os.path.join(conf.baseuploadpath, proxy_id, meta_id, shape_id+".zip")

		print "Unpacking file %s" % zipfilename

		zipfp = zipfile.ZipFile(zipfilename, mode='r')
	except:
		print "Issue when opening zip file %s " % zipfilename
		#leaving as placeholder in case we want to add a more specific handling
		raise

	# Inspecting zip file to ensure it does NOT contain path data in the filenames, which is forbidden in our use, and that the files in it have the proper naming for a SINGLE shapefile structure

	ext_mandatory_shape = {
		"shp": False,
		"shx": False,
		"dbf": False,
		"prj": False
	}

	ext_mandatory_minfo = {
		"mif": False,
		"mid": False
	}

	ext_mandatory_json = {
		"geojson": False
	}

	ext_accept = [
		".shp", ".shx", ".dbf", ".prj", ".sbn", ".sbx", ".fbn", ".fbx", ".ain", ".aih", ".ixs", ".mxs", ".atx", ".cpg", ".shp.xml", ".qix", ".fix", ".qpj"
	]

	print "Working on unpacked data"

	for candidatepath in zipfp.namelist():
		#checking that no file unpacks to a different directory
		if "/" in candidatepath:
			raise InvalidShapeArchiveException ("Shapefile archives should not contain names with path data")
		else:

			cext = candidatepath.split(".")[-1]
			print candidatepath, cext
			if ext_mandatory_shape.has_key(cext):
				ext_mandatory_shape[cext] = True
			if ext_mandatory_minfo.has_key(cext):
				ext_mandatory_minfo[cext] = True
			if ext_mandatory_json.has_key(cext):
				ext_mandatory_json[cext] = True
			#removed strict check on accepted fie types

	print ext_mandatory_shape, ext_mandatory_minfo, ext_mandatory_json
	if not (all(ext_mandatory_shape.values()) or all(ext_mandatory_minfo.values()) or all(ext_mandatory_json.values()) ):
		raise InvalidShapeArchiveException ("Mandatory file missing in shape archive %s (should contain .shp, .shx, .dbf and .prj for shape file OR .mif and .mid for mapinfo OR .geojson for geojson)" % shape_id)

	#creating the path after opening the zip so there is a smaller risk of leaving trash behind if we get an error
	path_mirror = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, shape_id, ".tmp")
	if os.path.exists(path_mirror):
		shutil.rmtree(path_mirror)
	os.makedirs(path_mirror)

	#TODO: ensure that we remove any read-only flags and set the correct permissions if needed
	zipfp.extractall(path_mirror)



def convertShapeFileToJson (proxy_id, meta_id, shape_id, normalise=True):
	"""
	Converts a shapefile to GeoJSON data and returns it.
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:param normalise: boolean, if we want to normalise the file
	:return:
	"""
	shapepath = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, shape_id)

	print "Path is: %s (%s proxy type)" % (shapepath, learnProxyTypeAdv(proxy_id, getManifest(proxy_id)))
	print "Path data will be normalised? %s " % normalise

	return convertShapePathToJson(shapepath, normalise)

def getCoreFile (path_mapdir):
	"""
	Given a directory with map files in it, will (heuristically) find the "main" file for the accepted type of maps. We handle SHP an MINFO files for now. Note that the file dir is supposed to have already been validated (so no mixed types)
	:param path_mapdir:
	:return:
	"""

	core_ext = ['shp', 'mif', 'geojson']
	allfiles = os.listdir(path_mapdir)
	#print "Seeking core file from %s" % allfiles
	for cfile in allfiles:
		filename, sep, ext = cfile.partition(".")
		if ext in core_ext:
			#print "Found core file %s for path %s" % (cfile, path_mapdir)
			return cfile

	# if we find no core file we throw an exception (it should not be possible, otherwise the dir would NOT have been validated)
	raise Exception ("Missing core file in map dir %s" % path_mapdir)


def convertShapePathToJson (path_shape, normalise=True, temp=False):
	"""
	Converts a shapefile to GeoJSON data and returns it.
	:param path_shape: path of the shape file to be converted
	:param normalise: defines if we want to remove or modify elements in the  'properties' section according to the server's settings
	:param temp: if we are working on the .tmp directory
	:return: geojson feature data
	"""

	#gdal.SetConfigOption('GML_INVERT_AXIS_ORDER_IF_LAT_LONG', 'NO')

	#TODO: debug only, remove if not needed (error 1 on empty geoms)
	ogr.UseExceptions()

	EPSG_WGS84 = 4326

	print "Shape conversion to JSON format"

	if temp is True:
		basepath, temp_holder = os.path.split(path_shape)
		basepath, shape_id = os.path.split(basepath)
	else:
		basepath, shape_id = os.path.split(path_shape)

	basepath, meta_id = os.path.split(basepath)


	print "Work paths: %s / %s / %s" % (basepath, meta_id, shape_id)



	issinglefile = len(os.listdir(path_shape)) == 1
	print "Single file? %s" % issinglefile
	if issinglefile:
		#print "One file only"
		path_shape = os.path.join(path_shape, os.listdir(path_shape)[0])
	else:
		#print "Multiple files, heuristic find"
		path_shape = os.path.join(path_shape, getCoreFile(path_shape))


	print "Main item:",path_shape


	basepath = basepath.partition(conf.path_mirror)[0]

	if basepath.endswith("/"):
		basepath = basepath[:-1]

	basepath, proxy_id = os.path.split(basepath)


	#TODO: verify key name for shape id information

	collection = {
		'id' : shape_id,
		'type': 'FeatureCollection',
		'features' : [],
	}


	try:

		print "Getting datasource from shape path %s" % path_shape
		#print "Datasource raw data: %s " % open(path_shape, "r").read()
		datasource = ogr.Open(str(path_shape))
		print "EXTRACTING DATASOURCE SRS DATA:"
		print "****>"+str(datasource)
	except Exception as ex:
		print "ERROR during OGR parse on %s: %s" % (path_shape, ex)
		raise


	#SRS CONVERSION CODE
	print "Setting SRS conversion"
	tSRS=ogr.osr.SpatialReference()
	tSRS.ImportFromEPSG(EPSG_WGS84)
	#print "Converting to %s " % tSRS

	#SRS CONVERSION CODE


	print "Requiring normalisation? %s" % normalise
	if normalise is True:
		convtable = getConversionTable(proxy_id, meta_id, shape_id)
		print "Data will be normalised with convtable %s" % (convtable,)


	#boundaries defines the implicit bounding box of the map.
	# Using angular measure
	boundaries = [181, 91,-181, -91]

	print "Inspecting datasource %s " % datasource


	# fix for when OGR cannot assign a featureid
	noid = []
	maxid = 0


	for i in range (0, datasource.GetLayerCount()):
		layer = datasource.GetLayer(i)
		#print "EXTRACTING LAYER SRS DATA:"
		#print "****>"+str(dir(layer))

		sSRS=layer.GetSpatialRef()
		#print "Layer %s has %s features with spatial ref %s" % (layer, layer.GetFeatureCount(), sSRS)
		print "Layer %s has %s features" % (layer, layer.GetFeatureCount())




		feature = layer.GetNextFeature()
		while feature is not None:
		#for f in range (0, layer.GetFeatureCount()):
		#		feature = layer.GetFeature(f)

			#if f==0:
			#	print "EXTRACTING FEATURE SRS DATA:"
			#	print "****>"+str(dir(feature))

			#print "Feature %s geometry from %s into..." % (feature, geom)
			try:
				#geom.AssignSpatialReference(sSRS)

				geom = feature.GetGeometryRef()

				geom.TransformTo(tSRS)
				geom.AssignSpatialReference(tSRS)
				#print "Feature %s geometry to   %s" % (feature, geom)
			except Exception as ex:
				print "Transformation error on %s: %s" % (feature ,ex)
				#print "Error on feature %s geometry %s: %s " % (feature, f, geom)


				#TODO: REMOVE, SHOULD BE HERE ONLY FOR DEBUG
				continue

			# fixed to output actual dict

			#print "DEBUG: exporting %s to JSON" % feature
			"""
			print "Exporting feature to JSON"
			print feature
			rawjson = feature.ExportToJson()
			print "Moving raw json to json dict"
			jsondata = json.loads(rawjson)
			#print "DEBUG: exported %s" % jsondata
			"""
			#print "Exporting feature to JSON"
			#print feature.keys()
			#print feature.items()
			#print feature.geometry()
			#jsondata = feature.ExportToJson(as_object=True)

			#print jsondata

			#print "Recreating obj struct"

			jsondata = {}
			jsondata['type'] = "Feature"

			#print "Getting properties"
			jsondata['properties'] = feature.items()

			#print "Getting geometry"
			jsondata['geometry'] = json.loads(feature.geometry().ExportToJson())

			#print "Object recreated"

			#print "feature.exportToJson outputs "+str(type(jsondata))

			# we may want to keep to original "properties" elements


			if normalise:
				jsondata = adaptGeoJson(jsondata, convtable)


			positions = []

			ftype = jsondata['geometry']['type']
			fgeom = jsondata['geometry']['coordinates']

			#print "Setting bbox for feature type %s" % ftype
			if ftype == 'Point':
				positions.append(fgeom)
			elif ftype == 'LineString' or ftype == 'MultiPoint':
				for position in fgeom:
					positions.append(position)
			elif ftype == 'MultiLineString':
				for linestring in fgeom:
					for position in linestring:
						positions.append(position)

			for position in positions:

				if position[0] < boundaries[0]:
					boundaries[0] = position[0]
				if position[0] > boundaries[2]:
					boundaries[2] = position[0]

				if position[1] < boundaries[1]:
					boundaries[1] = position[1]
				if position[1] > boundaries[3]:
					boundaries[3] = position[1]


			#print "DEBUG: JSONDATA: %s (%s)" % (jsondata, type(jsondata))

			if jsondata.has_key(id):
				try:
					if int(jsondata['id']) > maxid:
						maxid = int(jsondata['id'])
				except:
					pass
			else:
				noid.append(len(collection['features']))


			if ftype in ("LineString", "Point"):
				collection['features'].append(jsondata)
			elif ftype in ("MultiLineString", "MultiPoint"):
				fitems = []
				if ftype == "MultiLineString":
					convtype = "LineString"
				elif ftype == "MultiPoint":
					convtype = "Point"
				for fitem in fgeom:
					jsonobj = copy.deepcopy (jsondata)
					jsonobj['geometry']['type'] = convtype
					jsonobj['geometry']['coordinates'] = fitem
					collection['features'].append(jsonobj)


			feature = layer.GetNextFeature()

	for seqid in noid:
		collection['features'][seqid]['id'] = maxid
		maxid+=1


	print "Boundaries set to "+str(boundaries)
	collection['bbox'] = boundaries

	if len(collection['features']) == 0:
		print 'Could not retrieve any feature from map %s' % shape_id
		raise Exception ('Could not retrieve any feature from map %s') % shape_id
	else:
		print "Retrieved %s features " % len(collection['features'])

	return collection


def learnProxyTypeAdv (proxy_id, manifest):
	"""
	Returns the FUNCTIONAL proxy type, adding the specific case of the linked proxy
	:param proxy_id:
	:param manifest:
	:return:
	"""

	baseproxytype = learnProxyType(manifest)
	print "Found base proxy type %s " % baseproxytype
	if baseproxytype in ('local', 'query'):
		islinked = False
	else:
		islinked = isLinkedProxy(proxy_id, manifest['name'])

	print "Proxy is linked? %s" % islinked

	if islinked:
		return 'linked'
	else:
		return baseproxytype



def learnProxyType (manifest):
	"""
	Reads the manifest dict and returns the type of proxy as Read, Write, Query
	NOTE: duplicate from FiderWeb to avoid risk of cross-imports
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


def isLinkedProxy (ref_id, ref_name):
	"""
	returns whether the reference proxy is linked to another proxy (actually a standalone tool)
	:return:
	"""

	for proxy_cmp in getProxyList():

		name_cmp = getManifest(proxy_cmp)['name']

		if ref_id != proxy_cmp and name_cmp == ref_name:
			return True

	return False


def getProxyList ():
	"""
	Returns a list of the softproxies on the hardproxy
	:return:
	"""

	manifests = os.listdir(os.path.join(conf.baseproxypath, "proxies"))

	listing = []
	for proxymanfile in manifests:
		listing.append(proxymanfile.split(".")[0])

	return listing

def getAllEditables ():
	"""
	Returns a dict with proxy/meta/shape of only editable maps (queries excluded) in the hardproxy. Note that element with key ".name" in a proxy is not a meta but the name of the proxy (. char cannot be used in meta names)
	:return:
	"""

	maplist = {}

	proxymanifests = os.listdir(conf.basemanifestpath)
	for manfile in proxymanifests:
		manifestdata = json.load(open(os.path.join(conf.basemanifestpath, manfile)))

		proxy_id = manfile.split(".")[0]

		if learnProxyType(manifestdata) != 'query':

			maplist[proxy_id] = {}
			maplist[proxy_id]['.name'] = manifestdata['name']

			for metadata in manifestdata['metadata']:
				meta_id = metadata['name']
				maplist[proxy_id][meta_id] = []

				mapfilenames = os.listdir(os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id))
				for mapname in mapfilenames:
					maplist[proxy_id][meta_id].append(mapname)


	return maplist






def getRemotesList (proxy_id):
	"""
	Returns a list of all the remote resource config files (i.e. WFS) retrieved for the specified proxy.
	:param proxy_id:
	:return: list of dicts with meta_id, shape_id keys/values
	"""

	maps_remotepath = []

	proxy_remotepath = os.path.join (conf.baseproxypath, proxy_id, conf.path_remoteres)

	for meta_id in os.listdir(proxy_remotepath):
		meta_remotepath = os.path.join(proxy_remotepath, meta_id)
		for mapconf in os.listdir(meta_remotepath):
			maps_remotepath.append({'meta_id': meta_id, 'mapconf': mapconf})

	return maps_remotepath







def getConversionTable (proxy_id, meta_id, shape_id):
	"""
	Returns a conversion table for geojson features properties. returns a dictionary with dict[keyfrom] = keyto. Returns None if there is NO table for the specified shape_id, raises an Exception if the file exists but cannot be properly accessed or parsed
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	tablepath = os.path.join(conf.baseproxypath, proxy_id, "conf", "mappings", meta_id, shape_id)
	print "Requesting conversion table from %s " % (tablepath,)

	if not os.path.exists (tablepath):
		return None
	else:
		try:
			return json.load(open(tablepath))
		except Exception as ex:
			print "Error while accessing conversion table for %s.%s.%s: %s" % (proxy_id, meta_id, shape_id, ex.message)
			raise ConversionTableAccessException ("Error while accessing conversion table for %s.%s.%s: %s" % (proxy_id, meta_id, shape_id, ex.message))



def adaptGeoJson (jsondata, conversiontable=None):
	"""
	Takes a GeoJson dict and removes all non-compliant keys in PROPERTIES element; non compliant keys are those keys that are not defined specifically by the geojson specifications AND do not appear in the conversion table. The conversion table is used to change the name of the keys matched by its keys()
	:param jsondata:
	:param conversiontable: single level dictionary:
	:return:
	"""

	#in case the function is called with a str/unicode
	if isinstance(jsondata, (str, unicode)):
		jsondata = json.loads(jsondata)




	if conversiontable is None or (not conversiontable.has_key('forcedfields')) or (not conversiontable.has_key('fields')):
		conversiontable = {'forcedfields':{}, 'fields':{}, 'unmapped':{}}

	newdict = {}
	try:
		landing = jsondata[u'properties']
	except:
		landing = {}


	#print "GeoJson adaptation flow start"

	#print "Using conversiontable:\n%s" % conversiontable


	convlist = conversiontable['fields']

	for itemfrom in convlist:
		applies = True
		if landing.has_key(itemfrom):
			# use original value or conversion
			cvalue = landing[itemfrom]
			if convlist[itemfrom]['values'].has_key(cvalue):
				cvalue = convlist[itemfrom]['values'][cvalue]
		else:
			try:
				# use default value if we have this value in the model but not in the property set
				cvalue = convlist[itemfrom]['values']['']
			except:
				applies = False


		if applies:
			newdict[convlist[itemfrom]['to']] = cvalue

	forcedlist = conversiontable['forcedfields']
	for itemto in forcedlist:
		newdict[itemto] = forcedlist[itemto]['']

	try:
		for unmapped in conversiontable['unmapped']:
			newdict[unmapped] = None
	except Exception as ex:
		#  supporting older conversion tables
		pass

	jsondata['properties'] = newdict


	return jsondata







def assembleMetaJson (proxy_id, meta_id):
	"""
	Creates a list of (dict)json objects from the files in the gjs section of the soft proxy and returns it
	:param proxy_id:
	:param meta_id:
	:return: list of dicts (from json)
	"""

	meta_json = []

	metadir = os.path.join (conf.baseproxypath, proxy_id, conf.path_geojson, meta_id)

	filelist = os.listdir(metadir)

	for filename in filelist:
		try:
			fp = open(os.path.join(metadir, filename), 'r')
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

	#print "Rebuilding map (core routine) %s/%s/%s" % (proxy_id, meta_id, shape_id)

	path_shape = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, shape_id)
	if modified:
		path_shape = os.path.join(path_shape, ".tmp")

	norm = True
	if learnProxyType(getManifest(proxy_id)) == "local":
		norm = False

	shape_gj = convertShapePathToJson (path_shape, normalise=norm, temp=True)

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
		destpath =  os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson, meta_id, shape_id)
		shape_fp = open (destpath, 'w+')
		json.dump(shapedata, shape_fp, encoding="latin-1")
		shape_fp.close()
	except Exception as ex:
		print "Error while saving: %s " % ex.message
		#TODO: add more complex exception handling
		raise

	print "Correctly updated %s/%s/%s to %s" % (proxy_id, meta_id, shape_id, destpath)

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

	if upserts is None:
		upserts = []

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

	open(nextfilepath, 'w+').close()




def alterMapDetails (proxy_id, meta_id, shape_id, req_changelist, req_model=None):
	"""
	This function opens a geojson map and alters only a specific list of objects. Before doing it, it checks that the previous status of these items is still in sync with the status the request sender had. If the data is in sync, the changes are made and a list of updated Ids is sent back, otherwise an error with the status of the unsynced objects.
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:param req_changelist: a json dictionary (by featureid) with a dictionary for each item that has 'origin' as the pre-modification status and 'current' as the current
	:return:
	"""

	success = False
	objects = []

	# loading the map from the geojson directory
	gj_fp = open(os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson, meta_id, shape_id ))
	mapdata = json.load(gj_fp)
	gj_fp.close()

	changelist = json.loads(req_changelist)
	# modified etrny: json entry
	keylist = {}
	allids = []


	print "Comparing changelist: \n%s" % req_changelist

	#print "map length %s" % len(mapdata['features'])

	for i in range (0, len(mapdata['features'])):
		currentid = mapdata['features'][i]['id']
		allids.append(currentid)
		#print "%s %s: %s %s" % (type(i),i, type(currentid), currentid)
		#print i
		#print mapdata['features'][i]
		if changelist.has_key(str(currentid)):
			keylist[str(currentid)] = i

	#print "Comparing to map:\n%s" % mapdata

	print "Keylist: %s" % keylist

	# checking if there is any misalignment
	syncstatus = {}

	for fid in keylist.keys():
		tid = keylist[fid]
		candidate = changelist[fid]['origin']
		reference = mapdata['features'][tid]

		#print "Comparing %s to %s" % (candidate, reference)

		syncstatus[fid] = ( candidate ['geometry'] == reference['geometry'] and candidate['attributes'] == reference['properties'] )


	print "Syncstatus: %s " % syncstatus


	# code for change
	newfid = max([fid for fid in allids if isinstance(fid, int)])
	tids = dict ((v,k) for k, v in keylist.iteritems())
	print "TIDS: %s" % tids
	if all(syncstatus.values()):

		# we apply the changes and get an updated ids list

		# 1. apply the changes to the json data

		fidchanges = {}
		deleted = []

		for fid in changelist.keys():

			print "Updating element %s" % fid


			if fid not in keylist.keys():

				if changelist[fid]['current'] is not None:
					newfid += 1
					print "Renaming changelist key %s to %s" % (fid, newfid)

					#1.1.1 create a new feature

					cgeom = changelist[fid]['current']['geometry']
					cprop = changelist[fid]['current']['attributes']

					mapdata['features'].append ({
						'geometry': cgeom, 'type': 'Feature', 'properties': cprop, 'id': newfid
					})

					#TODO #1.1.2 add old -> new FID conversion

					fidchanges[fid] = newfid

			else:

				basetid = keylist[fid]

				#balancing the removed elements
				delta = len(filter(lambda did: did < basetid, deleted))
				tid = basetid-delta

				if changelist[fid]['current'] is not None:
					#1.2 save to the existing feature with id = keylist[fid]

					mapdata['features'][tid]['geometry'] = changelist[fid]['current']['geometry']
					mapdata['features'][tid]['properties'] = changelist[fid]['current']['attributes']

					fidchanges[fid] = fid
				else:
					#1.2.1 removing the feature
					del mapdata['features'][tid]
					deleted.append(basetid)

					fidchanges[fid] = None

		#2.1 save the json data to geojson and mirror folders

		gjpath = os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson, meta_id, shape_id )

		gj_fp = open(gjpath, 'w+')
		json.dump(mapdata, gj_fp)
		gj_fp.close()

		#2.2 COPY GEOJSON DATA to mirror folder

		mirror_path = os.path.join (conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, shape_id)
		targets = os.listdir(mirror_path)

		for target in targets:
			if os.path.isdir (target):
				shutil.rmtree (os.path.join(mirror_path, target))
			else:
				os.unlink(os.path.join(mirror_path, target))


		shutil.copy(gjpath, os.path.join(mirror_path, shape_id+".geojson"))

		#2.3 remove translation table for this map since we have the correct model already

		path_mapconf = os.path.join(conf.baseproxypath, proxy_id, conf.path_mappings, meta_id, shape_id)

		if os.path.exists(path_mapconf):
			os.unlink (path_mapconf)

		#2.3.2 recreate the translation table so we don't risk losing properties if we rebuild the gj folder

		#TODO: implement logging
		#NOTE: we TRY to recover the model, but fail silently in case, since it's not critical and the user can fix it. LOG somewhere?

		try:

			req_model = json.loads(req_model)

			mapmodel = {}
			mtype = req_model['mid']

			for elid in req_model['struct'].keys():
				mapmodel [elid] = [mtype, elid]

			print "SAVING NEW MODEL: %s" % mapmodel

			mapconf_fp = open(path_mapconf, 'w+')
			json.dump(mapmodel, mapconf_fp)
			mapconf_fp.close()

		except Exception, ex:
			print "DEBUG: failed to save data model due to %s" % ex

		success = True
		objects = fidchanges

	else:

		# we create a list of the inconsistencies and send them back
		# loading the map from the geojson directory
		#(actually a full list with true/false depending on the status of the single object)

		success = False
		objects = syncstatus


	#print "Returning %s (%s)" % (success, objects)
	return success, objects


def sendProxyManifestRaw (jsonmanifest):
	"""
	Sends the manifest of a given soft proxy to the main server and returns the response
	:param jsonmanifest:
	:return:
	"""

	print "Expected replies for manifest send:\n%s\n%s" % (TemplatesModels.model_response_manifest_success, TemplatesModels.model_response_manifest_fail)



	try:
		return sendMessageToServer(jsonmanifest, conf.URL_WRITEMANIFEST, 'POST',  TemplatesModels.model_response_manifest_success, TemplatesModels.model_response_manifest_fail)
	except Exception as ex:
		return False, "Error while sending manifest to %s: %s" % (conf.URL_WRITEMANIFEST, str(ex))


def sendProxyManifestFromFile (proxy_id):
	"""
	Sends the manifest of a given soft proxy to the main server and returns the response
	:param proxy_id:
	:return:
	"""
	return sendProxyManifestRaw(getManifest(proxy_id))