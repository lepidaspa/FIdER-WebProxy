/**
 * Created with PyCharm.
 * User: drake
 * Date: 10/13/12
 * Time: 6:35 PM
 * To change this template use File | Settings | File Templates.
 */


var objtypes = { 'LineString': 'tratte', 'Points': 'punti'};


var proxy_id;
var proxy_man;
var proxy_maps;


function pageInit (req_proxy_id, req_manifest, req_proxy_maps)
{

    proxy_id = req_proxy_id;
    proxy_man = req_manifest;
    proxy_maps = req_proxy_maps;

    console.log("Data for proxy "+proxy_id);
    console.log(proxy_maps);




}