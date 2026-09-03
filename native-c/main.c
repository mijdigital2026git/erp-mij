#define UNICODE
#define _UNICODE
#include <windows.h>
#include <wrl.h>
#include <wil/com.h>
#include <WebView2.h>

using namespace Microsoft::WRL;

// Global variables
HINSTANCE hInst;
HWND hWndMain;
ICoreWebView2* webviewWindow = NULL;
ICoreWebView2Controller* controllerWindow = NULL;

const wchar_t CLASS_NAME[]  = L"MIJ_ERP_Native_Class";
const wchar_t WINDOW_TITLE[] = L"MIJ ERP Digital Client Portal";

LRESULT CALLBACK WindowProc(HWND hwnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
    case WM_SIZE:
        if (controllerWindow != NULL) {
            RECT bounds;
            GetClientRect(hwnd, &bounds);
            controllerWindow->put_Bounds(bounds);
        }
        break;
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProc(hwnd, uMsg, wParam, lParam);
}

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, PWSTR pCmdLine, int nCmdShow) {
    hInst = hInstance;

    WNDCLASS wc = { };
    wc.lpfnWndProc   = WindowProc;
    wc.hInstance     = hInstance;
    wc.lpszClassName = CLASS_NAME;
    wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
    wc.hCursor       = LoadCursor(NULL, IDC_ARROW);

    RegisterClass(&wc);

    hWndMain = CreateWindowEx(
        0,
        CLASS_NAME,
        WINDOW_TITLE,
        WS_OVERLAPPEDWINDOW,
        CW_USEDEFAULT, CW_USEDEFAULT, 1280, 850,
        NULL,
        NULL,
        hInstance,
        NULL
    );

    if (hWndMain == NULL) {
        return 0;
    }

    ShowWindow(hWndMain, nCmdShow);
    UpdateWindow(hWndMain);

    // Initialize WebView2 Native Runtime (Host remote URL http://202.155.94.144:4321/login?code=Abmalaya)
    CreateCoreWebView2EnvironmentWithOptions(subProcessPath, NULL, NULL,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [hWndMain](HRESULT result, ICoreWebView2Environment* env) -> HRESULT {
                env->CreateCoreWebView2Controller(hWndMain,
                    Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [hWndMain](HRESULT result, ICoreWebView2Controller* controller) -> HRESULT {
                            if (controller != NULL) {
                                controllerWindow = controller;
                                controllerWindow->get_CoreWebView2(&webviewWindow);
                            }

                            RECT bounds;
                            GetClientRect(hWndMain, &bounds);
                            controllerWindow->put_Bounds(bounds);

                            // Load ERP Client Portal Remote Endpoint inside Native C Window
                            webviewWindow->Navigate(L"http://202.155.94.144:4321/login?code=Abmalaya");

                            return S_OK;
                        }).Get());
                return S_OK;
            }).Get());

    MSG msg = { };
    while (GetMessage(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessage(&msg);
    }

    return 0;
}
