import * as vscode from 'vscode';
import * as path from 'path';

export class KdbExplorerProvider implements vscode.TreeDataProvider<KdbExplorerNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<KdbExplorerNode | undefined | void> = new vscode.EventEmitter<KdbExplorerNode | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<KdbExplorerNode | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private rootElement: any) {
		//
	}

	refresh(rootElement: any): void {
		this.rootElement = rootElement;
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: KdbExplorerNode): vscode.TreeItem {
		return element;
	}

	getChildren(element?: KdbExplorerNode): Thenable<KdbExplorerNode[]> {
		if (!this.rootElement) {
			return Promise.resolve([]);
		}

		if (element) {
			return Promise.resolve(this.getChildElements(element));
		}
		else {
			const root = new KdbExplorerNode(this.rootElement, "", "", vscode.TreeItemCollapsibleState.None);
			return Promise.resolve(this.getChildElements(root));
		}
	}

	private getChildElements(parent: KdbExplorerNode): KdbExplorerNode[] {
		let isRoot = parent.namespace === "";

		const createNode = (key: string, value: any): KdbExplorerNode => {
			let namespace: string = (isRoot ? key : parent.namespace);

			let isLeaf = typeof(value) === "string";
			let isEmptyParent = Object.keys(value).length === 0;

			let label = (isLeaf)
				? `${namespace}.${value}`
				: key.replace(`${namespace}.`, "");

			let state = (isLeaf || isEmptyParent)
				? vscode.TreeItemCollapsibleState.None
				: vscode.TreeItemCollapsibleState.Collapsed;

			return new KdbExplorerNode(value, label, namespace, state);
		};

		return Object.entries(parent.object).map(([key, value]) => createNode(key !== "null" ? key : "", value));
	}
}

export class KdbExplorerNode extends vscode.TreeItem {

	constructor(
		public readonly object: any,
		public readonly label: string,
		public readonly namespace: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label, collapsibleState);
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	};

	contextValue = 'dependency';
}
