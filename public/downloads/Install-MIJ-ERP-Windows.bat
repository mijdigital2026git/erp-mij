@echo off
title MIJ ERP Client Portal Setup
color 0A
echo =======================================================
echo          MIJ ERP DIGITAL CLIENT SOFTWARE SETUP         
echo =======================================================
echo.
echo Installing MIJ ERP Client Application to your Desktop...
echo.

set SCRIPT="%TEMP%\CreateShortcut.vbs"
echo Set oWS = WScript.CreateObject("WScript.Shell") > %SCRIPT%
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\MIJ ERP Client Portal.lnk" >> %SCRIPT%
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> %SCRIPT%
echo oLink.TargetPath = "msedge.exe" >> %SCRIPT%
echo oLink.Arguments = "--app=http://202.155.94.144:4321/login?code=CLIENT123 --window-size=1280,850" >> %SCRIPT%
echo oLink.Description = "MIJ ERP Digital Client Application" >> %SCRIPT%
echo oLink.Save >> %SCRIPT%
cscript //nologo %SCRIPT%
del %SCRIPT%

echo =======================================================
echo [SUCCESS] MIJ ERP Client Portal App Installed!
echo.
echo An icon named 'MIJ ERP Client Portal' has been created on your Desktop.
echo Double click the icon to launch the software standalone.
echo =======================================================
echo.
pause
