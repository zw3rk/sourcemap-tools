// VSCode Webview API types

interface VSCodeState {
    [key: string]: unknown;
}

interface VSCodeMessage {
    command?: string;
    type?: string;
    [key: string]: unknown;
}

interface VSCodeApi {
    postMessage: (message: VSCodeMessage) => void;
    getState: () => VSCodeState | undefined;
    setState: (state: VSCodeState) => void;
}

declare const acquireVsCodeApi: () => VSCodeApi;