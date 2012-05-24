from django.conf.urls.defaults import patterns, include, url

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
from FIdERWP import views

admin.autodiscover()


handler404 = 'FIdERWP.views.error404test'
handler500 = 'FIdERWP.views.error500test'

urlpatterns = patterns('',
    # Examples:
    # url(r'^$', 'ProxyWeb.views.home', name='home'),
    # url(r'^ProxyWeb/', include('ProxyWeb.foo.urls')),

    # Uncomment the admin/doc line below to enable admin documentation:
    url(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    url(r'^admin/', include(admin.site.urls)),


	url(r'^proxy/setup', views.softproxy_create_manifest),
	url(r'^proxy/create', views.softproxy_create_make),
	url(r'^proxy/conversion', views.softproxy_conversion_setup),
	url(r'^proxy/shapetable/(?P<proxy_id>\w*)/(?P<meta_id>\w*)/(?P<shape_id>\w*)', views.component_shapefile_table),
	url(r'^proxy/refresh/(?P<proxy_id>\w*)', views.hardproxy_refresh),
	url(r'proxy/debug', views.showfeatures),
	url(r'proxy/maketable/', views.proxy_create_conversion),
	url(r'proxy/upload/', views.proxy_uploadmap),


)

