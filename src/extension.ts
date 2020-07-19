// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as nodeq from 'node-q';

let connection : nodeq.Connection;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
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
		const input = await vscode.window.showInputBox({ prompt: "Please enter host string: "});
		if (!input) {
			return;
		}

		const params = input.split(":");
		if (!params) {
			throw new Error("Failed to parse input");
		}

		let options : nodeq.ConnectionParameters = {};
		if (params.length > 0) { options.host = params[0]; }
		if (params.length > 1) { options.port = +params[1]; }
		if (params.length > 1) { options.user = params[2]; }
		if (params.length > 1) { options.password = params[3]; }

		nodeq.connect(options, function(err, conn) {
			if (err || !conn) {
				throw err;
			}

			connection = conn;
			console.log("Connected to", `${options.host}:${options.port}`);
		});
	});

	let runSelectionQuery = vscode.commands.registerCommand('vscode-kdb-q.runSelectionQuery', async () => {
		var editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}
		
		var selection = editor.selection;
		var text = editor.document.getText(selection);

		connection.k(text, function(err, res) {
			if (err) {
				throw err;
			}

			console.log("Result:", res);
		});
	});

	context.subscriptions.push(connectToServer);
	context.subscriptions.push(runSelectionQuery);
}

// this method is called when your extension is deactivated
export function deactivate() {
	connection?.close();
}
