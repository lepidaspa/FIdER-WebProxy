#!/usr/bin/env python
# -*- coding: utf-8 -*-

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

import os
import json
import sys
import traceback
import urllib2
import zipfile


from django.core.files.base import  File
from django.core.files.storage import FileSystemStorage
from django.utils.safestring import SafeString
from django.views.decorators.csrf import csrf_exempt
from django.template.context import RequestContext
from django.shortcuts import render_to_response
from django.http import HttpResponse

from FIdERProxyFS.proxy_core import readSingleShape
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

	try:
		shapetable = proxy_core.getConversionTable(kwargs["proxy_id"], kwargs["meta_id"], kwargs["shape_id"])
	except Exception as ex:
		print "Error when loading shape conversion table: %s" % ex
		shapetable = None



	try:

		jsonresponse = urllib2.urlopen(conf.URL_CONVERSIONS)
		convtable = json.load(jsonresponse)
		print "Received conversion table from server: %s" % convtable

	except Exception as ex:
		if isinstance(ex, urllib2.HTTPError):
			errormess = ex.code
		elif isinstance(ex, urllib2.URLError):
			errormess = ex.reason
		else:
			errormess = ex.message
		print "Error when requesting conversion table from %s: %s" % (conf.URL_CONVERSIONS, errormess)

		convtable = {
			'Duct' : {
				'ID' : 'str',
				'Owner': 'str',
				'OwnerID' : 'str',
				'StartID': 'str',
				'EndID': 'str',
				'Length': 'str',
				'Type': 'str',
				'Availability': 'str',
				'CreationDate': 'str',
				'LastUpdate': 'str',
				},
			'Well' : {
				'ID': 'int',
				'Owner': 'str',
				'OwnerID': 'str',
				'Address': 'str',
				'Type': 'str',
				'CreationDate': 'str',
				'LastUpdate': 'str',
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
		"conversion" : convtable,
		"shapetable": shapetable
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



	#checking if a file has just been uploaded
	filestuff = ""
	changestoconfirm = 0
	if request.method == 'POST':


		try:
			upload = request.FILES['mapsub']
		except:
			upload = None

		# now we check for delete requests, BEFORE the upload to avoid a replace and delete condition
		try:
			removals = request.POST.getlist("removal")
		except:
			removals = None
		#print "Removing "+str(removals)

		for removal in removals:
			proxy_id, meta_id, shape_id = removal.split("-",2)
			if proxy_id == request.POST['sel_proxy'] and meta_id == request.POST['sel_meta']:
				try:
					filestuff+="Mappa %s/%s/%s cancellata<br>" % (proxy_id, meta_id, shape_id)
					changestoconfirm+=1
					os.remove(os.path.join(conf.baseuploadpath, proxy_id, meta_id, shape_id+".zip"))
					proxy_core.handleDelete(proxy_id, meta_id, shape_id)
				except Exception as ex:
					filestuff+="Cancellazione della mappa %s/%s/%s fallita (%s)<br>"  % (proxy_id, meta_id, shape_id, ex)





		# then we perform the upload

		if upload is not None:


			proxy_id = request.POST['sel_proxy']
			meta_id = request.POST['sel_meta']
			shape_id = request.POST['sel_saveas']
			print "FORM: Uploading file to %s/%s/%s" % (proxy_id, meta_id, shape_id)
			if shape_id == "":
				shape_id = None
			success, output = saveMapFile(upload, proxy_id, meta_id, shape_id)
			if success:
				filestuff += "Upload del file %s su %s completato.<br>" % (upload.name, output)
				changestoconfirm+=1
			else:
				filestuff += "Upload del file %s fallito. Causa: %s <br>" % (upload.name, output)


	#working form

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


	if filestuff != "" and changestoconfirm>0:
		filestuff += '<a href="/proxy/refresh/'+proxy_id+'">Conferma modifiche</a>'


	return render_to_response ('uploadmask.html', {"proxies":list_proxy, "metadata":list_meta_byproxy, "shapefile":list_shape_bymeta_byproxy, "uploads": filestuff},
		context_instance=RequestContext(request))


def saveMapFile (uploaded, proxy_id, meta_id, shape_id=None):
	"""
	Takes an uploaded file (usually InMemoryUploadedFile) and saves it to the proxy/meta/shape destination, if needed after normalising the names inside
	:param uploaded:
	:param proxy_id:
	:param meta_id:
	:param shape_id:
	:return:
	"""

	print "Uploading file %s, size %s " % (uploaded.name, uploaded.size)
	#print "Data: %s " % (str(uploaded.read()))

	isvalid = proxy_core.verifyShapeArchiveStructure(uploaded)
	if not isvalid:
		return False, "Struttura dell'archivio non valida"

	if shape_id is None:
		shape_id = uploaded.name[:-4]
		if os.path.exists(os.path.join(conf.baseuploadpath, proxy_id, meta_id, uploaded.name)):
			os.remove(os.path.join(conf.baseuploadpath, proxy_id, meta_id, uploaded.name))
		fs = FileSystemStorage(location=os.path.join(conf.baseuploadpath))
		savepath = fs.save(os.path.join(proxy_id, meta_id, shape_id+".zip"), File(uploaded))
		return True, savepath
	else:
		try:
			if os.path.exists(os.path.join(conf.baseuploadpath, proxy_id, meta_id, shape_id+".zip")):
				os.remove(os.path.join(conf.baseuploadpath, proxy_id, meta_id, shape_id+".zip"))

			zipfrom = zipfile.ZipFile(uploaded)
			zipdata = zipfrom.infolist()
			try:
				zipto = zipfile.ZipFile(os.path.join(conf.baseuploadpath,proxy_id, meta_id, shape_id+".zip"), 'w', zipfile.ZIP_DEFLATED)
			except:
				zipto = zipfile.ZipFile(os.path.join(conf.baseuploadpath,proxy_id, meta_id, shape_id+".zip"), 'w', zipfile.ZIP_STORED)
			for element in zipdata:
				filename = element.filename.replace(element.filename.split(".")[0], shape_id)
				zipto.writestr(filename, zipfrom.read(element))
			zipto.close()
			return True, shape_id

		except Exception as ex:
			#print ex.message
			return False, "Eccezione: %s" % ex


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


	print "TABLE: %s" % response_table_update

	return HttpResponse(json.dumps(response_table_update), mimetype="application/json")



def proxy_visual (request, **kwargs):
	"""
	Visualization interface for data that has been both uploaded and refreshed
	:param request:
	:param kwargs: [proxy_id], [meta_id], [shape_id]
	:return:
	"""

	#TODO: handle pre-selected visual range

	list_proxy = ProxyFS.getProxyList()

	list_meta_byproxy = {}
	for proxy in list_proxy:
		list_meta_byproxy [proxy] = os.listdir(os.path.join(conf.baseproxypath,proxy, conf.path_geojson))

	list_shape_bymeta_byproxy = {}
	for proxy in list_proxy:
		list_shape_bymeta_byproxy[proxy] = {}
		for meta in list_meta_byproxy[proxy]:
			list_shape_bymeta_byproxy[proxy][meta] = []
			for shape in os.listdir(os.path.join(conf.baseproxypath,proxy, conf.path_geojson, meta)):
				list_shape_bymeta_byproxy[proxy][meta].append(shape)

	proxyboxes = {}
	metaboxes = {}

	for proxy_id in list_proxy:
		fp_manifest = open(os.path.join(conf.baseproxypath, proxy_id, conf.path_manifest), 'r')
		manifest = json.load (fp_manifest)
		proxyboxes[proxy_id] = []
		for coord in manifest['area']:
			proxyboxes[proxy_id].append(float(coord))
		metaboxes[proxy_id] = {}
		for meta in manifest['metadata']:
			metaboxes[proxy_id][meta['name']] = []
			for coord in meta['area']:
				metaboxes[proxy_id][meta['name']].append(float(coord))
		fp_manifest.close()

	print proxyboxes
	print metaboxes

	return render_to_response ('proxy_visual.html', {"proxies":list_proxy, "metadata":list_meta_byproxy, "shapefile":list_shape_bymeta_byproxy, "proxyboxes": SafeString(json.dumps(proxyboxes)), "metaboxes":SafeString (json.dumps(metaboxes)) },
		context_instance=RequestContext(request))

def proxy_loadmap (request, **kwargs):

	proxy_id = kwargs['proxy_id']
	meta_id = kwargs['meta_id']
	shape_id = kwargs['shape_id']

	print "Loading map data for map %s/%s/%s" % (proxy_id, meta_id, shape_id)

	jsondata = readSingleShape (proxy_id, meta_id, shape_id)
	return HttpResponse(jsondata, mimetype="application/json")


def proxy_features (request):

	return render_to_response ('welcome.html', context_instance=RequestContext(request))















def set_access_control_headers(response):
	response['Access-Control-Allow-Origin'] = '*'
	response['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
	response['Access-Control-Max-Age'] = 1000
	response['Access-Control-Allow-Headers'] = '*'

class HttpOptionsDecorator(object):
	def __init__(self, f):
		self.f = f

	def __call__(self, *args, **kwargs):
		#logging.info("Call decorator")
		request = args[0]
		if request.method == "OPTIONS":
			response = HttpResponse()
			set_access_control_headers(response)
			return response
		else:
			response = self.f(*args, **kwargs)
			set_access_control_headers(response)
			return response


@HttpOptionsDecorator
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

