#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (C) 2012 Laboratori Guglielmo Marconi S.p.A. <http://www.labs.it>
#
# This file is part of SANET
# SANET is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, version 3 of the License
#
# SANET is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with SANET. If not, see <http://www.gnu.org/licenses/>.


# CHANGELOG
#
# 1.01 Added fillSafely to make easier to fill a new dict in compliance with a Model instance
# 1.00 Basic structure and validation functions for Model and Process


__author__ = 'Antonio Vaccarino'
__docformat__ = 'restructuredtext en'


import types
import re
#very dirty hack so we can parse regular expressions as keysets
RE_TYPE = type(re.compile(""))

VALFIELD_KEYDESC = 0
VALFIELD_CHECKDESC = 1
VALFIELD_SEQBYKEY = 2
VALFIELD_SEQBYCHECK = 3

CHKFIELD_FUNCDESC = 0
CHKFIELD_EXPECT = 1
CHKFIELD_ARGS = 2
CHKFIELD_KWARGS = 3

def validateFieldIteratively (fielddata, validator):
	"""
	Validates the field as a list of objects considered appropriate by action
	:param fielddata:
	:param validator: specific function to be applied to all the objects in the iterable
	:return: bool
	"""

	if not isinstance (fielddata, (list, tuple)):
		return False

	for element in fielddata:
		if not validator(element):
			return False

	return True

def validateFieldAsListOf (fielddata, *reftype):
	"""
	Validates the field as a listing of istances of reftype
	:param fielddata:
	:param reftype:
	:return: bool
	"""

	if not isinstance (fielddata, (list, tuple)):
		return False

	if not any ([isinstance(element, reftype) for element in fielddata]):
		return False

	return True


# static since we want to access this from both the Model and Process validations
def digDictVals (keyseq, candidate):
	"""
		 Parses a hierarchical key descriptor, i.e. a list
		 :param keyseq: list of keys interpreted as the subsequent levels of the dictionary. Tuples inside this are exploded at their first level
		 :param candidate: the candidate dict from which we extract the values
		 :return: a tuple of values
		 """

	if not isinstance (keyseq, list):
		raise TypeError("Only lists allowed as key sequences")
	if not isinstance (candidate, dict):
		raise TypeError("Candidate must be a dictionary")

	#results = []
	paths = [candidate,]



	while len(keyseq) > 0:

		ckey = keyseq.pop(0)

		if isinstance (ckey, list):
			raise TypeError ("Nesting of lists is not allowed (lists are not allowed as dict keys")

		newpaths = []
		for cpath in paths:
			if isinstance (ckey, RE_TYPE):
				rekey = []

				try:
					for subkey in cpath.keys():
						#print subkey
						if ckey.match(subkey):
							rekey.append (subkey)
				except AttributeError:
					#no longer in a dictionary
					pass
				pkey = tuple(rekey)

			else:
				pkey = ckey

			if isinstance (pkey, tuple):
				# splitting branch
				for subkey in pkey:
					#print "Req %s from %s" % (subkey, cpath)
					newpaths.append(cpath[subkey])
			else:
				# single branch
				#print "Req %s from %s" % (ckey, cpath)
				newpaths.append(cpath[pkey])

		paths = newpaths


	return tuple(paths)

def digDictKeys (candidate):
	"""
	Gets all keys from all levels of a dictionary and returns them as a flat tuple
	:param candidate:
	:return:
	"""

	keylist = []
	paths = candidate.keys()
	while len(paths)>0:
		node = paths.pop(0)
		if isinstance(candidate[node], dict):
			newpaths = digDictKeys(candidate[node])
			keylist += newpaths
		keylist.append(node)

	return keylist


def getKeysWithPath (candidate, targets, breadcrumb=[]):
	"""
	Finds all the child keys of specific parent keys in a multi-level dictionary and return their full paths
	:param candidate:
	:param targets: list of accepted values; for now only SPECIFIC values, no types or regex and such
	:param breadcrumb: list of the keys from root to current
	:return: list of keysequences as [level1key, level2key, level3key]
	"""

	paths = []

	for ckey in candidate.keys():
		if ckey in targets:
			paths.append(breadcrumb+[ckey,])
		if isinstance(candidate[ckey], dict):
			paths.extend(getKeysWithPath(candidate[ckey], targets, breadcrumb+[ckey,]))
			#paths += geteysWithPath(candidate[ckey], targets, breadcrumb+ckey)

	return paths












