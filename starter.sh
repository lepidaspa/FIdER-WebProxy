#/usr/bin/python2.7 manage.py runserver 0.0.0.0:8000
/usr/bin/gunicorn_django -c /home/ubuntu/FIdER-WebProxy/conf_guni.py /home/ubuntu/FIdER-WebProxy/settings.py
