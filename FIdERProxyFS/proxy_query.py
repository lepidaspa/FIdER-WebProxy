#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
import json
import os
import Common.TemplatesModels
from FIdERProxyFS import proxy_core
from MarconiLabsTools import ArDiVa

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

import psycopg2
import psycopg2.extensions

import proxy_config_core as proxyconf


class QueryFailedException (Exception):
	pass




def getReverseConversion (proxy_id, meta_id, map_id):
	"""
	Gets the fields conversion table, but with the values (our model) in place of the keys (external model)
	:param proxy_id:
	:param meta_id:
	:param map_id:
	:return:
	"""

	basetable = (proxy_core.getConversionTable (proxy_id, meta_id, map_id))
	print "Found table as follows"
	print basetable


	basetable = basetable['fields']
	reversetable = {}

	for key in basetable.keys():

		reversetable[basetable[key]['to']] = key

	print "Returning reverse table"
	return reversetable



def makeQueryOnMeta (proxy_id, meta_id, json_raw):
	"""
	Takes a JSON message, verifies it and builds a PGSQL query string from it for each map in the requested metadata. Returns one feature collection for each map since mappings can be different on the various registered queries
	:param jsonquery:
	:return:
	"""


	jsonmessage = json.loads(json_raw)

	print "Working on %s, type %s " % (jsonmessage, type(jsonmessage))


	messagemodel = ArDiVa.Model(Common.TemplatesModels.model_request_query)

	print "Model %s " % messagemodel

	if not messagemodel.validateCandidate(jsonmessage):
		print "DEBUG: invalid message %s" % jsonmessage
		raise Exception ("Messaggio non valido: %s" % messagemodel.log)


	collection = {
		"type": "FeatureCollection",
		"features" : [],
		"properties": {
			"proxy": proxy_id,
			"meta": meta_id,
			"errors": []
		}
	}


	# checking which queries are available for this meta
	querypath = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror, meta_id)
	querylist = os.listdir(querypath)

	print "trying query on %s " % querylist

	featureslist = []
	for query in querylist:
		print "Query "+str(query)+"\n"+str(jsonmessage)
		try:
			featureslist.extend(makeSelectFromJson(proxy_id, meta_id, query, jsonmessage))
			print "Query "+str(query)+" successful"
		except QueryFailedException:
			print "Query "+str(query)+" failed (querywise)"
			collection['properties']['errors'].append(query)
		except Exception as ex:
			print "Query "+str(query)+" failed (other)\n"+str(ex)
			collection['properties']['errors'].append(query)

	collection['features'] = featureslist

	print "Managed to complete request"

	return json.dumps(collection)



def makeSelectFromJson (proxy_id, meta_id, map_id, jsonmessage):
	"""
	Takes a JSON message and builds a PGSQL query string from it; this function is expected to be called via makeQueryOnMeta
	:param jsonquery:
	:return: array of features, NOT a featurecollection object
	"""


	DEC2FLOAT = psycopg2.extensions.new_type(
		psycopg2._psycopg.DECIMAL.values, # oids for the decimal type
		'DEC2FLOAT', # the new typecaster name
		psycopg2.extensions.FLOAT) # the typecaster creating floats

	# register the typecaster globally
	psycopg2.extensions.register_type(DEC2FLOAT)


	proj_WGS84 = 4326


	# if the message is valid, we assemble the query

	# we do a quick check to ensure the query can be satisfied by the data provided with this table
	# i.e. if the columns chosen are supported in our translation

	columns = []
	for querybit in jsonmessage['query']['inventory']:
		columns.append(querybit['column'])

	revtable = getReverseConversion(proxy_id, meta_id, map_id)


	print "Retrieved reverse table for makeSelectFromJson"
	print revtable

	# if a column is missing, we return an empty list without checking the DB
	if not all (map(revtable.has_key, columns)):
		return []


	convtable = {}
	for key in revtable.keys():
		convtable[revtable[key]] = key

	# now we can proceed with the actual query process

	fp_conndata = open(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror, meta_id, map_id))
	conn_data = json.load(fp_conndata)
	fp_conndata.close()
	connstring = makeConnectString(conn_data['connection'])

	try:
		conn = psycopg2.connect(connstring)
		cur = conn.cursor()
		print "Connection established"
	except Exception as ex:
		raise QueryFailedException ("Connessione fallita: %s" % ex)

	#NOTE: bt as BETWEEN removed for now since it would require a specific syntax
	operators = {
		"gt": "> %s",
		"ge": ">= %s",
		"lt": "< %s",
		"le": "<= %s",
		"eq": "= %s",
		"in": "<@ ARRAY [%s]"
	}

	wherestring = ""
	sep = ""
	for querybit in jsonmessage['query']['inventory']:

		newbit = sep + " %s " + operators[querybit['operator']]
		wherestring += newbit % (revtable[querybit['column']], querybit['params'])

		sep = " AND "

	if len(jsonmessage['query']['BB']) > 0:

		#TODO: verify if we prefer to also have items that CROSS the bounding box or if we only what what is COMPLETELY inside (current)

		bb = jsonmessage['query']['BB']

		newbit = sep + " transform("+revtable['geometry'] +", "+str(proj_WGS84)+") @ ST_SetSRID(ST_MakeBox2D(ST_Point(%s, %s), ST_Point(%s , %s)), "+str(proj_WGS84)+")"
		wherestring += cur.mogrify(newbit, (bb[0], bb[1], bb[2], bb[3]))


	print "QUERY CONDITIONS: *************\n%s\n******************************" % wherestring

	view_id = conn_data['query']['view']
	schema_id = conn_data['query']['schema']
	if schema_id != "" and schema_id is not None:
		schema_id += "."


	fields = []
	selectcols = ""
	sep = ""
	for colname in convtable:

		alias = convtable[colname]
		fields.append(alias)
		if convtable[colname] == "geometry":
			colname = "ST_AsGeoJSON(transform("+colname+", 4326))"

		selectcols += sep + colname + " AS " + alias
		sep = ", "

	if selectcols == "":
		selectcols = " * "

	if wherestring != "":
		wherestring = " WHERE "+wherestring

	limitstring = ""
	offsetstring = ""
	if jsonmessage['maxitems'] != 0:
		limitstring = " LIMIT %s" % jsonmessage['maxitems']
	if jsonmessage['offset'] != 0:
		offsetstring = " OFFSET %s" % jsonmessage['offset']


	querystring = 'SELECT '+selectcols+' FROM '+schema_id+view_id + wherestring + limitstring + offsetstring + ";"

	print "REQUESTED SELECT: " + querystring

	cur.execute(querystring)

	results = cur.fetchall()

	cur.close()
	conn.close()

	collection = []

	#print "FIELDS: %s" % fields
	#print "RESULTS: %s" % results

	valuestable = proxy_core.getConversionTable(proxy_id, meta_id, map_id)

	print "Received (linear) conv table %s" % valuestable

	forced = valuestable['forcedfields']

	print "Set forced values, moving to value conversion"
	print "(revtable is now %s)" % revtable

	fieldvalues = {}
	for fedfield in revtable.keys():
		clientfield = revtable[fedfield]
		if len(valuestable['fields'][clientfield]['values']) > 0:
			print "Adding %s to quick conv" % clientfield
			fieldvalues[fedfield] = valuestable['fields'][clientfield]['values']

	print "Quick conv table is %s " % fieldvalues

	errors = 0
	for row in results:

		try:
			data = {}

			data['type'] = "Feature"
			data['geometry'] = json.loads(row[fields.index('geometry')])

			#print "GEOM: %s " % data['geometry']

			properties = {}

			for key in forced.keys():
				properties[key] = forced[key]['']

			for field in fields:
				if field != 'geometry':
					clientvalue = row[fields.index(field)]
					if field in fieldvalues.keys() and clientvalue in fieldvalues[field]:
						properties[field] = fieldvalues[field][clientvalue]
					else:
						properties[field] = clientvalue

			data['properties'] = properties

			collection.append(data)

		except Exception as ex:
			errors += 1

	print "Found %s elements with %s errors" % (len(collection), errors)


	return collection


