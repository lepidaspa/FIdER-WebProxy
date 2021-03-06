#!/usr/bin/env python
# -*- coding: utf-8 -*-
import re
import urllib2

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

import shutil
import traceback
import zipfile
import time
import sys
import os
import json

import ogr
import gdal

import ftplib
import ftputil

import Common
from FIdERProxyFS import proxy_core
from Common.errors import *
import proxy_config_core as conf
import proxy_lock
from Common import TemplatesModels

from Common.Components import sendMessageToServer
"""
This module is called when a change happens in the filesystem (specifically in the upload directory, but the proxy checks anyway in case the fs monitor cannot filter before informing the proxy)
"""

def handleFSChange (eventpath):
	"""
	Wrapper for the whole handleFileUpdate process.
	Launches handleFileUpdate and logs/informs about any and all breakages
	Note that all errors are caught as exceptions, not return codes.
	We expect that under normal operative conditions all operations on the proxy DO work properly AND silently.
	This function acts only as launcher and exception interceptor for logging, the actual controller is HandleFileUpdate()
	:param eventpath:
	:return:
	"""

	# we only do a quick check to ensure the file event is in our upload path

	eventpath = os.path.realpath(eventpath)
	uploadpath = os.path.realpath(conf.baseuploadpath)
	if not eventpath.startswith(uploadpath):
		# if the event is not in a subdir of $upload we simply ignore it and exit
		sys.exit(0)

	# otherwise we start the actual file update handling process
	try:
		handleFileEvent(eventpath)
	except Exception as issue:
		print "ISSUE IN HANDLING fs change"
		logEvent (issue, True)



def logEvent (eventdata, iserror=False):
	"""
	Logs a standard event. Events are logged to file only, errors to file AND mail.
	:param eventdata: message
	:param iserror: boolean, if the event is an error/exception
	:return:
	"""
	ctime = time.time()
	currentdatetime = time.strftime("%Y-%m-%dT%H:%M:%SZ", ctime)
	eventstring = "%d %s %s" % (int(ctime*1000), currentdatetime, eventdata)

	#TODO: see if we can handle more gracefully issues in the file logging itself
	try:
		logToFile(eventstring)
	except:
		eventstring += "; FAILED TO LOG TO FILE"

	try:
		logToMail(eventstring)
	except:
		pass


def setProxyContacts (proxy_id, contactsjson):
	"""
	Writes the contacts file for this proxy. No check on the contents of contactsjson, will work as long as it's json-dumpable. No feedback given unless there is an exceptions
	:param proxy_id:
	:param contactsjson:
	:return:
	"""

	print "Setting contacts info for proxy %s:\n%s" % (proxy_id, contactsjson)

	#NOTE: since the linked proxy uses a symlink to the standalone tool, changing  this will always change the contacts on both instances
	contactspath = os.path.join(conf.baseproxypath, proxy_id, conf.path_contacts)
	json.dump(contactsjson, open(contactspath, 'w+'))



def createSoftProxy (proxy_id, manifest, linkedto=None):

	success = True
	message = manifest

	try:
		proxy_core.makeSoftProxy(proxy_id, manifest, linkedto)
	except Exception as ex:
		traceback.print_exc()
		return False, "Creazione del proxy %s fallita. Errore: %s" % (proxy_id, ex.message)

	# only for linker proxies
	if linkedto is not None:
		databuildresult = proxy_core.rebuildAllData(proxy_id)
		# creation succeeded but data import failed
		if not databuildresult['success']:
			success = False
			message = "Creazione del proxy %s riuscita con importazione mappe incompleta. Cataloghi da verificare: %s" % (proxy_id, databuildresult['errors'],)

	return success, message




def logToFile (message):
	"""
	Appends the message to the FSproxy logfile
	:param message:
	:return:
	"""
	#TODO: remove filename placeholder, see if we can suggest different files from the ProxyFS module (proxy_id is actually determined further down in the process)
	logfile = os.path.join (conf.log_folder, "proxyops.log")
	fp = open(logfile,"a")
	fp.write("\n"+message)
	fp.close()

