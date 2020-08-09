// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as nodeq from 'node-q';
import * as path from 'path';

import { KdbExplorerProvider } from './explorer';
import { KdbServerProvider } from './servers';
import * as moment from '../libs/momentjs/moment';

let currentConnection : Connection | undefined = undefined;
let connectionStatus: vscode.StatusBarItem;

// Track our current panels.
let gridPanel: vscode.WebviewPanel | undefined = undefined;
let consolePanel: vscode.OutputChannel | undefined = undefined;
let resultPanel: vscode.TextEditor | undefined = undefined;

// Store kdb+ globals here.
let globals: any;

// Store functions, variables and tables separately.
// This will make auto completion faster and easier.
let functions: string[] = [];
let variables: string[] = [];
let tables: string[] = [];
let keywords: string[] = [];

// Server view.
let serverProvider: KdbServerProvider;

// Namespace explorer view.
let explorerProvider: KdbExplorerProvider;

// The last clicked explorer item.
let lastExplorerItem: { query:string, time:number };

// The last query result.
// TODO: Support query result history.
let lastResult: QueryResult | undefined = undefined;

const constants = {
    names: ['','boolean','guid','','byte','short','int','long','real','float','char','symbol','timestamp','month','date','datetime','timespan','minute','second','time','symbol'],
    types: ['','b','g','','','h','i','j','e','f','c','s','p','m','d','z','n','u','v','t','s'],
    listSeparator:  [';','',' ','','',' ',' ',' ',' ',' ','','',' ',' ',' ',' ',' ',' ',' ',' '],
    listPrefix: ['(','','','','0x','','','','','','','','','','','','','','',''],
    listSuffix: [')','b','','','','h','i','','e','f','','','','m','','','','','',''],
    
    base: new Date(2000, 0) as any,
    days: 1000 * 60 * 60 * 24,
    hours: 1000 * 60 * 60,
    minutes: 1000 * 60,
    seconds: 1000,
};

export type MetaResult = {
    c: string;
    t: string;
    a: string;
    f: string;
};

export type QueryResult = {
    result: boolean,
    type: number,
    keys: string[],
    meta: MetaResult[],
    data: any,
};

export class Connection {
    options: nodeq.ConnectionParameters;
    connection?: nodeq.Connection;
    connected: boolean;
    
    constructor(connectingString: string) {
		// kdb+ connection strings are split by colons.
		const params = connectingString.split(":");

		if (!params) {
			throw new Error("Failed to parse input");
		}

		// Default connection options.
		let options : nodeq.ConnectionParameters = {
			nanos2date: false,
			socketNoDelay: true,
		};

		// Parse parameters.
		if (params.length > 0) { options.host = params[0]; }
		if (params.length > 1) { options.port = +params[1]; }
		if (params.length > 2) { options.user = params[2]; }
		if (params.length > 3) { options.password = params[3]; }

		// Assign to member variable.
        this.options = options;
        this.connected = false;
    }
    
    public disconnect() {
        if (this.connected) {
            this.connection?.close();
            this.connected = false;
        }
    }
	
	public connect(callback: nodeq.AsyncValueCallback<Connection>) {
		let options = this.options;

		// Connect to kdb+ server.
		nodeq.connect(options, (err, conn) => {
			if (err || !conn) {
                vscode.window.showErrorMessage(`Failed to connect to ${options.host}:${options.port}! [${err?.message}]`);
                return;
			}

			// Setup up connection close listener, update status bar if closed.
			conn.addListener("close", (hadError: boolean) => {
				// Let the user know that the remote connection was closed.
				vscode.window.showErrorMessage(`Disconnected from ${options.host}:${options.port}!`);

                this.connected = false;
				updateConnectionStatus(`${this.options.host}:${this.options.port}`, ConnectionStatus.Disconnected);
			});

			// Close existing connection, since we established a new one successfully.
			if (this.connection && this.connected) {
				this.connection.close(() => {
                    this.onConnect(err, conn, callback);
				});
			}
			else {
                this.onConnect(err, conn, callback);
            }
		});
    }

