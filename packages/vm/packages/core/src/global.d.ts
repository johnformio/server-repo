declare module 'formiojs/formio.form.js';
declare module '@formio/premium/dist/premium-server.min.js';
declare module 'nunjucks-date-filter';

declare module globalThis {
    // Define a few global noop placeholder shims and import the component classes
    var navigator: { userAgent: '' };
    var Text: {};
    var HTMLElement: {};
    var HTMLCanvasElement: {};
    var document: {
        createElement: () => {};
        cookie: string;
        getElementsByTagName: () => [];
        documentElement: {
            style: [];
            firstElementChild: { appendChild: () => {} };
        };
    };
    var window: {
        addEventListener: () => {};
        Event: () => void;
        navigator: { userAgent: '' };
    };
    function btoa(str: string | Buffer): string;
    var self: typeof globalThis;
    var Formio: any;
}