def logToMail (message):
	"""
	Sends the message via mail to the proxy-set recipients
	:param message:
	:return:
	"""
	#TODO: PLACEHOLDER, IMPLEMENT
	pass

def handleFileEvent (eventpath):
	"""
	Acts as controller during the whole process of update (and eventual send in case of write/full
	:param eventpath: path to the changed/added/deleted file on the filesystem
	:return:
	"""

	# our upload dir structure is:
	# $upload / $proxy_instance / $meta_id / $shape_id.zip

	# we detect what has actually changed.
	# It MUST be a zip file or somebody is messing with the dir structure and we must exit and warn about it



	proxy_id, meta_id, shape_id = proxy_core.verifyUpdateStructure(eventpath)


	print "Working on file event @ %s/%s/%s" % (proxy_id, meta_id, shape_id)
	print "w.eventpath %s" % eventpath

	locker = proxy_lock.ProxyLocker (retries=3, wait=5)

	upsert = None
	# Determining if the event is an upsert or a delete
	if not os.path.exists(eventpath):
		# delete
		#proxy_core.handleDelete (proxy_id, meta_id, shape_id)
		print "Deleting %s/%s/%s" % (proxy_id, meta_id, shape_id)
		locker.performLocked(proxy_core.handleDelete, proxy_id, meta_id, shape_id)
	elif zipfile.is_zipfile(eventpath):
		# upsert
		# proxy_core.handleUpsert (proxy_id, meta_id, shape_id)
		print "Updating/Adding %s/%s/%s" % (proxy_id, meta_id, shape_id)
		locker.performLocked(proxy_core.handleUpsert, proxy_id, meta_id, shape_id)
		upsert = shape_id
	else:
		# wrong file type or directory creation
		print "Unexpected file type or operation on path %s" % eventpath
		raise InvalidFSOperationException ("Unexpected file type or operation on path %s" % eventpath)

	if upsert is not None:
		shapedata = proxy_core.rebuildShape(proxy_id, meta_id, shape_id, modified=True)
		#proxy_core.replicateShapeData (shapedata, proxy_id, meta_id, shape_id, modified=True)
		locker.performLocked(proxy_core.replicateShapeData, shapedata, proxy_id, meta_id, shape_id, modified=True)
	else:
		# this is a delete
		#proxy_core.replicateDelete (proxy_id, meta_id, shape_id)
		locker.performLocked(proxy_core.replicateDelete, proxy_id, meta_id, shape_id)

	#no need of locking for this, since it simply adds/updates a file to the /next dir
	proxy_core.queueForSend(proxy_id, meta_id)


	#if the server is a write/full server, we launch the server update process

	proxymanifest = proxy_core.getManifest(proxy_id)
	if proxymanifest['operations']['write'] == u'full':
		try:
			sentok, details = sendUpdatesWrite(proxy_id)
			if sentok is True:
				logEvent ("Sent update for proxy %s" % proxy_id)
			else:
				logEvent ("Error while sending update for proxy %s: %s" % (proxy_id, details))
		except Exception as e:
			logEvent (e.message, True)



