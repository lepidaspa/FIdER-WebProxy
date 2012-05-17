#!/usr/bin/env python
# -*- coding: utf-8 -*-
import sys
sys.path.append("..")


from FIdERFLL.MessageValidator import validateDictToTemplate
from FIdERFLL.validate_fields import validateFieldAsBoundingBox

__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'

def validateFieldAsAnomaly (fielddata):


	process_field_anomaly = (
	(("BB",),((validateFieldAsBoundingBox,True, None, None),)),
		)


	model_field_anomaly = {
		"id": unicode,
		"anomaly": unicode,
		"BB": list
	}



	return validateDictToTemplate(fielddata, model_field_anomaly, process_field_anomaly, withlog=False)