#!/usr/bin/env python
# -*- coding: utf-8 -*-
import json
import urllib2
from FIdERProxyFS import proxy_config_core as conf
from FIdERProxyFS import proxy_core
from MarconiLabsTools import ArDiVa
from Common.errors import *
from Common import TemplatesModels

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

#from ProxySystem
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
	succeeded = None
	canverify = False
	if successreturns is not None:
		successmodel = ArDiVa.Model(successreturns)
		canverify = True
		print "Comparing %s to success model %s " % (jsonresponse, successmodel)

		if successmodel.validateCandidate(jsonresponse):
			succeeded = True
	if failreturns is not None:
		failmodel = ArDiVa.Model(failreturns)
		canverify = True
		print "Comparing %s to fail model %s " % (jsonresponse, failmodel)

	if failmodel.validateCandidate(jsonresponse):
			succeeded = False




	if canverify is True and succeeded is None:
		raise CommunicationFailure ("Unexpected message from server: %s" % jsonresponse)
	else:
		return succeeded, jsonresponse

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
	return sendProxyManifestRaw(proxy_core.getManifest(proxy_id))


def getWelcomeFromServer ():
	"""
	Sends a welcome request to the main server and receivesa token to be added to the manifest data. Returns a tuple, false/true + failure message or welcome dict (containing token)
	:return:
	"""

	try:

		jsonresponse = urllib2.urlopen(conf.URL_DISCOVERY)
		welcomedata = json.load(jsonresponse)
		print welcomedata

	except Exception as ex:
		if isinstance(ex, urllib2.HTTPError):
			errormess = ex.code
		elif isinstance(ex, urllib2.URLError):
			errormess = ex.reason
		else:
			errormess = ex.message
		return False, "Error when requesting welcome from %s: %s" % (conf.URL_DISCOVERY, errormess)

	return True, welcomedata