def rebuildFullShapesList (proxy_id):

	"""
	 Rebuilds the json data for all the metadata in a specific proxy, starting from the upload directory and clearing any pre-existent data.
	 :param proxy_id:
	 :return:
	 """


	# get the full meta list in the upload directory
	metalist = os.listdir(os.path.join(conf.baseuploadpath, proxy_id))

	print ("Rebuilding proxy %s with meta %s ") % (proxy_id, metalist)


	# for each meta we clean the $mirror directory (i.e. we DELETE everything)
	for meta_id in metalist:

		meta_mirrordir = os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id)
		for shape_mirrordir in os.listdir(meta_mirrordir):
			shutil.rmtree(os.path.join(meta_mirrordir, shape_mirrordir))

	#we launch the upsert process for each shape in each meta (AFTER the FULL cleanup)
	for meta_id in metalist:
		shapeslist = os.listdir(os.path.join(conf.baseuploadpath, proxy_id, meta_id))
		for shape_id in shapeslist:
			print ("Rebuilding proxy/meta/shape %s %s %s") % (proxy_id, meta_id, shape_id)
			print ("-> event path: "+os.path.join (conf.baseuploadpath, proxy_id, meta_id, shape_id))

			handleFileEvent (os.path.join (conf.baseuploadpath, proxy_id, meta_id, shape_id))


def isLinkedProxy (ref_id, ref_name):
	"""
	returns whether the reference proxy is linked to another proxy (actually a standalone tool)
	:return:
	"""

	for proxy_cmp in getProxyList():

		name_cmp = proxy_core.getManifest(proxy_cmp)['name']

		if ref_id != proxy_cmp and name_cmp == ref_name:
			return True

	return False

def createMessageUpdatesRead (proxy_id, timestamp):
	"""
	Sends the updates for a specific soft-proxy compared to a specific date. The main difference with sendUpdatesWrite is that the updates dir does NOT get cleaned after; also, we are creating a response
	:param proxy_id:
	:param timestamp: timestamp  from which we get the data
	:return: json message
	"""


	updateslist = []
	updatespath = os.path.join(conf.baseproxypath,proxy_id,"next")
	for cupdate in os.listdir(updatespath):
		updateslist.append((cupdate, os.path.getmtime(os.path.join(updatespath, cupdate))))


	updatestosend = []
	for meta_id, timeupdated in updateslist:
		if timeupdated >= timestamp:
			updatestosend.append(meta_id)


	locker = proxy_lock.ProxyLocker (retries=3, wait=5)

	meta_dict = {}
	for meta_id in updatestosend:
		meta_dict [meta_id] = locker.performLocked(proxy_core.assembleMetaJson, proxy_id, meta_id)

	template = TemplatesModels.model_response_read
	customfields = {
		"data": {
			"upserts" : meta_dict,
			"delete" : []
		}
	}

	requestmsg = proxy_core.createMessageFromTemplate(template, token=proxy_id, **customfields)

	return json.dumps(requestmsg)


def sendUpdatesWrite (proxy_id):
	"""
	Sends the updates for a specific soft-proxy to the main server according to the list of updates. This is the version for Request Write with updates only
	:param proxy_id:
	:return: tuple boolean/string (true/false, list of updates for logging/errors)
	"""

	# each meta is listed with its time of latest modification
	updateslist = []
	updatespath = os.path.join(conf.baseproxypath,proxy_id,"next")
	for cupdate in os.listdir(updatespath):
		updateslist.append((cupdate, os.path.getmtime(os.path.join(updatespath, cupdate))))


	locker = proxy_lock.ProxyLocker (retries=3, wait=5)

	meta_dict = {}
	for meta_id, timestamp in updateslist:
		meta_dict [meta_id] = locker.performLocked(proxy_core.assembleMetaJson, proxy_id, meta_id)
		metadelstring = conf.MAINSERVER_LOC+"/broker/clear?token="+proxy_id+"&meta="+meta_id
		urllib2.urlopen(metadelstring)

	template = TemplatesModels.model_request_write
	customfields = {
		"data": {
			"upserts" : meta_dict,
			"delete" : []
		}
	}



	# /broker/clear?token=???&meta=???


	requestmsg = Common.Components.createMessageFromTemplate(template, token=proxy_id, **customfields)

	send_success = sendMessageToServer(json.dumps(requestmsg), conf.URL_WRITEREQUEST, 'POST', TemplatesModels.model_response_write, TemplatesModels.model_error_error)

	if send_success:
		#proceed to clean up the /next directory from meta that has not received other modifications, log the success with the list of metas sent

		for cupdate in os.listdir(updatespath):
			# we remove only the entries that have not received additional updates from the time of sending; we check if the tuple filename/updatetime is in the updates list we created at the start of the process

			if (cupdate, os.path.getmtime(os.path.join(updatespath, cupdate))) in updateslist:
				try:
					os.remove(os.path.join(updatespath,cupdate))
				except:
					logEvent ("Failed to remove meta %s from the updates list of proxy %s" % (cupdate, proxy_id), True)

		logEvent ("Sent updates for proxy %s to main server", False)

	else:
		#leave the /next listing as is and log the failure as issue
		logEvent ("Failed to send updates for proxy %s (meta/timestamp list: %s)" % (proxy_id, updateslist), True)