    private onConnect(err: Error | undefined, conn: nodeq.Connection, callback: nodeq.AsyncValueCallback<Connection>) {
        // Show the user that the connected was established.
        vscode.window.showInformationMessage(`Connected to server ${this.options.host}:${this.options.port}!`);
            
        // No error, so we're connected.
        this.connected = true;
        this.connection = conn;

        this.updateGlobals();
        this.updateReservedKeywords();

        // Update global connection.
        currentConnection = this;

        updateConnectionStatus(`${this.options.host}:${this.options.port}`, ConnectionStatus.Connected);

        callback(err, this);
    }
    
    public executeQuery(context: vscode.ExtensionContext, query: string) {
        if (!this.connection || !this.connected || query.trim().length === 0) {
            return;
        }
    
        const maxCols = 2000;
        const maxRows = 2000;

        let maxNestedCols: number | undefined = vscode.workspace.getConfiguration().get("vscode-kdb-q.nestedObjectMaximumCharacterCount");
        maxNestedCols = Math.max(0, Math.min(maxNestedCols!, 2000));

        // Wrap the query result, make sure the query is executed in global scope.
        let trap = '.Q.trp[{ x:value x; s:{ $[type[x] in 0 98 99h; .Q.s1 x; x] }; x:$[not 99h = type x; x; &[98h = type key x; 98h = type value x]; [kc:cols key x; 0!x]; x]; t:type x; c:system "c"; system "c ' + maxRows + ' ", string $[t = 98h; ' + maxNestedCols + '; ' + maxCols + ']; r:`result`type`keys`meta`data!(1b; t; kc; $[t = 98h; 0!meta x; ()]; $[t = 98h; s each/: x; t in 0 99h; .Q.s x; x]); system "c ", .Q.s1 c; :r }; ; { \'(x, "\n\n", .Q.sbt y) }]';
    
        // // TODO: Make these configurable through settings.
        // // A server explorer showing all servers available in gateway is also nice.
        // var gatewayMode = false;
        // var serverType = "hdb";
    
        // if (gatewayMode) {
        //     // Wrap the result in a gateway call, make sure to escape double quotes.
        //     wrapped = '.gw.syncexec["' + wrapped.replace(/"/g, '\\"') + '"; `' + serverType +']';
        // }
    
        // Flush query through connection and print result.
        this.connection.k(trap, query, (err, result: QueryResult) => {
            updateConnectionStatus(`${this.options.host}:${this.options.port}`, ConnectionStatus.Connected);

            if (err) {
                result = { result: false, type: 11, keys: [], meta: [], data: err.message };
            }
    
            // If the result typw was 101, it means the query returned identity (::).
            if (result.type === 101) {
                result.data = "::" ;
            }
    
            // Stringify result, since we'LL be outputting this somewhere anyway.
            result.data = stringifyResult(result);
    
            // Store into global last result.
            lastResult = result;
    
            const config = vscode.workspace.getConfiguration();
            if (config.get("vscode-kdb-q.consoleViewEnabled")) {
                showConsoleView(context, query, result);
            }
    
            if (config.get("vscode-kdb-q.documentViewEnabled")) {
                showDocumentView(context, query, result);
            }
    
            if (config.get("vscode-kdb-q.gridViewEnabled")) {
                showGridView(context, result);
            }
        });

        updateConnectionStatus(`${this.options.host}:${this.options.port}`, ConnectionStatus.Querying);
    }

    public updateGlobals() {
        // Update globals upon successful connection.
        let globalQuery = "{[q] t:system\"T\";tm:@[{$[x>0;[system\"T \",string x;1b];0b]};0;{0b}];r:$[tm;@[0;(q;::);{[tm; t; msgs] if[tm;system\"T \",string t];'msgs}[tm;t]];@[q;::;{'x}]];if[tm;system\"T \",string t];r}{do[1000;2+2];{@[{.z.ide.ns.r1:x;:.z.ide.ns.r1};x;{r:y;:r}[;x]]}({:x!{![sv[`;] each x cross `Tables`Functions`Variables; system each \"afv\" cross enlist[\" \"] cross enlist string x]} each x} [{raze x,.z.s'[{x where{@[{1#get x};x;`]~1#.q}'[x]}` sv'x,'key x]}`]),(enlist `.z)!flip (`.z.Tables`.z.Functions`.z.Variables)!(enlist 0#`;enlist `ac`bm`exit`pc`pd`pg`ph`pi`pm`po`pp`ps`pw`vs`ts`s`wc`wo`ws;enlist `a`b`e`f`h`i`k`K`l`o`q`u`w`W`x`X`n`N`p`P`z`Z`t`T`d`D`c`zd)}";
        this.connection?.k(globalQuery, (err, result) => {
            if (err) {
                vscode.window.showErrorMessage(`Failed to retrieve kdb+ global variables: '${err.message}`);
                return;
            }

            updateGlobals(result);
        });
    }