def applyKeydesc (keydesc, candidate):
	"""
	parses a key descriptor and compares it to the structure of the candidate dictionary to return a tuple of the values to be used as candidates for a validation step. If keydesc is None, the whole candidate is returned.
	:param keydesc: the keydescriptor to be parsed.
	:param candidate: the candidate dictionary of the validator
	:return: tuple of values to be used for the actual check. When returning the whole dict, it is sole element in the returned tuple
	"""

	values = []

	# keydesc is a TUPLE. Inside it, every element is a separate descriptor.
	# tuples inside tuples are used as they are as keys, BUT tuples inside lists are exploded, so [c(a,b)] will result in [c][a],[c][b] while [c((a,b),)] will give [c][(a,b)] as key


	if not isinstance (keydesc, tuple):
		if keydesc is None:
			return tuple(candidate,)
		else:
			raise TypeError, ("Key/s descriptor must be either a tuple or None")

	#keyrep as "key representation" since it may be several keys, while the key descriptor is the collection of ALL key representation
	for keyrep in keydesc:
		#the boolean tells us if we are at the top level (the generator tuple itself) of the keydescriptor structure
		toplevel = True

		if isinstance(keyrep, list):
			values += digDictVals(keyrep, candidate)


		#TODO: avoid exception in case the dictionary ends BEFORE the hierarchy shown in our key list

		elif isinstance(keyrep, RE_TYPE):
			try:
				rekey = []
				for subkey in candidate.keys():
					if keyrep.match(subkey):
						rekey.append (subkey)
				# working on the parsed keys from the regexpkey
				for pkey in rekey:
					values.append(candidate[pkey])
			except AttributeError:
				#not in a dictionary anymore
				pass

		else:
			try:
				if candidate.has_key(keyrep):
					values.append(candidate[keyrep])
			except AttributeError:
				# not in a dictionary anymore
				pass

	return tuple(values)


class Validator:
	"""
	Arbitrary Dictionary Validator
	"""

	def __init__ (self, model_candidate=None, checklist_candidate=None):

		if model_candidate is None and checklist_candidate is None:
			raise ValueError ("At least one parameter must be not None")

		if (not isinstance(model_candidate, dict) or model_candidate is None) or (not isinstance(checklist_candidate, list) or checklist_candidate is None):
			raise TypeError ("Model must be dict or None, Checklist must be list or None")

		self.model = model_candidate
		self.process = checklist_candidate


	def getLog(self):
		log = []
		if self.model is not None:
			log += self.model.log
		if self.process is not None:
			log += self.process.log

		return log

