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

	# urls for "passive" operations, called by the main server
	url(r'^data/(?P<proxy_id>\w*)/', wpviews.proxy_read_full),

	#urls for self-ops, called by the proxy
	url(r'^fwp/maketable/', fwpviews.proxy_create_conversion),
	url(r'^fwp/maps/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)', fwpviews.proxy_loadmap),
	url(r'^fwp/conversion/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)', fwpviews.component_shapefile_table),
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
	url(r'^fwp/registerquery/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/$', fwpviews.registerquery),

	#urls for active operations, called by the clients
	url(r'^fwp/$', fwpviews.proxysel),
	url(r'^fwp/proxy/(?P<proxy_id>\w*)/$', fwpviews.proxypage),
	url(r'^fwp/proxy/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/$', fwpviews.metapage),
)



if settings.DEBUG:
	urlpatterns += patterns('',
		url(r'^static/(?P<path>.*)$', 'django.views.static.serve', {
			'document_root': settings.MEDIA_ROOT,
			}),
	)