    public updateReservedKeywords() {
        // Update reserved keywords upon successful connection.
        let reservedQuery = ".Q.res";
        this.connection?.k(reservedQuery, (err, result) => {
            if (err) {
                vscode.window.showErrorMessage(`Failed to retrieve kdb+ reserved keywords: '${err.message}`);
                return;
            }

            keywords = result;
        });
    }
}
//#endregion

export function timer() {
    let timeStart = new Date().getTime();
    return {
        /** <integer>s e.g 2s etc. */
        get seconds() {
            const seconds = Math.ceil((new Date().getTime() - timeStart) / 1000) + 's';
            return seconds;
        },
        /** Milliseconds e.g. 2000ms etc. */
        get ms() {
            const ms = (new Date().getTime() - timeStart) + 'ms';
            return ms;
        }
    };
}

// This method is called when the extension is activated.
// The extension is activated the very first time the command is executed.
export function activate(context: vscode.ExtensionContext) {
    console.log('vscode-kdb-q is now active!');

    const servers: string[] = vscode.workspace.getConfiguration().get("vscode-kdb-q.serverList") || [];

    // Samples of `window.registerTreeDataProvider`
    serverProvider = new KdbServerProvider(servers);
    vscode.window.registerTreeDataProvider('vscode-kdb-q-servers', serverProvider);

    // Samples of `window.registerTreeDataProvider`
    explorerProvider = new KdbExplorerProvider(null);
    vscode.window.registerTreeDataProvider('vscode-kdb-q-explorer', explorerProvider);

    // Register a content provider for our result scheme.
    const resultScheme = 'vscode-kdb-q';
    const resultProvider = new class implements vscode.TextDocumentContentProvider {
        // emitter and its event
        onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
        onDidChange = this.onDidChangeEmitter.event;

        provideTextDocumentContent(uri: vscode.Uri): string {
            let result = lastResult!;

            // Determine alignment for each column
            let headers = result.meta.map(m => m.c);
            let aligns = result.meta.map(m => m.t === "f" ? "." : "l");
            let opts = { align: aligns, keys:result.keys };
            let data = result.data;

            // Return formatted table.
            let text: string = isTable(result) ? formatTable(headers, data, opts) : data;
            return text;
        }
    };

    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(resultScheme, resultProvider));

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let connectToServer = vscode.commands.registerCommand('vscode-kdb-q.connectToServer', async (...args: any[]) => {
        if (args.length === 0) {
            args[0] = await promptConnection();
        }

        if (args[0] === undefined || typeof(args[0]) !== "string") {
            return;
        }

        if (currentConnection && currentConnection.connected) {
            currentConnection.disconnect();
        }
        
        currentConnection = connect(args[0]);
        currentConnection.connect((err, result) => {});
    });

    let runSelectionQuery = vscode.commands.registerTextEditorCommand('vscode-kdb-q.runSelectionQuery',
        async (editor: vscode.TextEditor, edit: vscode.TextEditorEdit) =>
    {
        // Get the selected text.
        // TODO: Support multiple selections?
        const selection = editor.selection;
        const query = editor.document.getText(selection);

        executeQuery(context, query);
    });

    let runLineQuery = vscode.commands.registerTextEditorCommand('vscode-kdb-q.runLineQuery',
        async (editor: vscode.TextEditor, edit: vscode.TextEditorEdit) =>
    {
        // Get current line.
        const lineNumber = editor.selection.active.line;
        const line = editor.document.lineAt(lineNumber);

        executeQuery(context, line.text);
    });

    let runQuery = vscode.commands.registerCommand('vscode-kdb-q.runExplorerQuery',
        async (...args: any[]) =>
    {
        if (!args || args.length === 0) {
            return;
        }

        let currentTime = Date.now();
        let doubleClickTime = 500;

        /*if (lastExplorerItem && lastExplorerItem.query === args[0] && (currentTime - lastExplorerItem.time) >= doubleClickTime)*/ {
            await executeQuery(context, args[0]);
        }

        lastExplorerItem = {query: args[0], time: currentTime};
    });

    context.subscriptions.push(connectToServer);
    context.subscriptions.push(runSelectionQuery);
    context.subscriptions.push(runLineQuery);
    context.subscriptions.push(runQuery);

    // create a new status bar item that we can now manage
    connectionStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    connectionStatus.command = 'vscode-kdb-q.connectToServer';
    connectionStatus.show();
    
    // connectionStatus.command = myCommandId;
    context.subscriptions.push(connectionStatus);

    context.subscriptions.push(vscode.languages.registerCompletionItemProvider("q", {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
            let items: vscode.CompletionItem[] = [];

            // TODO: Fix auto completion when cancelling completion and then retyping...
            // VS Code doesn't seem to handle completion items with double dots too well.
            
            // let line = document.lineAt(position.line).text;
            // let leading = line.substring(0, position.character);
            
            // let index = leading.length - 1;
            // let c = leading[index];

            // while (index >= 0 && (c === '.') || (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
            // 	c = leading[--index];
            // }

            // Replace leading dot if there is any.
            let getInsertText = (x: string) => {
                if ((x.match(/\./g) || []).length > 1) {
                    // if (x.startsWith(leading)) {
                    // 	return x.substring(x.lastIndexOf('.') + 1);
                    // }

                    return x.substr(1);
                }

                return x;
            };

            keywords.forEach(x => items.push({ label: x, kind: vscode.CompletionItemKind.Keyword }));
            functions.forEach(x => items.push({ label: x, insertText: getInsertText(x), kind: vscode.CompletionItemKind.Function }));
            tables.forEach(x => items.push({ label: x, insertText: getInsertText(x), kind: vscode.CompletionItemKind.Value }));
            variables.forEach(x => items.push({ label: x, insertText: getInsertText(x), kind: vscode.CompletionItemKind.Variable }));

            return items;
        }
    }));

    updateConnectionStatus("", ConnectionStatus.Disconnected);
}

