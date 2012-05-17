#!/usr/bin/env python
# -*- coding: utf-8 -*-



__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

import json
import sys


from django.template.context import RequestContext
from django.shortcuts import render_to_response
from django.http import HttpResponse

from MarconiLabsTools import ArDiVa
from FIdERProxyFS import ProxyFS, proxy_core
from FIdERWP import MessageTemplates, Components


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


def softproxy_create_make (request):
	"""
	Exchanges data with the main server, receives the token and builds the proxy structure locally, display a report on the results
	:param request:
	:return:
	"""


	# creating the pre-manifest
	jsonmessage = json.loads(request.POST['jsondata'])
	manifest = ArDiVa.Model(MessageTemplates.model_response_capabilities)


	# Getting the token from the main  server
	accepted, message = Components.getWelcomeFromServer()

	if accepted:
		#assembling the manifest

		proxy_id = message['token']
		jsonmessage['token'] = proxy_id
		manifest.fillSafely(jsonmessage)


		approved, response = Components.sendProxyManifest (proxy_id)

		if approved:

			# creating the actual proxy (SOFT proxy on current system)
			created, message = ProxyFS.createSoftProxy(proxy_id, manifest)
			if created:
				feedback = "Creato proxy %s con il seguente manifesto %s" % (proxy_id, str(manifest))
			else:
				feedback = "Errore nella creazione locale del proxy %s con il seguente manifesto<br>%s;<br>Errore %s" % (proxy_id, str(manifest), str(message))

		else:
			feedback = "Errore dal federatore nella creazione del proxy %s con il seguente manifesto<br> %s;<br>Errore %s" % (proxy_id, str(manifest), str(response))

	else:

		feedback = "Creazione proxy fallita, riprovare (%s).<br>Manifesto parziale %s" % (message, jsonmessage)



	#return render_to_response ('proxy_create_make.html', context_instance=RequestContext(request))
	return HttpResponse("<html><body>POST data:<br>"+str(feedback)+"</body></html>")




def softproxy_conversion_setup (request):
	"""
	Allows to setup a conversion table for a any proxy/meta/shape combination, according to what has already been uploaded
	:param request:
	:return:
	"""


	"""
	if request.FILE is not None:
		context = RequestContext(request)
		context ["uploadedfile"] = request.FILE
		return render_to_response ('proxy_setup_conversion.html', context)
	else:
		return render_to_response ('proxy_setup_conversion.html',context_instance=RequestContext(request))
	"""

	list_proxy = []
	list_meta_byproxy = {}
	list_shape_bymeta_byproxy = {}

	#TODO: Replace debug tests with actual data

	#get list of all proxies
	#list_proxy = os.listdir(os.path.join(conf.baseuploadpath))
	#DEBUG ONLY
	list_proxy = ['42g2424g42g24g', 'gg248j42', 'fg4g4224']

	#get list of all metas (for proxy); note: only those for which we have files uploaded
	#DEBUG ONLY
	list_meta_byproxy = {
		'42g2424g42g24g' : ["A","B", "C", "D"],
		'gg248j42' : ["E","F","G","H"],
		'fg4g4224': ["I","J","K", "L"]
	}

	#get list of all shapes (for meta, for proxy)
	#DEBUG ONLY
	list_shape_bymeta_byproxy = {
		'42g2424g42g24g' : {"A": [1,2,3],"B": [4,5,6], "C":[6,7,8], "D":[9,10,11]},
		'gg248j42' : {"E":[12,13,14,15],"F":[16,17,18],"G":[19,20,21],"H":[19,20,21]},
		'fg4g4224': {"I":[22,23,24,25],"J":[26,27,28,29],"K":[30,31,32], "L":[33,34,35,36,37]}
	}




	return render_to_response ('proxy_setup_conversion.html', {"proxies":list_proxy, "metadata":list_meta_byproxy, "shapefile":list_shape_bymeta_byproxy},
context_instance=RequestContext(request))



def component_shapefile_table (request, **kwargs):

	shapedata = proxy_core.convertShapeFileToJson(kwargs["proxy_id"], kwargs["meta_id"], kwargs["shape_id"], False)
	shapetable = proxy_core.getConversionTable(kwargs["proxy_id"], kwargs["meta_id"], kwargs["shape_id"])

	args = {
		"proxy_id" : kwargs["proxy_id"],
		"meta_id" : kwargs["meta_id"],
		"shape_id" : kwargs["shape_id"],
		"shapedata" : shapedata,
		"conversion" : shapetable

	}

	return render_to_response ('component_proxy_retrieve_conversion.html', args,
		context_instance=RequestContext(request))