class Model (dict):
	"""
	The Model class defines a dictionary template that can be used to perform a first step of validation with varying levels of strictness
	"""

	# dictionaries have exactly the SAME documented structure
	VAL_STRICT = 0
	# candidate has more keys but includes  all keys from the model
	VAL_SUPERSET = 1
	# candidate misses some keys but all the ones it has are compliant
	VAL_SUBSET = 2
	# candidate shares some keys with the model. Validates as long as the common keys match, other keys are ignored
	VAL_LOOSE = 3

	VAL_CODES = (VAL_STRICT, VAL_SUPERSET, VAL_SUBSET, VAL_LOOSE)

	def __init__ (self, generator, *args, **kwargs):
		print "ARGS for dict: "+str(generator)
		dict.__init__ (self, generator)
		if not kwargs.has_key("defaultrule"):
			defaultrule = None
		else:
			defaultrule = kwargs["defaultrule"]
		self.setDefaultRule(defaultrule)
		print "Creating new model with dict\n%s\nfrom\n%s " % (str(self), generator)

	def setDefaultRule (self, newdefault):
		if newdefault in self.VAL_CODES:
			self.default = newdefault
		else:
			self.default = self.VAL_STRICT


	def evaluateCompliance (self, candidate, descriptor, strictness, override=False):
		"""
		Determines if the candidate value conforms to a value/condition defined by the descriptor parameter
		:param candidate:
		:param descriptor:
		:param strictness:
		:param override:
		:return: boolean
		"""

		if isinstance (descriptor, Model):
			#validate as a DESCRIPTOR model validation (recurse)

			return descriptor.validateCandidate(candidate, strictness, override)

		elif isinstance (descriptor, dict):
			#recurse on validation for THIS template
			submodel = Model(descriptor, self.default)
			return submodel.validateCandidate(candidate, strictness, override)

		elif isinstance (descriptor, types.FunctionType):
			#evaluate if descriptor(candidate) is True
			return descriptor(candidate)

		elif isinstance (descriptor, RE_TYPE):
			#evaluate if candidate, converted to string, respects the regex
			return descriptor.match(unicode(candidate))

		elif isinstance (descriptor, type):
			#evaluate if the candidate is an object of said type or subclass
			return isinstance (candidate, descriptor)

		else:
			#evaluate if the candidate is EXACTLY the object described by descriptor
			return candidate == descriptor


	def validateCandidate (self, candidate, validateas = VAL_STRICT, override = False):
		"""
		Validates the candidate against the model. This is the function that performs the full validation, while evaluateCompliance only checks on a single value/condition
		:param candidate:
		:param validateas: defaults to the highest applicable level of check. If the model includes a regexp, the lowest value we can have is SUBSET. If the value provided is higher we issue a warning
		:return: True/False
		"""

		self.log = []

		try:
			if override is False:
				if self.default is not None:
					validateas = self.default
		except:
			# we use the validateas provided by the "user"
			pass

		#verify the validation level
		if validateas < self.VAL_SUBSET:
			allkeys = digDictKeys (self)
			#if any(map(isinstance, allkeys, RE_TYPE)):
			if any ([isinstance(key, RE_TYPE) for key in allkeys ]):
				print "WARNING: reducing strictness to SUBSET due to REGEXP keys in the model"
				validateas = self.VAL_SUBSET

		#STARTING ACTUAL VALIDATION on the keys

		testable = []

		keys_model = self.keys()
		keys_candidate = candidate.keys()

		if validateas == self.VAL_STRICT:
			#todo: implement STRICT validation
			keys_model.sort()
			keys_candidate.sort()

			if keys_candidate != keys_model:
				self.log.append("Model validation (strict) error: keys do not match")
				return False
			else:
				testable = keys_candidate

		elif validateas == self.VAL_SUPERSET:
			#todo: implement SUPERSET validation
			for ckey in keys_model:
				if ckey not in keys_candidate:
					self.log.append("Model validation (superset) error: key %s not in candidate" % ckey)
					return False
				else:
					testable.append(ckey)

		elif validateas == self.VAL_SUBSET:
			#todo: implement SUBSET validation
			for ckey in keys_candidate:
				if ckey not in keys_model:
					self.log.append("Model validation (subset) error: key %s not in model" % ckey)
					return False
				else:
					testable.append(ckey)

		elif validateas == self.VAL_LOOSE:
			for ckey in keys_candidate:
				if ckey in keys_model:
					testable.append(ckey)

			if len(testable) == 0:
				self.log.append("Model validation (loose) error: no common keys")

				return False


		# now we test the values of the "testable" keys
		# NOTE that if we find a template we use its default rule unless override is on, in which case we pass the override and the current intended (parameter) strictness

		for ckey in testable:
			passed = False
			if not (isinstance (self[ckey], list) or (isinstance (self[ckey], tuple))):
				passed = self.evaluateCompliance(candidate[ckey], self[ckey],validateas, override)

			else:
				for i in range (0, len(self[ckey])):
					if self.evaluateCompliance (candidate[ckey], self[ckey][i], validateas, override):
						passed = True

			if passed is False:
				self.log.append("Model validation error on key %s" % ckey)
				return False


		return True


	def getAdaptedValue (self, candidate, valuelist):
		"""
		Compares an arbitrary candidate to a list of valid values and tries to convert it to the types available before comparing it
		:param candidate:
		:param valuelist:
		:return: tuple, true/false and converted candidate/None
		"""
		validtypes = []
		for value in valuelist:
			if value.__class__ not in validtypes:
				validtypes.append(type(value))

		for ctype in validtypes:
			try:
				if ctype(candidate) in valuelist:
					return True, ctype(candidate)
			except:
				pass

		return False, None


	def getUnpacked (self):
		"""
		Unpacks the multiple key descriptors to return an expanded dictionary and a table . Will SKIP re.compile keys
		:return:
		"""

		#TODO: solve overlaps: we could have first (a,b) and then (b,a) as separate key descriptors

		RE_TYPE = type(re.compile(""))

		unpacked = {}
		for key in self.keys():
			if not isinstance(key, (tuple, RE_TYPE)):
				unpacked[key] = self[key]
			elif isinstance (key, tuple):
				for subkey in key:
					if not isinstance (key, RE_TYPE):
						unpacked[subkey] = self[key]

		return unpacked



	def fillSafely (self, kwargs):
		"""
		Fills a the Model dictionary with values for the specified keys. Note that this allows only for top-level insertions. There is no way to specify a multi-level key at the moment; a first-level key with a dict-type value will be filled with the content of the kwarg key if it also is a value. Also, keys that allow a single possible value are auto-filled.
		A partially compiled dict can be passed by putting it as **varname after all the named parameters
		:param kwargs: key/value pairs
		:return: tuple, True/False (new dictionary is compliant), content of generated dictionary
		"""

		generated = dict()
		unpacked = self.getUnpacked()
		modelkeys = unpacked.keys()

		for key in modelkeys:
			# fill with proposed value if possible
			if kwargs.has_key (key):
				#if not compliant we do NOT add it to the generated dict, all common key values must ALWAYS be compliant
				if isinstance(kwargs[key], dict) and (isinstance(unpacked[key], dict) or unpacked[key] == dict):
					#ugly hack to make dictionaries work
					generated[key] = kwargs[key]

				#TODO: verify functionality
				elif self.evaluateCompliance (kwargs[key], unpacked[key], self.default):
					generated[key] = kwargs[key]
				else:
					#try to see if it's a "solvable" type issue
					if isinstance(self[key], (tuple, list)):
						adaptable, adapted = self.getAdaptedValue (kwargs[key], self[key])
						if adaptable is True:
							generated[key] = adapted
			#autofill if there's only one alternative, but NOT if there was a proposed value; the caller should be aware the proposed value was wrong
			elif isinstance(self[key], (tuple,list)) and len(self[key]) == 1:
				generated[key] = self[key][0]
			#else NOTHING, we do not add the key at all and will sort it out during self-validation. If the Model is validated as subset this will not be a problem

		for key in kwargs.keys():
			#will see later in self-validation if additional key/value pairs are allowed, would be ok for a superset
			if key not in modelkeys:
				generated[key] = kwargs[key]

		#TODO: val_loose (and the override to subtemplates) is a temporary fix for multilevel dicts that are described in their lower levels in the original template, should work also in val_strict
		return self.validateCandidate(generated, self.VAL_LOOSE, True), generated