// This method is called when the extension is deactivated.
export function deactivate() {
    currentConnection?.disconnect();
}

async function promptConnection() {
    return await vscode.window.showInputBox({ prompt: "Please enter kdb+ connection string: "});
}

function connect(connectionString: string): Connection {
    return new Connection(connectionString);
}

async function executeQuery(context: vscode.ExtensionContext, query: string) {
    if (!currentConnection) {
        let cstr = await promptConnection();
        currentConnection = cstr ? connect(cstr) : currentConnection;
    }

    if(currentConnection) {
        if (!currentConnection.connected) {
            currentConnection.connect((err, conn) => {
                conn?.executeQuery(context, query);
            });
        }
        else {
            currentConnection?.executeQuery(context, query);
        }
    }
}

enum ConnectionStatus {
    Disconnected,
    Connected,
    Querying
}

function updateConnectionStatus(hostname: string, status: ConnectionStatus): void {
    let icon = () => {
        switch (status) {
            case ConnectionStatus.Disconnected: return '$(close)';
            case ConnectionStatus.Connected: return '$(check)';
            case ConnectionStatus.Querying: return '$(sync~spin)';
        }
    };

    if (status !== ConnectionStatus.Disconnected) {
        connectionStatus.color = "#00f000";
    }
    else {
        connectionStatus.color = "#f00000";
    }

    if (hostname && hostname.length > 0) {
        connectionStatus.text = `kdb-q: ${hostname} ${icon()}`;
    }
    else {
        connectionStatus.text = `kdb-q: disconnected ${icon()}`;
    }
}

function updateGlobals(result: any): void {
    globals = result;

    let entries: [string, any][] = Object.entries(globals);

    functions = [];
    tables = [];
    variables = [];

    entries.forEach(([key, value]) => {
        // Append dot to key, replace null with empty string.
        key = key === "null" ? "." : (key + ".");

        let f = value[key + "Functions"];
        let t = value[key + "Tables"];
        let v = value[key + "Variables"];

        // Stuff in global and .q namespace should be simplified to "".
        key = (key === "." || key === ".q.") ? "" : key;

        if (f instanceof Array) {
            f.forEach((obj: any) => functions.push(`${key}${obj}`));
        }

        if (t instanceof Array) {
            t.forEach((obj: any) => tables.push(`${key}${obj}`));
        }

        if (v instanceof Array) {
            v = v.filter((x: any) => !t.includes(x));
            v.forEach((obj: any) => variables.push(`${key}${obj}`));
        }
    });

    explorerProvider.refresh(result);
}