def sideloadST (proxy_id, meta_id, stmap_id, saveto_id):

	saveto_id = re.sub(r'[^\w._]+', "_", saveto_id)

	uploadpath = os.path.join(conf.baseuploadpath, proxy_id, meta_id, saveto_id+".zip")
	frompath = os.path.join(conf.baseproxypath, proxy_id, conf.path_standalone, stmap_id)


	with zipfile.ZipFile(uploadpath, 'w') as datazip:
		datazip.write(frompath, stmap_id+".geojson")

	print "Zipped data ok"

	try:
		handleFileEvent (uploadpath)
		response_sideload = {
			'success': True,
			'report': 'Mappa %s importata correttamente. ' % stmap_id
		}
	except Exception as ex:
		response_sideload = {
			'success': False,
			'report': 'Importazione di %s fallita. Causa: %s' % (stmap_id, ex)
		}


def uploadFTP (proxy_id, meta_id, map_id, connect, setforupdate=False):
	"""
	Loads a remote FTP resource to the proxy/meta/map combination in the request. Distinct from first time load which can be found in FIdERWeb
	:param proxy_id:
	:param meta_id:
	:param map_id:
	:param connect: dictionary with connection info: url, user, pass, layer
	:param setforupdate: boolean, whether to write the connection configuration in the remoteres directory for future updates. This is off by default as the function is called more often as an update than for creation
	:return: a report dict with keys success (bool) and report (string)
	"""

	response_upload = {
	'success': False,
	'report': ''
	}

	filename = re.sub(r'[^\w._]+', "_", connect['path'].split("/")[-1])

	hostinfo = connect['host'].split(":")
	hostname = hostinfo[0]
	hostport = "21"

	if len(hostinfo)==2:
		if hostinfo[1] not in (None, ""):
			hostport = hostinfo[1]


	class CustomPorted (ftplib.FTP):
		def __init__ (self, host, userid, password, port):
			ftplib.FTP.__init__(self)
			port = int(port)
			self.connect(host, port)
			self.login(userid, password)


	try:
		conn = ftputil.FTPHost(hostname, connect['user'], connect['pass'], port=hostport, session_factory=CustomPorted)

		if map_id is None or map_id == "":
			map_id = filename[:-4]

		# print "FORM: Uploading file to %s/%s/%s" % (proxy_id, meta_id, map_id)

		uploadedpath = os.path.join(conf.baseuploadpath, proxy_id, meta_id, filename)

		conn.download(connect['path'], uploadedpath, mode="b")


		# fp = open(uploadedpath, 'w+')
		# fp.write(upload.read())
		# fp.close()
		# upload.close()

		response_upload['success'] = True
		#response_upload['report'] = "Invio del file %s su %s per integrazione completato." % (filename, proxy_id)

		# print "File uploaded, proceeding with conversion to geojson"

		handleFSChange(uploadedpath)
		response_upload['report'] = "Integrazione del file %s su %s completata" % (filename, proxy_id)

		print response_upload['report']

		if setforupdate is True:
			try:
				fppath = os.path.join(conf.baseproxypath, proxy_id, conf.path_remoteres, meta_id)
				try:
					os.makedirs(fppath)
				except:
					# already exists: not a problem, if more severe we will get a different error later and handle that
					pass
				fp_ftpres = open(os.path.join(fppath, map_id+".ftp"), 'w+')
				json.dump(connect, fp_ftpres)
				fp_ftpres.close()
				response_upload['report'] += "Configurato l'aggiornamento automatico."
			except Exception as ex:
				print "ERROR while saving as remote resource: %s " % ex
				response_upload['report'] += "Aggiornamento automatico non configurato."

	except Exception as ex:
		print "ERROR: %s (%s)" % (ex, ex.message)
		response_upload['response'] = 'Caricamento dei dati da FTP fallito.'

	return response_upload


