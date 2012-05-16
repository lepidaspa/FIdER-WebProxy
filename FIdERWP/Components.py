#!/usr/bin/env python
# -*- coding: utf-8 -*-
import json
import urllib2
from FIdERProxyFS import proxy_config_core as conf
from FIdERProxyFS import proxy_core
from MarconiLabsTools import ArDiVa
from Common.errors import *
from Common import MessageTemplates

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
	successmodel = ArDiVa.Model(successreturns)
	failmodel = ArDiVa.Model(failreturns)

	if successmodel.validateCandidate(jsonresponse):
		succeeded = True
	elif failmodel.validateCandidate(jsonresponse):
		succeeded = False
	else:
		raise CommunicationFailure ("Unexpected message from server: %s" % jsonresponse)

	return succeeded, jsonresponse

def sendProxyManifest (proxy_id):
	"""
	Sends the manifest of a given soft proxy to the main server and returns the response
	:param proxy_id:
	:return:
	"""


	# PLACEHOLDER
	mainserver_discovery = conf.URL_DISCOVERY


	#we only do a simple http request since we only need the 200??

	try:
		return sendMessageToServer(proxy_core.getManifest(proxy_id), mainserver_discovery, MessageTemplates.model_response_manifest_success, MessageTemplates.model_response_manifest_fail)
	except Exception as ex:
		return False, ex.message



def getWelcomeFromServer ():
	"""
	Sends a welcome request to the main server and receivesa token to be added to the manifest data. Returns a tuple, false/true + failure message or welcome dict (containing token)
	:return:
	"""

	#TODO: move to a constants file
	#NOTE: find the domain/IP of the proxy itself for DISCOVERYURL
	DISCOVERYURL = "/proxy/discovery"

	#TODO: FIX ADDRESS OF THE MAIN SERVER
	MAINSERVERDOMAIN = ""
	MAINSERVERPATH = "/federation/new/helo"

	try:

		jsonresponse = urllib2.urlopen(MAINSERVERDOMAIN+MAINSERVERPATH)
		welcomedata = json.loads(jsonresponse)

	except Exception, ex:
		return False, ex.message

	return True, welcomedata




