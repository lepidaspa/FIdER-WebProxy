#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
import json

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

import psycopg2


def probePostGIS (conndata, table, schema=""):
	"""
	:param conndata:
	:param schema:
	:param table
	:return:
	"""


	#print "CONN data: %s" % conndata
	connstring = ""
	for key in conndata.keys():
		connstring += str(key)+"="+str(conndata[key])+" "
	dbname = conndata['dbname']


	target = ""
	if schema!="":
		target = schema+"."
	target += table


	print "CONN string: %s" % connstring
	#params =  'port=5432 password=lepidalabs user=labs host=195.62.186.196 dbname=geodb '

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