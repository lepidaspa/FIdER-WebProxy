#!/usr/bin/env python
# -*- coding: utf-8 -*-

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'


def loadConfFile(filepath):
	confdata = {}
	fp = open(filepath)
	for line in fp:
		key, value = line.strip().split("=",1)
		try:
			if line[0] != "#":
				confdata[key]=value
		except:
			pass
	return confdata




#IMPORTING FROM CONFIG TESTING
#TODO: REPLACE WITH ACTUAL CONFIG DATA
import config_testing

#TODO: make conf file more complete and place it out (problems with Django?)
#conf_core = loadConfFile(os.path.join("..","proxy_core.conf"))
conf_core = loadConfFile("proxy_core.conf")




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

mainserver_ref_location = config_testing.MAINSERVER_CONF_FILE

path_mirror = 'maps/mirror/'
path_geojson = 'maps/geojson/'
path_manifest = 'conf/manifest.json'

tries_for_connection = 3
tries_for_lock = 5
wait_for_connection = 10
wait_for_unlock = 3


#URL_WRITEREQUEST = config_testing.URL_WRITE_REQUEST
#URL_DISCOVERY = config_testing.URL_DISCOVERY

MAINSERVER_LOC = "http://"+conf_core["FIDER_ADDRESS"]+":"+conf_core["FIDER_PORT"]

URL_DISCOVERY = MAINSERVER_LOC+conf_core["URL_FIDER_WELCOME"]
URL_WRITEREQUEST = MAINSERVER_LOC+conf_core["URL_FIDER_SUBMIT_WRITE"]
URL_WRITEMANIFEST = MAINSERVER_LOC+conf_core["URL_FIDER_SUBMIT_MANIFEST"]

