/**
 * Created with PyCharm.
 * User: drake
 * Date: 5/21/12
 * Time: 2:14 PM
 * To change this template use File | Settings | File Templates.
 */


function pageInit()
{
    showProxyInfo();
    $("#sel_proxy").change(showProxyInfo);
    $("#button_rebuild_proxy").click(rebuildProxy);
}


function showProxyInfo()
{

    var proxy_id = $("#sel_proxy").val();
    $(".info_proxy").hide();


    if (proxy_id != "")
    {
        $("#proxy_"+proxy_id).show();
        $("#button_rebuild_proxy").show()
    }
    else
    {
        $("#button_rebuild_proxy").hide();
    }

}

function rebuildProxy()
{
    window.location.replace("/proxy/refresh/"+$("#sel_proxy").val());
}

function autoselect(proxy_id)
{
    var chosen = $("#sel_proxy").val();

    //$('#sel_proxy [selected="selected"]').removeAttr("selected");
    $('#sel_proxy').val(proxy_id);
    showProxyInfo();

}