class Check:
	"""
	A single check in the list of checks for a validation step
	Has a function descriptor (name of the function to be called), an expected value, and an arbitrary list of arguments that will be passed to the function AS IS.
	"""


	def __init__ (self, funcdesc, expected, args=(), kwargs=None):

		self.function = funcdesc
		self.expected = expected

		self.args = args
		if kwargs is None:
			kwargs = {}
		self.kwargs = kwargs

	def performCheck (self, candidate):
		"""
		Performs the check on the candidate value
		:param candidate:
		:return:
		"""

		return self.function(candidate, *self.args, **self.kwargs) == self.expected


class Validation:
	"""
	A validation unit: defines a number of tests on a key range. The tests are applied by check to all keys, results being combined by all/any. In theory any and all can be replaced with "any" function, but this may give unexpected results when received back by the Process and Validator objects
	"""


	def __init__ (self, keydesc, checkseq=None, seqbycheck=all, seqbykey=all, message=None):
		self.keydesc = keydesc
		self.checks = []
		self.seqbycheck = seqbycheck
		self.seqbykey = self.seqbykey

		if message is None:
			message = ("Validation error in key descriptor %s" % keydesc)
		else:
			self.message = message

		if checkseq is not None:
			for ccheck in checkseq:
				self.appendCheck(*ccheck)

	def appendCheck (self, funcdesc, expected, args=(), kwargs=None):
		"""
		Adds a check to the chosen Validation
		:param funcdesc: name of the function that is launched with first argument dict[keydesc]
		:param expected: the value that is expected to be returned from the function, will be tested with the == equality operator
		:param args: arguments for the function, expressed positionally, as list/tuple
		:param kwargs: arguments for the function, named, as dictionary
		:return:
		"""

		if kwargs is None:
			kwargs = {}

		self.checks.append(Check(funcdesc, expected, args, kwargs))


	def applyTo (self, candidate, logto=None):
		"""
		Applies a validation to the candidate dict after getting the values list according to the keydesc
		:param candidate: the candidate dictionary from which we extract the values for validation
		:param logto: log listing to which the eventual error message is appended
		:return: boolean True/False
		"""

		values = applyKeydesc(self.keydesc, candidate)
		resultsbykey = []
		for testable in values:
			resultsbycheck = []
			for test in self.checks:
				resultsbycheck.append (test.performCheck(testable))
			resultsbykey.append (self.seqbycheck(resultsbycheck))

		output = self.seqbykey(resultsbykey)
		if output is False:
			if logto is not None:
				logto.append(self.message)
		return output



