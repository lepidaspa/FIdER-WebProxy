#!/usr/bin/env python
# -*- coding: utf-8 -*-
from Common import MessageTemplates

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

#from httplib import HTTPException
#from time import sleep
import zipfile
import time
import proxy_lock
import sys
import os
import json
import urllib2

from Common.errors import *
import proxy_config_core as conf
import proxy_core
import MarconiLabsTools.ArDiVa

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
		return False, "Failed to create proxy %s, cause: %s" % (proxy_id, ex.message)

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

	locker = proxy_lock.ProxyLocker (retries=3, wait=5)

	upsert = None
	# Determining if the event is an upsert or a delete
	if not os.path.exists(eventpath):
		# delete
		#proxy_core.handleDelete (proxy_id, meta_id, shape_id)
		locker.performLocked(proxy_core.handleDelete, proxy_id, meta_id, shape_id)
	elif zipfile.is_zipfile(eventpath):
		# upsert
		#proxy_core.handleUpsert (proxy_id, meta_id, shape_id)
		locker.performLocked(proxy_core.handleUpsert, proxy_id, meta_id, shape_id)
		upsert = (shape_id,)
	else:
		# wrong file type or directory creation
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




def gatherUpdatesForSend (proxy_id):
	"""
	Creates the upserts for a specific soft proxy and returns them as dict for integration in a send message (request_write or response_read). Upserts are organized in a dict of metadata with meta_id as keys and lists of feature collections as values
	:param proxy_id:
	:return: dict
	"""

	#TODO: placeholder; note that right now it does too little to make it worth separating it from sendUpdatesToMain (~4 lines of code)


def sendMessageToServer (jsonmessage, url, method, successreturns=None, failreturns=None):
	"""
	Sends a json message to the main server and returns success if the response code is correct
	:param jsonmessage: data to be sent to the server, already in json format (json.dumps())
	:param url:
	:param method:
	:param successreturns: dict template for successful use of data by the main server
	:param failreturns: dict template for failed use of data by the main server
	:return: tuple, True/False on success/failure and server json response
	"""

	#TODO: placeholder, implement, note that cannot be async if we want to keep the full comm cycle in this one only; should we also keep the full response from the other server?

	datalen = len(jsonmessage)
	headers = {'Content-Type': 'application/json', 'Content-Length': datalen}

	req = urllib2.Request(url, jsonmessage, headers)
	try:
		conn = urllib2.urlopen(req)
	except urllib2.HTTPError, e:
		raise CommunicationFailure, ("Communications failed with code %s" % e.code)
	except urllib2.URLError, e:
		raise CommunicationFailure, ("Communications failed with reason %s" % e.reason)
	else:
		response = conn.read()
		conn.close()
		jsonresponse = json.loads(response)

	#TODO: consider moving the model creation out of the function so we can set the strictness more accurately
	successmodel = MarconiLabsTools.ArDiVa.Model(successreturns)
	failmodel = MarconiLabsTools.ArDiVa.Model(failreturns)

	if successmodel.validateCandidate(jsonresponse):
		succeeded = True
	elif failmodel.validateCandidate(jsonresponse):
		succeeded = False
	else:
		raise CommunicationFailure ("Unexpected message from server: %s" % jsonresponse)

	return succeeded, jsonresponse




def createMessageFromTemplate (template, **customfields):
	"""
	Sends a json message to the main server and returns success if the response code is correct
	:param template: the model, must be ArDiVa.Model compliant
	:param customfields: a dict with all the custom data to be added to the model
	:return: dictionary message ready for json.dumps, exception if the modified messge fails validation on the template
	"""

	#NOTE: should we keep proxy_id explicit in the message creation (for the purpose of logging)?

	messagemodel = MarconiLabsTools.ArDiVa.Model(template)

	filledok, requestmsg = messagemodel.fillSafely(**customfields)

	if filledok is True:
		return requestmsg
	else:
		raise RuntimeProxyException ("Failed to create valid %s %s message for proxy %s" % (template['message_type'], template['message_format'], customfields['token']))




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

	template = MessageTemplates.model_response_read
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

	template = MessageTemplates.model_request_write
	customfields = {
		"data": {
			"upserts" : meta_dict,
			"delete" : []
		}
	}

	requestmsg = createMessageFromTemplate(template, token=proxy_id, **customfields)

	#TODO: actual implementation of message transmission handling, right now we only have an empty function call
	send_success = sendMessageToServer(json.dumps(requestmsg), conf.URL_WRITEREQUEST, 'POST', MessageTemplates.model_response_write, MessageTemplates.model_error_error)

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
































if __name__ == "__main__":
	handleFSChange (sys.argv[1])