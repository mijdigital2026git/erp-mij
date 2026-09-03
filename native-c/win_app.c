#include <windows.h>
#include <shellapi.h>

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    // Native Win32 Shell API Launcher - Launches standalone isolated native process window
    // Load remote ERP Client Portal URL inside native Win32 window process
    LPCSTR url = "http://202.155.94.144:4321/login?code=Abmalaya";
    
    // Execute ShellExecute native API call to open dedicated standalone Window
    ShellExecuteA(NULL, "open", "msedge.exe", "--app=http://202.155.94.144:4321/login?code=Abmalaya --window-size=1280,850", NULL, SW_SHOWNORMAL);
    return 0;
}
