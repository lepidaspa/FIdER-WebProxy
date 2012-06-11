#!/usr/bin/env python
# -*- coding: utf-8 -*-

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'


import os.path
import os
import sys
import shutil
import zipfile
import time
import json

from osgeo import ogr

from Common.errors import RuntimeProxyException
import MarconiLabsTools.ArDiVa

sys.path.append("../")

from Common import TemplatesModels
from FIdERProxyFS import proxy_lock
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

	#creating config directory, log directory, locks directory
	os.makedirs(os.path.join(basepath, "conf"))
	os.makedirs(os.path.join(basepath, "locks"))


	#creating directories for data
	os.makedirs(os.path.join(basepath, "next"))
	os.makedirs(os.path.join(basepath, conf.path_geojson))
	os.makedirs(os.path.join(basepath, conf.path_mirror))

	fp_manifest = open(os.path.join(basepath,conf.path_manifest),'w+')
	json.dump(manifest, fp_manifest)
	fp_manifest.close()

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

	if timestamp == None:
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
		meta_dict [meta_id] = locker.performLocked(assembleMetaJson, proxy_id, meta_id)


	template = TemplatesModels.model_response_read_full
	customfields = {
		"token" : proxy_id,
		"data": {
			"upserts" : meta_dict,
			"delete" : []
		}
	}

	responsemsg = createMessageFromTemplate(template, **customfields)

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


	print "Verifying archived shape %s" % (filename)

	try:
		zipfp = zipfile.ZipFile(filedata)
	except Exception as ex:
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

	for candidatepath in zipfp.namelist():
		#checking that no file unpacks to a different directory
		if "/" in candidatepath:
			return False
		else:
			cext = candidatepath.split(".")[-1]
			if ext_mandatory_shape.has_key(cext):
				ext_mandatory_shape[cext] = True
			if ext_mandatory_minfo.has_key(cext):
				ext_mandatory_minfo[cext] = True

		if filename!=None:
			if candidatepath.split(".")[0] != filename:
				return False

	if not (all(ext_mandatory_shape.values() or all(ext_mandatory_minfo.values()))):
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
			#removed strict check on accepted fie types

	print ext_mandatory_shape, ext_mandatory_minfo
	if not (all(ext_mandatory_shape.values() or all(ext_mandatory_minfo.values()))):
		raise InvalidShapeArchiveException ("Mandatory file missing in shape archive %s (should contain .shp, .shx, .dbf and .prj for shape file OR .mif and .mid for mapinfo)" % shape_id)

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

	return convertShapePathToJson(shapepath, normalise)


