from django.conf.urls.defaults import patterns, include, url

# Uncomment the next two lines to enable the admin:
from django.contrib import admin

from FIdERWeb import views as fwpviews
from FiderMapEdit import views as editviews
from FIdERStandalone import views as stviews

from FIdERWebST import views as fwstviews

import settings

admin.autodiscover()

handler404 = 'fwpviews.error404test'
handler500 = 'fwpviews.error500test'

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'ProxyWeb.views.home', name='home'),
    # url(r'^ProxyWeb/', include('ProxyWeb.foo.urls')),

    # Uncomment the admin/doc line below to enable admin documentation:
    url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    url(r'^admin/', include(admin.site.urls)),

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
	url(r'^fwp/reviewqueryconn/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<map_id>\w*)/$$', fwpviews.reviewPostGIS),
	url(r'^fwp/registerquery/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/$', fwpviews.registerquery),
	url(r'^edit/mapslist/', editviews.getMapsList),

	#urls for active operations, called by the clients
	url(r'^fwp/proxy/(?P<proxy_id>\w*)/$', fwpviews.proxypage),
	url(r'^fwp/proxy/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/$', fwpviews.metapage),
	url(r'^edit/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)/$', editviews.mapeditor),
	url(r'^fwp/$', fwpviews.proxysel),
	url(r'^edit/update/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)/$', editviews.implementchanges),







	# standalone tool section
	#TODO: remove, deprecated
	url(r'^st/(?P<proxy_id>\w*)/$', stviews.uiview),
	url(r'^st/(?P<proxy_id>\w*)/(?P<map_id>\w*)/$', stviews.loadSTMap),
	url(r'^stsave/(?P<proxy_id>\w*)/$', stviews.saveMap),

	# standalone tool v2



	url(r'^fwst/upload/(?P<proxy_id>\w*)/$', fwstviews.uploadfile),
	url(r'^fwst/maps/(?P<proxy_id>\w*)/(?P<map_id>\w*)/$', fwstviews.loadSTMap),
	url(r'^fwst/save/(?P<proxy_id>\w*)/(?P<map_id>\w*)/$', fwstviews.saveSTMap),

	url(r'^fwp/stimport', fwpviews.sideloadSTMap),

	url(r'^fwst/(?P<proxy_id>\w*)/$', fwstviews.uiview),
	# same as before but with a preloaded map from the proxy federated selection
	url(r'^fwst/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)/$', fwstviews.uiview),
	url(r'^external/(?P<path>.*)$', fwpviews.geosearch)



)



if settings.DEBUG:
	urlpatterns += patterns('',
		url(r'^static/(?P<path>.*)$', 'django.views.static.serve', {
			'document_root': settings.MEDIA_ROOT,
			}),
	)