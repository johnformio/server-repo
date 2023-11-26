try {
    globalThis.navigator = { userAgent: '' };
} catch (e) {
    Object.defineProperty(globalThis, 'navigator', { userAgent: '' } as any);
}
globalThis.Text = class {};
globalThis.HTMLElement = class {};
globalThis.HTMLCanvasElement = class {};
globalThis.document = {
    createElement: () => ({}),
    cookie: '',
    getElementsByTagName: () => [],
    documentElement: {
        style: [],
        firstElementChild: { appendChild: () => ({}) },
    },
};
globalThis.window = {
    addEventListener: () => ({}),
    Event: function () {},
    navigator: globalThis.navigator,
};
globalThis.btoa = (str: string | Buffer) => {
    return str instanceof Buffer
        ? str.toString('base64')
        : Buffer.from(str.toString(), 'binary').toString('base64');
};
globalThis.self = globalThis;
