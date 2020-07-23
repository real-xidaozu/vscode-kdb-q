// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as nodeq from 'node-q';
import * as path from 'path';

let connection : nodeq.Connection;
let connectionStatus: vscode.StatusBarItem;

// Track current webview panel.
let gridPanel: vscode.WebviewPanel | undefined = undefined;

// This method is called when the extension is activated.
// The extension is activated the very first time the command is executed.
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-kdb-q" is now active!');

	// Display a message box to the user
	vscode.window.showInformationMessage('Hello World from vscode-kdb-q!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let connectToServer = vscode.commands.registerCommand('vscode-kdb-q.connectToServer', async () => {
		// The code you place here will be executed every time your command is executed
		const input = await vscode.window.showInputBox({ prompt: "Please enter kdb+ connection string: "});
		if (!input) {
			return;
		}

		// kdb+ connection strings are split by colons.
		const params = input.split(":");
		if (!params) {
			throw new Error("Failed to parse input");
		}

		// Parse parameters.
		let options : nodeq.ConnectionParameters = {};
		if (params.length > 0) { options.host = params[0]; }
		if (params.length > 1) { options.port = +params[1]; }
		if (params.length > 2) { options.user = params[2]; }
		if (params.length > 3) { options.password = params[3]; }

		// Connect to kdb+ server.
		nodeq.connect(options, function(err, conn) {
			if (err || !conn) {
				throw err;
			}

			// Setup up connection close listener, update status bar if closed.
			conn.addListener("close", (hadError: boolean) => {
				updateConnectionStatus("");
			});

			// Close existing connection, since we established a new one successfully.
			if (connection) {
				connection.close(() => {
					updateConnection(conn, options);
				});
			}
			else {
				updateConnection(conn, options);
			}
		});
	});

	let runSelectionQuery = vscode.commands.registerCommand('vscode-kdb-q.runSelectionQuery', () => {
		// Get the editor, do nothing if no editor was open.
		var editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		
		// Get the selected text.
		// TODO: Support multiple selections?
		var selection = editor.selection;
		var text = editor.document.getText(selection);

		// Flush query through connection and print result.
		connection.k(text, function(err, res) {
			if (err) {
				throw err;
			}

			// TODO: Print (formatted) result in special panel.
			console.log("Result:", res);

			showGrid(context, res);
		});
	});

	context.subscriptions.push(connectToServer);
	context.subscriptions.push(runSelectionQuery);

	// create a new status bar item that we can now manage
	connectionStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	connectionStatus.show();
	
	// connectionStatus.command = myCommandId;
	context.subscriptions.push(connectionStatus);

	updateConnectionStatus("");
}

// This method is called when the extension is deactivated.
export function deactivate() {
	connection?.close();
}

function updateConnection(conn: nodeq.Connection, options: nodeq.ConnectionParameters): void {
	// Update global connection variable.
	// TODO: Support multiple active connections?
	connection = conn;

	let hostname = `${options.host}:${options.port}`;
	updateConnectionStatus(hostname);

	console.log("Connected to", hostname);
}

function updateConnectionStatus(hostname: string): void {
	if (hostname && hostname.length > 0) {
		connectionStatus.text = `kdb-q: ${hostname}`;
	}
	else {
		connectionStatus.text = "kdb-q: disconnected";
	}
}

function getWebviewContent(): string {
	return `<!DOCTYPE html>
  	<html lang="en">
  		<head>
	  		<meta charset="UTF-8">
	  		<meta name="viewport" content="width=device-width, initial-scale=1.0">
	  		<title>Cat Coding</title>
  		</head>
  		<body>
	  		<img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />
  		</body>
  	</html>`;
}

function showGrid(context: vscode.ExtensionContext, obj: string): void {
	// Always show in side panel.
	const columnToShowIn = vscode.ViewColumn.Beside;
	// const payload = { data: JSON.stringify(obj), schema: {} };
	const payload = JSON.stringify(obj);
	
	if (gridPanel) {
		// If we already have a panel, show it in the target column
		gridPanel.reveal(columnToShowIn);
	}
	else {
		// Otherwise, create a new panel
		gridPanel = vscode.window.createWebviewPanel('kdb-q-grid', 'KDB+ Table', { preserveFocus: true, viewColumn: columnToShowIn }, { enableScripts: true, retainContextWhenHidden: true });
		
		// Reset when the current panel is closed
		gridPanel.onDidDispose(() => {
			gridPanel = undefined;
		}, null, context.subscriptions);
	}

	const uriAgGrid = gridPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'libs', 'ag-grid', 'ag-grid-community.min.noStyle.js')));
	const uriAgGridCSS = gridPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'libs', 'ag-grid', 'ag-grid.css')));
	const uriAgGridTheme = gridPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'libs', 'ag-grid', 'ag-theme-balham.css')));

	const grid_content = `
		<html>
			<head>
				<script src="${uriAgGrid}"></script>
				<style> html, body { margin: 0; padding: 0; height: 100%; } </style>
				<link rel="stylesheet" href="${uriAgGridCSS}">
				<link rel="stylesheet" href="${uriAgGridTheme}">
			</head>
		<body>
			<div id="myGrid" style="height: 100%; width: 100%;" class="ag-theme-balham"></div>
		</body>
		<script type="text/javascript">
			var payload = ${payload};
			var columnDefinitions = [
				{ headerName: "Time", field: "time" },
				{ headerName: "Symbol", field: "sym" },
				{ headerName: "Size", field: "size" },
				{ headerName: "Price", field: "price" }
			];

			var gridOptions = {
				onGridReady: event => event.api.sizeColumnsToFit(),
				onGridSizeChanged: event => event.api.sizeColumnsToFit(),
				defaultColDef: {
					resizable: true,
					filter: true,
					sortable: true
				},
				columnDefs: columnDefinitions,
			    rowData: payload
			};
			var eGridDiv = document.querySelector('#myGrid');
			new agGrid.Grid(eGridDiv, gridOptions);
		</script>
	</html>
	`;

	gridPanel.webview.html = grid_content;
}