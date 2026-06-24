import { Plugin, TFile } from 'obsidian';

const BLOCK_START = '%%dataview-graph-links';
const BLOCK_END = 'dataview-graph-links%%';
const BLOCK_REGEX = new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\n?`);
const QUERY_REGEX = /```dataview\n([\s\S]*?)```/g;
const FROM_REGEX = /FROM\s+([\s\S]+?)(?=\n(?:WHERE|SORT|LIMIT|GROUP|FLATTEN)\b|$)/i;

interface DataviewApi {
	pages(source?: string): { file: { path: string; name: string } }[];
}

export default class DataviewGraphSyncPlugin extends Plugin {
	private syncing = false;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	async onload() {
		// Wait for all plugins (including Dataview) to finish loading
		this.app.workspace.onLayoutReady(() => {
			setTimeout(() => this.syncAll(), 3000);
		});

		// Re-sync when files are added, removed, or renamed (new files may appear in query results)
		this.registerEvent(this.app.vault.on('create', () => this.scheduleSyncAll()));
		this.registerEvent(this.app.vault.on('delete', () => this.scheduleSyncAll()));
		this.registerEvent(this.app.vault.on('rename', () => this.scheduleSyncAll()));

		// Re-sync a specific file when its metadata changes (e.g. summary field filled in)
		// which could change query results elsewhere
		this.registerEvent(
			this.app.metadataCache.on('changed', () => this.scheduleSyncAll())
		);
	}

	private scheduleSyncAll() {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => this.syncAll(), 1500);
	}

	private getDataviewApi(): DataviewApi | null {
		return (this.app as any).plugins?.plugins?.['dataview']?.api ?? null;
	}

	async syncAll() {
		const dv = this.getDataviewApi();
		if (!dv) {
			console.warn('Dataview Graph Sync: Dataview plugin not found.');
			return;
		}
		for (const file of this.app.vault.getMarkdownFiles()) {
			await this.syncFile(file, dv);
		}
	}

	async syncFile(file: TFile, dv: DataviewApi) {
		// Skip our own writes
		if (this.syncing) return;

		const content = await this.app.vault.read(file);

		// Collect all FROM sources from every dataview block in this file
		const sources: string[] = [];
		let match: RegExpExecArray | null;
		QUERY_REGEX.lastIndex = 0;
		while ((match = QUERY_REGEX.exec(content)) !== null) {
			const source = this.extractSource(match[1]);
			if (source) sources.push(source);
		}

		// If no dataview blocks, remove any existing hidden block and bail
		if (sources.length === 0) {
			if (!BLOCK_REGEX.test(content)) return;
			await this.writeFile(file, content.replace(BLOCK_REGEX, ''));
			return;
		}

		// Resolve which files each query matches, excluding this file itself
		const linkedNames = new Set<string>();
		for (const source of sources) {
			try {
				dv.pages(source).forEach(page => {
					if (page.file.path !== file.path) {
						linkedNames.add(page.file.name.replace(/\.md$/, ''));
					}
				});
			} catch {
				// skip unparseable queries
			}
		}

		// Build the hidden block
		const links = [...linkedNames].map(name => `[[${name}]]`).join(' ');
		const newBlock = links ? `${BLOCK_START}\n${links}\n${BLOCK_END}` : '';

		// Patch the content
		let newContent: string;
		if (BLOCK_REGEX.test(content)) {
			newContent = newBlock
				? content.replace(BLOCK_REGEX, newBlock + '\n')
				: content.replace(BLOCK_REGEX, '');
		} else if (newBlock) {
			newContent = content.trimEnd() + '\n\n' + newBlock + '\n';
		} else {
			return;
		}

		if (newContent !== content) {
			await this.writeFile(file, newContent);
		}
	}

	private async writeFile(file: TFile, content: string) {
		this.syncing = true;
		try {
			await this.app.vault.modify(file, content);
		} finally {
			this.syncing = false;
		}
	}

	private extractSource(query: string): string | null {
		const match = query.match(FROM_REGEX);
		return match ? match[1].trim() : null;
	}
}
