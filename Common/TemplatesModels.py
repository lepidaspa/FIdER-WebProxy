#!/usr/bin/env python
# -*- coding: utf-8 -*-
from FIdERProxyFS import proxy_config_core

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

from MarconiLabsTools.ArDiVa import validateFieldIteratively, validateFieldAsListOf
from FIdERFLL.validate_fields_templates import validateFieldAsAnomaly
from FIdERFLL.validate_fields import *


# This file contains ArDiVa-based models and processes for the message validator

model_response_capabilities = {
	"token": unicode,
	"message_type": (u'response',),
	"message_format": (u'capabilities',),
	"base_url": (proxy_config_core.HARDPROXY_LOC,),
	"area": list,
	"time": list,
	"operations": {
		"write": (u"full", u"sync", u"none"),
		"read": (u"full", u"diff", u"none"),
		"query": {
			"inventory": (u"full", u"simple", u"none"),
			"geographic": (u"full", u"BB", u"none"),
			"time": (u"full", u"none"),
			"bi": (u"full", u"simple", u"none"),
			"signs": bool,
		},
	},
	"metadata": list
}



model_response_welcome = {
	"token": unicode,
	"message_type": (u'response',),
	"message_format": (u'welcome',),
	"latest_model_version": unicode,
}

# no process_response_welcome



model_response_read = {
	u"token": unicode,
	u"message_type": (u'response',),
	u"message_format": (u'read',),
	u"time": unicode,
	u"data": {
		u"upsert": dict,
		u"delete": list
	}
}

model_response_read_full = {
	u"token": unicode,
	u"message_type": (u'response',),
	u"message_format": (u'read',),
	u"data": {
		u"upsert": dict,
		u"delete": list
	}
}


model_request_write = {
	"token": unicode,
	"message_type": [u'request',],
	"message_format": [u'write',],
	"data": {
		"upsert": dict,
		"delete": list
	}
}


#TODO: verify is DICT is the correct type for QUERY/INVENTORY
model_request_query = {
	"token": unicode,
	"message_type": [u'request',],
	"message_format": [u'query',],
	"query" : {
		"BB": list,
		"inventory": dict,
		"time": unicode,
		"signed": bool
	},
}



model_response_write = {
	"token": unicode,
	"message_type": [u'response',],
	"message_format": [u'write',],
	"acknowledge": {
		"upsert": list,
		"delete": list
	},
	"anomalies": list
}



model_error_anomaly = {
	"token": unicode,
	"message_type": [u'error',],
	"message_format": [u'anomaly',],
	"anomalies": list
}


model_error_error = {
	"token": unicode,
	"message_type": [u'error',],
	"message_format": [u'error',],
	"error_message": unicode,
	"error_code": unicode
}




model_request_api = {
	"token": unicode,
	"message_type": [u'request',],
	"message_format": [u'query',],
	"query" : {
		"BB": list,
		"time": unicode,
		"sign": unicode
	},
	"key": unicode,
}




model_response_manifest = {
	"message_type" : [u'response',],
	"message_format" : [u'manifest',],
	"approved": bool,
	"message": unicode
}

model_response_manifest_fail = {
	"message_type" : [u'response'],
	"message_format" : [u'manifest'],
	"approved": [False],
	"message": unicode
}

model_response_manifest_success = {
	"message_type" : [u'response',],
	"message_format" : [u'manifest',],
	"approved": [True,],
	"message": unicode
}

model_request_read = {
	"token": unicode,
	"message_type": [u'request',],
	"message_format": [u'read',],
	"time": unicode
}

process_error_anomaly = {
	(("anomalies",),((validateFieldIteratively,True,validateFieldAsAnomaly,None),)),
}

process_request_api = (
	((["query", "BB"],),((validateFieldAsBoundingBox,True, None, None),)),
	((["query", "time"],),((validateFieldAsIsoDateTime,True, None, None),)),
)

process_request_read = [
	(("time",),((validateFieldAsIsoDateTime, True, None, None),)),
]




process_request_query = (
	((["query", "BB"],),((validateFieldAsBoundingBox,True, None, None),)),
	((["query", "time"],),((validateFieldAsIsoDateTime,True, None, None),)),
)


#TODO: verify the specific subset of geojson objects that we need to use for this

#removed temporarily since now we don't have a list but a dict of lists
#	((["data", "upsert"],),((validateFieldIteratively,True, validateGeoJsonObject, None),)),
process_response_read = (
	(("time",),((validateFieldAsIsoDateTime, True, None, None),)),
)


process_response_capabilities = [
	(("area",),((validateFieldAsBoundingBox,True, None, None),)),
	(("time",),((validateFieldAsTimeSpan, True, None, None),)),
	(("base_url",), ((validateFieldAsActiveUrl, True, None, None),)),
	(("metadata"), ((validateFieldAsMetadataListing, True, None, None),))
]

#removed temporarily since now we don't have a list but a dict of lists
#	((["data", "upsert"],),((validateFieldIteratively,True, validateGeoJsonObject, None),)),
process_request_write = (
	((["data", "delete"],),((validateFieldAsListOf,True,(str, unicode),None),))
)


#NOTE: unlike response_read and request_write, we are always passing geo objects IDs in this one
process_response_write = (
	((["acknowledge", "upsert"],),((validateFieldAsListOf,True,(str, unicode),None),)),
	((["acknowledge", "delete"],),((validateFieldAsListOf,True,(str, unicode),None),)),
	(("anomalies",),((validateFieldAsListOf,True,(str, unicode),None),)),
)