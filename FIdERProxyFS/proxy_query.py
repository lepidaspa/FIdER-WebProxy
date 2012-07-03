#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
import json
import os
from psycopg2.tests.testconfig import dbname
import Common.TemplatesModels
from FIdERProxyFS import proxy_core
from MarconiLabsTools import ArDiVa

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

import psycopg2
import proxy_config_core as proxyconf



def getReverseConversion (proxy_id, meta_id, map_id):
	"""
	Gets the fields conversion table, but with the values (our model) in place of the keys (external model)
	:param proxy_id:
	:param meta_id:
	:param map_id:
	:return:
	"""

	basetable = proxy_core.getConversionTable (proxy_id, meta_id, map_id)
	reversetable = {}
	for key in basetable.keys():

		reversetable [basetable[key][1]] = key


	return reversetable



def makeSelectFromJson (proxy_id, meta_id, map_id, jsonmessage):
	"""
	Takes a JSON message and builds a PGSQL query string from it
	:param jsonquery:
	:return:
	"""

	jsonmessage = json.loads(jsonmessage)

	messagemodel = ArDiVa.Model(Common.TemplatesModels.model_request_query)

	if not messagemodel.validateCandidate(jsonmessage):
		raise Exception ("Messaggio non valido: %s" % messagemodel.log)

	# if the message is valid, we assemble the query

	# we do a quick check to ensure the query can be satisfied by the data provided with this table
	# i.e. if the columns chosen are supported in our translation

	columns = []
	for querybit in jsonmessage['query']['inventory']:
		columns.append(querybit['column'])

	revtable = getReverseConversion(proxy_id, meta_id, map_id)

	# if a column is missing, we return an empty list without checking the DB
	if not all (map(revtable.has_key, columns)):
		return []

	convtable = {}
	for key in revtable.keys():
		convtable[revtable[key]] = key

	# now we can proceed with the actual query process


	conn_data = json.load(os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror, meta_id, map_id))
	connstring = makeConnectString(conn_data['connection'])

	try:
		conn = psycopg2.connect(connstring)
		cur = conn.cursor()
		print "Connection established"
	except Exception as ex:
		raise Exception ("Connessione fallita: %s" % ex)

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
		wherestring += cur.mogrify(newbit, (querybit['column'], querybit['params']))

		sep = " AND "

	#TODO: add bounding box  check

	wherestring += ";"
	print wherestring

	view_id = conn_data['query']['view']
	schema_id = conn_data['query']['schema']
	if schema_id != "" and schema_id is not None:
		schema_id += "."

	selectcols = ""
	sep = ""
	for colname in columns:
		selectcols += sep + colname + " AS " + convtable[colname]
		sep = ", "

	querystring = 'SELECT '+selectcols+' FROM '+schema_id+view_id + ' WHERE ' + wherestring

	print "SELECT REQUESTED: " + querystring

	cur.execute(querystring)

	cur.scroll(jsonmessage['offset'])

	fields = cur.fetchmany(jsonmessage['maxitems'])

	cur.close()
	conn.close()

	return fields





def makeConnectString (conndata):

	#print "CONN data: %s" % conndata
	connstring = ""
	for key in conndata.keys():
		connstring += str(key)+"="+str(conndata[key])+" "



	print "CONN string: %s" % connstring
	#params =  'port=5432 password=lepidalabs user=labs host=195.62.186.196 dbname=geodb '

	return connstring



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

	print str(sqlstring % sqlvalues)+": "+str(fields)

	#print "Postgres error %s: %s" % (e.pgcode, e.pgerror)

	cur.close()
	conn.close()

	return fields


def registerQuery (proxy_id, meta_id, map_id, data_conn, data_conv):
	"""
	Creates two json files, one in maps/mirror with the connection data and one in conf/mappings with the conversion table.
	:param proxy_id:
	:param meta_id:
	:param map_id:
	:param data_conn:
	:param data_conv:
	:return:
	"""

	loc_conn_params = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_mirror, meta_id, map_id)
	loc_conv_table = os.path.join(proxyconf.baseproxypath, proxy_id, proxyconf.path_mappings, meta_id, map_id)

	fp_connection = open(loc_conn_params, 'w+')
	json.dump(data_conn, fp_connection)
	fp_connection.close()

	fp_conversion = open(loc_conv_table, 'w+')
	json.dump(data_conv, fp_conversion)
	fp_conversion.close()

	return