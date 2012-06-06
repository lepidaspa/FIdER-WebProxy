/**
 * Created with PyCharm.
 * User: drake
 * Date: 5/31/12
 * Time: 11:04 AM
 * To change this template use File | Settings | File Templates.
 */


function changeSection(destination)
{
   //alert ($("#"+launcherid).closest("div").attr("id"));

    document.location.href=destination;
}

function highlightSection ()
{
    switch(document.location.href.split("/")[4])
    {

        case "setup":
        case "create":
            $("#launcher_proxycreate").addClass ("launched");
            break;

        case "refresh":
            $("#launcher_proxyrefresh").addClass ("launched");
            break;

        case "conversion":
        case "maketable":
            $("#launcher_proxyconvert").addClass ("launched");
            break;

        case "upload":
            $("#launcher_proxyupload").addClass ("launched");

            break;

        case "vis":
            $("#launcher_proxyview").addClass ("launched");

    }
}