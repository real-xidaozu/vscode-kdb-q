import * as vscode from 'vscode';
import * as path from 'path';

export class KdbServerProvider implements vscode.TreeDataProvider<KdbServerNode> {

	private _onDidChangeTreeData: vscode.EventEmitter<KdbServerNode | undefined | void> = new vscode.EventEmitter<KdbServerNode | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<KdbServerNode | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private serverList: string[]) {
		//
	}

	refresh(serverList: string[]): void {
		this.serverList = serverList;
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: KdbServerNode): vscode.TreeItem {
		return element;
	}

	getChildren(element?: KdbServerNode): Thenable<KdbServerNode[]> {
		if (!this.serverList) {
			return Promise.resolve([]);
		}

		return Promise.resolve(this.getChildElements(element));
	}

	private getChildElements(element?: KdbServerNode): KdbServerNode[] {
		const mode: string = vscode.workspace.getConfiguration().get("vscode-kdb-q.serverGroupMode") || "None";

		if (mode === "None") {
			// No grouped, so just return an array of tree items.
			return this.createLeafItems(this.serverList);
		}
		else if (mode === "Hostname") {
			// If no element was passed, default to root server list.
			let list = element?.children || this.serverList;

			// Group by first component of connection string (aka hostname).
			let grouped = this.groupBy(list, x => x.split(':')[0]);

			// If number of groups is one, just show that group.
			if (grouped.size === 1) {
				return this.createLeafItems(Array.from(grouped.values())[0]);
			}

			// Multiple groups available, so breakdown into collapsed nodes.
			let servers: KdbServerNode[] = [];
			grouped.forEach((v, k) => {
				return servers.push(new KdbServerNode(v, k, vscode.TreeItemCollapsibleState.Collapsed));
			});

			return servers;
		}

		return [];
	}

	private createLeafItems(servers: string[]) : KdbServerNode[] {
		return servers.map(x => new KdbServerNode(x.split(':'), x.split(':').slice(0, 2).join(':'), vscode.TreeItemCollapsibleState.None, {
			command: 'vscode-kdb-q.connectToServer',
			title: '',
			arguments: [x]
		}));
	}

	private groupBy<T>(list: Array<T>, callback: (x: T) => string) {
		const map = new Map<string, T[]>();

		list.forEach((item) => {
			 const key = callback(item);
			 const collection = map.get(key);

			 if (!collection) {
				 map.set(key, [item]);
			 }
			 else {
				 collection.push(item);
			 }
		});

		return map;
	}
}

export class KdbServerNode extends vscode.TreeItem {

	constructor(
		public readonly children: string[],
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
	}

	get description(): string {
		return this.collapsibleState === vscode.TreeItemCollapsibleState.None && this.children.length > 2
			? `${this.children[2]}:${'*'.repeat(this.children[3].length)}`
			: "";
	}

	iconPath = {
		light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
		dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
	};

	contextValue = 'dependency';
}
