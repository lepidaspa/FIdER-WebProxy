#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
import json
import urllib2
import os
import shutil
from FIdERProxyFS import proxy_core, proxy_lock, ProxyFS


__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'


"""
This file defines the proxy actions called directly from the web interface.
These functions can call ProxyFS and proxy_core to actually perform the operations on the underlying structure, but they always return info in a json message containing a boolean success and and a report field.
"""

import proxy_config_core as proxyconf

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

def getProxyType (proxy_id):
	"""
	Opens the manifest and returns the type of manifest
	:param proxy_id:
	:return:
	"""

	manifest = proxy_core.getManifest(proxy_id)

	return learnProxyType(manifest)



def deleteProxy (proxy_id):
	"""
	Deletes a softproxy from the hardproxy, called by proxy_controller
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	print "Deleting proxy %s" % proxy_id

	feedback = {
	'success': False,
	'report': ""
	}


	if not (proxy_id.startswith("local_")):
		url = proxyconf.MAINSERVER_LOC+"/broker/delete/"+proxy_id
		try:
			delete_response = urllib2.urlopen(url)
			print "Deletion confirmed"

		except (urllib2.HTTPError, urllib2.URLError) as ex:

			print "ERRORE: %s\nMESSAGGIO: %s" % (ex, ex.message)
			feedback['report'] = "Cancellazione annullata dal federatore"
			return feedback



	try:
		print "Removing proxy %s" % proxy_id

		datadir = os.path.join(proxyconf.baseproxypath, proxy_id)
		uploaddir = os.path.join(proxyconf.baseuploadpath, proxy_id)
		manifest = os.path.join(proxyconf.basemanifestpath, proxy_id+".manifest")
		islinked = ProxyFS.isLinkedProxy(proxy_id, json.load(open(manifest))['name'])

		elements = 0

		print "Removing data dir for proxy %s" % proxy_id
		if os.path.exists (datadir):
			elements+=1

			# first we remove the links
			if islinked:
				mirrordir = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror)
				os.remove(mirrordir)
			shutil.rmtree(datadir)
		print "Removing upload dir for proxy %s" % proxy_id
		if os.path.exists (uploaddir):
			elements+=1
			shutil.rmtree(uploaddir)
		print "Removing manifest file for proxy %s" % proxy_id
		if os.path.exists(manifest):
			elements+=1
			os.remove(manifest)

		if elements == 0:
			raise Exception ("Proxy inesistente")

		feedback ['success'] = True
		feedback ['response'] = "Cancellazione del proxy confermata"

	except Exception as ex:
		print "Proxy %s non cancellato dal filesystem, causa %s" % (proxy_id, ex)
		feedback ['response'] = "Proxy %s non cancellato dal filesystem, causa %s" % (proxy_id, ex)


	return feedback




def deleteMap (proxy_id, meta_id, shape_id):
	"""
	Deletes a single map from the proxy, called by proxy_controller
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	print "Requested deletion of map %s/%s/%s" % (proxy_id, meta_id, shape_id)

	proxytype = getProxyType(proxy_id)


	feedback = {
		'success': False,
		'report': ""
	}

	locker = proxy_lock.ProxyLocker (retries=3, wait=5)


	if proxytype != 'query' and meta_id != ".st":

		#first we check for remote reload info


		print "Checking for remote load info"

		try:

			if proxy_core.isRemoteMap:
				os.remove(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_remoteres, meta_id, shape_id+'.wfs'))

			if proxy_core.isFTPMap:
				os.remove(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_remoteres, meta_id, shape_id+'.ftp'))
		except Exception as ex:
			feedback ['report'] = 'Cancellazione dei dati di riferimento remoto fallita: %s' % ex
			return feedback



		# we do not need to remove stuff in the geojson dir if the proxy is query

		uploadpath = os.path.join (proxyconf.baseuploadpath, proxy_id, meta_id, shape_id)
		if os.path.exists(uploadpath):
			try:
				os.remove(uploadpath)
			except Exception as ex:
				feedback ['report'] = 'Cancellazione fallita: %s' % ex
				return feedback

		# we may have done a partial removal earlier, so the file is not in the upload directory but is in the mirror and geojson dirs.

		try:
			locker.performLocked(proxy_core.handleDelete, proxy_id, meta_id, shape_id)
			#proxy_core.handleDelete(proxy_id, meta_id, shape_id)
			feedback['success'] = True
			feedback['report'] = "Cancellazione della mappa %s completata." % shape_id
		except Exception as ex:
			feedback['report'] = 'Cancellazione interrotta: %s' % ex


		try:
			locker.performLocked(proxy_core.replicateDelete, proxy_id, meta_id, shape_id)

			#proxy_core.replicateDelete(proxy_id, meta_id, shape_id)
			feedback['success'] = True
			feedback['report'] = "Cancellazione della mappa %s completata." % shape_id
		except Exception as ex:
			feedback['report'] = "Cancellazione della mappa %s completata." % shape_id

	elif meta_id == '.st':
		try:
			locker.performLocked(proxy_core.handleDelete, proxy_id, meta_id, shape_id)
			feedback['success'] = True
			feedback['report'] = "Cancellazione della mappa %s in archivio completata." % shape_id

		except Exception as ex:
			feedback['report'] = 'Cancellazione interrotta: %s' % ex


	elif proxytype == "query":
		try:

			target = os.path.join (proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror, meta_id, shape_id)
			os.remove(target)
			#proxy_core.handleDelete(proxy_id, meta_id, shape_id)
			feedback['success'] = True
			feedback['report'] = "Cancellazione della mappa %s completata." % shape_id
		except Exception as ex:
			feedback['report'] = 'Cancellazione interrotta: %s' % ex




	return feedback

