from django.conf.urls.defaults import patterns, include, url

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
from FIdERWP import views as wpviews
from FIdERWeb import views as fwpviews
import settings

admin.autodiscover()

handler404 = 'wpviews.error404test'
handler500 = 'wpviews.error500test'

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'ProxyWeb.views.home', name='home'),
    # url(r'^ProxyWeb/', include('ProxyWeb.foo.urls')),

    # Uncomment the admin/doc line below to enable admin documentation:
    url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    url(r'^admin/', include(admin.site.urls)),

	# urls for active operations, proxy-side
	url(r'^proxy/setup', wpviews.softproxy_create_manifest),
	url(r'^proxy/create', wpviews.softproxy_create_make),
	url(r'^proxy/conversion', wpviews.softproxy_conversion_setup),
	url(r'^proxy/shapetable/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)', wpviews.component_shapefile_table),
	url(r'^proxy/refresh/(?P<proxy_id>\w*)', wpviews.hardproxy_refresh),
	url(r'^proxy/debug', wpviews.showfeatures),
	url(r'^proxy/maketable/', wpviews.proxy_create_conversion),
	url(r'^proxy/upload/', wpviews.proxy_uploadmap),
	url(r'^proxy/vis/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)', wpviews.proxy_visual),
	url(r'^proxy/maps/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)', wpviews.proxy_loadmap),
	url(r'^proxy/vis/', wpviews.proxy_visual),

	# urls for "passive" operations, called by the main server
	url(r'^data/(?P<proxy_id>\w*)/', wpviews.proxy_read_full),

	url(r'^proxy/$', wpviews.proxy_features),



	url(r'^fwp/$', fwpviews.proxysel),
	url(r'^fwp/proxy/(?P<proxy_id>\w*)/$', fwpviews.proxypage),
	url(r'^fwp/proxy/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/$', fwpviews.metapage),
	url(r'^fwp/maps/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)', fwpviews.proxy_loadmap),
	url(r'^fwp/conversion/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)', fwpviews.component_shapefile_table),


)



if settings.DEBUG:
	urlpatterns += patterns('',
		url(r'^static/(?P<path>.*)$', 'django.views.static.serve', {
			'document_root': settings.MEDIA_ROOT,
			}),
	)