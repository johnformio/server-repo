declare const globalThis: any;
export default function mockBrowserContext() {
    if (!globalThis) return;
    if (!globalThis.Text) globalThis.Text = class {};
    if (!globalThis.HTMLElement) globalThis.HTMLElement = class {};
    if (!globalThis.HTMLCanvasElement) globalThis.HTMLCanvasElement = class {};
    if (!globalThis.HTMLInputElement) globalThis.HTMLInputElement = class {};
    if (!globalThis.HTMLTextAreaElement)
        globalThis.HTMLTextAreaElement = class {};
    if (!globalThis.navigator) globalThis.navigator = { userAgent: '' };
    if (!globalThis.document) globalThis.document = {};
    if (!globalThis.document.createElement)
        globalThis.document.createElement = () => ({
            style: {},
            appendChild: () => {},
            setAttribute: () => {},
            getContext: () => ({}),
        });
    if (!globalThis.document.cookie) globalThis.document.cookie = '';
    if (!globalThis.document.getElementsByTagName)
        globalThis.document.getElementsByTagName = () => [];
    if (!globalThis.document.documentElement)
        globalThis.document.documentElement = {};
    if (!globalThis.document.documentElement.style)
        globalThis.document.documentElement.style = [];
    if (!globalThis.document.documentElement.firstElementChild)
        globalThis.document.documentElement.firstElementChild = {};
    if (!globalThis.document.documentElement.firstElementChild.appendChild)
        globalThis.document.documentElement.firstElementChild.appendChild =
            () => {};
    if (!globalThis.window) globalThis.window = {};
    if (!globalThis.window.addEventListener)
        globalThis.window.addEventListener = () => {};
    if (!globalThis.window.Event) globalThis.window.Event = function () {};
    if (!globalThis.window.navigator)
        globalThis.window.navigator = globalThis.navigator;
    if (!globalThis.window.document)
        globalThis.window.document = globalThis.document;
    if (!globalThis.btoa)
        globalThis.btoa = (str: any) => {
            return str instanceof Buffer
                ? str.toString('base64')
                : Buffer.from(str.toString(), 'binary').toString('base64');
        };
    if (!globalThis.self) globalThis.self = global;
}
