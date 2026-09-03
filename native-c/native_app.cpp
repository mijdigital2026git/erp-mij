#include "webview.h"
#include <windows.h>

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    webview::webview w(false, nullptr);
    w.set_title("MIJ ERP Digital Client Portal");
    w.set_size(1280, 850, WEBVIEW_HINT_NONE);
    w.navigate("http://202.155.94.144:4321/login?code=Abmalaya");
    w.run();
    return 0;
}