function showDocumentView(context: vscode.ExtensionContext, query: string, result: QueryResult) {
    let title = `KDB+ Result - ${moment(Date.now()).format("HH:mm:ss.SSS")}\n${query.substring(0, 40)}`;
    let uri = vscode.Uri.parse('vscode-kdb-q:' + title);

    let position: string | undefined = vscode.workspace.getConfiguration().get("vscode-kdb-q.documentViewPosition");
    if (position === "Grid") {
        position = vscode.workspace.getConfiguration().get("vscode-kdb-q.gridViewPosition");
    }

    let columnToShowIn = (<any>vscode.ViewColumn)[position!];

    vscode.workspace.openTextDocument(uri)
    .then((document: vscode.TextDocument) => {
        vscode.languages.setTextDocumentLanguage(document, "q");

        vscode.window.showTextDocument(document, {
            preview: true,
            preserveFocus: true,
            viewColumn: columnToShowIn,
        }).then(editor => {
            resultPanel = editor;
        });
    }, (error: any) => {
        console.error(error);
    });
}

function showConsoleView(context: vscode.ExtensionContext, query: string, result: QueryResult) {
    if (consolePanel === undefined) {
        consolePanel = vscode.window.createOutputChannel('kdb-q console');
        consolePanel.show(true);
    }

    const elapsed = timer();

    // Determine alignment for each column
    let headers = result.meta.map(m => m.c);
    let aligns = result.meta.map(m => m.t === "f" ? "." : "l");
    let opts = { align: aligns, keys: result.keys };
    let data = result.data;

    // Return formatted table.
    let text: string = isTable(result) ? formatTable(headers, data, opts) : data;

    console.log("Took:", elapsed.ms);

    consolePanel.appendLine(`=== Query : ${query.replace("\n", " ")} ===`);
    consolePanel.appendLine(text);
}