def fullQueryOnMap (proxy_id, meta_id, map_id):
	"""
	Makes a non parametrised query on the map and returns a FeatureCollection
	:param proxy_id:
	:param meta_id:
	:param map_id:
	:return:
	"""

	collection = {
	"type": "FeatureCollection",
	"features" : [],
	"properties":
		{
			"proxy": proxy_id,
			"meta": meta_id,
			"map": map_id,
			"errors": []
		}
	}


	jsondict = {
		'query' : {
			'BB': [],
			'inventory': [],
			'time': ''
			},
		'maxitems': 0,
		'offset': 0
	}

	featurelist = makeSelectFromJson(proxy_id, meta_id, map_id, jsondict)

	print "Query result for map %s" % map_id

	collection['features'] = featurelist

	return collection




def makeConnectString (conndata):

	#print "CONN data: %s" % conndata
	connstring = ""
	for key in conndata.keys():
		connstring += str(key)+"="+str(conndata[key])+" "



	print "CONN string: %s" % connstring
	#params =  'port=5432 password=lepidalabs user=labs host=195.62.186.196 dbname=geodb '

	return connstring


def getPGStructure (proxy_id, meta_id, query_id):
	"""
	Finds the columns structure for a specific registered query
	:param proxy_id:
	:param meta_id:
	:param query_id:
	:return:
	"""

	# loads the connection info from filesystem, then returns probePostGIS

	conn_fp = open(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror, meta_id, query_id))
	connconfig = json.load(conn_fp)
	conn_fp.close()

	return probePostGIS(connconfig['connection'], connconfig['query']['view'], connconfig['query']['schema'])



def probePostGIS (conndata, table, schema=""):
	"""
	Checks the columns present on the requested table
	:param conndata:
	:param schema:
	:param table
	:return:
	"""

	dbname = conndata['dbname']

	target = ""
	if schema!="":
		target = schema+"."
	target += table

	connstring = makeConnectString(conndata)

	conn = psycopg2.connect(connstring)
	cur = conn.cursor()
	print "Connection established"

	sqlstring = "select column_name, is_nullable, data_type from information_schema.columns where table_catalog=%s and table_schema=%s and table_name=%s;"
	sqlvalues =  (dbname, schema, table)
	querystring = cur.mogrify(sqlstring, sqlvalues)
	cur.execute(querystring)
	fields = cur.fetchall()

	#print str(sqlstring % sqlvalues)+": "+str(fields)

	#print "Postgres error %s: %s" % (e.pgcode, e.pgerror)

	cur.close()
	conn.close()

	return fields


def registerQuery (proxy_id, meta_id, map_id, data_conn):
	"""
	Creates two json files, one in maps/mirror with the connection data and one in conf/mappings with the conversion table.
	:param proxy_id:
	:param meta_id:
	:param map_id:
	:param data_conn:
	:return:
	"""

	loc_conn_params = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror, meta_id, map_id)
	loc_conv_table = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_mappings, meta_id, map_id)

	fp_connection = open(loc_conn_params, 'w+')
	json.dump(data_conn, fp_connection)
	fp_connection.close()

	"""
	fp_conversion = open(loc_conv_table, 'w+')
	json.dump(data_conv, fp_conversion)
	fp_conversion.close()
	"""
	#TODO: return meaningful value

	return