class Process:
	"""
	The Process class defines a sequence of validations applied to a dict (previously validated by model comparison) to ensure that it conforms to the requirements of the Validator class. NOTE: the class is not thought for on-the-fly alterations of the validations sequence, but rather for parsing of a preset list (that effectively acts as a script).
	"""

	def __init__ (self, validations=None):
		self.validations = []
		self.log = []
		if validations is not None:
			self.importProcessScript(validations)

	def importProcessScript(self, validations_list):
		"""
		Parses a user defined validations list/tuple into the checks/validations structure of the Process and adds to the current validations listing (i.e. you can add several scripts in a row)
		:param validations_list:
		:return:
		"""
		for step in validations_list:
			self.appendValidation (*step)

	def appendValidation (self, keydesc, checkseq=None, seqbycheck=all, seqbykey=all, message=None):
		"""
		Adds a single validation step at the end of the Process.
		:param keydesc: list of keys
		:param checkseq: a list of checks to be performed on the selected keydesc. Can be None (used for "soft" init in complex script parsing), in that case the validation step will be skipped as True automatically
		:param seqbycheck: the any/all clause applied when combining the results of different functions on the same key
		:param seqbykey: the any/all clause applied when combining the results of a check on different keys
		:param message: the error message to be added to the log if the validation meets an error
		:return:
		"""

		if message is None:
			message = "Validation error on descriptor %s", keydesc

		self.validations.append(Validation(keydesc, checkseq, seqbycheck, seqbykey, message))


	def performValidations (self, candidate):
		"""
		Walks the full list of validations starting with the first and stopping at the first false result. Ignores any key descriptor that can be applied (implicitly taken as successful) Returns False for fail or True for success.
		:param candidate: the candidate dictionary we want to validate
		:return: boolean
		"""
		self.log = []
		for testunit in self.validations:
			if testunit.applyTo(candidate, self.log) is False:
				return False
		return True

	def performValidationsAll (self, candidate):
		"""
		Walks the full list of validations from first to last even if one or more validations fail.
		:param candidate: the candidate dictionary we want to validate
		:return: List of True,False, None for every validation in the Validations list. True for success, False for failure, None if the keydescriptor cannot be applied.
	   """

		self.log = []
		results = []
		for testunit in self.validations:
			results.append(testunit.applyTo(candidate, self.log))
		return results

