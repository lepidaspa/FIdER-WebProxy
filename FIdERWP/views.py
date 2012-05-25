#!/usr/bin/env python
# -*- coding: utf-8 -*-

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

import os
import json
import sys
import traceback

from django.views.decorators.csrf import csrf_exempt
from django.template.context import RequestContext
from django.shortcuts import render_to_response
from django.http import HttpResponse

from MarconiLabsTools import ArDiVa
from FIdERProxyFS import ProxyFS, proxy_core
from FIdERWP import MessageTemplates, Components
from FIdERProxyFS import proxy_config_core as conf

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
	premanifest = ArDiVa.Model(MessageTemplates.model_response_capabilities)


	# Getting the token from the main  server
	accepted, message = Components.getWelcomeFromServer()

	if accepted:
		#assembling the manifest

		proxy_id = message['token']
		jsonmessage['token'] = proxy_id
		filledok, manifest = premanifest.fillSafely(jsonmessage)

		#print "*****JSONMESS: \n"+str(jsonmessage)+"*****"
		#print "*****MANIFEST: "+str(filledok)+"\n"+str(manifest)+"*****"

		approved, response = Components.sendProxyManifestRaw (json.dumps(manifest))

		if approved:

			# creating the actual proxy (SOFT proxy on current system)
			created, message = ProxyFS.createSoftProxy(proxy_id, manifest)
			if created:
				feedback = "Creato proxy %s con il seguente manifesto %s" % (proxy_id, str(manifest))
			else:
				feedback = "Errore nella creazione locale del proxy %s con il seguente manifesto<br>%s<br>Errore %s" % (proxy_id, str(manifest), str(message))

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



	#TODO: Replace debug tests with actual data

	#get list of all proxies
	list_proxy = os.listdir(os.path.join(conf.baseuploadpath))


	#get list of all metas (for proxy); note: only those for which we have files uploaded


	list_meta_byproxy = {}
	for proxy in list_proxy:
		list_meta_byproxy [proxy] = os.listdir(os.path.join(conf.baseuploadpath,proxy))

	#get list of all shapes (for meta, for proxy)



	#TODO: use getProxyFullListing from ProxyFS

	list_shape_bymeta_byproxy = {}
	for proxy in list_proxy:
		list_shape_bymeta_byproxy[proxy] = {}
		for meta in list_meta_byproxy[proxy]:
			list_shape_bymeta_byproxy[proxy][meta] = []
			for shape in os.listdir(os.path.join(conf.baseuploadpath,proxy,meta)):
				list_shape_bymeta_byproxy[proxy][meta].append(shape[:-4])

	return render_to_response ('proxy_setup_conversion.html', {"proxies":list_proxy, "metadata":list_meta_byproxy, "shapefile":list_shape_bymeta_byproxy},
context_instance=RequestContext(request))



def component_shapefile_table (request, **kwargs):
	"""

	:param request:
	:param kwargs:
	:return:
	"""
	shapedata = None
	shapetable = None

	if kwargs.has_key('proxy_id') and kwargs.has_key('meta_id') and kwargs.has_key('shape_id'):
		shapedata = proxy_core.convertShapeFileToJson(kwargs["proxy_id"], kwargs["meta_id"], kwargs["shape_id"], False)
	#shapetable = proxy_core.getConversionTable(kwargs["proxy_id"], kwargs["meta_id"], kwargs["shape_id"])

	#DEBUG ONLY
	#TODO: get these from the main server
	shapetable = {
		'Node' : {
			'LocationNote' : 'str',
			'Tipologia': 'str',
			'Address' : 'str',
			'Neighborhood': 'str',
			},
		'Well' : {
			'Name' : 'str',
			'RETE' : 'str',
			'Address' : 'str',
			'Closure' : 'str',
			'Width' : 'int',
			'Length' : 'int'
		},
		'Duct' : {
			'Length': 'int',
			'Tube': 'str',
			'CODICE': 'str',
			'RETE': 'str',
			'Infrastructure': 'str'
		}

	}

	#print "PARSING SHAPE DATA from %s" % type(shapedata)
	#print shapedata
	conversionfrom = {}
	for feature in shapedata['features']:
		#print "Feature: %s *** (%s)" % (feature, type(feature))
		#print "Properties: %s " % feature['properties']
		for key in feature['properties'].keys():
			if not conversionfrom.has_key (key):
				conversionfrom[key] = str(type(feature['properties'][key])).split("'")[1]

	args = {
		"proxy_id" : kwargs["proxy_id"],
		"meta_id" : kwargs["meta_id"],
		"shape_id" : kwargs["shape_id"],
		"shapedata" : conversionfrom,
		"conversion" : shapetable
	}

	#print args




	return render_to_response ('component_proxy_retrieve_conversion.html', args,
		context_instance=RequestContext(request))

