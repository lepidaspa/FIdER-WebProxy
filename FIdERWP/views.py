#!/usr/bin/env python
# -*- coding: utf-8 -*-
import json
from django.shortcuts import render_to_response
import sys
from django.template.context import RequestContext
from FIdERProxyFS import ProxyFS
from FIdERWP import MessageTemplates, Components

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
	Allows tosetup a conversion table for a specific server
	:param request:
	:return:
	"""


	if request.FILE is not None:
		context = RequestContext(request)
		context ["uploadedfile"] = request.FILE
		return render_to_response ('proxy_setup_conversion.html', context)
	else:
		return render_to_response ('proxy_upload_conversion.html',context_instance=RequestContext(request))