function showGridView(context: vscode.ExtensionContext, result: QueryResult): void {
    if (!isTable(result)) {
        return;
    }

    // Function to get ag-grid column type.
    let getColumnType = (t: string) => {
        switch (t) {
            case "f": case "e": case "i": case "j": case "h": case "b": return 'numberColumn';
            case "c": case "s": case "S": case "C":                     return 'textColumn';
            case "d": case "p":                                         return 'dateColumn';
            default:                                                    break;
        }

        return false;
    };

    // Create column definitions for ag-grid.
    var columnDefinitions = result.meta.map(m => {
        return { headerName: m.c, field: m.c, type: getColumnType(m.t) };
    });

    // This is stupid but convert strings back to numbers if possible.
    let data = result.data.map((x: any) => {
        let y: any = Object.assign({}, x);

        for (let i = 0; i < result.meta.length; ++i) {
            let t = result.meta[i].t;
            let c = result.meta[i].c;
            
            if (t === "f" || t === "e") {
                y[c] = parseFloat(x[c]);
            }
            else if (t === "i" || t ===  "j" || t ===  "h" || t === "b") {
                y[c] = parseInt(x[c]);
            }
        }
        
        return y;
    });

    const position: string | undefined = vscode.workspace.getConfiguration().get("vscode-kdb-q.gridViewPosition");
    const columnToShowIn: vscode.ViewColumn = (<any>vscode.ViewColumn)[position!];

    if (gridPanel) {
        // If we already have a panel, show it in the target column
        // gridPanel.reveal(columnToShowIn, true);
    }
    else {
        // Otherwise, create a new panel
        gridPanel = vscode.window.createWebviewPanel('kdb-q-grid', 'KDB+ Grid', { preserveFocus: true, viewColumn: columnToShowIn }, { enableScripts: true, retainContextWhenHidden: true });
        
        const uriAgGrid = gridPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'libs', 'ag-grid', 'ag-grid-community.min.noStyle.js')));
        const uriAgGridCSS = gridPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'libs', 'ag-grid', 'ag-grid.css')));
        const uriAgGridTheme = gridPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'libs', 'ag-grid', 'ag-theme-balham-dark.css')));
    
        const grid_content = `
            <html>
            <head>
                <script src="${uriAgGrid}"></script>
                <style> html, body { margin: 0; padding: 0; height: 100%; } </style>
                <link rel="stylesheet" href="${uriAgGridCSS}">
                <link rel="stylesheet" href="${uriAgGridTheme}">
            </head>
            <body>
                <!-- div style="margin: 10px; "><button onclick="exportToCsv()">Export to CSV</button></div -->
                <div id="myGrid" style="height: 100%; width: 100%;" class="ag-theme-balham-dark"></div>
            </body>
            <script type="text/javascript">
                var gridOptions = {
                    defaultColDef: {
                        editable: true,
                        resizable: true,
                        filter: true,
                        sortable: true
                    },
                    columnTypes: {
                        textColumn: { filter: 'agTextColumnFilter' },
                        numberColumn: { filter: 'agNumberColumnFilter' },
                        dateColumn: {
                              // specify we want to use the date filter
                              filter: 'agDateColumnFilter',
                    
                              // add extra parameters for the date filter
                              filterParams: {
                                // provide comparator function
                                comparator: function(filterLocalDateAtMidnight, cellValue) {
                                      // We create a Date object for comparison against the filter date
                                      var dateParts = cellValue.substring(0, 10).split('.');
                                      var year = Number(dateParts[0]);
                                      var month = Number(dateParts[1]) - 1;
                                      var day = Number(dateParts[2]);
                                      var cellDate = new Date(year, month, day);
                    
                                      // Now that both parameters are Date objects, we can compare
                                      if (cellDate < filterLocalDateAtMidnight) {
                                        return -1;
                                    }
                                    else if (cellDate > filterLocalDateAtMidnight) {
                                        return 1;
                                    }
                                    else {
                                        return 0;
                                      }
                                },
                              },
                        },
                    }
                };

                function exportToCsv() {
                    var params = {
                        // suppressQuotes: getValue('#suppressQuotes'),
                        // columnSeparator: getValue('#columnSeparator')
                    };
                    
                    if (params.suppressQuotes || params.columnSeparator) {
                        alert('NOTE: you are downloading a file with non-standard quotes or separators - it may not render correctly in Excel.');
                    }

                    gridOptions.api.exportDataAsCsv(params);
                };

                // Handle the message inside the webview.
                window.addEventListener('message', event => {
                    const message = event.data;
                    const payload = message.payload;
                    const columns = message.columns;

                    gridOptions.api.setRowData(payload);
                    gridOptions.api.setColumnDefs(columns);

                    var allColumnIds = [];
                    gridOptions.columnApi.getAllColumns().forEach(function(column) {
                          allColumnIds.push(column.colId);
                    });
                  
                    gridOptions.columnApi.autoSizeColumns(allColumnIds, false);
                });

                // Setup the grid after the page has finished loading.
                document.addEventListener('DOMContentLoaded', function () {
                    var gridDiv = document.querySelector('#myGrid');
                    new agGrid.Grid(gridDiv, gridOptions);
                });
            </script>
        </html>
        `;

        gridPanel.webview.html = grid_content;

        // Reset when the current panel is closed
        gridPanel.onDidDispose(() => {
            gridPanel = undefined;
        }, null, context.subscriptions);
    }

    gridPanel.webview.postMessage({ columns: columnDefinitions, payload: data });
}

function isTable(result: QueryResult): boolean {
    if (!result.result || !result.meta || result.meta.length === 0/* || result.data.length === 0*/) {
        return false;
    }

    return true;
}

function stringifyResult(result: QueryResult) {
    if (!result.result) {
        return `'${result.data}`;
    }

    if (isTable(result)) {
        return stringifyTable(result.meta, result.data);
    }

    // If it's not a table, perform simple stringification.
    return stringify(constants.types[Math.abs(result.type!)], result.data);
}

function stringifyTable(meta: MetaResult[], rows: any): any {
    let result = new Array(rows.length);
    let types = meta.map(m => m.t);
    let fromEntries = (arr: any) => Object.assign({}, ...Array.from(arr, ([k, v]) => ({[k]: v}) ));

    for (let i = 0; i < rows.length; ++i) {
        let keys = Object.keys(rows[i]);
        let values = Object.values(rows[i]).map((x, j) => stringify(types[j], x));

        let entries = keys.map(function(key, i) {
            return [key, values[i]];
        });

        result[i] = fromEntries(entries);
    }

    return result;
}