def uploadWFS (proxy_id, meta_id, map_id, connect, setforupdate=False):
	"""
	Loads a remote WFS resource to the proxy/meta/map combination in the request.
	:param proxy_id:
	:param meta_id:
	:param map_id:
	:param connect: dictionary with connection info: url, user, pass, layer
	:param setforupdate: boolean, whether to write the connection configuration in the remoteres directory for future updates. This is off by default as the function is called more often as an update than for creation
	:return: a report dict with keys success (bool) and report (string)
	"""

	response_upload = {
		'success': False,
		'report': ''
	}

	protocol, separator, url = connect['url'].partition("://")
	authstring = ""
	if connect['user'] not in (None, ""):
		authstring = connect['user']
		if connect['pass'] not in (None, ""):
			authstring = authstring+":"+connect['pass']
		authstring += "@"

	connectstring = "WFS:"+protocol+separator+authstring+url
	print connectstring,connect

	gdal.SetConfigOption('GML_CONSIDER_EPSG_AS_URN', 'YES')
	gdal.SetConfigOption('GML_INVERT_AXIS_ORDER_IF_LAT_LONG', 'YES')


	driver = ogr.GetDriverByName('WFS')
	try:

		wfs = driver.Open(connectstring)
		#rewfs = driver.CopyDataSource(wfs, "rewfs", options=["GML_INVERT_AXIS_ORDER_IF_LAT_LONG=YES"] )
		#layer = wfs.CopyLayer(wfs.GetLayerByName(str(connect['layer'])),str(connect['layer']),  options=["GML_INVERT_AXIS_ORDER_IF_LAT_LONG=YES"])

		layer = wfs.GetLayerByName(str(connect['layer']))

	except Exception as ex:
		print "Connection error: %s " % ex
		# TODO: add logging
		response_upload['report'] = "Connessione fallita o dati mancanti per l'indirizzo specificato."
		return response_upload

	print "Received WFS data"

	map_id= re.sub(r'[^\w._]+', "_", map_id)

	gjfeatures = []
	for feature in layer:
		#print 'Json representation for Feature: %s' % feature.GetFID()
		gjfeatures.append(json.loads(feature.ExportToJson()))

	#print gjfeatures

	collection = {
		'id' : map_id,
		'type': 'FeatureCollection',
		'features' : gjfeatures
	}

	uploadpath = os.path.join(conf.baseuploadpath, proxy_id, meta_id, map_id+".zip")

	print "Ready to zip WFS data"

	with zipfile.ZipFile(uploadpath, 'w') as datazip:
		datazip.writestr(map_id+".geojson", json.dumps(collection))

	print "Zipped data ok"

	try:
		handleFileEvent (os.path.join(conf.baseuploadpath, proxy_id, meta_id, map_id+".zip"))
		response_upload = {
			'success': True,
			'report': 'Mappa %s aggiornata. ' % map_id
		}

		# adding the wfs resource to the list of remote resources IF it worked

		if setforupdate:

			try:
				fppath = os.path.join(conf.baseproxypath, proxy_id, conf.path_remoteres, meta_id)
				try:
					os.makedirs(fppath)
				except:
					# already exists: not a problem, if more severe we will get a different error later and handle that
					pass
				fp_wfsres = open(os.path.join(fppath, map_id+".wfs"), 'w+')
				json.dump(connect, fp_wfsres)
				fp_wfsres.close()
				response_upload['report'] += "Configurato l'aggiornamento automatico."
			except Exception as ex:
				print "ERROR while saving as remote resource: %s " % ex
				response_upload['report'] += "Aggiornamento automatico non configurato."


	except Exception, ex:
		response_upload = {
			'success': False,
			'report': ex
		}


	gdal.SetConfigOption('GML_INVERT_AXIS_ORDER_IF_LAT_LONG', None)


	return response_upload