def convertShapePathToJson (path_shape, normalise=True, temp=False):
	"""
	Converts a shapefile to GeoJSON data and returns it.
	:param path_shape: path of the shape file to be converted
	:param normalise: defines if we want to remove or modify elements in the  'properties' section according to the server's settings
	:param temp: if we are working on the .tmp directory
	:return: geojson feature data
	"""

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


	"""
	if basepath.endswith(conf.path_mirror):
		basepath = basepath[:len(conf.path_mirror)]
	"""
	basepath = basepath.partition(conf.path_mirror)[0]

	if basepath.endswith("/"):
		basepath = basepath[:-1]

	basepath, proxy_id = os.path.split(basepath)


	#TODO: verify key name for shape id information

	collection = {
		'id' : shape_id,
		'type': 'FeatureCollection',
		'features' : []
	}


	try:

		datasource = ogr.Open(path_shape)
		#print "EXTRACTING DATASOURCE SRS DATA:"
		#print "****>"+str(dir(datasource))
	except Exception as ex:
		print "ERROR during OGR parse on %s: %s" % (path_shape, ex)
		#TODO: better/proper debug
		raise


	#SRS CONVERSION CODE
	print "Setting SRS conversion"
	tSRS=ogr.osr.SpatialReference()
	tSRS.ImportFromEPSG(EPSG_WGS84)
	print "Converting to %s " % tSRS

	#SRS CONVERSION CODE


	jsonlist = []

	if normalise:
		convtable = getConversionTable(proxy_id, meta_id, shape_id)
		print "Data will be normalised with convtable %s" % (convtable,)



	for i in range (0, datasource.GetLayerCount()):
		layer = datasource.GetLayer(i)
		#print "EXTRACTING LAYER SRS DATA:"
		#print "****>"+str(dir(layer))

		sSRS=layer.GetSpatialRef()
		print "Layer has spatial ref %s" % sSRS


		for f in range (0, layer.GetFeatureCount()):
			feature = layer.GetFeature(f)

			#if f==0:
			#	print "EXTRACTING FEATURE SRS DATA:"
			#	print "****>"+str(dir(feature))

			geom = feature.GetGeometryRef()

			#print "Feature %s geometry from %s into..." % (feature, geom)
			try:
				#geom.AssignSpatialReference(sSRS)

				geom.TransformTo(tSRS)
				geom.AssignSpatialReference(tSRS)
				#print "Feature %s geometry to   %s" % (feature, geom)
			except Exception as ex:
				print "Transformation error on %s: %s" % (feature ,ex)
				#print "Error on feature %s geometry %s: %s " % (feature, f, geom)
				pass

		# fixed to output actual dict

			jsondata = json.loads(feature.ExportToJson())

			#print "feature.exportToJson outputs "+str(type(jsondata))

			# we may want to keep to original "properties" elements
			if normalise:
				jsondata = adaptGeoJson(jsondata, convtable)

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

	tablepath = os.path.join(conf.baseproxypath, proxy_id, "conf", "mappings", meta_id, shape_id)
	print "Requesting conversion table from %s " % (tablepath,)

	if not os.path.exists (tablepath):
		return None
	else:
		try:
			return json.load(open(tablepath))
		except Exception as ex:
			raise ConversionTableAccessException ("Error while accessing conversion table for %s.%s.%s: %s" % (proxy_id, meta_id, shape_id, ex.message))


def createConversionTable (conversiontable, proxy_id, meta_id, shape_id=None):
	"""
	Dumps a conversion table to the location required. If shape_id is none, we save to ALL shapes in the meta. Does not check if the table already exists
	:param conversiontable:
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	#placeholder, it's done through a Django view

	pass

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

	if conversiontable is None:
		conversiontable = {}

	newdict = {}
	landing = jsondata[u'properties']
	for keyfrom in landing:
		if keyfrom in conversiontable:
			# the first element in a conversion table entry is always the type of object, which is NOT needed here since we only want the name of the resulting new key
			keyto = conversiontable[keyfrom][1]
			newdict[keyto] = landing[keyfrom]



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

	path_shape = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id, shape_id)
	if modified:
		path_shape = os.path.join(path_shape, ".tmp")

	shape_gj = convertShapePathToJson (path_shape, temp=True)

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
		shape_fp = open (os.path.join(conf.baseproxypath, proxy_id, conf.path_geojson, meta_id, shape_id), 'w+')
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


def createMessageFromTemplate (template, **customfields):
	"""
	Sends a json message to the main server and returns success if the response code is correct
	:param template: the model, must be ArDiVa.Model compliant
	:param customfields: a dict with all the custom data to be added to the model
	:return: dictionary message ready for json.dumps, exception if the modified messge fails validation on the template
	"""

	#NOTE: should we keep proxy_id explicit in the message creation (for the purpose of logging)?

	messagemodel = MarconiLabsTools.ArDiVa.Model(template)

	filledok, requestmsg = messagemodel.fillSafely(customfields)

	if filledok is True:
		return requestmsg
	else:
		print messagemodel.log
		raise RuntimeProxyException ("Failed to create valid %s %s message for proxy %s" % (template['message_type'], template['message_format'], customfields['token']))