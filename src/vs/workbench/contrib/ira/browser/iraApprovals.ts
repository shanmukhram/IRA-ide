/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

export interface IIraApprovalItem {
	id: string;
	title: string;
	details?: string;
	createdAt: number;
	status: 'pending' | 'approved' | 'rejected';
}

export const IRA_APPROVALS_STORAGE_KEY = 'ira.approvals.items';

export class IraApprovalsService extends Disposable {
	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();
		const store = this._register(new DisposableStore());
		this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, IRA_APPROVALS_STORAGE_KEY, store)(() => {
			this._onDidChange.fire();
		}));
	}

	getItems(): IIraApprovalItem[] {
		const raw = this.storageService.get(IRA_APPROVALS_STORAGE_KEY, StorageScope.PROFILE, '[]');
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	setItems(items: IIraApprovalItem[]): void {
		this.storageService.store(IRA_APPROVALS_STORAGE_KEY, JSON.stringify(items), StorageScope.PROFILE, StorageTarget.USER);
		this._onDidChange.fire();
	}

	add(title: string, details?: string): IIraApprovalItem {
		const items = this.getItems();
		const item: IIraApprovalItem = {
			id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
			title,
			details,
			createdAt: Date.now(),
			status: 'pending'
		};
		items.unshift(item);
		this.setItems(items);
		return item;
	}

	updateStatus(id: string, status: 'approved' | 'rejected'): void {
		const items = this.getItems();
		const idx = items.findIndex(i => i.id === id);
		if (idx === -1) {
			return;
		}
		items[idx] = { ...items[idx], status };
		this.setItems(items);
	}

	clear(): void {
		this.setItems([]);
	}
}