def getProxyList ():
	"""
	Returns a list of the softproxies on the hardproxy
	:return:
	"""

	#TODO: update to new system with centralised manifests
	manifests = os.listdir(os.path.join(conf.baseproxypath, "proxies"))

	listing = []
	for proxymanfile in manifests:
		listing.append(proxymanfile.split(".")[0])

	return listing

def getFullProxyListing (precompiled=True):
	"""
	Complete list of shape data that have already been loaded (and compiled, partially or entirely) on the hardproxy by meta and by softproxy.
	:param precompiled: boolean, if true we use the data in the JSON directories, if false we check the MIRROR directory
	:return:
	"""

	branch = ""
	if precompiled:
		branch = conf.path_geojson
	else:
		branch = conf.path_mirror

	list_proxy = getProxyList()

	list_meta_byproxy = {}
	for proxy in list_proxy:
		list_meta_byproxy [proxy] = os.listdir(os.path.join(conf.baseproxypath,proxy, branch))

	list_shape_bymeta_byproxy = {}
	for proxy in list_proxy:
		list_shape_bymeta_byproxy[proxy] = {}
		for meta in list_meta_byproxy[proxy]:
			list_shape_bymeta_byproxy[proxy][meta] = []
			for shape in os.listdir(os.path.join(conf.baseproxypath,proxy,branch, meta)):
				if precompiled:
					list_shape_bymeta_byproxy[proxy][meta].append(shape)
				else:
					list_shape_bymeta_byproxy[proxy][meta].append(shape[:-4])

	return list_shape_bymeta_byproxy




def getProxyStamps (precompiled=True, dated=False):
	"""
	List of update times for all meta on the HARDproxy, by softproxy.
	:param precompiled: boolean, if true we use the data in the JSON directories, if false we check the MIRROR directory
	:param dated: boolean, if we want to receive the data in date or timestamp form
	:return:
	"""

	if precompiled:
		branch = conf.path_geojson
	else:
		branch = conf.path_mirror

	list_proxy = getProxyList()


	list_meta_byproxy = {}
	for proxy in list_proxy:
		list_meta_byproxy [proxy] = os.listdir(os.path.join(conf.baseproxypath, proxy, branch))


	meta_stamped = {}
	#note: for precompiled we can simply check the timestamp of the parent dir, not so on the mirror dir as it contains a subdir for each shapefile
	for proxy in list_proxy:
		meta_stamped [proxy] = {}
		for meta in list_meta_byproxy[proxy]:
			stamps = []
			for shapepath in os.listdir(os.path.join(conf.baseproxypath, proxy, branch, meta)):
				#note: this is the timestamp of the shapedata DIR for shapefiles, or of the json files for the json dir
				stamps.append (os.path.getmtime(os.path.join(conf.baseproxypath, proxy, branch, meta, shapepath)))

			#the most recent file has the highest timestap, so element -1 in a sorted list
			if len(stamps) > 0:

				stamps.sort()
				if dated is False:
					meta_stamped[proxy][meta] = stamps[-1]
				else:
					meta_stamped[proxy][meta] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(stamps[-1]))
			else:
				#TODO: better output on missing data
				meta_stamped[proxy][meta] = ""

	return meta_stamped

if __name__ == "__main__":
	handleFSChange (sys.argv[1])