def hardproxy_refresh (request, **kwargs):

	try:
		proxy_id = kwargs['proxy_id']
	except:
		proxy_id = None

	if proxy_id is not None and proxy_id != "":
		#print "UPDATING PROXY! (%s)" % proxy_id
		ProxyFS.rebuildFullShapesList(proxy_id)
		preselect = proxy_id
	else:
		preselect = ""


	proxy_data_listing = ProxyFS.getFullProxyListing(False)

	proxy_data_listing.keys()

	#getting the timestamp for the last refresh of
	list_meta_stamped = ProxyFS.getProxyStamps(True, True)
	#print "META DATES: "+str(list_meta_stamped)



	return render_to_response ('proxy_refresh_json.html', {"proxies": proxy_data_listing.keys(), "metadata": list_meta_stamped, "shapes": proxy_data_listing, "preselect": preselect}, context_instance=RequestContext(request))

def showfeatures (request):
	"""
	Summarises the sections available on this proxy, only for debug?
	:param request:
	:return:
	"""



	return render_to_response ('featurelist.html', context_instance=RequestContext(request))

def proxy_uploadmap (request):
	"""
	Allows the user to upload a single shapefile archive on the proxy. For now the system only handles archives with a number of zipped shapefiles
	:param request:
	:return:
	"""

	# creating the args for the select fields so the user chan specify WHERE the files are to be sent

	list_proxy = os.listdir(os.path.join(conf.baseuploadpath))
	list_meta_byproxy = {}
	for proxy in list_proxy:
		list_meta_byproxy [proxy] = os.listdir(os.path.join(conf.baseuploadpath,proxy))

	list_shape_bymeta_byproxy = {}
	for proxy in list_proxy:
		list_shape_bymeta_byproxy[proxy] = {}
		for meta in list_meta_byproxy[proxy]:
			list_shape_bymeta_byproxy[proxy][meta] = []
			for shape in os.listdir(os.path.join(conf.baseuploadpath,proxy,meta)):
				list_shape_bymeta_byproxy[proxy][meta].append(shape[:-4])

	return render_to_response ('uploadmask.html', {"proxies":list_proxy, "metadata":list_meta_byproxy, "shapefile":list_shape_bymeta_byproxy},
		context_instance=RequestContext(request))



@csrf_exempt
def proxy_create_conversion (request):
	"""
	Receives a json dict describing the meta or shape to which the conversion is applied to and saves it. If to a meta, it saves it to ALL metas independently.
	:param request: request.POST has the arguments passed from the conversion table creation form. Contains 'convtable' with the full conversion table as a dict with key the source property name and value a list with object type and property name in the anfov model.
	:return:
	"""


	#print "Proxy create conversion"

	#print "Running at "+str(time.ctime())
	#print "PARAMS: "+str(request.POST)

	response_table_update = {
		'completed': False,
		'ok' : [],
		'failed': []
	}


	try:

		args = json.loads(request.POST['jsonmessage'])

		convtable =  args['convtable']
		proxy_id =  args['proxy_id']
		meta_id =  args['meta_id']
		shape_id = args['shape_id']

		#print "CONVERSION TABLE for PROXY: %s - META: %s - SHAPE: %s\nCONVTABLE: %s\n" % (proxy_id, meta_id, shape_id, convtable)

		#TODO: placeholder, implement

		#make union of MIRROR and MAPPINGS

		if shape_id is None:
			mapped_shapes = os.listdir(os.path.join(conf.baseproxypath, proxy_id, "conf/mappings", meta_id))
			mirrored_shapes = os.listdir(os.path.join(conf.baseproxypath, proxy_id, conf.path_mirror, meta_id))

			for cshape in mirrored_shapes:
				if cshape not in mapped_shapes:
					mapped_shapes.append(cshape)

		else:
			mapped_shapes = [shape_id,]

		#print "Writing mappings for %s.%s" % (meta_id, mapped_shapes)

		for shape_id in mapped_shapes:

			shape_path = os.path.join (conf.baseproxypath, proxy_id, "conf/mappings", meta_id, shape_id)

			try:
				#TODO: add lock file support (really needed?)
				fp = open(shape_path, 'w+')
				json.dump(convtable, fp)
				fp.close()
				response_table_update['ok'].append(shape_id)
			except Exception as ex:
				# if we cannot update the conversion table, we set it on the failed updates
				print "File update issue %s" % ex
				response_table_update['failed'].append(shape_id)

		if len(response_table_update['failed']) == 0:
			response_table_update['completed'] = True
	except:
		print traceback.format_exc()


	#print "TABLE: %s" % response_table_update

	return HttpResponse(json.dumps(response_table_update), mimetype="application/json")



def proxy_read_full (request, **kwargs):
	"""
	returns all the data for a specific proxy
	:param request:
	:param kwargs:
	:return:
	"""

	read_result = {}

	proxy_id = kwargs['proxy_id']

	print "DJANGO: performing full read of proxy %s " % proxy_id

	read_result = proxy_core.handleReadFull(proxy_id)

	return HttpResponse(read_result, mimetype="application/json")

