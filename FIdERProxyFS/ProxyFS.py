#!/usr/bin/env python
# -*- coding: utf-8 -*-
import shutil
import traceback
from Common import TemplatesModels
from FIdERProxyFS import proxy_core
from FIdERProxyFS.proxy_core import createMessageFromTemplate

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

#from httplib import HTTPException
#from time import sleep
import zipfile
import time
import sys
import os
import json

from Common.errors import *
import proxy_config_core as conf
import proxy_lock

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
		#TODO: add actual mailing code, decide how to log normal events
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


def createSoftProxy (proxy_id, manifest):

	try:
		proxy_core.createSoftProxy(proxy_id, manifest)
	except Exception as ex:
		traceback.print_exc()
		return False, "Creazione del proxy %s fallita. Errore: %s" % (proxy_id, ex.message)

	return True, manifest




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

	requestmsg = createMessageFromTemplate(template, token=proxy_id, **customfields)

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

	template = TemplatesModels.model_request_write
	customfields = {
		"data": {
			"upserts" : meta_dict,
			"delete" : []
		}
	}

	requestmsg = createMessageFromTemplate(template, token=proxy_id, **customfields)

	#TODO: actual implementation of message transmission handling, right now we only have an empty function call
	send_success = sendMessageToServer(json.dumps(requestmsg), conf.URL_WRITEREQUEST, 'POST', TemplatesModels.model_response_write, TemplatesModels.model_error_error)

	if send_success:
		#proceed to clean up the /next directory from meta that has not received other modifications, log the success with the list of metas sent

		for cupdate in os.listdir(updatespath):
			# we remove only the entries that have not received additional updates from the time of sending; we check if the tuple filename/updatetime is in the updates list we created at the start of the process

			if (cupdate, os.path.getmtime(os.path.join(updatespath, cupdate))) in updateslist:
				#TODO: choose final exception handling in case something removed the files before us: currently we are ignoring it, logging and going on
				try:
					os.remove(os.path.join(updatespath,cupdate))
				except:
					logEvent ("Failed to remove meta %s from the updates list of proxy %s" % (cupdate, proxy_id), True)

		logEvent ("Sent updates for proxy %s to main server", False)

	else:
		#leave the /next listing as is and log the failure as issue
		logEvent ("Failed to send updates for proxy %s (meta/timestamp list: %s)" % (proxy_id, updateslist), True)

def getProxyList ():


	#TODO: update to new system with centralised manifests
	listing = os.listdir(os.path.join(conf.baseproxypath))
	excludepath = ["log", "next", "locks", "proxies"]

	for excluded in excludepath:
		try:
			listing.remove(excluded)
		except:
			pass

	return listing

def getFullProxyListing (precompiled=True):
	"""
	Complete list of shape data that have already been loaded (and compiled, partially or entirely) on the hardproxy by meta and by softproxy.
	:param precompiled: boolean, if true we use the data in the JSON directories, if false we check the MIRROR directory
	:return:
	"""

	branch = ""
	if precompiled:
		branch = "maps/json"
	else:
		branch = "maps/mirror"

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