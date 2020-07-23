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

	context.subscriptions.push(vscode.languages.registerCompletionItemProvider("q", {
		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
			
			return [
				{ label: ".z.a", insertText: "z.a", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.ac", insertText: "z.ac", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.b", insertText: "z.b", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.bm", insertText: "z.bm", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.c", insertText: "z.c", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.e", insertText: "z.e", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.exit", insertText: "z.exit", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.f", insertText: "z.f", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.h", insertText: "z.h", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.i", insertText: "z.i", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.k", insertText: "z.k", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.K", insertText: "z.K", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.l", insertText: "z.l", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.n", insertText: "z.n", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.N", insertText: "z.N", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.o", insertText: "z.o", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.p", insertText: "z.p", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.P", insertText: "z.P", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.pc", insertText: "z.pc", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.pg", insertText: "z.pg", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.pd", insertText: "z.pd", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.ph", insertText: "z.ph", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.pi", insertText: "z.pi", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.pm", insertText: "z.pm", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.po", insertText: "z.po", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.pp", insertText: "z.pp", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.ps", insertText: "z.ps", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.pw", insertText: "z.pw", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.q", insertText: "z.q", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.s", insertText: "z.s", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.ts", insertText: "z.ts", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.u", insertText: "z.u", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.vs", insertText: "z.vs", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.w", insertText: "z.w", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.wc", insertText: "z.wc", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.wo", insertText: "z.wo", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.W", insertText: "z.W", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.ws", insertText: "z.ws", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.x", insertText: "z.x", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.z", insertText: "z.z", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.Z", insertText: "z.Z", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.t", insertText: "z.t", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.T", insertText: "z.T", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.d", insertText: "z.d", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.D", insertText: "z.D", kind: vscode.CompletionItemKind.Function },
				{ label: ".z.zd", insertText: "z.zd", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.addmonths", insertText: "Q.addmonths", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.addr", insertText: "Q.addr", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.host", insertText: "Q.host", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.chk", insertText: "Q.chk", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.cn", insertText: "Q.cn", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.dd", insertText: "Q.dd", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.dpft", insertText: "Q.dpft", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.dsftg", insertText: "Q.dsftg", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.def", insertText: "Q.def", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.en", insertText: "Q.en", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.fc", insertText: "Q.fc", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.ff", insertText: "Q.ff", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.fk", insertText: "Q.fk", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.fmt", insertText: "Q.fmt", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.f", insertText: "Q.f", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.fps", insertText: "Q.fps", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.fs", insertText: "Q.fs", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.fsn", insertText: "Q.fsn", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.ft", insertText: "Q.ft", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.fu", insertText: "Q.fu", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.gc", insertText: "Q.gc", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.hdpf", insertText: "Q.hdpf", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.hg", insertText: "Q.hg", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.hp", lainsertTextbel: "Q.hp", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.id", insertText: "Q.id", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.ind", insertText: "Q.ind", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.j10", insertText: "Q.j10", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.j12", insertText: "Q.j12", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.x10", insertText: "Q.x10", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.x12", insertText: "Q.x12", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.k", insertText: "Q.k", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.l", insertText: "Q.l", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.MAP", insertText: "Q.MAP", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.opt", insertText: "Q.opt", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.par", insertText: "Q.par", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.qp", insertText: "Q.qp", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.qt", insertText: "Q.qt", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.s", insertText: "Q.s", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.s1", insertText: "Q.s1", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.ty", insertText: "Q.ty", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.v", insertText: "Q.v", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.V", insertText: "Q.V", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.view", insertText: "Q.view", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.res", insertText: "Q.res", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.t", insertText: "Q.t", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.A", insertText: "Q.A", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.a", insertText: "Q.a", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.n", insertText: "Q.n", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.nA", insertText: "Q.nA", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.na", insertText: "Q.na", kind: vscode.CompletionItemKind.Function },
				{ label: ".Q.w", insertText: "Q.w", kind: vscode.CompletionItemKind.Function },
				{ label: "abs", kind: vscode.CompletionItemKind.Function },
				{ label: "acos", kind: vscode.CompletionItemKind.Function },
				{ label: "aj", kind: vscode.CompletionItemKind.Function },
				{ label: "aj0", kind: vscode.CompletionItemKind.Function },
				{ label: "all", kind: vscode.CompletionItemKind.Function },
				{ label: "and", kind: vscode.CompletionItemKind.Function },
				{ label: "any", kind: vscode.CompletionItemKind.Function },
				{ label: "asc", kind: vscode.CompletionItemKind.Function },
				{ label: "asin", kind: vscode.CompletionItemKind.Function },
				{ label: "asof", kind: vscode.CompletionItemKind.Function },
				{ label: "atan", kind: vscode.CompletionItemKind.Function },
				{ label: "attr", kind: vscode.CompletionItemKind.Function },
				{ label: "avg", kind: vscode.CompletionItemKind.Function },
				{ label: "avgs", kind: vscode.CompletionItemKind.Function },
				{ label: "bin", kind: vscode.CompletionItemKind.Function },
				{ label: "binr", kind: vscode.CompletionItemKind.Function },
				{ label: "ceiling", kind: vscode.CompletionItemKind.Function },
				{ label: "cols", kind: vscode.CompletionItemKind.Function },
				{ label: "cor", kind: vscode.CompletionItemKind.Function },
				{ label: "cos", kind: vscode.CompletionItemKind.Function },
				{ label: "count", kind: vscode.CompletionItemKind.Function },
				{ label: "cov", kind: vscode.CompletionItemKind.Function },
				{ label: "cross", kind: vscode.CompletionItemKind.Function },
				{ label: "csv", kind: vscode.CompletionItemKind.Function },
				{ label: "cut", kind: vscode.CompletionItemKind.Function },
				{ label: "delete", kind: vscode.CompletionItemKind.Function },
				{ label: "deltas", kind: vscode.CompletionItemKind.Function },
				{ label: "desc", kind: vscode.CompletionItemKind.Function },
				{ label: "dev", kind: vscode.CompletionItemKind.Function },
				{ label: "differ", kind: vscode.CompletionItemKind.Function },
				{ label: "distinct", kind: vscode.CompletionItemKind.Function },
				{ label: "div", kind: vscode.CompletionItemKind.Function },
				{ label: "do", kind: vscode.CompletionItemKind.Function },
				{ label: "dsave", kind: vscode.CompletionItemKind.Function },
				{ label: "each", kind: vscode.CompletionItemKind.Function },
				{ label: "ej", kind: vscode.CompletionItemKind.Function },
				{ label: "ema", kind: vscode.CompletionItemKind.Function },
				{ label: "enlist", kind: vscode.CompletionItemKind.Function },
				{ label: "eval", kind: vscode.CompletionItemKind.Function },
				{ label: "except", kind: vscode.CompletionItemKind.Function },
				{ label: "exec", kind: vscode.CompletionItemKind.Function },
				{ label: "exit", kind: vscode.CompletionItemKind.Function },
				{ label: "exp", kind: vscode.CompletionItemKind.Function },
				{ label: "fby", kind: vscode.CompletionItemKind.Function },
				{ label: "fills", kind: vscode.CompletionItemKind.Function },
				{ label: "first", kind: vscode.CompletionItemKind.Function },
				{ label: "fkeys", kind: vscode.CompletionItemKind.Function },
				{ label: "flip", kind: vscode.CompletionItemKind.Function },
				{ label: "floor", kind: vscode.CompletionItemKind.Function },
				{ label: "get", kind: vscode.CompletionItemKind.Function },
				{ label: "getenv", kind: vscode.CompletionItemKind.Function },
				{ label: "group", kind: vscode.CompletionItemKind.Function },
				{ label: "gtime", kind: vscode.CompletionItemKind.Function },
				{ label: "hclose", kind: vscode.CompletionItemKind.Function },
				{ label: "hcount", kind: vscode.CompletionItemKind.Function },
				{ label: "hdel", kind: vscode.CompletionItemKind.Function },
				{ label: "hopen", kind: vscode.CompletionItemKind.Function },
				{ label: "hsym", kind: vscode.CompletionItemKind.Function },
				{ label: "iasc", kind: vscode.CompletionItemKind.Function },
				{ label: "idesc", kind: vscode.CompletionItemKind.Function },
				{ label: "if", kind: vscode.CompletionItemKind.Function },
				{ label: "ij", kind: vscode.CompletionItemKind.Function },
				{ label: "in", kind: vscode.CompletionItemKind.Function },
				{ label: "insert", kind: vscode.CompletionItemKind.Function },
				{ label: "inter", kind: vscode.CompletionItemKind.Function },
				{ label: "inv", kind: vscode.CompletionItemKind.Function },
				{ label: "key", kind: vscode.CompletionItemKind.Function },
				{ label: "keys", kind: vscode.CompletionItemKind.Function },
				{ label: "last", kind: vscode.CompletionItemKind.Function },
				{ label: "like", kind: vscode.CompletionItemKind.Function },
				{ label: "lj", kind: vscode.CompletionItemKind.Function },
				{ label: "ljf", kind: vscode.CompletionItemKind.Function },
				{ label: "load", kind: vscode.CompletionItemKind.Function },
				{ label: "log", kind: vscode.CompletionItemKind.Function },
				{ label: "lower", kind: vscode.CompletionItemKind.Function },
				{ label: "lsq", kind: vscode.CompletionItemKind.Function },
				{ label: "ltime", kind: vscode.CompletionItemKind.Function },
				{ label: "ltrim", kind: vscode.CompletionItemKind.Function },
				{ label: "mavg", kind: vscode.CompletionItemKind.Function },
				{ label: "max", kind: vscode.CompletionItemKind.Function },
				{ label: "maxs", kind: vscode.CompletionItemKind.Function },
				{ label: "mcount", kind: vscode.CompletionItemKind.Function },
				{ label: "md5", kind: vscode.CompletionItemKind.Function },
				{ label: "mdev", kind: vscode.CompletionItemKind.Function },
				{ label: "med", kind: vscode.CompletionItemKind.Function },
				{ label: "meta", kind: vscode.CompletionItemKind.Function },
				{ label: "min", kind: vscode.CompletionItemKind.Function },
				{ label: "mins", kind: vscode.CompletionItemKind.Function },
				{ label: "mmax", kind: vscode.CompletionItemKind.Function },
				{ label: "mmin", kind: vscode.CompletionItemKind.Function },
				{ label: "mmu", kind: vscode.CompletionItemKind.Function },
				{ label: "mod", kind: vscode.CompletionItemKind.Function },
				{ label: "msum", kind: vscode.CompletionItemKind.Function },
				{ label: "neg", kind: vscode.CompletionItemKind.Function },
				{ label: "next", kind: vscode.CompletionItemKind.Function },
				{ label: "not", kind: vscode.CompletionItemKind.Function },
				{ label: "null", kind: vscode.CompletionItemKind.Function },
				{ label: "or", kind: vscode.CompletionItemKind.Function },
				{ label: "over", kind: vscode.CompletionItemKind.Function },
				{ label: "parse", kind: vscode.CompletionItemKind.Function },
				{ label: "peach", kind: vscode.CompletionItemKind.Function },
				{ label: "pj", kind: vscode.CompletionItemKind.Function },
				{ label: "plist", kind: vscode.CompletionItemKind.Function },
				{ label: "prd", kind: vscode.CompletionItemKind.Function },
				{ label: "prds", kind: vscode.CompletionItemKind.Function },
				{ label: "prev", kind: vscode.CompletionItemKind.Function },
				{ label: "prior", kind: vscode.CompletionItemKind.Function },
				{ label: "rand", kind: vscode.CompletionItemKind.Function },
				{ label: "rank", kind: vscode.CompletionItemKind.Function },
				{ label: "ratios", kind: vscode.CompletionItemKind.Function },
				{ label: "raze", kind: vscode.CompletionItemKind.Function },
				{ label: "read0", kind: vscode.CompletionItemKind.Function },
				{ label: "read1", kind: vscode.CompletionItemKind.Function },
				{ label: "reciprocal", kind: vscode.CompletionItemKind.Function },
				{ label: "reval", kind: vscode.CompletionItemKind.Function },
				{ label: "reverse", kind: vscode.CompletionItemKind.Function },
				{ label: "rload", kind: vscode.CompletionItemKind.Function },
				{ label: "rotate", kind: vscode.CompletionItemKind.Function },
				{ label: "rsave", kind: vscode.CompletionItemKind.Function },
				{ label: "rtrim", kind: vscode.CompletionItemKind.Function },
				{ label: "save", kind: vscode.CompletionItemKind.Function },
				{ label: "scan", kind: vscode.CompletionItemKind.Function },
				{ label: "scov", kind: vscode.CompletionItemKind.Function },
				{ label: "sdev", kind: vscode.CompletionItemKind.Function },
				{ label: "select", kind: vscode.CompletionItemKind.Function },
				{ label: "set", kind: vscode.CompletionItemKind.Function },
				{ label: "setenv", kind: vscode.CompletionItemKind.Function },
				{ label: "show", kind: vscode.CompletionItemKind.Function },
				{ label: "signum", kind: vscode.CompletionItemKind.Function },
				{ label: "sin", kind: vscode.CompletionItemKind.Function },
				{ label: "sqrt", kind: vscode.CompletionItemKind.Function },
				{ label: "ss", kind: vscode.CompletionItemKind.Function },
				{ label: "ssr", kind: vscode.CompletionItemKind.Function },
				{ label: "string", kind: vscode.CompletionItemKind.Function },
				{ label: "sublist", kind: vscode.CompletionItemKind.Function },
				{ label: "sum", kind: vscode.CompletionItemKind.Function },
				{ label: "sums", kind: vscode.CompletionItemKind.Function },
				{ label: "sv", kind: vscode.CompletionItemKind.Function },
				{ label: "svar", kind: vscode.CompletionItemKind.Function },
				{ label: "system", kind: vscode.CompletionItemKind.Function },
				{ label: "tables", kind: vscode.CompletionItemKind.Function },
				{ label: "tan", kind: vscode.CompletionItemKind.Function },
				{ label: "til", kind: vscode.CompletionItemKind.Function },
				{ label: "trim", kind: vscode.CompletionItemKind.Function },
				{ label: "txf", kind: vscode.CompletionItemKind.Function },
				{ label: "type", kind: vscode.CompletionItemKind.Function },
				{ label: "uj", kind: vscode.CompletionItemKind.Function },
				{ label: "ungroup", kind: vscode.CompletionItemKind.Function },
				{ label: "union", kind: vscode.CompletionItemKind.Function },
				{ label: "update", kind: vscode.CompletionItemKind.Function },
				{ label: "upper", kind: vscode.CompletionItemKind.Function },
				{ label: "upsert", kind: vscode.CompletionItemKind.Function },
				{ label: "value", kind: vscode.CompletionItemKind.Function },
				{ label: "var", kind: vscode.CompletionItemKind.Function },
				{ label: "view", kind: vscode.CompletionItemKind.Function },
				{ label: "views", kind: vscode.CompletionItemKind.Function },
				{ label: "vs", kind: vscode.CompletionItemKind.Function },
				{ label: "wavg", kind: vscode.CompletionItemKind.Function },
				{ label: "where", kind: vscode.CompletionItemKind.Function },
				{ label: "while", kind: vscode.CompletionItemKind.Function },
				{ label: "within", kind: vscode.CompletionItemKind.Function },
				{ label: "wj", kind: vscode.CompletionItemKind.Function },
				{ label: "wj1", kind: vscode.CompletionItemKind.Function },
				{ label: "wsum", kind: vscode.CompletionItemKind.Function },
				{ label: "ww", kind: vscode.CompletionItemKind.Function },
				{ label: "xasc", kind: vscode.CompletionItemKind.Function },
				{ label: "xbar", kind: vscode.CompletionItemKind.Function },
				{ label: "xcol", kind: vscode.CompletionItemKind.Function },
				{ label: "xcols", kind: vscode.CompletionItemKind.Function },
				{ label: "xdesc", kind: vscode.CompletionItemKind.Function },
				{ label: "xexp", kind: vscode.CompletionItemKind.Function },
				{ label: "xgroup", kind: vscode.CompletionItemKind.Function },
				{ label: "xkey", kind: vscode.CompletionItemKind.Function },
				{ label: "xlog", kind: vscode.CompletionItemKind.Function },
				{ label: "xprev", kind: vscode.CompletionItemKind.Function },
				{ label: "xrank", kind: vscode.CompletionItemKind.Function }
			];
		}
	}));

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
	// const payload = JSON.stringify(obj);
	
	if (gridPanel) {
		// If we already have a panel, show it in the target column
		gridPanel.reveal(columnToShowIn);
	}
	else {
		// Otherwise, create a new panel
		gridPanel = vscode.window.createWebviewPanel('kdb-q-grid', 'KDB+ Table', { preserveFocus: true, viewColumn: columnToShowIn }, { enableScripts: true, retainContextWhenHidden: true });
		
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
				<div id="myGrid" style="height: 100%; width: 100%;" class="ag-theme-balham-dark"></div>
			</body>
			<script type="text/javascript">
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
						editable: true,
						resizable: true,
						filter: true,
						sortable: true,
						minWidth: 100,
						flex: 1
					}
				};

				// Handle the message inside the webview
				window.addEventListener('message', event => {
					const message = event.data; // The JSON data our extension sent
		
					var payload = message.payload;
		
					gridOptions.api.setRowData(payload);
					gridOptions.api.setColumnDefs(columnDefinitions);
				});

				// setup the grid after the page has finished loading
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

	gridPanel.webview.postMessage({ payload: obj });
}