function formatTable(headers_: any, rows_: any, opts: any) {
    if (!opts) {
        opts = {};
    }

    // Convert to array of arrays, instead of array of objects.
    // Make sure we store the new array separately, don't alter orginal.
    let data = new Array(rows_.length);
    for (let i = 0; i < rows_.length; ++i) {
        data[i] = (typeof(rows_[i]) === "object" ? Object.values(rows_[i]) : rows_[i]);
    }

    var hsep = opts.hsep === undefined ? ' ' : opts.hsep;
    var align = opts.align || [];
    var keys = opts.keys || [];
    var stringLength = opts.stringLength || function (s: any) { return String(s).length; };
    
    var dotsizes = reduce(data, function (acc: any, row: any) {
        forEach(row, function (c: any, ix: any) {
            var [left, right] = dotoffsets(c);

            if (!acc[ix]) {
                acc[ix] = [left, right];
            }
            else {
                if (left > acc[ix][0]) {
                    acc[ix][0] = left;
                }
                if (right > acc[ix][1]) {
                    acc[ix][1] = right;
                }
            }
        });
        return acc;
    }, []);
    
    var rows = map(data, function (row: any) {
        return map(row, function (c_: any, ix: any) {
            var c = String(c_);
            if (align[ix] === '.') {
                var [left, right] = dotoffsets(c);

                var test = /\./.test(c);
                var [maxLeft, maxRight] = dotsizes[ix];
                var leftSize = maxLeft - left;
                var rightSize = (maxRight === 0 || test ? 0 : 1) + maxRight - right;

                return ' '.repeat(leftSize) + c + ' '.repeat(rightSize);
            }
            else {
                return c;
            }
        });
    });
    
    var sizes = reduce(rows, function (acc: any, row: any) {
        forEach(row, function (c: any, ix: any) {
            var n = stringLength(c);
            if (!acc[ix] || n > acc[ix]) {
                acc[ix] = n;
            }
        });
        return acc;
    }, headers_.map((x: any) => x.length));

    var result = map(rows, function (row: any) {
        return map(row, function (c: any, ix: any) {
            var n = (sizes[ix] - stringLength(c)) || 0;
            var s = Array(Math.max(n + 1, 1)).join(' ');
            if (align[ix] === 'r'/* || align[ix] === '.'*/) {
                return s + c;
            }
            
            if (align[ix] === 'c') {
                return Array(Math.ceil(n / 2 + 1)).join(' ')
                    + c + Array(Math.floor(n / 2 + 1)).join(' ')
                ;
            }
            
            return c + s;
        }).join(hsep);
    });
    
    // Add whitespace to each column header.
    var headers = map(headers_, function (c: any, ix: any) {
        return c + ' '.repeat(Math.max(0, sizes[ix] - c.length));
    });

    // Find out where we should add key/value separator, if any.
    var columnSeparatorIndex = 0;
    for (let i = 0; i < keys.length; ++i) {
        columnSeparatorIndex += headers[i].length;
    }
 
    // Repeat separator with same length as header.
    var header = headers.join(hsep);
    var separator = '-'.repeat(header.length);

    // Insert separator and header at zero index (in reverse order).
    result.unshift(separator);
    result.unshift(header);
    
    // Insert pipe at given index for each row.
    if (columnSeparatorIndex > 0) {
        const insertAt = (str: any, sub: any, pos: any) => `${str.slice(0, pos)}${sub}${str.slice(pos)}`;
        result = result.map((x: any) => insertAt(x, '|', columnSeparatorIndex + 1));
    }

    // Join all rows together.
    return result.join('\n');
};

function dotoffsets(c: string) {
    var m = /\.[^.]*$/.exec(c);
    return m ? [m.index, c.length - m.index - 1] : [c.length, 0];
}

function reduce(xs: any, f: any, init: any) {
    if (xs.reduce) {
        return xs.reduce(f, init);
    }

    var i = 0;
    var acc = arguments.length >= 3 ? init : xs[i++];
    for (; i < xs.length; i++) {
        f(acc, xs[i], i);
    }
    
    return acc;
}

