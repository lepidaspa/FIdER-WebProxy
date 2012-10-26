/**
 * Created with PyCharm.
 * User: drake
 * Date: 10/25/12
 * Time: 3:24 PM
 * To change this template use File | Settings | File Templates.
 */



var proxies;


function pageInit(proxylist)
{

    proxies = proxylist;


    $("#tabsel_proxy").live('click', showSelProxy);
    $("#tabsel_standalone").live('click', showSelStandalone)


    showSelProxy();
}

function showSelProxy ()
{
    $("#tabsel_standalone").addClass("unseltab");
    $("#tabsel_proxy").removeClass("unseltab");
    $("#instances_proxy").show();
    $("#instances_standalone").hide();
}


function showSelStandalone ()
{
    $("#tabsel_standalone").removeClass("unseltab");
    $("#tabsel_proxy").addClass("unseltab");
    $("#instances_proxy").hide();
    $("#instances_standalone").show();
}