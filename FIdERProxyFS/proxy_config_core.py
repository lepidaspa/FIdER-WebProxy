#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

def loadConfFile(filepath):
	print "Loading %s" % filepath
	confdata = {}
	fp = open(filepath)
	for line in fp:
		try:
			if line[0] != "#":
				key, value = line.strip().split("=",1)
				confdata[key]=value
		except:
			pass
	return confdata




#IMPORTING FROM CONFIG TESTING
#TODO: REPLACE WITH ACTUAL CONFIG DATA
import config_testing

if __name__ == "__main__":
	relpath = "."
else:
	relpath = os.path.dirname(__file__)

print relpath

#TODO: make conf file more complete and place it out (problems with Django?)
#conf_core = loadConfFile(os.path.join("..","proxy_core.conf"))
print "Loading config from %s" % relpath
conf_core = loadConfFile(os.path.join(relpath, "proxy_core.conf"))




# list of FEDERA user ids that can admin the proxy, can change
users_federa = []

#email address where all errors are sent, can change
#NOTE: this is IN ADDITION to sending to all admins according to FEDERA settings
mail_admin = config_testing.PROXYADMIN_MAIL

# location of the logging file
log_folder = "./tests/logs/"

# general data path for the HARD proxy
#baseproxypath = config_testing.HARDPROXY_DATAPATH
#baseuploadpath = config_testing.UPLOADPATH
baseproxypath = conf_core["PROXY_ROOT_MAIN"]
baseuploadpath = conf_core["PROXY_ROOT_UPLOAD"]
basemanifestpath = conf_core["PROXY_LIST"]

mainserver_ref_location = config_testing.MAINSERVER_CONF_FILE

path_mirror = 'maps/mirror'
path_geojson = 'maps/geojson'
path_manifest = 'conf/manifest.json'
path_mappings = 'conf/mappings'
path_remoteres = 'conf/remote'
path_standalone = 'maps/st'

tries_for_connection = 3
tries_for_lock = 5
wait_for_connection = 10
wait_for_unlock = 3


#URL_WRITEREQUEST = config_testing.URL_WRITE_REQUEST
#URL_DISCOVERY = config_testing.URL_DISCOVERY

MAINSERVER_LOC = "http://"+conf_core["FIDER_ADDRESS"]+":"+conf_core["FIDER_PORT"]
HARDPROXY_LOC = "http://"+conf_core["HARDPROXY_ADDRESS"]+":"+conf_core["HARDPROXY_PORT"]

URL_DISCOVERY = MAINSERVER_LOC+conf_core["URL_FIDER_WELCOME"]
URL_WRITEREQUEST = MAINSERVER_LOC+conf_core["URL_FIDER_SUBMIT_WRITE"]
URL_WRITEMANIFEST = MAINSERVER_LOC+conf_core["URL_FIDER_SUBMIT_MANIFEST"]
URL_CONVERSIONS = MAINSERVER_LOC+conf_core["URL_FIDER_REQUEST_CONVERSIONS"]
URL_MODELS = MAINSERVER_LOC+conf_core["URL_FIDER_REQUEST_MODELS"]