function forEach(xs: any, f: any) {
    if (xs.forEach) {
        return xs.forEach(f);
    }

    for (var i = 0; i < xs.length; i++) {
        f.call(xs, xs[i], i);
    }
}

function map(xs: any, f: any) {
    if (xs.map) {
        return xs.map(f);
    }

    var res = [];
    for (var i = 0; i < xs.length; i++) {
        res.push(f.call(xs, xs[i], i));
    }
}

function pad(num: number, size: number) {
    return (num + "").padStart(size, '0');
}

function stringify(t: string, x: any): string {
    let type = typeof(x);
    let isObject = type === "object";

    if (!x && isObject) {
        return "";
    }

    if (type === "string") {
        return x;
    }

    // This bit here is for vectors.
    if (x instanceof Array) {
        if (x.length === 0) {
            return "()"; // TODO: Add type in front of ()?
        }

        if (typeof(x[0]) === "object") {
            return "[nested]";
        }

        return (x.length > 1 ? '' : ',') +
              t === "s" ? ('`' + x.map((y: any) => stringify(t, y)).join('`'))
            : t === "b" ? (x.map((y: any) => stringify(t, y)).join('') + 'b')
            : (x.map((y: any) => stringify(t, y)).join(' '));
    }

    // Below is for handling tables and atoms.
    switch (t) {
        case "f":
            // TODO: Find out if there's a more efficient way to fix floating point errors.
            return x.toFixed(7).replace(/\.?0*$/, '');

        case "b":
            return x === true ? '1' : '0';

        case "d":
            return x.toISOString().replace(/-/g, '.').slice(0, 10);

        case "p":
            // The most we can do is micro second precision I guess...
            // When converting down to nanoseconds, precision errors occur very frequently.
            const pbase = Math.floor(x / 1000000);
            const prem = Math.round((x - (pbase * 1000000)) / 1000);
            return moment.utc(pbase).format("YYYY.MM.DDTHH:mm:ss.SSS").replace('T', 'D') + pad(prem, 3);
            // return x.toISOString().replace(/-/g, '.').replace('T', 'D').replace('Z', '');

        case "n":
            const duration = moment.duration(Math.floor(Math.abs(x / 1000000)));
            const nsign = x < 0 ? '-' : '';
            
            const fractional = pad(Math.abs(x % 1000000000), 9);

            const seconds = Math.abs(duration.seconds());
            const minutes = Math.abs(duration.minutes());
            const hours = Math.abs(duration.hours());
            const days = Math.floor(Math.abs(duration.asDays()));

            return `${nsign}${days}D${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${fractional}`;
            // // TODO: Test whether this actually works (test larger dates, negative, etc.)
            // let milliseconds = Math.abs(x.getUTCMilliseconds());
            // let seconds = Math.abs(x.getUTCSeconds());
            // let minutes = Math.abs(x.getUTCMinutes());
            // let hours = Math.abs(x.getUTCHours());

            // let diffTime = Math.abs(x - constants.base);

            // diffTime -= (hours * constants.hours) + (minutes * constants.minutes) + (seconds * constants.seconds) + (milliseconds);
            // let days = Math.floor(diffTime / constants.days);

            // const nsign = x < constants.base ? '-' : '';
            // return `${nsign}${days}D${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(milliseconds, 3)}`;

        case "t":
            return x.toISOString().slice(11, 23);

        case "u":
            const usign = x < constants.base ? '-' : '';
            if (usign === '-') {
                x = constants.base - x;
                return `${usign}${pad(x.getUTCHours(), 2)}:${pad(x.getUTCMinutes(), 2)}`;
            }

            return `${usign}${pad(x.getMinutes(), 2)}:${pad(x.getSeconds(), 2)}`;

        case "v":
            const vsign = x < constants.base ? '-' : '';
            if (vsign === '-') {
                x = new Date(constants.base - x);
                return `${vsign}${pad(x.getUTCHours(), 2)}:${pad(x.getUTCMinutes(), 2)}:${pad(x.getUTCSeconds(), 2)}`;
            }

            return `${vsign}${pad(x.getHours(), 2)}:${pad(x.getMinutes(), 2)}:${pad(x.getSeconds(), 2)}`;

        default:
            break;
    }

    // Print nested objects as '[nested]'.
    return isObject ? "[nested]" : x.toString();
}
