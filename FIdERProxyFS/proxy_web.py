#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
import os
import shutil
from FIdERProxyFS import proxy_core, proxy_lock

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'


"""
This file defines the proxy actions called directly from the web interface.
These functions can call ProxyFS and proxy_core to actually perform the operations on the underlying structure, but they always return info in a json message containing a boolean success and and a report field.
"""

import proxy_config_core as proxyconf


def deleteMap (proxy_id, meta_id, shape_id):
	"""
	Deletes a single map from the proxy
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	feedback = {
		'success': False,
		'report': ""
	}

	locker = proxy_lock.ProxyLocker (retries=3, wait=5)


	uploadpath = os.path.join (proxyconf.baseuploadpath, proxy_id, meta_id, shape_id)
	if os.path.exists(uploadpath):
		try:
			os.remove(uploadpath)
		except Exception, ex:
			feedback ['report'] = 'Cancellazione fallita: %s' % ex
			return feedback

	# we may have done a partial removal earlier, so the file is not in the upload directory but is in the mirror and geojson dirs.

	try:

		locker.performLocked(proxy_core.handleDelete, proxy_id, meta_id, shape_id)
		#proxy_core.handleDelete(proxy_id, meta_id, shape_id)
		feedback['success'] = True
		feedback['report'] = "Cancellazione della mappa %s completata." % shape_id
	except Exception, ex:
		feedback['report'] = 'Cancellazione interrotta: %s' % ex

	try:
		locker.performLocked(proxy_core.replicateDelete, proxy_id, meta_id, shape_id)

		#proxy_core.replicateDelete(proxy_id, meta_id, shape_id)
		feedback['success'] = True
		feedback['report'] = "Cancellazione della mappa %s completata." % shape_id
	except Exception, ex:
		feedback['report'] = 'Cancellazione interrotta: %s' % ex


	return feedback

