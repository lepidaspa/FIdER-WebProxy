#!/usr/bin/env python
# -*- coding: utf-8 -*-
from django.shortcuts import render_to_response
import sys
from django.template.context import RequestContext

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

from django.http import HttpResponse
from MarconiLabsTools import ArDiVa

def error404test (request):

	htmldata = "<html><body>Error 404 test: </body></html>"
	return HttpResponse(htmldata)


def error500test (request):
	type, value, tb = sys.exc_info()
	htmldata = "<html><body>Error 500 test: <br><pre>"+str(request)+"\n"+str(value)+"</pre><br> </body></html>"
	return HttpResponse(htmldata)


def softproxy_create_manifest (request):
	"""
	Creation of the soft proxy, step 1: create the manifest (except for metadata)
	:param request:
	:return:
	"""

	return render_to_response ('proxy_setup_manifest.html',context_instance=RequestContext(request))




