from django.conf.urls.defaults import patterns, include, url
from django.views.generic.simple import redirect_to

# Uncomment the next two lines to enable the admin:
from django.contrib import admin

from FIdERWeb import views as fwpviews


from FIdERWebST import views as fwstviews
from FIdERProxyFS import proxy_config_core

import settings

admin.autodiscover()

handler404 = 'fwpviews.error404test'
handler500 = 'fwpviews.error500test'

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'ProxyWeb.views.home', name='home'),
    # url(r'^ProxyWeb/', include('ProxyWeb.foo.urls')),

    # Uncomment the admin/doc line below to enable admin documentation:
    #url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    #url(r'^admin/', include(admin.site.urls)),

	# urls for "passive" operations, called by the main server
	url(r'^data/(?P<proxy_id>\w*)/', fwpviews.proxy_read_full),
	url(r'^query/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/', fwpviews.proxy_perform_query),
	url(r'^refreshmap/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)/', fwpviews.map_refresh_remote),
	url(r'^refreshremote/(?P<proxy_id>\w*)/', fwpviews.proxy_refresh_remote),



	#urls for self-ops, called by the proxy

	# Field VALUE translation
	url(r'^fwp/valueconv/$', fwpviews.proxy_getModels),
	# Field NAME translation
	url(r'^fwp/maketable/', fwpviews.proxy_create_conversion),
	url(r'^fwp/maps/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)', fwpviews.proxy_loadmap),
	#OLDurl(r'^fwp/conversion/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)', fwpviews.component_shapefile_table),
	(r'^fwp/conversion/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)', fwpviews.getConversionInfo),
	url(r'^fwp/upload/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)/', fwpviews.proxy_uploadmap),
	url(r'^fwp/upload/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/$', fwpviews.proxy_uploadmap),
	url(r'^fwp/download/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)/', fwpviews.proxy_uploadwfs),
	url(r'^fwp/download/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/$', fwpviews.proxy_uploadwfs),
	url(r'^fwp/rebuild/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)/', fwpviews.proxy_rebuildmap),
	url(r'^fwp/rebuild/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/', fwpviews.proxy_rebuildmeta),
	url(r'^fwp/control/', fwpviews.proxy_controller),
	url(r'^fwp/proxylist/', fwpviews.proxy_get_all),
	url(r'^fwp/create/', fwpviews.proxy_create_new),
	url(r'^fwp/newqueryconn/', fwpviews.probePostGIS),
	url(r'^fwp/reviewqueryconn/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<map_id>\w*)/$', fwpviews.reviewPostGIS),
	url(r'^fwp/registerquery/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/$', fwpviews.registerquery),
	url(r'^fwp/maplist/(?P<proxy_id>\w*)/$', fwpviews.proxy_maps_list),

	#urls for active operations, called by the clients
	url(r'^fwp/proxy/(?P<proxy_id>\w*)/$', fwpviews.proxypage),
	url(r'^fwp/get/(?P<proxy_id>\w*)/(?P<meta_id>\.?\w*)/(?P<map_id>\w*)/$', fwpviews.proxy_getSingleMap),
	url(r'^fwp/proxy/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/$', fwpviews.metapage),
	url(r'^fwp/$', fwpviews.proxysel),





	# standalone tool v2



	url(r'^fwst/upload/(?P<proxy_id>\w*)/$', fwstviews.uploadfile),
	url(r'^fwst/maps/(?P<proxy_id>\w*)/(?P<map_id>\w*)/$', fwstviews.loadSTMap),
	url(r'^fwst/save/(?P<proxy_id>\w*)/(?P<map_id>\w*)/$', fwstviews.saveSTMap),

	url(r'^fwp/stimport', fwpviews.sideloadSTMap),

	url(r'^fwst/(?P<proxy_id>\w*)/$', fwstviews.uiview),
	# same as before but with a preloaded map from the proxy federated selection
	url(r'^fwst/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)/$', fwstviews.uiview),
	url(r'^external/(?P<path>.*)/$', fwpviews.geosearch),

	url(r'^fwp/fed/owners/$', fwpviews.getProviders),
	url(r'^fwp/fed/settings/$', redirect_to, {'url': proxy_config_core.URL_CONFIG}),
	url(r'', redirect_to, {'url': "/fwp/"})




)



if settings.DEBUG:
	urlpatterns += patterns('',
		url(r'^static/(?P<path>.*)$', 'django.views.static.serve', {
			'document_root': settings.MEDIA_ROOT,
			}),
	)